'use strict';

// Локальная модель для всех (владелец 05.10): компьютер привязан к аккаунту и сам забирает задания.
// Время и таймеры подменены — проверяется логика посредника, без сети.

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../server-local-ai-v1.js');

function clock() {
  let t = 1_000_000; const q = [];
  return {
    now: () => t,
    timers: { set: (fn, ms) => { const h = { at: t + ms, fn }; q.push(h); return h; }, clear: (h) => { const i = q.indexOf(h); if (i >= 0) q.splice(i, 1); } },
    tick(ms) { t += ms; for (;;) { q.sort((a, b) => a.at - b.at); const h = q[0]; if (!h || h.at > t) break; q.shift(); h.fn(); } },
  };
}
function setup() {
  const c = clock(), disk = new Map(); let n = 0;
  const relay = L.create({ now: c.now, timers: c.timers, random: (k) => Buffer.alloc(k, ++n),
    readStore: (uid) => (disk.has(uid) ? JSON.parse(disk.get(uid)) : null), writeStore: (uid, v) => disk.set(uid, JSON.stringify(v)) });
  return { c, disk, relay };
}
const TAGS = { models: [
  { name: 'qwen3.5:9b-mlx', size: 8.9e9, capabilities: ['completion', 'vision', 'thinking'], details: { format: 'safetensors' } },
  { name: 'qwen3.5:2b', size: 2.7e9, capabilities: ['completion'], details: { format: 'gguf', parameter_size: '2B' } },
  { name: 'gpt-oss:120b-cloud', size: 384, capabilities: ['completion'], remote_host: 'https://ollama.com:443', remote_model: 'gpt-oss:120b' },
  { name: 'deepseek-v3.1:671b-cloud', size: 1, capabilities: ['completion'] },
  { name: 'nomic-embed-text:latest', size: 2.7e8, capabilities: ['embedding'], details: { format: 'gguf' } },
  { name: 'odd:1b', size: 1e9, details: { format: 'ggml' } },
  { name: 'bad name with spaces', size: 1 },
] };
function connect(relay, uid, name) {
  const { code } = relay.startPairing(uid);
  const { token } = relay.pair(code, { name, platform: 'macos' });
  const auth = relay.authenticate(token);
  relay.hello(auth, TAGS);
  return { token, auth: relay.authenticate(token) };
}
// Коннектор: ждёт задание и сразу отвечает моделью.
function poll(relay, token) {
  const got = {};
  relay.next(relay.authenticate(token), (status, payload, id) => Object.assign(got, { status, payload, id }));
  return got;
}
const ollamaOk = (text) => JSON.stringify({ model: 'qwen3.5:9b-mlx', message: { role: 'assistant', content: text }, done: true, done_reason: 'stop', prompt_eval_count: 30, eval_count: 5 });

test('only local chat models are offered; cloud aliases and embeddings never are', () => {
  assert.deepEqual(L.localModels(TAGS).map((m) => [m.name, m.vision]), [['qwen3.5:9b-mlx', true], ['qwen3.5:2b', false]]);
  assert.deepEqual(L.localModels(null), []);
});

test('request body: system first, no thinking, context sized to the talk, photo on the last message', () => {
  const p = L.payloadFor('m', 'SYS', [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }], 500, ['IMG']);
  assert.equal(p.stream, false); assert.equal(p.think, false);
  assert.deepEqual(p.messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
  assert.deepEqual(p.messages[3].images, ['IMG']); assert.equal(p.messages[1].images, undefined);
  assert.equal(p.options.num_ctx, 8192, 'a photo gets its own room in the context'); assert.equal(p.options.num_predict, 500);
  assert.equal(L.payloadFor('m', 'SYS', [{ role: 'user', content: 'a' }], 500).options.num_ctx, 4096);
  assert.equal(L.payloadFor('m', 'x'.repeat(40000), [{ role: 'user', content: 'q' }], 1500).options.num_ctx, 32768);
  assert.equal(L.payloadFor('m', 'x'.repeat(70000), [{ role: 'user', content: 'q' }]).error, 'context_too_large');
  assert.equal(L.payloadFor('m', 'x', []).error, 'empty');
});

test('model answers: thinking tags removed, errors and empty answers are honest failures', () => {
  assert.equal(L.readAnswer(200, ollamaOk('<think>hmm</think> Привет')).text, 'Привет');
  assert.equal(L.readAnswer(404, JSON.stringify({ error: "model 'x' not found" })).message, "model 'x' not found");
  assert.equal(L.readAnswer(0, '').reason, 'model_error');
  assert.equal(L.readAnswer(200, JSON.stringify({ done: true, message: { content: '  ' } })).reason, 'invalid_response');
});

test('pairing: one-time code that expires; the device key works until revoked', () => {
  const { c, relay, disk } = setup();
  const { code, expiresAt } = relay.startPairing('albert');
  assert.match(code, /^sp1\./); assert.ok(Date.parse(expiresAt) > c.now());
  const first = relay.pair(code, { name: 'Edith <b>', platform: 'macos' });
  assert.match(first.token, /^sd1\./);
  assert.deepEqual(relay.pair(code, { name: 'again' }), { error: 'bad_code' }, 'single use');
  assert.equal(relay.authenticate(first.token).device.name, 'Edith b');
  assert.equal(relay.authenticate(first.token.slice(0, -2) + 'xx'), null, 'wrong secret');
  assert.doesNotMatch(disk.get('albert'), new RegExp(first.token.split('.')[3]), 'only a hash is stored');
  const late = relay.startPairing('albert').code; c.tick(L.PAIR_TTL_MS + 1);
  assert.deepEqual(relay.pair(late, {}), { error: 'bad_code' }, 'expired');
  assert.deepEqual(relay.pair('sp1.' + Buffer.from('nobody').toString('base64url') + '.x', {}), { error: 'bad_code' });
  relay.revoke('albert', first.deviceId);
  assert.equal(relay.authenticate(first.token), null);
});

test('a request reaches the connector, the model answers, the app gets the text', async () => {
  const { relay } = setup();
  const edith = connect(relay, 'albert', 'Edith');
  assert.equal(relay.status('albert').devices[0].model, 'qwen3.5:9b-mlx', 'the largest installed local model is picked first');
  const got = poll(relay, edith.token);
  const answer = relay.complete('albert', 'SYS', [{ role: 'user', content: 'Привет' }], 300);
  assert.equal(got.status, 200); assert.equal(got.payload.model, 'qwen3.5:9b-mlx'); assert.ok(got.id);
  assert.equal(relay.result(edith.auth, got.id, 200, ollamaOk('Привет!')), true);
  assert.deepEqual(await answer, { ok: true, text: 'Привет!', tokens: 35, truncated: false, provider: 'ollama', source: 'local', device: 'Edith', model: 'qwen3.5:9b-mlx' });
  assert.equal(relay.result(edith.auth, got.id, 200, ollamaOk('again')), false, 'a job is answered once');
});

test('Edith asleep → Jarvis answers; nobody awake → a clear offline error, no cloud fallback', async () => {
  const { c, relay } = setup();
  const edith = connect(relay, 'albert', 'Edith'), jarvis = connect(relay, 'albert', 'Jarvis');
  relay.update('albert', { id: jarvis.auth.device.id, model: 'qwen3.5:2b' });
  c.tick(L.ONLINE_MS + 1);                                     // оба давно не спрашивали
  assert.equal((await relay.complete('albert', 's', [{ role: 'user', content: 'q' }])).reason, 'offline');
  const j = poll(relay, jarvis.token);                         // Jarvis в сети, Edith спит
  const pending = relay.complete('albert', 's', [{ role: 'user', content: 'q' }]);
  assert.equal(j.payload.model, 'qwen3.5:2b');
  relay.result(jarvis.auth, j.id, 200, ollamaOk('jarvis'));
  assert.equal((await pending).device, 'Jarvis');
  const e = poll(relay, edith.token);                          // Edith проснулась — она первая
  const next = relay.complete('albert', 's', [{ role: 'user', content: 'q' }]);
  assert.equal(e.status, 200);
  relay.result(edith.auth, e.id, 200, ollamaOk('edith'));
  assert.equal((await next).device, 'Edith');
  relay.update('albert', { id: jarvis.auth.device.id, primary: true });
  assert.deepEqual(relay.status('albert').devices.map((d) => d.name), ['Jarvis', 'Edith']);
});

test('a computer that fell asleep after the last poll does not hang the app', async () => {
  const { c, relay } = setup();
  const edith = connect(relay, 'albert', 'Edith');
  const pending = relay.complete('albert', 's', [{ role: 'user', content: 'q' }]); // ещё «в сети», но опроса нет
  c.tick(L.PICKUP_MS + 1);
  assert.equal((await pending).reason, 'offline');
  const got = poll(relay, edith.token);
  const slow = relay.complete('albert', 's', [{ role: 'user', content: 'q' }]);
  assert.equal(got.status, 200);
  assert.equal(relay.ack(edith.auth, got.id), true, 'the computer took the job; the model is just slow');
  c.tick(L.JOB_MS + 1);
  assert.equal((await slow).reason, 'timeout');
});

test('busy, interrupted and revoked jobs end with a reason; long polls end with 204', async () => {
  const { c, relay } = setup();
  const edith = connect(relay, 'albert', 'Edith');
  const idle = poll(relay, edith.token); c.tick(L.POLL_MS + 1);
  assert.equal(idle.status, 204);
  const first = poll(relay, edith.token);
  const jobs = [1, 2, 3].map(() => relay.complete('albert', 's', [{ role: 'user', content: 'q' }]));
  assert.equal((await relay.complete('albert', 's', [{ role: 'user', content: 'q' }])).reason, 'busy');
  assert.equal(first.status, 200);
  const second = poll(relay, edith.token);                    // коннектор перезапустился посреди задания
  assert.equal((await jobs[0]).reason, 'interrupted');
  assert.equal(second.status, 200, 'the next job goes out at once');
  relay.revoke('albert', edith.auth.device.id);
  assert.equal((await jobs[1]).reason, 'revoked'); assert.equal((await jobs[2]).reason, 'revoked');
});

test('photos go only to a model that sees; a missing model is named', async () => {
  const { relay } = setup();
  const edith = connect(relay, 'albert', 'Edith');
  relay.update('albert', { id: edith.auth.device.id, model: 'qwen3.5:2b' });
  poll(relay, edith.token);
  const r = await relay.complete('albert', 's', [{ role: 'user', content: 'q' }], 100, { images: ['IMG'] });
  assert.equal(r.error, 'vision_unavailable');
  assert.deepEqual(relay.update('albert', { id: edith.auth.device.id, model: 'gpt-oss:120b-cloud' }), { error: 'bad_model' }, 'a cloud alias cannot be chosen');
  relay.hello(relay.authenticate(edith.token), { models: [] });
  assert.equal((await relay.complete('albert', 's', [{ role: 'user', content: 'q' }])).reason, 'model_missing');
  assert.equal((await setup().relay.complete('nobody', 's', [{ role: 'user', content: 'q' }])).reason, 'not_paired');
});

test('at most five computers per account', () => {
  const { relay } = setup();
  for (let i = 0; i < L.MAX_DEVICES; i++) connect(relay, 'albert', 'pc' + i);
  assert.deepEqual(relay.startPairing('albert'), { error: 'too_many_devices' });
});

test('an open poll from a computer that fell asleep does not swallow the request: no acknowledgement → next computer', async () => {
  const { c, relay } = setup();
  const edith = connect(relay, 'albert', 'Edith'), jarvis = connect(relay, 'albert', 'Jarvis');
  const e = poll(relay, edith.token);                 // ожидание Edith открыто, а Mac уже уснул
  const j = poll(relay, jarvis.token);
  const pending = relay.complete('albert', 's', [{ role: 'user', content: 'q' }]);
  assert.equal(e.status, 200, 'sent into the sleeping connection first');
  c.tick(L.ACK_MS + 1);
  await new Promise(setImmediate);
  assert.equal(j.status, 200, 'then handed to Jarvis');
  assert.equal(relay.ack(jarvis.auth, j.id), true);
  relay.result(jarvis.auth, j.id, 200, ollamaOk('jarvis'));
  assert.equal((await pending).device, 'Jarvis');
  assert.equal(relay.ack(edith.auth, e.id), false, 'a late acknowledgement is refused, so Edith skips the job');
  const solo = setup(), one = connect(solo.relay, 'u', 'Edith'), first = poll(solo.relay, one.token);
  const lone = solo.relay.complete('u', 's', [{ role: 'user', content: 'q' }]);
  assert.equal(first.status, 200);
  solo.c.tick(L.ACK_MS + 1);
  assert.equal((await lone).reason, 'offline', 'alone and asleep: offline after seconds, not minutes');
});
