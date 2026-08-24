'use strict';
/* Gemini отвечает HTTP 200 даже когда контент заблокирован сейфти-фильтром или на уровне
 * промпта — candidates либо пуст, либо без content. Раньше это читалось как «успех с пустым
 * текстом»: extractJson('') просто возвращал null, юзер видел «Не разобрал» без единой
 * зацепки, а в логах не оставалось вообще ничего.
 *
 * Поймано на реальном случае: Альберт наговорил «Эпизод» голосом (после отпуска — период
 * без записей), в тексте оказалась ASR-мисхир обсценной лексика («отсылка на суку»), и
 * house-провайдер (Gemini — первый в порядке `houseProvider()`) молча вернул пустоту.
 *
 * Тест гоняет НАСТОЯЩИЙ код `aiCompleteMessages`, вырезанный из server.js по балансу скобок —
 * не переписанный здесь, — с подменённым `httpsPostJson`, чтобы не бить по сети реальным
 * ключом. Так же вырезан `AI_PROVIDERS`, от которого функция берёт shape/host/model.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function cutConst(name) {
  const start = SERVER.indexOf(`const ${name} = {`);
  assert.ok(start >= 0, `не нашёл const ${name} — server.js переписали, тест надо чинить`);
  let depth = 0;
  for (let i = SERVER.indexOf('{', start); i < SERVER.length; i += 1) {
    if (SERVER[i] === '{') depth += 1;
    else if (SERVER[i] === '}') { depth -= 1; if (!depth) return SERVER.slice(start, i + 2); }
  }
  throw new Error(`не закрылась const ${name}`);
}
function cutFunction(name) {
  const asyncIdx = SERVER.indexOf(`async function ${name}(`);
  const start = asyncIdx >= 0 ? asyncIdx : SERVER.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `не нашёл function ${name} — server.js переписали, тест надо чинить`);
  let depth = 0;
  for (let i = SERVER.indexOf('{', start); i < SERVER.length; i += 1) {
    if (SERVER[i] === '{') depth += 1;
    else if (SERVER[i] === '}') { depth -= 1; if (!depth) return SERVER.slice(start, i + 1); }
  }
  throw new Error(`не закрылась function ${name}`);
}

// Строим aiCompleteMessages в изолированной области видимости, где httpsPostJson — наш мок,
// а не настоящий сетевой вызов. Функция обращается к httpsPostJson и AI_PROVIDERS как к
// свободным переменным — JS резолвит их из объемлющей области, ровно как обычное require.
function buildAiCompleteMessages(mockHttpsPostJson) {
  const src = `${cutConst('AI_PROVIDERS')}\n${cutFunction('aiCompleteMessages')}\nreturn aiCompleteMessages;`;
  const factory = new Function('httpsPostJson', src);
  return factory(mockHttpsPostJson);
}

const KEYS = { gemini: 'test-key' };

test('заблокированный кандидат (SAFETY) не читается как успех с пустым текстом', async () => {
  const aiCompleteMessages = buildAiCompleteMessages(async () => ({
    status: 200,
    json: { candidates: [{ finishReason: 'SAFETY', index: 0, safetyRatings: [] }] },
  }));
  const r = await aiCompleteMessages('gemini', KEYS, 'sys', [{ role: 'user', content: 'привет' }], 2000);
  assert.equal(r.ok, false, 'заблокированный ответ должен провалиться, а не притвориться успехом');
  assert.match(r.detail, /SAFETY/);
});

test('блок на уровне промпта (promptFeedback.blockReason, candidates вовсе нет)', async () => {
  const aiCompleteMessages = buildAiCompleteMessages(async () => ({
    status: 200,
    json: { promptFeedback: { blockReason: 'SAFETY', safetyRatings: [] } },
  }));
  const r = await aiCompleteMessages('gemini', KEYS, 'sys', [{ role: 'user', content: 'что угодно' }], 2000);
  assert.equal(r.ok, false);
  assert.match(r.detail, /SAFETY/);
});

test('обычный успешный ответ Gemini по-прежнему проходит (не регрессия)', async () => {
  const aiCompleteMessages = buildAiCompleteMessages(async () => ({
    status: 200,
    json: {
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"proposals":[{"sphere":"Здоровье","intensity":3,"why":"плавал много"}]}' }] } }],
      usageMetadata: { totalTokenCount: 42 },
    },
  }));
  const r = await aiCompleteMessages('gemini', KEYS, 'sys', [{ role: 'user', content: 'рассказ' }], 2000);
  assert.equal(r.ok, true);
  assert.match(r.text, /"sphere":"Здоровье"/);
  assert.equal(r.tokens, 42);
});

test('MAX_TOKENS с частичным текстом — не блок, а урезанный успех', async () => {
  const aiCompleteMessages = buildAiCompleteMessages(async () => ({
    status: 200,
    json: {
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"proposals":[' }] } }],
      usageMetadata: { totalTokenCount: 2000 },
    },
  }));
  const r = await aiCompleteMessages('gemini', KEYS, 'sys', [{ role: 'user', content: 'длинный рассказ' }], 2000);
  assert.equal(r.ok, true, 'урезанный, но непустой текст не должен считаться блоком');
  assert.equal(r.text, '{"proposals":[');
});

test('HTTP-ошибка провайдера (не 200) обрабатывается как раньше', async () => {
  const aiCompleteMessages = buildAiCompleteMessages(async () => ({
    status: 429,
    json: { error: { message: 'rate limited' } },
  }));
  const r = await aiCompleteMessages('gemini', KEYS, 'sys', [{ role: 'user', content: 'x' }], 2000);
  assert.equal(r.ok, false);
  assert.equal(r.status, 429);
  assert.equal(r.detail, 'rate limited');
});
