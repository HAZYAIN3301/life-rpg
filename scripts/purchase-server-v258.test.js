'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const snap = value => ({ exists: value !== undefined, value: value === undefined ? null : value });
const copy = value => structuredClone(value);
const at = '2026-09-12T18:00:00.000Z';
const gear = (id = 'w1', cost = 120) => ({ id: 'purchase-' + id, gearId: id, cost, at });
const reward = () => ({ id: 'purchase-r', rewardId: 'r', cost: 10, at });

test('purchase admission uses persisted personal progress and exact grants on real modern/legacy endpoints', { timeout: 60000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-purchases258-'));
  const port = 54100 + process.pid % 300, origin = 'http://127.0.0.1:' + port;
  let child, uid, cookie;
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) await new Promise(resolve => {
      child.once('exit', resolve); child.kill();
    });
  }
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'pipe',
      env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), PUSH_SCHED: 'off' } });
    let log = ''; child.stdout.on('data', b => log += b); child.stderr.on('data', b => log += b);
    for (let n = 0; n < 250; n++) {
      if (child.exitCode !== null) throw Error(log);
      try { if ((await fetch(origin + '/api/auth/profiles')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error(log || 'QA server did not start');
  }
  async function api(route, data, method = 'POST', auth = cookie) {
    const response = await fetch(origin + route, { method, headers: { Cookie: auth || '', 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, body: await response.json(), cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  }
  await start();
  const user = await api('/api/auth/register', { name: 'Purchase QA', email: 'purchase258@example.test', password: 'synthetic-only258' });
  assert.equal(user.status, 200); uid = user.body.id; cookie = user.cookie;
  const userDir = path.join(dir, 'users', uid);
  const base = () => ({ settings: { curve: { base: 100, growth: 1.3 }, skills: [{ id: 'skill' }],
    gear: { owned: [], equipped: {}, relics: [] }, cosmetics: [], den: { owned: [], slots: {}, theme: 'workshop' } },
    tasks: [{ id: 'credit', title: 'Synthetic credit', done: true, xpAwarded: 0, goldAwarded: 10000 }],
    goals: [], habitlog: {}, episodes: [], purchases: [], rewards: [{ id: 'r', name: 'Personal reward', cost: 10 }], lootbox: {}, skilltree: {} });
  // Only this process's synthetic DATA_DIR is seeded; no live account or generic-write gate is bypassed in production.
  function seed(patch = {}, tier = 'free') {
    const state = { ...base(), ...copy(patch) };
    for (const [name, value] of Object.entries(state)) fs.writeFileSync(path.join(userDir, name + '.json'), JSON.stringify(value));
    const usersFile = path.join(dir, 'users.json'), users = JSON.parse(fs.readFileSync(usersFile));
    const record = users.find(row => row.id === uid); record.plan = tier; record.isAdmin = false;
    record.trialStartedAt = '2020-01-01T00:00:00.000Z'; record.proUntil = null;
    fs.writeFileSync(usersFile, JSON.stringify(users));
    return state;
  }
  function disk(name) { return JSON.parse(fs.readFileSync(path.join(userDir, name + '.json'))); }
  function make(data, state, route = 'economy', legacy = false) {
    return { data, base: { settings: snap(state.settings), tasks: snap(state.tasks) },
      ...(legacy ? {} : route === 'economy'
        ? { version: 2, economyBase: Object.fromEntries(Object.keys(data).map(name => [name, snap(state[name])])) }
        : { version: 3, featureBase: Object.fromEntries(Object.keys(data).map(name => [name, snap(state[name])])) }) };
  }
  async function rejected(data, state, reason, route = 'economy', legacy = false, extra = {}) {
    const before = Object.fromEntries(Object.keys(state).map(name => [name, fs.readFileSync(path.join(userDir, name + '.json'), 'utf8')]));
    const response = await api('/api/' + route + '/commit', { ...make(data, state, route, legacy), ...extra });
    assert.equal(response.status, 409, JSON.stringify(response.body)); assert.equal(response.body.error, reason);
    for (const [name, bytes] of Object.entries(before)) assert.equal(fs.readFileSync(path.join(userDir, name + '.json'), 'utf8'), bytes, name + ' unchanged');
  }

  for (const legacy of [false, true]) await t.test((legacy ? 'legacy' : 'modern') + ' cannot buy level 18 gear with only gold', async () => {
    const state = seed(), settings = copy(state.settings); settings.gear.owned.push('w4'); settings.gear.equipped.weapon = 'w4';
    settings.imported = { skill: { xp: 999999 } }; settings.curve.base = 1;
    await rejected({ settings, purchases: [gear('w4', 3200)] }, state, 'purchase_level_required', 'economy', legacy,
      { personalLevel: 999, tier: 'pro', uid: 'someone-else' });
  });
  await t.test('imported personal mastery unlocks at the exact personal threshold; leaderboard is not the source', async () => {
    const initial = base(); initial.settings.imported = { skill: { xp: 619 } };
    const state = seed(initial), settings = copy(state.settings); settings.gear.owned.push('w2'); settings.gear.equipped.weapon = 'w2';
    const payload = make({ settings, purchases: [gear('w2', 450)] }, state);
    const saved = await api('/api/economy/commit', payload); assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(disk('purchases').length, 1); assert.deepEqual(disk('settings').gear.owned, ['w2']);
    await stop(); await start();
    const replay = await api('/api/economy/commit', payload); assert.equal(replay.status, 200); assert.equal(replay.body.replay, true);
    assert.equal(disk('purchases').length, 1, 'retry after restart never spends twice');
  });
  await t.test('legacy goals use the same loaded defaults as the app', async () => {
    const state = seed({ goals: [0, 1, 2].map(i => ({ id: 'g' + i, type: 'mid', completedAt: at })) });
    const settings = copy(state.settings); settings.den.owned.push('theme:moon-tower'); settings.den.theme = 'moon-tower';
    const result = await api('/api/economy/commit', make({ settings,
      purchases: [{ id: 'den', denId: 'moon-tower', cost: 420, at }] }, state));
    assert.equal(result.status, 200, JSON.stringify(result.body));
  });
  await t.test('malformed progress does not become level one', async () => {
    const state = seed({ episodes: [{ from: 'invalid', to: '2026-09-12', profile: [] }] });
    const settings = copy(state.settings); settings.gear.owned.push('w1');
    await rejected({ settings, purchases: [gear()] }, state, 'purchase_progress_unavailable');
  });
  for (const [label, mutate, reason] of [
    ['extra paid gear', s => s.gear.owned.push('w4'), 'purchase_ownership_changed'],
    ['extra cosmetic', s => s.cosmetics.push('fr_phoenix'), 'purchase_ownership_changed'],
    ['extra paid den token', s => s.den.owned.push('theme:moon-tower'), 'purchase_ownership_changed'],
    ['unowned equipped gear', s => s.gear.equipped.weapon = 'w4', 'invalid_purchase_equipment'],
    ['wrong equipment slot', s => s.gear.equipped.amulet = 'w1', 'invalid_purchase_equipment'],
    ['new random-power relic', s => s.gear.relics.push({ uid: 'fake', xpPct: 999 }), 'purchase_relics_changed'],
    ['free account Pro room', s => s.den.theme = 'spirit-house', 'purchase_pro_required'],
  ]) await t.test('rejects piggyback ' + label + ' without writing any file', async () => {
    const state = seed(), settings = copy(state.settings); settings.gear.owned.push('w1'); mutate(settings);
    await rejected({ settings, purchases: [gear()] }, state, reason);
  });
  for (const name of ['lootbox', 'skilltree', 'rewards']) await t.test('purchase cannot also mint or rewrite ' + name, async () => {
    const state = seed(), value = name === 'rewards' ? [{ id: 'free-new', cost: 0 }] : { fakeGrant: 999999 };
    await rejected({ purchases: [reward()], [name]: value }, state, 'purchase_credit_changed');
  });
  for (const legacy of [false, true]) await t.test((legacy ? 'legacy' : 'modern') + ' Guide cannot smuggle inventory with a real reward purchase', async () => {
    const initial = base(); initial.settings.guideV3 = { version: 3, currentChapter: 'rewards', currentStep: 'engage' };
    const state = seed(initial), settings = copy(state.settings); settings.guideV3.currentStep = 'complete'; settings.gear.owned.push('w4');
    await rejected({ settings, purchases: [reward()] }, state, 'purchase_ownership_changed', 'guide', legacy);
  });
  await t.test('starter initialization, old ownership/relics and expired unchanged Pro selection survive purchase', async () => {
    const initial = base(); initial.settings.gear.owned = ['legacy-unknown', 'w4'];
    initial.settings.gear.equipped.weapon = 'w4'; initial.settings.gear.relics = [{ uid: 'old', xpPct: 8 }];
    initial.settings.den.theme = 'spirit-house';
    const state = seed(initial), settings = copy(state.settings); settings.gear.owned.push('w1');
    const catalogue = require('../public/shop-catalog-v1');
    settings.den.owned = ['theme:workshop', ...catalogue.DEN_ITEMS.filter(item => item.access === 'starter').map(item => item.id)];
    const result = await api('/api/economy/commit', make({ settings, purchases: [gear()] }, state));
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.deepEqual(disk('settings'), settings);
  });
  await t.test('settings-only equipment and chest owners retain their previous transport', async () => {
    const state = seed(), settings = copy(state.settings); settings.marker = 'existing-owner';
    const result = await api('/api/economy/commit', make({ settings, lootbox: { goldWon: 12, opened: 1 } }, state));
    assert.equal(result.status, 200); assert.equal(disk('lootbox').goldWon, 12);
    assert.equal((await api('/api/economy/commit', make({ purchases: [] }, state), 'POST', '')).status, 401);
  });
});
