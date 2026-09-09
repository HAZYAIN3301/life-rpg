'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { spawn } = require('node:child_process');
const W = require('../public/economy-write-v1'), J = require('../public/commitment-journal-v1');
const P = require('../public/purchase-policy-v1'), C = require('../public/shop-catalog-v1'), Guide = require('../public/guide-v3');
const root = path.resolve(__dirname, '..'), app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const snap = value => ({ exists: value !== undefined, value: value === undefined ? null : value });
const row = (patch = {}) => ({ id: 'p1', rewardId: 'r1', cost: 10, at: '2026-09-09T18:00:00.000Z', ...patch });
const context = () => ({ purchases: [], settings: {}, rewards: [{ id: 'r1', cost: 10 }], earnedGold: 100 });

test('purchase policy: all catalogue prices stay shared and ordinary purchase does not invent credit', () => {
  assert.equal(C.GEAR.length, 15); assert.equal(C.DEN_ITEMS.length, 21);
  assert.equal(C.item('gear', 'w1').cost, 120); assert.equal(C.item('cosmetic', 'fr_gold').cost, 900);
  assert.equal(C.item('den', 'moon-tower').cost, 420);
  assert.equal(Object.isFrozen(C.GEAR[0]), true);
  assert.match(app, /State\._guideNoteAttempt = null; State\._guideCalendarAttempt = null; State\._habitCompletionAttempt = null/);
  assert.deepEqual(P.validate(context(), { purchases: [row()] }), { ok: true });
  assert.equal(P.earnedGold({ tasks: [{ done: true, goldAwarded: 13 }, { done: false, goldAwarded: 999 }],
    habitlog: { day: { h: { gold: 7 } } }, goals: [{ completedAt: 'today', xpReward: 60 }],
    lootbox: { goldWon: 9 }, adminGold: 3, partyGold: 150 }), 203);
});
for (const [label, mutation, reason] of [
  ['discount', (c, d) => d.purchases[0].cost = 1, 'purchase_price_changed'],
  ['negative', (c, d) => d.purchases[0].cost = -1, 'purchase_price_changed'],
  ['unknown', (c, d) => d.purchases[0].rewardId = 'absent', 'purchase_price_changed'],
  ['ambiguous target', (c, d) => d.purchases[0].gearId = 'w1', 'invalid_purchase_target'],
  ['not enough gold', c => c.earnedGold = 9, 'insufficient_gold'],
  ['credit unreadable', c => c.earnedGold = null, 'insufficient_gold'],
  ['duplicate ID', (c, d) => d.purchases.push(row()), 'invalid_purchase'],
  ['legacy ID spend bypass', (c, d) => d.purchases[0].id = 'oath_fake', 'invalid_purchase'],
  ['price changed in same request', (c, d) => { d.purchases[0].cost = 0; d.rewards = [{ id: 'r1', cost: 0 }]; }, 'purchase_price_changed'],
  ['rewrite history', (c, d) => { c.purchases = [row()]; d.purchases[0].cost = 0; }, 'purchase_history_changed'],
  ['delete history', (c, d) => { c.purchases = [row()]; d.purchases = []; }, 'purchase_history_changed'],
]) test('purchase rejection: ' + label, () => {
  const c = context(), d = { purchases: [row()] }; mutation(c, d);
  assert.deepEqual(P.validate(c, d), { ok: false, reason });
});
test('gear receipt requires the same item grant, rejects repeat ownership and preserves old history', () => {
  const c = { ...context(), earnedGold: 500 }, data = { purchases: [{ id: 'gear', gearId: 'w1', cost: 120, at: row().at }] };
  assert.equal(P.validate(c, data).reason, 'missing_purchase_item');
  data.settings = { gear: { owned: ['w1'] } };
  assert.equal(P.validate(c, data).ok, true);
  c.settings = data.settings; assert.equal(P.validate(c, data).reason, 'already_owned');
  assert.equal(P.validate({ ...context(), purchases: [{ id: 'historic', cost: 30 }] },
    { purchases: [{ id: 'historic', cost: 30 }, row()] }).ok, true);
});

test('Guide Notes and Calendar retain the real reducer result and reject stale account/target', async () => {
  for (const [chapter, completion, slot, candidate] of [
    ['notes', 'note-persisted', 'inbox', [{ id: 'note', kind: 'text', text: 'Real note' }]],
    ['calendar', 'task-date-persisted', 'tasks', [{ id: 'task', title: 'Real task', startTime: '12:00' }]],
  ]) {
    let attempts = 0, now = 1; const writes = [], applied = [];
    const c = { window: { GuideV3: Guide }, State: { me: { id: 'a' }, settings: { guideV3: Guide.normalize({
      enabled: true, currentChapter: chapter, currentStep: 'engage',
      chapterMeta: { [chapter]: { candidateId: candidate[0].id } } }) } },
      Store: { _writeEpoch: 1 }, _guideV3WriteEpoch: 1, structuredClone, Date: { now: () => ++now },
      taskWriteAllowed: () => true, validateTasksPayload: () => true, inboxWriteAllowed: () => true,
      validateInboxPayload: () => true, track: () => {},
      guideV3ContextActive: () => true, featureSnapshotCommit: async (kind, data) => { writes.push(data); return ++attempts > 1; } };
    c.guideV3Exclusive = op => op({ epoch: c._guideV3WriteEpoch, accountId: c.State.me.id });
    vm.createContext(c); vm.runInContext(app.slice(app.indexOf('const guideV3FeatureAttempts ='), app.indexOf('let _guideV3SurfaceKey =')), c);
    const call = () => c.guideV3FeatureCommit(chapter, completion, candidate[0].id, { [slot]: candidate }, data => applied.push(data));
    assert.equal(await call(), false); assert.equal(applied.length, 0); assert.equal(c.State.settings.guideV3.currentStep, 'engage');
    assert.equal(await call(), true); assert.equal(writes[0], writes[1]); assert.equal(applied.length, 1);
    assert.equal(c.State.settings.guideV3.currentStep, 'complete');
    c.State.me.id = 'b'; assert.equal(await call(), false); assert.equal(writes.length, 2);
  }
});

test('feature transport keeps byte-identical body, rejects malformed receipts and delayed cross-account responses', async () => {
  const attempts = [], remembered = [];
  const candidate = { habits: [{ id: 'h', title: 'Read', days: [1] }] };
  let mode = 'lost';
  const c = { window: { EconomyWriteV1: W }, State: { me: { id: 'a' } }, structuredClone, AbortSignal, console: { error() {} },
    pwaWriteAllowed: () => true, habitWriteAllowed: () => true,
    dedicatedCommitPayload: (data, extra) => ({ data, ...extra }), commitmentBoundaryRejected: async () => false,
    rememberDedicatedCommitSlots: data => { remembered.push(data); return true; },
    Store: { _writeEpoch: 1, _persisted: { habits: snap([]) } },
    fetch: async (url, options) => {
      attempts.push(options.body);
      if (mode === 'lost') throw Error('lost response');
      if (mode === 'switch') c.State.me.id = 'b';
      const sent = JSON.parse(options.body);
      return { status: 200, ok: true, json: async () => ({ ok: true, snapshots: mode === 'malformed' ? {} : { habits: snap(sent.data.habits) } }) };
    } };
  c.Store.runExclusive = async (names, op) => { assert.ok(names.includes('settings') && names.includes('tasks')); return op({ writeEpoch: 1, accountId: c.State.me.id }); };
  vm.createContext(c); vm.runInContext(app.slice(app.indexOf('const featureSnapshotRequests ='), app.indexOf('async function reloadHabitData')), c);
  assert.equal(await c.habitDataCommit(candidate), false);
  mode = 'malformed'; assert.equal(await c.habitDataCommit(candidate), false); assert.equal(remembered.length, 0);
  mode = 'ok'; assert.equal(await c.habitDataCommit(candidate), true);
  assert.equal(new Set(attempts).size, 1); assert.deepEqual(remembered[0], candidate);
  mode = 'switch'; assert.equal(await c.habitDataCommit({ habits: [] }), false); assert.equal(remembered.length, 1);
});

test('Guide + habits shared WAL: SIGKILL rollback/rollforward, repeat, parallel tabs, privacy, price rejection', { timeout: 70000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-features253-'));
  const base = 'http://127.0.0.1:' + (53100 + process.pid % 300); let child;
  const stop = async () => { if (child && child.exitCode === null && child.signalCode === null) await new Promise(r => { child.once('exit', r); child.kill(); }); };
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const start = async (extra = {}) => {
    child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: base.split(':').pop(), PUSH_SCHED: 'off', ...extra }, stdio: 'pipe' });
    let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    for (let i = 0; i < 250; i++) {
      if (child.exitCode !== null) throw Error(output);
      try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {}
      await new Promise(r => setTimeout(r, 20));
    }
    throw Error(output);
  };
  const api = async (route, cookie = '', data, method) => {
    const res = await fetch(base + route, { method: method || (data === undefined ? 'GET' : 'POST'),
      headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: res.status, data: await res.json(), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  };
  await start();
  const user = await api('/api/auth/register', '', { name: 'Feature QA', email: 'feature253@example.test', password: 'only-test253' });
  const other = await api('/api/auth/register', '', { name: 'Other QA', email: 'other253@example.test', password: 'only-test253' });
  assert.equal(user.status, 200); const cookie = user.cookie;
  const read = async n => { const v = await api('/api/data/' + n, cookie); assert.ok([200, 404].includes(v.status)); return snap(v.status === 404 ? undefined : v.data); };
  const make = async data => ({ version: 3, data,
    featureBase: Object.fromEntries(await Promise.all(Object.keys(data).map(async n => [n, await read(n)]))),
    base: { settings: await read('settings'), tasks: await read('tasks') } });
  const settings = { guideV3: { version: 3, currentChapter: 'notes', currentStep: 'complete' } };
  for (const [kind, slot, value] of [
    ['guide', 'inbox', [{ id: 'note', kind: 'text', text: 'Never lose this' }]],
    ['guide', 'tasks', [{ id: 'task', title: 'Schedule this', startTime: '12:00' }]],
    ['habits', 'habits', [{ id: 'habit', title: 'Read', days: [1] }]],
    ['habits', 'habitlog', { '2026-09-09': { habit: { xp: 5, gold: 5, at: row().at } } }],
  ]) {
    const data = { [slot]: value, settings: { ...settings, marker: slot } }, payload = await make(data);
    await stop(); await start({ COMMITMENT_CRASH_AT: 'after_' + slot + '_write' });
    await assert.rejects(api('/api/' + kind + '/commit', cookie, payload)); await stop(); await start();
    for (const n of Object.keys(data)) assert.deepEqual(await read(n), payload.featureBase[n], 'rollback ' + n);
    await stop(); await start({ COMMITMENT_CRASH_AT: 'after_committed_journal' });
    await assert.rejects(api('/api/' + kind + '/commit', cookie, payload)); await stop(); await start();
    for (const n of Object.keys(data)) assert.deepEqual((await read(n)).value, data[n], 'rollforward ' + n);
    const replay = await api('/api/' + kind + '/commit', cookie, payload);
    assert.equal(replay.status, 200); assert.equal(replay.data.replay, true);
    assert.equal((await api('/api/' + kind + '/commit', '', payload)).status, 401);
    assert.equal((await api('/api/data/' + slot, other.cookie)).status, 404);
    assert.equal((await api('/api/' + kind + '/commit', cookie, { ...payload, featureBase: {} })).status, 400);
  }
  const a = await make({ habitlog: { '2026-09-09': { a: { xp: 1 } } } }), b = { ...a, data: { habitlog: { '2026-09-09': { b: { xp: 1 } } } } };
  assert.deepEqual((await Promise.all([api('/api/habits/commit', cookie, a), api('/api/habits/commit', cookie, b)])).map(r => r.status).sort(), [200, 409]);
  const balanceData = [{ id: 'credit', done: true, goldAwarded: 25 }];
  assert.equal((await api('/api/data/tasks', cookie, balanceData, 'PUT')).status, 200);
  assert.equal((await api('/api/data/rewards', cookie, context().rewards, 'PUT')).status, 200);
  const spend = async purchases => api('/api/economy/commit', cookie, { version: 2, data: { purchases },
    economyBase: { purchases: await read('purchases') }, base: { settings: await read('settings'), tasks: await read('tasks') } });
  assert.equal((await spend([row({ cost: 1 })])).status, 409);
  assert.equal((await read('purchases')).exists, false, 'invalid price writes nothing');
  assert.equal((await spend([row()])).status, 200);
  assert.equal((await spend([row(), row({ id: 'p2' }), row({ id: 'p3' })])).status, 409, 'server balance prevents overspend');
  assert.equal((await read('purchases')).value.length, 1);
  assert.equal((await spend([])).status, 409, 'history cannot be removed by economy endpoint');
  fs.writeFileSync(path.join(dir, 'users', user.data.id, '.commitment-journal-v1.json'), '{broken');
  assert.equal((await api('/api/data/inbox', cookie)).status, 409);
  assert.equal((await api('/api/habits/commit', cookie, a)).status, 409);
});
