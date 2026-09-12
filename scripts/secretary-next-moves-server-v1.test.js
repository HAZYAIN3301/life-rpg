'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const Service = require('../server-secretary-next-moves-v1.js');
const ROOT = path.resolve(__dirname, '..');
const PASSWORD = 'secretary-transport-42';
const ROUTE = '/api/secretary/next-moves';

async function start(dataDir) {
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', (c) => { output += c; }); child.stderr.on('data', (c) => { output += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 700; i += 1) {
    if (child.exitCode != null) throw new Error(output);
    try { if ((await fetch(base + '/api/auth/profiles')).ok) return { base, child }; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  child.kill('SIGKILL'); throw new Error(output || 'server startup timed out');
}
async function stop(rt) { if (rt.child.exitCode == null) { const done = once(rt.child, 'exit'); rt.child.kill('SIGKILL'); await done; } }
async function register(rt, id) {
  const response = await fetch(rt.base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: id, email: id + '@secretary.test', password: PASSWORD }) });
  assert.equal(response.status, 200);
  return { ...(await response.json()), cookie: response.headers.get('set-cookie').split(';')[0] };
}
function clock() {
  const now = new Date(), utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  const offset = 12 * 60 - utc;
  const today = new Date(now.getTime() + offset * 60000).toISOString().slice(0, 10);
  return { now: now.toISOString(), today, offset };
}
function context(c = clock(), originalRef = 'quest:own_task') {
  return { activeSession: { active: false }, guide: { active: false }, firstValue: { pending: false },
    lapse: { confirmed: true, source: 'user_confirmed', eventKey: 'attention:episode_a', day: c.today,
      endedAt: new Date(Date.parse(c.now) - 60000).toISOString(), observedAt: new Date(Date.parse(c.now) - 1000).toISOString(),
      ...(originalRef ? { originalRef } : {}) } };
}

test('authoritative return transport on a real isolated server', { timeout: 180000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-next-moves-'));
  let rt = await start(dir);
  t.after(async () => { await stop(rt); fs.rmSync(dir, { recursive: true, force: true }); });
  const alice = await register(rt, 'return-alice'), bob = await register(rt, 'return-bob');
  const c = clock(), userDir = path.join(dir, 'users', alice.id), file = path.join(userDir, 'secretary.json');
  let sequence = 0;
  const body = (op, extra = {}) => ({ op, clientId: 'tab_a', requestId: 'intent_' + ++sequence, context: context(c), ...extra });
  const req = async (user, route, payload, method = 'POST') => {
    const response = await fetch(rt.base + route, { method,
      headers: { 'Content-Type': 'application/json', Cookie: user?.cookie || '', 'X-Local-Day': c.today, 'X-Tz-Offset': String(c.offset) },
      ...(method !== 'GET' ? { body: JSON.stringify(payload) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const call = (payload, user = alice) => req(user, ROUTE, payload);
  const write = (name, value, user = alice) => {
    const directory = path.join(dir, 'users', user.id); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify(value));
  };
  const saved = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const reset = () => {
    for (const name of ['secretary', 'secretary-claims', 'secretary-events', 'secretary-ledger', 'first-value']) {
      fs.rmSync(path.join(userDir, name + '.json'), { force: true });
    }
    write('settings', {}); write('tasks', [{ id: 'own_task', title: 'Synthetic saved task', done: false, date: c.today }]);
    write('habits', []); write('habitlog', {}); write('days', {});
  };
  reset();
  const claim = async (extra = {}) => {
    const decision = await call(body('decide', extra)); assert.equal(decision.status, 200); assert.ok(decision.body.offer, JSON.stringify(decision));
    const intent = body('claim', { ...extra, offerId: decision.body.offer.offerId });
    const response = await call(intent); assert.equal(response.status, 200, JSON.stringify(response));
    return { intent, ...response.body };
  };
  const outcome = (claimed, value, extra = {}) => body('outcome', { offerId: claimed.offer.offerId, token: claimed.token, outcome: value, ...extra });

  await t.test('authentication, strict flags and malformed input are distinct from silence', async () => {
    assert.equal((await call(body('decide'), null)).status, 401);
    assert.equal((await call(body('decide', { clientId: null }))).status, 400);
    assert.equal((await call(body('decide', { context: {} }))).status, 400);
    assert.equal((await call(body('decide', { context: { ...context(c), activeSession: { active: 'false' } } }))).body.error, 'invalid_flag');
    const quiet = await call(body('decide', { context: { ...context(c), lapse: null } }));
    assert.equal(quiet.status, 200); assert.equal(quiet.body.offer, null);
    assert.equal(fs.existsSync(file), false, 'deciding alone has no durable delivery effect');
    const invalid = context(c); invalid.lapse.eventKey = 'https://private.invalid/path';
    assert.equal((await call(body('decide', { context: invalid }))).status, 400);
  });
  await t.test('saved ownership is authoritative; foreign, deleted and future targets become one question', async () => {
    write('tasks', [{ id: 'foreign_task', title: 'Never copy this title', done: false }], bob);
    const foreign = context(c, 'quest:foreign_task'); foreign.lapse.originalStillActionable = true;
    foreign.tasks = [{ id: 'foreign_task', done: false }];
    const response = await call(body('decide', { context: foreign }));
    assert.equal(response.body.offer.action.type, 'ask_one_question');
    assert.equal(response.body.offer.about.targetRef, null);
    assert.equal(JSON.stringify(response).includes('Never copy'), false);
    write('tasks', [{ id: 'own_task', done: false, date: '2099-01-01' }]);
    assert.equal((await call(body('decide'))).body.offer.action.type, 'ask_one_question');
    reset();
  });
  await t.test('all UI blockers and own evening boundary are checked before a claim', async () => {
    for (const field of ['activeSession', 'guide', 'firstValue']) {
      const ctx = context(c); ctx[field][field === 'firstValue' ? 'pending' : 'active'] = true;
      assert.equal((await call(body('decide', { context: ctx }))).body.offer, null);
    }
    write('settings', { secretary: { configured: true, eveningTime: '00:00' } });
    const asleep = await call(body('decide'));
    assert.equal(asleep.body.offer.capabilityId, 'after-lapse-return');
    assert.equal(asleep.body.offer.action.type, 'ask_one_question');
    write('settings', { guideV3: { enabled: true, currentChapter: 'habits' } });
    assert.equal((await call(body('decide'))).body.offer, null);
    write('settings', {}); write('first-value', { status: 'action_ready' });
    assert.equal((await call(body('decide'))).body.offer, null);
    reset();
  });
  await t.test('concurrent devices get exactly one durable claim, and legacy cannot claim beside it', async () => {
    const choice = (await call(body('decide'))).body.offer;
    const results = await Promise.all(['tab_a', 'tab_b'].map((clientId) => call(body('claim', { offerId: choice.offerId, clientId }))));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = results.find((r) => r.status === 200).body;
    const ownRow = saved().delivery.offers[choice.offerId];
    assert.equal(results.find((r) => r.status === 409).body.recheckAt, winner.offer.expiresAt);
    assert.equal(saved().nextMoves.offers[choice.cooldownKey].state, 'offered');
    assert.equal(ownRow.token, winner.token);
    assert.equal((await req(alice, '/api/secretary/claim', { offerId: 'morning-recovery|' + c.today, channel: 'card' })).status, 409);
    const resume = await call(body('decide', { clientId: ownRow.clientId }));
    assert.equal(resume.body.resume.token, winner.token);
    const other = await call(body('decide', { clientId: ownRow.clientId === 'tab_a' ? 'tab_b' : 'tab_a' }));
    assert.equal(other.body.resume, null); assert.equal(other.body.offer, null);
    assert.deepEqual(other.body.silence, { reason: 'held', recheckAt: winner.offer.expiresAt });
    const blocked = context(c); blocked.activeSession.active = true;
    assert.deepEqual((await call(body('decide', { context: blocked }))).body.silence, { reason: 'context_blocked' });
    reset();
  });
  await t.test('a legacy hold wins the same account surface before return claim', async () => {
    const choice = (await call(body('decide'))).body.offer;
    assert.equal((await req(alice, '/api/secretary/claim', { offerId: 'morning-recovery|' + c.today, channel: 'push' })).status, 200);
    const lease = JSON.parse(fs.readFileSync(path.join(userDir, 'secretary-claims.json'), 'utf8')).claims['morning-recovery|' + c.today];
    const race = await call(body('claim', { offerId: choice.offerId }));
    assert.equal(race.status, 409); assert.deepEqual(race.body, { error: 'held', recheckAt: lease.expiresAt });
    const silence = await call(body('decide'));
    assert.equal(silence.body.offer, null);
    assert.deepEqual(silence.body.silence, { reason: 'legacy_held', recheckAt: lease.expiresAt });
    assert.equal(fs.existsSync(file), false);
    reset();
  });
  await t.test('claim response loss, reload resume, restart and request conflict preserve one token', async () => {
    const choice = (await call(body('decide'))).body.offer;
    const intent = body('claim', { offerId: choice.offerId });
    // Close the response without consuming its receipt, after the server commits.
    await new Promise((resolve, reject) => {
      const request = http.request(rt.base + ROUTE, { method: 'POST', headers: { Cookie: alice.cookie,
        'Content-Type': 'application/json', 'X-Local-Day': c.today, 'X-Tz-Offset': String(c.offset) } }, (response) => {
        assert.equal(response.statusCode, 200); response.destroy(); resolve();
      }); request.on('error', reject); request.end(JSON.stringify(intent));
    });
    const original = saved().delivery.offers[choice.offerId];
    const retry = await call(intent); assert.equal(retry.body.repeat, true); assert.equal(retry.body.token, original.token);
    assert.equal((await call({ ...intent, invocation: 'manual' })).status, 409);
    await stop(rt); rt = await start(dir);
    const restored = await call(body('decide')); assert.equal(restored.body.resume.token, original.token);
    assert.equal(restored.body.resume.persistedAt, original.claimedAt);
    const owner = { offer: original.offer, token: original.token };
    assert.equal((await call(outcome(owner, 'accepted'), bob)).status, 404);
    assert.equal((await call(outcome(owner, 'accepted', { clientId: 'tab_b' }))).status, 403);
    const acceptIntent = outcome(owner, 'accepted');
    const accepted = await call(acceptIntent); assert.equal(accepted.status, 200);
    assert.equal(accepted.body.action.args.targetRef, 'quest:own_task');
    const repeat = await call(acceptIntent); assert.equal(repeat.body.persistedAt, accepted.body.persistedAt); assert.equal(repeat.body.repeat, true);
    const semantic = await call(outcome(owner, 'accepted')); assert.equal(semantic.body.persistedAt, accepted.body.persistedAt);
    assert.equal((await call(outcome(owner, 'dismissed'))).status, 409);
    assert.equal((await call(body('decide'))).body.offer, null);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userDir, 'tasks.json'), 'utf8'))[0].done, false, 'accepted only authorizes opening');
    reset();
  });
  await t.test('dismissal is durable, idempotent and cannot be undone by client ledger/import/generic PUT', async () => {
    const held = await claim(); const dismiss = outcome(held, 'dismissed');
    assert.equal((await call(dismiss)).status, 200); assert.equal((await call(dismiss)).body.repeat, true);
    assert.equal(saved().nextMoves.capabilities['after-lapse-return'].dismissedInARow, 1);
    assert.equal((await call(body('decide', { ledger: { version: 2, offers: {}, capabilities: {} } }))).body.offer, null);
    for (const name of ['secretary', 'secretary-ledger', 'secretary-claims', 'secretary-events']) {
      assert.equal((await req(alice, '/api/data/' + name, {}, 'PUT')).status, 403);
    }
    assert.equal((await req(alice, '/api/account/import', { format: 'satoru-account', version: 1, data: { secretary: Service.empty() } })).status, 400);
    const archive = await req(alice, '/api/account/export', null, 'GET');
    assert.deepEqual(archive.body.serverOwned.secretary, saved());
    assert.equal(archive.body.data.secretary, undefined);
    reset();
  });
  await t.test('stale target at acceptance records expired and never returns a runnable action', async () => {
    const held = await claim(); write('tasks', []);
    const rejected = await call(outcome(held, 'accepted'));
    assert.equal(rejected.status, 409); assert.equal(rejected.body.error, 'stale_target'); assert.equal(rejected.body.action, undefined);
    assert.equal(saved().nextMoves.offers[held.offer.cooldownKey].state, 'expired');
    assert.equal((await call(body('decide'))).body.offer, null);
    reset();
  });
  await t.test('acceptance rechecks local blockers, the saved evening boundary and a linked habit minimum', async () => {
    let held = await claim(); const blocked = context(c); blocked.activeSession.active = true;
    assert.equal((await call(outcome(held, 'accepted', { context: blocked }))).body.error, 'context_blocked');
    assert.equal(saved().nextMoves.offers[held.offer.cooldownKey].state, 'offered');
    write('settings', { secretary: { configured: true, eveningTime: '00:00' } });
    assert.equal((await call(outcome(held, 'accepted'))).body.error, 'stale_target');
    reset();
    write('habits', [{ id: 'own_habit', title: 'Synthetic habit', days: [0, 1, 2, 3, 4, 5, 6], atomic: { twoMin: 'Open saved page' } }]);
    held = await claim({ context: context(c, 'habit:own_habit') });
    assert.equal(held.offer.action.args.targetRef, 'habit:own_habit');
    write('habitlog', { [c.today]: { own_habit: true } });
    assert.equal((await call(outcome(held, 'accepted'))).body.error, 'stale_target');
    reset();
  });
  await t.test('attention contract roundtrip preserves valid original refs and the rest of legacy rows', async () => {
    const now = new Date(Date.now() - 10000).toISOString();
    const data = { version: 1, mode: 'contracts', policies: [],
      sessions: [{ id: 's1', policyId: 'p1', purpose: 'work', startedAt: now, originalRef: 'quest:own_task' }],
      episodes: [{ id: 'e1', sourcePolicyId: 'p1', declaredPurpose: 'work', startedAt: now, endedAt: now, outcome: 'escaped', originalRef: 'quest:own_task' },
        { id: 'legacy', sourcePolicyId: 'p1', declaredPurpose: 'work', startedAt: now, originalRef: 'https://invalid.test' }] };
    assert.equal((await req(alice, '/api/attention', { data }, 'PUT')).status, 200);
    const stored = JSON.parse(fs.readFileSync(path.join(userDir, 'attention.json'), 'utf8'));
    assert.equal(stored.sessions[0].originalRef, 'quest:own_task');
    assert.equal(stored.episodes[0].originalRef, 'quest:own_task');
    assert.equal(stored.episodes[1].id, 'legacy'); assert.equal(stored.episodes[1].originalRef, undefined);
  });
  await t.test('an elapsed lease settles expired after restart; it cannot reopen with a new device', async () => {
    const held = await claim(); const state = saved();
    state.delivery.offers[held.offer.offerId].offer.expiresAt = new Date(Date.now() - 1000).toISOString();
    write('secretary', state);
    await stop(rt); rt = await start(dir);
    const decision = await call(body('decide', { clientId: 'tab_b' }));
    assert.equal(decision.body.offer, null); assert.equal(decision.body.resume, null);
    assert.equal(saved().nextMoves.offers[held.offer.cooldownKey].state, 'expired');
    assert.equal(saved().nextMoves.capabilities['after-lapse-return'].ignoredInARow, 1);
    assert.equal((await call(held.intent)).status, 409);
    const expiredAt = saved().delivery.offers[held.offer.offerId].persistedAt;
    const expiryIntent = outcome(held, 'expired');
    const acknowledged = await call(expiryIntent);
    assert.equal(acknowledged.status, 200, 'client timer can acknowledge server auto-expiry');
    assert.deepEqual(acknowledged.body, { ok: true, outcome: 'expired', action: null, persistedAt: expiredAt, repeat: true });
    const after = fs.readFileSync(file, 'utf8');
    assert.equal(saved().nextMoves.capabilities['after-lapse-return'].ignoredInARow, 1, 'one ignored offer, not two');
    assert.equal((await call(expiryIntent)).body.persistedAt, expiredAt);
    assert.equal(fs.readFileSync(file, 'utf8'), after, 'exact retry does not rewrite the receipt');
    assert.equal((await call(outcome(held, 'expired'))).body.persistedAt, expiredAt, 'new requestId is the same expiry');
    assert.equal((await call(outcome(held, 'expired', { clientId: 'tab_b' }))).status, 403);
    assert.equal((await call(outcome(held, 'accepted'))).status, 409);
    reset();
  });
  await t.test('write refusal is 500 with no accepted outcome, and the same intention succeeds on retry', async () => {
    const held = await claim(), intent = outcome(held, 'accepted'); const before = fs.readFileSync(file, 'utf8');
    const backup = path.join(userDir, '.backups', 'secretary', 'previous.json');
    fs.rmSync(backup, { force: true }); fs.mkdirSync(backup);
    assert.equal((await call(intent)).status, 500);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    fs.rmdirSync(backup);
    assert.equal((await call(intent)).status, 200);
    assert.equal(saved().nextMoves.offers[held.offer.cooldownKey].state, 'accepted');
    reset();
  });
  await t.test('damaged envelope/ledger and read failures never become quiet success or overwrite', async () => {
    for (const damaged of ['{broken', JSON.stringify({ ...Service.empty(), nextMoves: { version: 2, offers: [], capabilities: {} } })]) {
      fs.writeFileSync(file, damaged);
      assert.equal((await call(body('decide'))).status, 422);
      assert.equal((await call(body('claim', { offerId: 'forged' }))).status, 422);
      assert.equal(fs.readFileSync(file, 'utf8'), damaged);
      assert.equal((await req(alice, '/api/account/export', null, 'GET')).status, 422);
    }
    fs.rmSync(file); fs.mkdirSync(file);
    assert.equal((await call(body('decide'))).status, 500);
    fs.rmdirSync(file); reset();
    write('secretary-ledger', { version: 1, delivered: { bad: [] } });
    assert.equal((await req(alice, '/api/secretary', null, 'GET')).status, 422);
    reset();
  });
  const plannedSupport = ['after-lapse-return', 'planned-start'];
  const plannedExtra = () => ({ supportedCapabilities: plannedSupport, context: { ...context(c), lapse: null } });
  const scheduledTask = (extra = {}) => ({ id: 'own_task', title: 'Saved scheduled task', done: false,
    completedAt: null, date: c.today, startTime: '12:00', estimateMin: 30, ...extra });
  await t.test('legacy hold advertises its earliest live expiry without releasing delivered or uncertain claims', async () => {
    write('tasks', [scheduledTask()]);
    const at = new Date().toISOString(), expired = new Date(Date.now() - 1000).toISOString();
    const first = new Date(Date.now() + 60000).toISOString(), second = new Date(Date.now() + 120000).toISOString();
    const claims = { version: 1, claims: {
      expired: { at, expiresAt: expired, token: 'expired-token', channel: 'card' },
      uncertain: { at, expiresAt: second, token: 'uncertain-token', channel: 'push', outcome: 'retry', settledAt: at },
      delivered: { at, expiresAt: first, token: 'delivered-token', channel: 'card', outcome: 'delivered', settledAt: at },
    } };
    write('secretary-claims', claims);
    const before = fs.readFileSync(path.join(userDir, 'secretary-claims.json'), 'utf8');
    const initial = await call(body('decide', plannedExtra()));
    assert.deepEqual(initial.body.silence, { reason: 'legacy_held', recheckAt: first });
    assert.equal(initial.body.offer, null); assert.equal(initial.body.resume, null);
    assert.equal(fs.readFileSync(path.join(userDir, 'secretary-claims.json'), 'utf8'), before, 'wake metadata does not release or extend any legacy lease');
    assert.equal(fs.existsSync(file), false, 'waiting does not spend the new offer budget');
    claims.claims.delivered.expiresAt = expired; write('secretary-claims', claims);
    assert.deepEqual((await call(body('decide', plannedExtra()))).body.silence, { reason: 'legacy_held', recheckAt: second });
    claims.claims.uncertain.expiresAt = expired; write('secretary-claims', claims);
    const freed = await call(body('decide', plannedExtra()));
    assert.equal(freed.body.offer.capabilityId, 'planned-start'); assert.equal(freed.body.resume, null);
    reset();
  });
  await t.test('new claim expiry removes held wake metadata and durably expires only once', async () => {
    write('tasks', [scheduledTask()]); const held = await claim(plannedExtra());
    const other = { ...plannedExtra(), clientId: 'tab_b' };
    assert.deepEqual((await call(body('decide', other))).body.silence, { reason: 'held', recheckAt: held.offer.expiresAt });
    const state = saved(); state.delivery.offers[held.offer.offerId].offer.expiresAt = new Date(Date.now() - 1).toISOString(); write('secretary', state);
    const freed = await call(body('decide', other));
    assert.equal(freed.body.resume, null); assert.notEqual(freed.body.silence?.reason, 'held');
    assert.equal(freed.body.silence?.recheckAt, undefined);
    assert.equal(saved().nextMoves.capabilities['planned-start'].ignoredInARow, 1);
    await call(body('decide', other)); assert.equal(saved().nextMoves.capabilities['planned-start'].ignoredInARow, 1);
    reset();
  });
  await t.test('planned-start requires explicit supported capabilities; old v254 never receives a planned offer or resume', async () => {
    write('tasks', [scheduledTask()]);
    assert.equal((await call(body('decide', { context: { ...context(c), lapse: null } }))).body.offer, null);
    for (const supportedCapabilities of [null, 'planned-start', ['unknown-capability'], ['planned-start', 'planned-start']]) {
      assert.equal((await call(body('decide', { ...plannedExtra(), supportedCapabilities }))).status, 400);
    }
    assert.equal((await call(body('decide', { ...plannedExtra(), supportedCapabilities: [] }))).body.offer, null);
    const held = await claim(plannedExtra());
    assert.equal(held.offer.capabilityId, 'planned-start');
    assert.equal(held.offer.action.args.size, 'planned');
    assert.deepEqual(held.offer.about.planned, { date: c.today, startTime: '12:00' });
    assert.equal(held.offer.alternatives.length, 0);
    const oldResume = await call(body('decide', { context: { ...context(c), lapse: null } }));
    assert.equal(oldResume.body.offer, null); assert.equal(oldResume.body.resume, null);
    const newResume = await call(body('decide', plannedExtra()));
    assert.equal(newResume.body.resume.token, held.token);
    const other = await call(body('decide', { ...plannedExtra(), clientId: 'tab_b' }));
    assert.equal(other.body.resume, null); assert.equal(other.body.offer, null);
    reset();
  });
  await t.test('planned lease needs no lapse and ends at the saved schedule window, not a sliding response window', async () => {
    write('tasks', [scheduledTask({ startTime: '11:16' })]);
    const held = await claim(plannedExtra());
    const closesAt = new Date(Date.parse(c.today + 'T12:02:00.000Z') - c.offset * 60000).toISOString();
    assert.equal(held.offer.expiresAt, closesAt);
    const replay = await call(held.intent); assert.equal(replay.body.offer.expiresAt, closesAt); assert.equal(replay.body.token, held.token);
    const ledger = saved(); ledger.delivery.offers[held.offer.offerId].offer.expiresAt = new Date(Date.now() - 1).toISOString();
    write('secretary', ledger);
    const expired = await call(outcome(held, 'expired')); assert.equal(expired.status, 200);
    assert.equal(saved().nextMoves.capabilities['planned-start'].ignoredInARow, 1);
    reset();
  });
  await t.test('after-lapse priority and the same account claim protect the two enabled capabilities', async () => {
    write('tasks', [scheduledTask()]);
    const preferred = await call(body('decide', { supportedCapabilities: plannedSupport }));
    assert.equal(preferred.body.offer.capabilityId, 'after-lapse-return');
    const choice = (await call(body('decide', plannedExtra()))).body.offer;
    const competing = await Promise.all(['tab_a', 'tab_b'].map(clientId => call(body('claim', { ...plannedExtra(), clientId, offerId: choice.offerId }))));
    assert.deepEqual(competing.map(item => item.status).sort(), [200, 409]);
    assert.equal((await call(body('claim', { supportedCapabilities: plannedSupport, offerId: preferred.body.offer.offerId }))).status, 409);
    reset();
  });
  await t.test('acceptance revalidates claimed task date/time/deletion/completion and durably expires stale choices', async () => {
    for (const tasks of [[], [scheduledTask({ done: true })], [scheduledTask({ completedAt: c.now })],
      [scheduledTask({ date: '2099-01-01' })], [scheduledTask({ startTime: '12:01' })],
      [scheduledTask({ startTime: null })], [scheduledTask({ startTime: '99:00' })]]) {
      write('tasks', [scheduledTask()]); const held = await claim(plannedExtra());
      write('tasks', tasks);
      const intent = outcome(held, 'accepted', { context: plannedExtra().context });
      const rejected = await call(intent);
      assert.equal(rejected.status, 409, JSON.stringify(tasks)); assert.equal(rejected.body.error, 'stale_target');
      assert.equal(rejected.body.action, undefined); assert.equal(saved().nextMoves.offers[held.offer.cooldownKey].state, 'expired');
      const again = await call(intent); assert.equal(again.body.persistedAt, rejected.body.persistedAt);
      assert.equal(saved().nextMoves.capabilities['planned-start'].ignoredInARow, 1);
      reset();
    }
  });
  await t.test('a nearer task appearing does not revoke the still-valid task the person already saw', async () => {
    write('tasks', [scheduledTask({ startTime: '11:58' })]); const held = await claim(plannedExtra());
    write('tasks', [scheduledTask({ startTime: '11:58' }), scheduledTask({ id: 'new_nearer', startTime: '12:00' })]);
    const accepted = await call(outcome(held, 'accepted', { context: plannedExtra().context }));
    assert.equal(accepted.status, 200); assert.equal(accepted.body.action.args.targetRef, 'quest:own_task');
    assert.equal(accepted.body.action.args.size, 'planned');
    const tasks = JSON.parse(fs.readFileSync(path.join(userDir, 'tasks.json'), 'utf8'));
    assert.equal(tasks.every(task => task.done === false), true, 'receipt authorizes opening, not start or completion');
    reset();
  });
  await t.test('planned acceptance respects active session/day/Guide/First Value and preserves a saved late schedule', async () => {
    write('tasks', [scheduledTask()]); const held = await claim(plannedExtra());
    const active = plannedExtra().context; active.activeSession.active = true;
    assert.equal((await call(outcome(held, 'accepted', { context: active }))).body.error, 'context_blocked');
    for (const [name, value] of [['days', { [c.today]: { closed: true } }], ['settings', { guideV3: { currentChapter: 'habits', enabled: true } }], ['first-value', { status: 'action_ready' }]]) {
      write(name, value); assert.equal((await call(outcome(held, 'accepted', { context: plannedExtra().context }))).body.error, 'context_blocked');
      if (name === 'first-value') fs.rmSync(path.join(userDir, 'first-value.json'));
      else write(name, {});
    }
    write('settings', { secretary: { configured: true, eveningTime: '11:00' } });
    assert.equal((await call(outcome(held, 'accepted', { context: plannedExtra().context }))).status, 200,
      'an explicitly scheduled late task retains planned policy semantics');
    reset();
  });
  await t.test('planned outcome write failure/retry/restart shares the same durable receipt and ownership guards', async () => {
    write('tasks', [scheduledTask()]); const held = await claim(plannedExtra());
    const intent = outcome(held, 'accepted', { context: plannedExtra().context });
    assert.equal((await call(intent, bob)).status, 404);
    assert.equal((await call({ ...intent, clientId: 'tab_b', requestId: 'foreign-intent' })).status, 403);
    const before = fs.readFileSync(file, 'utf8'), backup = path.join(userDir, '.backups', 'secretary', 'previous.json');
    fs.rmSync(backup, { force: true }); fs.mkdirSync(backup);
    assert.equal((await call(intent)).status, 500); assert.equal(fs.readFileSync(file, 'utf8'), before);
    fs.rmdirSync(backup);
    const accepted = await call(intent); assert.equal(accepted.status, 200);
    await stop(rt); rt = await start(dir);
    const replay = await call(intent); assert.equal(replay.body.persistedAt, accepted.body.persistedAt); assert.equal(replay.body.repeat, true);
    assert.equal((await call(body('decide', plannedExtra()))).body.offer, null);
    reset();
  });
  const eveningSupport = ['after-lapse-return', 'planned-start', 'evening-close'];
  const eveningExtra = () => ({ supportedCapabilities: eveningSupport, context: { ...context(c), lapse: null } });
  const eveningSettings = extra => ({ secretary: { configured: true, eveningTime: '12:00', dailyReminder: true, ...extra } });
  await t.test('evening opt-in negotiates only to a capable client and respects explicit reminder opt-out', async () => {
    write('settings', eveningSettings());
    for (const supportedCapabilities of [undefined, ['after-lapse-return', 'planned-start']]) {
      assert.equal((await call(body('decide', { ...eveningExtra(), supportedCapabilities }))).body.offer, null);
    }
    const held = await claim(eveningExtra());
    assert.deepEqual(held.offer.action, { type: 'evening_transition_open', args: { day: c.today, boundaryLocal: '12:00' } });
    assert.equal(held.offer.alternatives.length, 0); assert.equal(held.offer.closesDay, false);
    assert.equal((await call(body('decide', { ...eveningExtra(), supportedCapabilities: plannedSupport }))).body.resume, null);
    reset();
    for (const dailyReminder of [false, undefined]) {
      write('settings', eveningSettings({ dailyReminder }));
      assert.equal((await call(body('decide', eveningExtra()))).body.offer, null);
    }
    write('settings', eveningSettings({ dailyReminder: 'true' }));
    assert.equal((await call(body('decide', eveningExtra()))).status, 422);
    reset();
  });
  await t.test('closed day retains the saved evening reminder; active session waits without claiming its budget', async () => {
    write('settings', eveningSettings()); write('days', { [c.today]: { closed: true } });
    const choice = (await call(body('decide', eveningExtra()))).body.offer;
    assert.equal(choice.capabilityId, 'evening-close');
    const active = eveningExtra(); active.context.activeSession.active = true;
    const waiting = await call(body('decide', active));
    assert.equal(waiting.body.offer, null); assert.equal(waiting.body.silence.deferUntil, 'session_end');
    assert.equal((await call(body('claim', { ...active, offerId: choice.offerId }))).body.error, 'context_blocked');
    assert.equal(fs.existsSync(file), false);
    const held = await claim(eveningExtra());
    assert.equal((await call(body('decide', eveningExtra()))).body.resume.token, held.token);
    const accepted = await call(outcome(held, 'accepted', { context: eveningExtra().context }));
    assert.equal(accepted.status, 200); assert.equal(JSON.parse(fs.readFileSync(path.join(userDir, 'days.json'), 'utf8'))[c.today].closed, true);
    reset();
  });
  await t.test('known saved busy window defers evening decision and claim without spending the daily offer', async () => {
    write('settings', eveningSettings());
    const choice = (await call(body('decide', eveningExtra()))).body.offer;
    write('tasks', [scheduledTask({ startTime: '11:30', estimateMin: 60 })]);
    const extra = { ...eveningExtra(), supportedCapabilities: ['evening-close'] };
    const waiting = await call(body('decide', extra));
    const until = new Date(Date.parse(c.today + 'T12:30:00.000Z') - c.offset * 60000).toISOString();
    assert.deepEqual(waiting.body.silence, { reason: 'busy_until_known_commitment', recheckAt: until });
    assert.equal((await call(body('claim', { ...extra, offerId: choice.offerId }))).body.error, 'context_blocked');
    assert.equal(fs.existsSync(file), false);
    write('tasks', []); assert.equal((await claim(eveningExtra())).offer.offerId, choice.offerId);
    reset();
  });
  await t.test('saved evening boundary change or opt-out durably expires an accepted stale offer', async () => {
    for (const change of [{ eveningTime: '12:01' }, { configured: false }, { dailyReminder: false }]) {
      write('settings', eveningSettings()); const held = await claim(eveningExtra());
      write('settings', eveningSettings(change));
      const intent = outcome(held, 'accepted', { context: eveningExtra().context });
      const stale = await call(intent); assert.equal(stale.status, 409); assert.equal(stale.body.error, 'stale_target');
      assert.equal(saved().delivery.offers[held.offer.offerId].state, 'expired');
      assert.equal(saved().nextMoves.capabilities['evening-close'].ignoredInARow, 0, 'user scheduled reminders never accumulate advice suppression');
      assert.equal((await call(intent)).body.persistedAt, stale.body.persistedAt);
      reset();
    }
  });
  await t.test('evening acceptance waits for new active/busy context, then permits the same unchanged intent', async () => {
    write('settings', eveningSettings()); const held = await claim(eveningExtra());
    const active = eveningExtra().context; active.activeSession.active = true;
    assert.equal((await call(outcome(held, 'accepted', { context: active }))).body.error, 'context_blocked');
    write('tasks', [scheduledTask({ startTime: '11:30', estimateMin: 60 })]);
    const intent = outcome(held, 'accepted', { context: eveningExtra().context });
    const busy = await call(intent); assert.equal(busy.body.error, 'context_blocked');
    assert.equal(busy.body.recheckAt, held.offer.expiresAt); assert.equal(saved().delivery.offers[held.offer.offerId].state, 'offered');
    write('tasks', []); assert.equal((await call(intent)).status, 200);
    reset();
  });
  await t.test('evening lease clips the real boundary window and write failures/restart retain an honest receipt', async () => {
    write('settings', eveningSettings({ eveningTime: '10:01' })); const held = await claim(eveningExtra());
    assert.equal(held.offer.expiresAt, new Date(Date.parse(c.today + 'T12:02:00.000Z') - c.offset * 60000).toISOString());
    const intent = outcome(held, 'accepted', { context: eveningExtra().context });
    assert.equal((await call(intent, bob)).status, 404);
    const before = fs.readFileSync(file, 'utf8'), backup = path.join(userDir, '.backups', 'secretary', 'previous.json');
    fs.rmSync(backup, { force: true }); fs.mkdirSync(backup);
    assert.equal((await call(intent)).status, 500); assert.equal(fs.readFileSync(file, 'utf8'), before);
    fs.rmdirSync(backup); const accepted = await call(intent); assert.equal(accepted.status, 200);
    await stop(rt); rt = await start(dir);
    assert.equal((await call(intent)).body.persistedAt, accepted.body.persistedAt);
    assert.equal((await call(body('decide', eveningExtra()))).body.offer, null);
    reset();
  });
  await t.test('evening corrupted action identity fails closed instead of opening or becoming healthy silence', async () => {
    write('settings', eveningSettings()); const held = await claim(eveningExtra());
    const state = saved(); state.delivery.offers[held.offer.offerId].offer.action.args.boundaryLocal = ['12:00']; write('secretary', state);
    assert.equal((await call(body('decide', eveningExtra()))).status, 422);
    reset();
  });
  await t.test('account cascade delete removes envelope, receipts and private backups', async () => {
    const held = await claim(); await call(outcome(held, 'dismissed'));
    assert.equal(fs.existsSync(path.join(userDir, '.backups', 'secretary', 'previous.json')), true);
    assert.equal((await req(alice, '/api/auth/delete-account', { confirm: 'DELETE', password: PASSWORD })).status, 200);
    assert.equal(fs.existsSync(userDir), false);
    assert.equal(fs.readdirSync(dir).some((name) => name.startsWith('.account-delete-' + alice.id)), false);
  });
});
