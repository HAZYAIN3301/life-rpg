'use strict';
// R04C: ИИ-запрос — таймаут, отмена и поздний ответ завершаются ровно одним статусом.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public/ai-request-v1.js');

function manualTimers() {
  const timers = new Map(); let id = 0;
  return {
    set: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clear: (key) => { timers.delete(key); },
    fire: () => { for (const [key, t] of [...timers]) { timers.delete(key); t.fn(); } },
    size: () => timers.size,
    lastMs: () => [...timers.values()].pop()?.ms,
  };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('a normal answer resolves done and clears its timer', async () => {
  const timers = manualTimers();
  const req = A.create({ timeoutMs: 5000, setTimer: timers.set, clearTimer: timers.clear });
  const out = await req.run(async (signal) => { assert.ok(signal, 'fetch receives an AbortSignal'); return 'text'; });
  assert.deepEqual(out, { status: 'done', value: 'text' });
  assert.equal(timers.size(), 0);
  assert.equal(req.status, 'done');
});

test('timeout aborts the request and a late answer is never delivered', async () => {
  const timers = manualTimers(), gate = deferred(); let aborted = false;
  const req = A.create({ timeoutMs: 5000, setTimer: timers.set, clearTimer: timers.clear });
  const running = req.run((signal) => { signal.addEventListener('abort', () => { aborted = true; }); return gate.promise; });
  assert.equal(timers.lastMs(), 5000);
  timers.fire();
  assert.equal(aborted, true);
  gate.resolve('late text');
  assert.deepEqual(await running, { status: 'timeout', late: true });
  assert.equal(req.cancel(), false, 'a settled request cannot change status');
});

test('cancel aborts and the rejected fetch is reported as cancelled, not as an error', async () => {
  const timers = manualTimers(), gate = deferred();
  const req = A.create({ setTimer: timers.set, clearTimer: timers.clear });
  const running = req.run((signal) => { signal.addEventListener('abort', () => gate.reject(new Error('AbortError'))); return gate.promise; });
  assert.equal(req.cancel(), true);
  assert.deepEqual(await running, { status: 'cancelled', late: false });
  assert.equal(timers.size(), 0);
});

test('a response for a closed dialog, another account or a newer request is stale', async () => {
  let current = true; const gate = deferred();
  const req = A.create({ isCurrent: () => current });
  const running = req.run(() => gate.promise);
  current = false; gate.resolve('someone else');
  assert.deepEqual(await running, { status: 'stale' });
  assert.equal(req.signal.aborted, true);
});

test('network failure is an error only while the request is still current', async () => {
  const failed = await A.create().run(async () => { throw new Error('offline'); });
  assert.equal(failed.status, 'error');
  assert.equal(failed.error.message, 'offline');
  const stale = await A.create({ isCurrent: () => false }).run(async () => { throw new Error('offline'); });
  assert.equal(stale.status, 'stale');
});

test('cancel before start, single run and timeout bounds', async () => {
  const req = A.create();
  req.cancel();
  let called = false;
  assert.deepEqual(await req.run(async () => { called = true; }), { status: 'cancelled' });
  assert.equal(called, false);
  await assert.rejects(() => req.run(async () => 1), /once/);
  assert.equal(A.create({ timeoutMs: 10 }).timeoutMs, A.MIN_TIMEOUT_MS);
  assert.equal(A.create({ timeoutMs: 1e9 }).timeoutMs, A.MAX_TIMEOUT_MS);
  assert.equal(A.create({ timeoutMs: 'x' }).timeoutMs, A.DEFAULT_TIMEOUT_MS);
});

// Сервер: настоящий httpsPostJson из server.js с подменённым https — замолчавший провайдер
// обрывается таймаутом простоя и отклоняет промис, а не висит.
test('server provider call rejects after the idle timeout instead of hanging', async () => {
  const fs = require('node:fs'), path = require('node:path'), { EventEmitter } = require('node:events');
  const SERVER = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = SERVER.indexOf('function httpsPostJson(');
  let depth = 0, end = -1;
  for (let i = SERVER.indexOf('{', start); i < SERVER.length; i += 1) {
    if (SERVER[i] === '{') depth += 1; else if (SERVER[i] === '}') { depth -= 1; if (!depth) { end = i + 1; break; } }
  }
  const limit = SERVER.match(/const AI_UPSTREAM_TIMEOUT_MS = (.+);/);
  assert.ok(limit, 'upstream timeout constant exists');
  let armed = null, destroyedWith = null;
  const https = { request: () => { const req = new EventEmitter(); req.setTimeout = (ms, fn) => { armed = { ms, fn }; }; req.destroy = (error) => { destroyedWith = error; req.emit('error', error); }; req.write = () => {}; req.end = () => {}; return req; } };
  const httpsPostJson = new Function('https', 'process', `const AI_UPSTREAM_TIMEOUT_MS = ${limit[1]};\n${SERVER.slice(start, end)}\nreturn httpsPostJson;`)(https, { env: {} });
  const pending = httpsPostJson('provider.test', '/v1', {}, { q: 1 });
  assert.equal(armed.ms, 120000, 'default idle timeout is two minutes');
  armed.fn();
  await assert.rejects(pending, (error) => error.code === 'AI_UPSTREAM_TIMEOUT');
  assert.equal(destroyedWith.code, 'AI_UPSTREAM_TIMEOUT');
  const custom = new Function('https', 'process', `const AI_UPSTREAM_TIMEOUT_MS = ${limit[1]};\n${SERVER.slice(start, end)}\nreturn httpsPostJson;`)(https, { env: { AI_UPSTREAM_TIMEOUT_MS: '1' } });
  custom('provider.test', '/v1', {}, {}).catch(() => {});
  assert.equal(armed.ms, 5000, 'configured timeout is bounded');
});
