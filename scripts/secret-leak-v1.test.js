'use strict';
/* Секреты не должны покидать сервер даже частично.
 *
 * Найдено при аудите: когда у человека нет своего ИИ-ключа, работает ДОМАШНИЙ ключ владельца.
 * Если провайдер в этот момент вернёт ошибку авторизации, его текст уходил клиенту дословно —
 * а провайдеры в таких ошибках показывают ключ частично («Incorrect API key provided:
 * sk-...XYZ»). То есть чужой секрет утекал любому, кто нарвался на сбой.
 *
 * Правило, которое здесь стережётся: чей ключ сломался, тот и видит подробности. На своём
 * ключе текст провайдера полезен и безопасен, на домашнем — это чужой секрет.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function fnSource(name) {
  const start = SERVER.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} должна существовать`);
  const brace = SERVER.indexOf('{', start); let depth = 0;
  for (let i = brace; i < SERVER.length; i += 1) {
    if (SERVER[i] === '{') depth += 1;
    else if (SERVER[i] === '}' && --depth === 0) return SERVER.slice(start, i + 1);
  }
  throw new Error(`не закрыта ${name}`);
}

test('scrubSecrets вырезает ключи всех провайдеров, которыми мы пользуемся', () => {
  const shapes = SERVER.match(/const SECRET_SHAPES = \[[\s\S]*?\];/);
  assert.ok(shapes, 'список форм ключей не найден');
  const box = {};
  vm.createContext(box);
  vm.runInContext(shapes[0] + '\n' + fnSource('scrubSecrets') + '\nglobalThis.scrub = scrubSecrets;', box);

  const cases = [
    ['Incorrect API key provided: sk-proj-abc123DEF456ghi789', 'sk-proj-abc123DEF456ghi789'],
    ['API key not valid: AIzaSyD-fake-key-000111222', 'AIzaSyD-fake-key-000111222'],
    ['invalid api key gsk_abcdef0123456789', 'gsk_abcdef0123456789'],
    ['Authorization: Bearer re_abcdef0123456789xyz', 're_abcdef0123456789xyz'],
  ];
  for (const [text, secret] of cases) {
    const out = box.scrub(text);
    assert.equal(out.includes(secret), false, `не вырезано: ${secret}`);
    assert.match(out, /\[скрыто\]/);
  }
  // Обычный текст ошибки не портится — подсказка должна остаться читаемой.
  assert.equal(box.scrub('rate limit exceeded, retry in 20s'), 'rate limit exceeded, retry in 20s');
  assert.equal(box.scrub(null), '');
});

test('на домашнем ключе подробности провайдера наружу не уходят', () => {
  const body = fnSource('aiErr');
  // Ключевое различие: detail отдаётся только когда ключ СВОЙ.
  assert.match(body, /const own = r\.source && r\.source !== 'house'/);
  assert.match(body, /own[\s\S]*detail: scrubSecrets\(r\.detail\)/, 'detail уходит без различия чей ключ');
  assert.match(body, /\{ error: 'provider', status: r\.status \}/, 'на домашнем ключе должен уходить только код');
  // И даже своему — только после чистки.
  assert.doesNotMatch(body, /detail: r\.detail\b/, 'detail отдаётся сырым');
});

test('внутренности сбоя не подставляются в ответ клиенту', () => {
  // Раньше три обработчика ИИ отвечали текстом исключения: там оказываются адреса, таймауты
  // и имена хостов. Клиенту нужен стабильный код, подробность — в логи.
  assert.doesNotMatch(SERVER, /sendJson\(res, 502, \{ error: String\(e\.message/);
  const chatStart = SERVER.indexOf("u === '/api/ai/chat'");
  const chat = SERVER.slice(chatStart, SERVER.indexOf("\n  if (", chatStart + 1));
  assert.match(chat, /error: 'provider_unavailable'/);
  assert.match(chat, /console\.error\('\[ai\]', scrubSecrets/);
});
