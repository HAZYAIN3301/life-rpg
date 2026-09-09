'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const W = require('../public/economy-write-v1'), J = require('../public/commitment-journal-v1');
const root = path.resolve(__dirname, '..');
const snap = (value) => ({ exists: value !== undefined, value: value === undefined ? null : value });

test('economy exact-base policy: immutable replay, concurrent conflict and invalid snapshots', () => {
  const actual = { purchases: snap([]) }, data = { purchases: [{ id: 'one', cost: 10 }] };
  assert.equal(W.decide(actual, data, actual), 'commit');
  assert.equal(W.decide({ purchases: snap(data.purchases) }, data, actual), 'replay');
  assert.equal(W.decide({ purchases: snap([...data.purchases, { id: 'two' }]) }, data, actual), 'conflict');
  assert.equal(W.decide(actual, data, {}), 'invalid');
  assert.equal(W.decide(actual, { secret: {} }, actual), 'invalid');
  assert.equal(W.decide({ purchases: snap(null) }, data, actual), 'invalid');
  assert.equal(W.decide({ settings: snap({ b: 2, a: 1 }) }, { settings: { a: 1, b: 2 } }, { settings: snap({}) }), 'replay');
  assert.deepEqual(actual.purchases.value, []);
});

test('one existing WAL carries item, spend, voucher, perk and protected pair without losing legacy compatibility', () => {
  const data = { settings: { gear: { owned: ['w1'] } }, tasks: [], skilltree: {}, purchases: [{ id: 'p1' }], rewards: [], lootbox: { vouchers: [] } };
  const base = Object.fromEntries(Object.keys(data).map(n => [n, snap()]));
  const p = J.prepare({ txId: 'economy:test:one', createdAt: '2026-09-09T12:00:00.000Z', base, data });
  assert.equal(p.ok, true);
  assert.equal(J.recoveryPlan(p.journal).actions.every(a => a.op === 'remove'), true);
  const c = J.markCommitted(p.journal, '2026-09-09T12:00:01.000Z');
  assert.deepEqual(Object.fromEntries(J.recoveryPlan(c.journal).actions.map(a => [a.name, a.value])), data);
  const bad = structuredClone(p.journal); bad.files.purchases.after[0].id = 'tampered';
  assert.equal(J.validate(bad), false);
});

test('economy real server: crash recovery, stable retry, exact CAS, Guide purchase, privacy and corrupt WAL', { timeout: 45000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-economy251-'));
  const base = `http://127.0.0.1:${52100 + process.pid % 300}`; let child;
  const stop = async () => { if (child && child.exitCode === null && child.signalCode === null) await new Promise(r => { child.once('exit', r); child.kill(); }); };
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const start = async (extra = {}) => {
    child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: base.split(':').pop(), PUSH_SCHED: 'off', ...extra }, stdio: 'pipe' });
    let output = ''; child.stderr.on('data', b => { output += b; }); child.stdout.on('data', b => { output += b; });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error(output); try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {} await new Promise(r => setTimeout(r, 20)); }
    throw Error('server not ready: ' + output);
  };
  const req = async (route, cookie = '', body) => { const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); let data; try { data = await response.json(); } catch {} return { status: response.status, data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] }; };
  await start();
  const user = await req('/api/auth/register', '', { name: 'Economy QA', email: 'economy251@example.test', password: 'test-only-economy251' });
  const other = await req('/api/auth/register', '', { name: 'Other QA', email: 'other251@example.test', password: 'test-only-economy251' });
  assert.equal(user.status, 200); const cookie = user.cookie;
  const read = async n => { const r = await req('/api/data/' + n, cookie); assert.ok([200, 404].includes(r.status)); return snap(r.status === 404 ? undefined : r.data); };
  const make = async data => ({ version: 2, economyBase: Object.fromEntries(await Promise.all(Object.keys(data).map(async n => [n, await read(n)]))), base: { settings: await read('settings'), tasks: await read('tasks') }, data });
  const settings = { lang: 'ru', gear: { owned: [] }, commitmentsV1: { version: 1, mode: 'default', items: [], log: {} } };
  const seed = { base: { settings: await read('settings'), tasks: await read('tasks') }, data: { settings, purchases: [] } };
  assert.equal((await req('/api/economy/commit', cookie, seed)).status, 200);
  // Synthetic earned credit and persisted catalogue; v253 rejects invented prices.
  fs.writeFileSync(path.join(dir, 'users', user.data.id, 'tasks.json'), JSON.stringify([{ id: 'earned', title: 'QA', done: true, goldAwarded: 1000 }]));
  fs.writeFileSync(path.join(dir, 'users', user.data.id, 'rewards.json'), JSON.stringify([{ id: 'r10', cost: 10 }, { id: 'r20', cost: 20 }, { id: 'r5', cost: 5 }]));
  const purchase = { id: 'stable-p1', cost: 120, at: '2026-09-09T12:00:00.000Z', gearId: 'w1' };
  const next = { settings: { ...settings, gear: { owned: ['w1'] } }, purchases: [purchase] };
  const payload = await make(next);
  assert.equal((await req('/api/economy/commit', '', payload)).status, 401);
  assert.equal((await req('/api/economy/commit', cookie, { ...payload, economyBase: {} })).status, 400);
  // Actual process death after first half: recovery must restore BOTH halves.
  await stop(); await start({ COMMITMENT_CRASH_AT: 'after_settings_write' });
  await assert.rejects(req('/api/economy/commit', cookie, payload)); await stop(); await start();
  assert.deepEqual((await read('settings')).value, settings); assert.deepEqual((await read('purchases')).value, []);
  // Actual process death after durable commit: recovery must retain BOTH halves.
  await stop(); await start({ COMMITMENT_CRASH_AT: 'after_committed_journal' });
  await assert.rejects(req('/api/economy/commit', cookie, payload)); await stop(); await start();
  assert.deepEqual((await read('settings')).value, next.settings); assert.deepEqual((await read('purchases')).value, [purchase]);
  const replay = await req('/api/economy/commit', cookie, payload); assert.equal(replay.status, 200); assert.equal(replay.data.replay, true);
  assert.deepEqual((await req('/api/data/purchases', other.cookie)).status, 404);
  // Two tabs sharing a base: only one divergent spend survives.
  const a = await make({ purchases: [purchase, { id: 'a', rewardId: 'r10', cost: 10, at: purchase.at }] });
  const b = { ...a, data: { purchases: [purchase, { id: 'b', rewardId: 'r20', cost: 20, at: purchase.at }] } };
  const results = await Promise.all([req('/api/economy/commit', cookie, a), req('/api/economy/commit', cookie, b)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const current = (await read('purchases')).value;
  assert.equal((await req('/api/economy/commit', cookie, payload)).status, 409, 'old retry cannot erase a later purchase');
  assert.deepEqual((await read('purchases')).value, current);
  // The Guide purchase path must use the same journal, not a weaker two-write exception.
  const guideSettings = { ...(await read('settings')).value, guideV3: { version: 3 } };
  const guide = { base: { settings: await read('settings'), tasks: await read('tasks') }, data: { settings: guideSettings, purchases: [...current, { id: 'guided', rewardId: 'r5', cost: 5, at: purchase.at }] } };
  await stop(); await start({ COMMITMENT_CRASH_AT: 'after_purchases_write' });
  await assert.rejects(req('/api/guide/commit', cookie, guide)); await stop(); await start();
  assert.deepEqual((await read('purchases')).value, current);
  assert.equal((await req('/api/guide/commit', cookie, guide)).status, 200);
  // Unknown file smuggling and corrupt recovery are closed, never empty success.
  assert.equal((await req('/api/economy/commit', cookie, { data: { 'party-rewards': {} } })).status, 400);
  const journal = path.join(dir, 'users', user.data.id, '.commitment-journal-v1.json');
  fs.writeFileSync(journal, '{broken');
  assert.equal((await req('/api/data/purchases', cookie)).status, 409);
  assert.equal((await req('/api/economy/commit', cookie, a)).status, 409);
});
