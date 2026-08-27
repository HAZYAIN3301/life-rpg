'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

function cutFunction(name) {
  const asyncAt = SERVER.indexOf(`async function ${name}(`);
  const start = asyncAt >= 0 ? asyncAt : SERVER.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  let depth = 0;
  for (let i = SERVER.indexOf('{', start); i < SERVER.length; i += 1) {
    if (SERVER[i] === '{') depth += 1;
    else if (SERVER[i] === '}') { depth -= 1; if (!depth) return SERVER.slice(start, i + 1); }
  }
  throw new Error(`unclosed ${name}`);
}

function buildChatComplete(mockCall) {
  const src = `${cutFunction('assistantReplyLooksIncomplete')}\n${cutFunction('aiCompleteChatForUser')}\nreturn aiCompleteChatForUser;`;
  return new Function('aiCallForUser', src)(mockCall);
}

test('clear provider reply is returned once without a speculative retry', async () => {
  let calls = 0;
  const complete = buildChatComplete(async () => { calls += 1; return { ok: true, text: 'Готовый ответ.', truncated: false, provider: 'gemini' }; });
  const result = await complete({ id: 'u1' }, 'gemini', 'system', [{ role: 'user', content: 'question' }]);
  assert.equal(calls, 1);
  assert.equal(result.text, 'Готовый ответ.');
});

test('provider truncation triggers one full bounded rewrite, not a stitched fragment', async () => {
  const calls = [];
  const complete = buildChatComplete(async (_user, provider, system, messages, maxTokens) => {
    calls.push({ provider, system, messages, maxTokens });
    if (calls.length === 1) return { ok: true, text: '1. Готово\n2. **', truncated: true, provider: 'gemini', source: 'house' };
    return { ok: true, text: 'Цельный короткий ответ без оборванного списка.', truncated: false, provider: 'gemini', source: 'house' };
  });
  const result = await complete({ id: 'u1' }, null, 'system', [{ role: 'user', content: 'long question' }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].maxTokens, 4000);
  assert.equal(calls[1].maxTokens, 4000);
  assert.equal(calls[1].provider, 'gemini');
  assert.match(calls[1].system, /ЗАНОВО ЦЕЛИКОМ/);
  assert.equal(result.text, 'Цельный короткий ответ без оборванного списка.');
  assert.equal(result.recoveredFromTruncation, true);
  assert.doesNotMatch(result.text, /1\. Готово/);
});

test('obviously open Markdown triggers recovery even if provider claimed STOP', async () => {
  let calls = 0;
  const complete = buildChatComplete(async () => {
    calls += 1;
    return calls === 1
      ? { ok: true, text: '```json\n{"x":1', truncated: false, provider: 'openai' }
      : { ok: true, text: 'Код не нужен. Вот законченный ответ.', truncated: false, provider: 'openai' };
  });
  const result = await complete({ id: 'u1' }, 'openai', 'system', [{ role: 'user', content: 'question' }]);
  assert.equal(calls, 2);
  assert.equal(result.recoveredFromTruncation, true);
});

test('a second broken attempt fails closed and the client explains it in every locale', async () => {
  const complete = buildChatComplete(async () => ({ ok: true, text: '2. **', truncated: true, provider: 'gemini', source: 'house' }));
  const result = await complete({ id: 'u1' }, 'gemini', 'system', [{ role: 'user', content: 'question' }]);
  assert.equal(result.ok, false);
  assert.equal(result.incomplete, true);
  assert.equal(result.detail, 'incomplete_response');
  assert.match(SERVER, /r\.incomplete[\s\S]{0,160}incomplete_response/);
  const key = 'Ответ дважды оборвался у ИИ-провайдера. Я не показываю обрывок как готовый совет — повтори запрос.';
  assert.match(APP, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const row = APP.slice(APP.indexOf(`'${key}'`), APP.indexOf(`'${key}'`) + 1000);
  for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(row, new RegExp(locale));
  assert.match(APP, /d\.error === 'incomplete_response'/);
});
