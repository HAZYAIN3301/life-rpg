'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const Service = require('../server-secretary-next-moves-v1.js');
const Claims = require('../public/secretary-claim-v1.js');
const DAY = '2026-09-12', NOW = DAY + 'T22:00:00.000Z';
const clock = { now: NOW, today: DAY, offset: 0 };
const context = { lapse: null, activeSession: { active: false }, guide: { active: false }, firstValue: { pending: false } };
const capabilities = ['after-lapse-return', 'planned-start', 'evening-close'];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evening-push-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = uid => path.join(root, uid);
  let failWrites = false, seq = 0;
  const write = (name, value) => { fs.mkdirSync(directory('alice'), { recursive: true }); fs.writeFileSync(path.join(directory('alice'), name + '.json'), JSON.stringify(value)); };
  const read = name => JSON.parse(fs.readFileSync(path.join(directory('alice'), name + '.json'), 'utf8'));
  const create = () => Service.createService({ userDir: directory, durableWrite: (file, value) => {
    if (failWrites) throw new Error('synthetic write refusal');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value));
  } });
  const service = create();
  write('tasks', []); write('habits', []); write('habitlog', {}); write('days', {});
  write('settings', { secretary: { configured: true, dailyReminder: true, eveningTime: '22:00' } });
  const body = (op, extra) => ({ op, clientId: 'tab-a', requestId: 'r' + ++seq, context, supportedCapabilities: capabilities, ...extra });
  const call = (intent, current = clock, owner = 'alice', engine = service) => engine.transact(owner, intent, current);
  return { root, write, read, service, create, body, call, fail: value => { failWrites = value; } };
}
function browserClaim(f, clientId = 'tab-a') {
  const decision = f.call(f.body('decide', { clientId })); assert.ok(decision.body.offer);
  const intent = f.body('claim', { clientId, offerId: decision.body.offer.offerId });
  const claimed = f.call(intent); assert.equal(claimed.status, 200);
  return { ...claimed.body, intent };
}
function tick(f, send) {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const code = source.slice(source.indexOf('async function pushTick() {'), source.indexOf('\n// ИИ BYOK:'));
  const user = { id: 'alice', push: { endpoint: 'https://synthetic.invalid', tz: 'UTC' } };
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return Date.parse(NOW); } }
  const env = { Date: ClockDate, loadUsers: () => [user], saveUsers: () => {}, userLocalParts: () => ({ date: DAY, hour: 22, minute: 0 }),
    readUserJson: (_id, name) => f.read(name), readUserCompanion: () => null, NudgeCopy: { normalizeLocale: () => 'en' },
    pushDecision: () => 'e', secretaryEveningDue: settings => ({ configured: true, due: settings.secretary.dailyReminder }),
    secretaryPushOffer: () => null, secretaryNextMoves: f.service, tzOffsetMinutesFor: () => 0, SecretaryClaimV1: Claims,
    sendWebPush: send, pushDeliveryOutcome: result => result.status >= 200 && result.status < 300 ? 'delivered' : [404, 410].includes(result.status) ? 'gone' : 'retry',
  };
  vm.runInNewContext(code + '\nthis.run = pushTick;', env);
  return { run: env.run, user };
}

test('a push reservation is durable before the actual scheduler sends a neutral Today notification', async t => {
  const f = fixture(t); let sends = 0;
  const runner = tick(f, async (_subscription, payload) => {
    sends++; const row = Object.values(f.read('secretary').delivery.offers)[0];
    assert.equal(row.state, 'offered'); assert.equal(row.push.status, 'reserved'); assert.equal(row.offer.channel, 'push');
    assert.equal(payload.url, './?view=today'); assert.equal(payload.tag, 'satoru-evening');
    assert.equal(JSON.stringify(payload).includes('22:00'), false); return { status: 201 };
  });
  await runner.run(); assert.equal(sends, 1);
  const row = Object.values(f.read('secretary').delivery.offers)[0];
  assert.equal(row.push.status, 'delivered'); assert.equal(row.state, 'offered');
  assert.equal(Object.keys(f.read('secretary').delivery.requests).length, 0, 'provider success is not user acceptance');
});
test('reservation write failure prevents every outbound notification effect', async t => {
  const f = fixture(t); f.fail(true); let sends = 0;
  await tick(f, async () => { sends++; return { status: 201 }; }).run();
  assert.equal(sends, 0); assert.equal(fs.existsSync(path.join(f.root, 'alice', 'secretary.json')), false);
});
test('uncertain provider response and settlement write failure cannot produce a second push', async t => {
  for (const [status, failSettlement] of [[500, false], [500, true], [201, true]]) {
    const f = fixture(t); let sends = 0;
    const runner = tick(f, async () => { sends++; if (failSettlement) f.fail(true); return { status }; });
    await runner.run(); f.fail(false); await runner.run();
    assert.equal(sends, 1);
    const row = Object.values(f.read('secretary').delivery.offers)[0];
    assert.equal(row.push.status, failSettlement ? 'reserved' : 'retry');
    assert.equal(f.create().reserveEveningPush('alice', clock), null, 'restart cannot resend an uncertain attempt');
  }
});
test('waiting handoff cannot interrupt a new session or known plan and cannot renew an expired push lease', t => {
  const f = fixture(t), reservation = f.service.reserveEveningPush('alice', clock);
  const active = { ...context, activeSession: { active: true } };
  assert.equal(f.call(f.body('decide', { context: active })).body.offer, null);
  assert.throws(() => f.call(f.body('claim', { offerId: reservation.offerId, context: active })), error => error.code === 'context_blocked');
  f.write('tasks', [{ id: 'busy', date: DAY, startTime: '21:30', estimateMin: 60, done: false }]);
  const waiting = f.call(f.body('decide'));
  assert.equal(waiting.body.resume, null); assert.equal(waiting.body.offer, null);
  assert.deepEqual(waiting.body.silence, { reason: 'busy_until_known_commitment', recheckAt: reservation.expiresAt });
  f.write('tasks', []);
  const later = { ...clock, now: DAY + 'T22:16:00.000Z' };
  assert.equal(f.create().reserveEveningPush('alice', later), null);
  assert.equal(f.read('secretary').delivery.offers[reservation.offerId].state, 'expired');
  assert.equal(f.read('secretary').nextMoves.capabilities['evening-close'].ignoredInARow, 0);
});
test('authenticated card handoff transfers one logical offer and its original lease without a second budget entry', t => {
  const f = fixture(t), reservation = f.service.reserveEveningPush('alice', clock);
  const before = f.read('secretary').nextMoves;
  const old = f.call(f.body('decide', { supportedCapabilities: ['after-lapse-return', 'planned-start'] }));
  assert.equal(old.body.offer, null); assert.equal(old.body.resume, null);
  const accepted = browserClaim(f);
  assert.equal(accepted.offer.offerId, reservation.offerId); assert.equal(accepted.offer.channel, 'card');
  assert.equal(accepted.offer.expiresAt, reservation.expiresAt); assert.notEqual(accepted.token, reservation.token);
  assert.deepEqual(f.read('secretary').nextMoves, before);
  assert.equal(f.call(accepted.intent).body.token, accepted.token, 'lost handoff reply replays the same receipt');
  const other = f.call(f.body('claim', { clientId: 'tab-b', offerId: reservation.offerId }));
  assert.equal(other.status, 409); assert.equal(other.body.error, 'held');
  assert.equal(f.call(f.body('decide', { clientId: 'tab-b' })).body.resume, null);
});
test('late delivery settlement after a card acceptance records only transport status and survives restart', t => {
  const f = fixture(t), reservation = f.service.reserveEveningPush('alice', clock), held = browserClaim(f);
  const intent = f.body('outcome', { offerId: held.offer.offerId, token: held.token, outcome: 'accepted' });
  const accepted = f.call(intent); assert.equal(accepted.status, 200);
  f.service.settleEveningPush('alice', { ...reservation, outcome: 'delivered', now: NOW });
  const row = f.read('secretary').delivery.offers[reservation.offerId];
  assert.equal(row.state, 'accepted'); assert.equal(row.clientId, 'tab-a'); assert.equal(row.push.status, 'delivered');
  assert.equal(f.call(intent, clock, 'alice', f.create()).body.persistedAt, accepted.body.persistedAt);
  assert.equal(f.create().reserveEveningPush('alice', clock), null);
});
test('a definitive gone subscription still permits the same authenticated card and never resends the notification', t => {
  const f = fixture(t), reservation = f.service.reserveEveningPush('alice', clock);
  f.service.settleEveningPush('alice', { ...reservation, outcome: 'gone', now: NOW });
  assert.equal(f.service.reserveEveningPush('alice', clock), null);
  assert.equal(browserClaim(f).offer.offerId, reservation.offerId);
});
test('existing card outcomes suppress background reservation; closed day does not cancel a configured reminder', t => {
  for (const outcome of ['accepted', 'dismissed', 'expired']) {
    const f = fixture(t), held = browserClaim(f);
    assert.equal(f.service.reserveEveningPush('alice', clock), null);
    f.call(f.body('outcome', { offerId: held.offer.offerId, token: held.token, outcome }));
    assert.equal(f.service.reserveEveningPush('alice', clock), null);
  }
  const f = fixture(t); f.write('days', { [DAY]: { closed: true } });
  assert.ok(f.service.reserveEveningPush('alice', clock));
});
test('known schedule, synced active Attention and corrupted Attention block push instead of pretending idle', t => {
  const f = fixture(t);
  f.write('tasks', [{ id: 'busy', date: DAY, startTime: '21:30', estimateMin: 60, done: false }]);
  assert.equal(f.service.reserveEveningPush('alice', clock), null);
  f.write('tasks', []);
  f.write('attention', { version: 1, mode: 'contracts', sessions: [{ id: 's1', startedAt: NOW, endedAt: null }] });
  assert.equal(f.service.reserveEveningPush('alice', clock), null);
  f.write('attention', { version: 1, mode: 'contracts', sessions: [{ id: 's1', startedAt: 'broken' }] });
  assert.throws(() => f.service.reserveEveningPush('alice', clock), error => error.status === 422);
});
test('pending handoff revalidates boundary, ownership and strict action identity', t => {
  const f = fixture(t), reservation = f.service.reserveEveningPush('alice', clock);
  const intent = f.body('claim', { offerId: reservation.offerId });
  f.write('settings', { secretary: { configured: true, dailyReminder: true, eveningTime: '22:01' } });
  const stale = f.call(intent); assert.equal(stale.status, 409); assert.equal(stale.body.error, 'stale_target');
  assert.equal(f.call(intent).body.persistedAt, stale.body.persistedAt);
  assert.equal(f.read('secretary').delivery.offers[reservation.offerId].state, 'expired');
  assert.throws(() => f.service.settleEveningPush('alice', { ...reservation, token: 'foreign-token', outcome: 'delivered', now: NOW }), error => error.status === 403);
});
test('cross-midnight known schedule waits until the day boundary and never fabricates a same-day end', t => {
  const f = fixture(t); f.write('settings', { secretary: { configured: true, dailyReminder: true, eveningTime: '23:30' } });
  f.write('tasks', [{ id: 'late', date: DAY, startTime: '23:00', estimateMin: 120, done: false }]);
  const later = { ...clock, now: DAY + 'T23:45:00.000Z' };
  const waiting = f.call(f.body('decide', { supportedCapabilities: ['evening-close'] }), later);
  assert.deepEqual(waiting.body.silence, { reason: 'busy_until_known_commitment', recheckAt: '2026-09-13T00:00:00.000Z' });
  assert.equal(f.service.reserveEveningPush('alice', later), null);
});
