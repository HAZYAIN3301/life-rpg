'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

function cutFunction(source, name) {
  const asyncAt = source.indexOf(`async function ${name}(`);
  const start = asyncAt >= 0 ? asyncAt : source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (!depth) return source.slice(start, i + 1); }
  }
  throw new Error(`unclosed ${name}`);
}

function buildClassifier() {
  return new Function(`${cutFunction(SERVER, 'assistantRequestNeedsDeliberation')}\nreturn assistantRequestNeedsDeliberation;`)();
}

function buildAssistantComplete(mockComplete) {
  const source = `${cutFunction(SERVER, 'assistantRequestNeedsDeliberation')}\n${cutFunction(SERVER, 'aiCompleteAssistantChatForUser')}\nreturn aiCompleteAssistantChatForUser;`;
  return new Function('aiCompleteChatForUser', source)(mockComplete);
}

test('long personal reflection enters deliberation while a short reversible command stays fast', () => {
  const classify = buildClassifier();
  const reflection = 'Мне нужно детально разобрать ситуацию и прийти к итоговым решениям. ' + 'Нет ясного конца работы, отдыха и обратной связи. '.repeat(35);
  assert.equal(classify([{ role: 'user', content: reflection }]), true);
  assert.equal(classify([{ role: 'user', content: 'ну переведи выбранные цели в архив' }]), false);
  assert.equal(classify([{ role: 'user', content: 'Как работает энергия?' }]), false);
});

test('a decision follow-up inherits depth from the previous long reflection', () => {
  const classify = buildClassifier();
  const history = [
    { role: 'user', content: 'Я описываю всю ситуацию. '.repeat(90) },
    { role: 'assistant', content: 'Уточню главное.' },
    { role: 'user', content: 'Какой итог и что делать сегодня?' },
  ];
  assert.equal(classify(history), true);
});

test('deep chat builds a private decision brief and then a separately verified answer', async () => {
  const calls = [];
  const complete = buildAssistantComplete(async (_user, provider, system, messages, purpose) => {
    calls.push({ provider, system, messages, purpose });
    if (calls.length === 1) return { ok: true, text: 'Факты; гипотезы; рычаг.', provider: 'anthropic', source: 'house' };
    return { ok: true, text: 'Итоговый ответ человеку.', provider: 'anthropic', source: 'house' };
  });
  const messages = [{ role: 'user', content: 'Нужно подробно разобраться и принять решение. '.repeat(40) }];
  const result = await complete({ id: 'u1' }, null, 'BASE_SYSTEM', messages);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].purpose, 'deliberation');
  assert.match(calls[0].system, /редакторское досье/);
  assert.match(calls[0].system, /не создавай ACTIONS/);
  assert.equal(calls[1].provider, 'anthropic');
  assert.equal(calls[1].purpose, 'deliberation');
  assert.match(calls[1].system, /DECISION_BRIEF=/);
  assert.match(calls[1].system, /Факты; гипотезы; рычаг/);
  assert.match(calls[1].system, /сверь каждое утверждение с исходным сообщением/);
  assert.equal(calls[1].messages, messages);
  assert.equal(result.text, 'Итоговый ответ человеку.');
  assert.equal(result.deliberated, true);
  assert.doesNotMatch(result.text, /Факты; гипотезы/);
});

test('simple chat remains a single provider completion', async () => {
  let calls = 0;
  const complete = buildAssistantComplete(async () => { calls += 1; return { ok: true, text: 'Короткий ответ.' }; });
  const result = await complete({ id: 'u1' }, 'gemini', 'BASE_SYSTEM', [{ role: 'user', content: 'Как работает энергия?' }]);
  assert.equal(calls, 1);
  assert.equal(result.text, 'Короткий ответ.');
  assert.equal(result.deliberated, undefined);
});

test('house deliberation provider is purpose-scoped and falls back when its key is absent', () => {
  const providers = { gemini: {}, groq: {}, anthropic: {}, openai: {} };
  const keys = { gemini: 'gem-key', anthropic: 'claude-key' };
  const build = (env) => new Function('AI_PROVIDERS', 'houseKeyFor', 'process', `${cutFunction(SERVER, 'houseProvider')}\nreturn houseProvider;`)(
    providers,
    (id) => keys[id] || '',
    { env },
  );
  assert.equal(build({ AI_HOUSE_PROVIDER: 'gemini', AI_HOUSE_DELIBERATION_PROVIDER: 'anthropic' })('deliberation'), 'anthropic');
  assert.equal(build({ AI_HOUSE_PROVIDER: 'gemini', AI_HOUSE_DELIBERATION_PROVIDER: 'openai' })('deliberation'), 'gemini');
  assert.equal(build({ AI_HOUSE_PROVIDER: 'gemini', AI_HOUSE_DELIBERATION_PROVIDER: 'anthropic' })(), 'gemini');
});

test('assistant prompt rejects parroting, unsupported diagnosis and false brevity', () => {
  const manualAt = APP.indexOf('const GOJO_MANUAL');
  const manual = APP.slice(manualAt, APP.indexOf('const CHAT_SUGGESTIONS', manualAt));
  assert.match(manual, /Большая рефлексия[\s\S]*требует настоящего разбора/);
  assert.match(manual, /не повторяй их как будто это твой новый вывод/);
  assert.match(manual, /Не соглашайся автоматически/);
  assert.match(manual, /не ставь клинических\/психологических диагнозов/);
  assert.match(manual, /не вместо анализа/);
  assert.doesNotMatch(manual, /предложи ОДИН маленький шаг/);
  assert.match(SERVER, /AI_HOUSE_DELIBERATION_PROVIDER/);
  assert.match(SERVER, /aiCompleteAssistantChatForUser\(user, provider, system, messages\)/);
});
