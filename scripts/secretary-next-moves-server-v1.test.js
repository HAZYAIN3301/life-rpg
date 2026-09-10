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
    assert.equal(saved().nextMoves.offers[choice.cooldownKey].state, 'offered');
    assert.equal(ownRow.token, winner.token);
    assert.equal((await req(alice, '/api/secretary/claim', { offerId: 'morning-recovery|' + c.today, channel: 'card' })).status, 409);
    const resume = await call(body('decide', { clientId: ownRow.clientId }));
    assert.equal(resume.body.resume.token, winner.token);
    const other = await call(body('decide', { clientId: ownRow.clientId === 'tab_a' ? 'tab_b' : 'tab_a' }));
    assert.equal(other.body.resume, null); assert.equal(other.body.offer, null);
    reset();
  });
  await t.test('a legacy hold wins the same account surface before return claim', async () => {
    const choice = (await call(body('decide'))).body.offer;
    assert.equal((await req(alice, '/api/secretary/claim', { offerId: 'morning-recovery|' + c.today, channel: 'push' })).status, 200);
    assert.equal((await call(body('claim', { offerId: choice.offerId }))).status, 409);
    assert.equal((await call(body('decide'))).body.offer, null);
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
  await t.test('account cascade delete removes envelope, receipts and private backups', async () => {
    const held = await claim(); await call(outcome(held, 'dismissed'));
    assert.equal(fs.existsSync(path.join(userDir, '.backups', 'secretary', 'previous.json')), true);
    assert.equal((await req(alice, '/api/auth/delete-account', { confirm: 'DELETE', password: PASSWORD })).status, 200);
    assert.equal(fs.existsSync(userDir), false);
    assert.equal(fs.readdirSync(dir).some((name) => name.startsWith('.account-delete-' + alice.id)), false);
  });
});
