'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const Policy = require('../public/settings-inventory-policy-v1'), Chest = require('../public/chest-claim-v1');
const ROOT = path.resolve(__dirname, '..'), copy = value => structuredClone(value);
const snap = value => ({ exists: value !== undefined, value: value === undefined ? null : copy(value) });
const day = () => new Date().toISOString().slice(0, 10);
const fixture = () => ({ settings: { lang: 'ru', skills: [{ id: 's', name: 'Skill' }], curve: { base: 100, growth: 1.3 },
  guideV3: { version: 3, currentChapter: 'notes', currentStep: 'complete' },
  gear: { owned: [], equipped: {}, relics: [] }, cosmetics: [], equipped: { title: 'old' },
  den: { owned: [], slots: {}, theme: 'workshop' } },
  tasks: [{ id: 'credit', title: 'Personal history', done: true, date: day(), xpAwarded: 0, goldAwarded: 10000 }],
  goals: [], 'goal-groups': [], habitlog: {}, habits: [], antihabits: [], episodes: [], purchases: [], rewards: [],
  lootbox: { day: day(), opened: 0, carry: 0, goldWon: 7, history: [] }, skilltree: {}, inbox: [] });
const archive = data => ({ format: 'satoru-account', version: 1, data });
async function runtime(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-ownership261-'));
  const port = 54700 + process.pid % 250, base = 'http://127.0.0.1:' + port;
  // Deterministic entropy belongs to this isolated test server only. HTTP still
  // accepts no prize/entropy fields; production retains crypto.randomInt.
  const preload = path.join(dir, 'test-entropy.cjs');
  fs.writeFileSync(preload, "const c=require('node:crypto'), original=c.randomInt; let n=0; c.randomInt=function(a,b,...rest){return a===0&&b===0x100000000?Math.floor([0,.7,0][n++%3]*b):original.call(this,a,b,...rest)};\n");
  const child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: ROOT,
    env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), PUSH_SCHED: 'off',
      COMMITMENT_CRASH_AT: '', COMMITMENT_FAIL_AFTER_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null)
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    fs.rmSync(dir, { recursive: true, force: true });
  });
  let ready = false;
  for (let n = 0; n < 300; n++) {
    if (child.exitCode !== null) throw Error(output);
    try { if ((await fetch(base + '/api/auth/profiles')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  assert.equal(ready, true, output);
  let cookie = '';
  const api = async (route, data, method = data === undefined ? 'GET' : 'POST', auth = cookie) => {
    const response = await fetch(base + route, { method, headers: { Cookie: auth, 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000) });
    return { status: response.status, body: await response.json(), cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  };
  const user = await api('/api/auth/register', { name: 'Ownership QA', email: 'ownership261@example.test', password: 'synthetic-only261' });
  assert.equal(user.status, 200); cookie = user.cookie;
  const userDir = path.join(dir, 'users', user.body.id);
  const role = (plan = 'free', isAdmin = false) => {
    const file = path.join(dir, 'users.json'), users = JSON.parse(fs.readFileSync(file));
    Object.assign(users.find(row => row.id === user.body.id), { plan, isAdmin, proUntil: null, trialStartedAt: '2020-01-01T00:00:00.000Z' });
    fs.writeFileSync(file, JSON.stringify(users));
  };
  const seed = (patch = {}) => {
    const state = { ...fixture(), ...copy(patch) }; role();
    for (const [name, value] of Object.entries(state)) fs.writeFileSync(path.join(userDir, name + '.json'), JSON.stringify(value));
    fs.rmSync(path.join(userDir, 'chest-receipts.json'), { force: true });
    return state;
  };
  const read = name => JSON.parse(fs.readFileSync(path.join(userDir, name + '.json')));
  const bytes = () => {
    const rows = {};
    function visit(where, prefix = '') {
      for (const entry of fs.readdirSync(where, { withFileTypes: true })) {
        const file = path.join(where, entry.name), name = prefix + entry.name;
        if (entry.isDirectory()) visit(file, name + '/'); else rows[name] = fs.readFileSync(file, 'utf8');
      }
    }
    visit(userDir); return rows;
  };
  return { api, seed, read, bytes, role, userDir, uid: user.body.id };
}
function pairBase(state) { return { settings: snap(state.settings), tasks: snap(state.tasks) }; }
function envelope(state, data, route, legacy = false) {
  return { data, base: pairBase(state), ...(legacy ? {} : route === 'economy'
    ? { version: 2, economyBase: Object.fromEntries(Object.keys(data).map(n => [n, snap(state[n])])) }
    : { version: 3, featureBase: Object.fromEntries(Object.keys(data).map(n => [n, snap(state[n])])) }) };
}
function withGraph(settings) {
  return { ...settings, commitmentsV1: { version: 1, mode: 'default', items: [], log: {} } };
}
test('ownership HTTP admission covers every ordinary settings writer and preserves explicit grants/restoration', { timeout: 60000 }, async t => {
  const r = await runtime(t);
  async function deny(route, data, reason = 'inventory_ownership_changed', method = 'POST') {
    const before = r.bytes(), result = await r.api(route, data, method);
    assert.equal(result.status, 422, route + ': ' + JSON.stringify(result.body));
    assert.equal(result.body.error, reason); assert.deepEqual(r.bytes(), before, 'no account files or backups changed');
  }
  for (const method of ['PUT', 'POST']) await t.test('generic settings ' + method + ' cannot add unpaid inventory', async () => {
    const state = r.seed(), settings = copy(state.settings); settings.gear.owned.push('w4');
    settings.inventoryAuthority = [{ kind: 'gear', id: 'w4' }]; settings.trustedGrant = true;
    await deny('/api/data/settings', settings, undefined, method);
  });
  for (const route of ['economy', 'guide', 'habits']) for (const legacy of [false, true])
    await t.test(route + ' ' + (legacy ? 'legacy' : 'modern') + ' settings-only/batched bypass changes no file', async () => {
      const state = r.seed(), settings = copy(state.settings); settings.cosmetics.push('fr_phoenix');
      const data = route === 'guide' ? { settings, inbox: [{ id: 'note', kind: 'text', text: 'must not be written' }] }
        : route === 'habits' ? { settings, habitlog: { [day()]: { h: { xp: 10 } } } }
        : { settings, lootbox: { ...state.lootbox, goldWon: 99999 } };
      await deny('/api/' + route + '/commit', { ...envelope(state, data, route, legacy),
        inventoryAuthority: [{ kind: 'cosmetic', id: 'fr_phoenix' }], trustedGrant: true, tier: 'pro' });
    });
  await t.test('Board cannot smuggle inventory beside its own settings and tasks', async () => {
    const state = r.seed(), settings = copy(state.settings); settings.den.owned.push('theme:moon-tower');
    settings.board = { active: [], done: [], rested: [] };
    await deny('/api/board/commit', { base: pairBase(state), data: { settings, tasks: [] } });
  });
  for (const reconcile of [false, true]) await t.test('Commitment ' + (reconcile ? 'server reconciliation' : 'exact base') + ' cannot mint', async () => {
    const initial = fixture(); initial.settings = withGraph(initial.settings);
    const state = r.seed(initial), settings = copy(state.settings); settings.gear.relics.push({ uid: 'forged', xpPct: 999 });
    await deny('/api/commitments/commit', { base: reconcile ? 'server' : pairBase(state),
      data: { settings, tasks: [] }, ...(reconcile ? { inventoryAuthority: 'inventory replacement' } : {}) }, 'inventory_relics_changed');
  });
  await t.test('extended goal graph denies before changing any of its five files', async () => {
    const state = r.seed(), settings = copy(state.settings); settings.gear.owned.push('w4');
    const names = ['settings', 'tasks', 'goals', 'groups', 'skilltree'];
    await deny('/api/goals/commit', { base: Object.fromEntries(names.map(n => [n, snap(state[n === 'groups' ? 'goal-groups' : n])])),
      data: { settings, tasks: [], goals: [], groups: [], skilltree: {} } });
  });
  await t.test('a stale Commitment base remains a revision conflict even when it predates an inventory grant', async () => {
    const initial = fixture(); initial.settings = withGraph(initial.settings);
    const old = copy(initial); initial.settings.gear.owned.push('w4'); r.seed(initial);
    const before = r.bytes(), result = await r.api('/api/commitments/commit', {
      base: pairBase(old), data: { settings: old.settings, tasks: old.tasks } });
    assert.equal(result.status, 409); assert.equal(result.body.error, 'commitment_revision_conflict'); assert.deepEqual(r.bytes(), before);
  });
  for (const [label, mutate, reason] of [
    ['unowned weapon', s => s.gear.equipped.weapon = 'w4', 'inventory_invalid_selection'],
    ['unowned cosmetic', s => s.equipped.frame = 'fr_phoenix', 'inventory_invalid_selection'],
    ['unowned Den item', s => s.den.slots.wall = 'wall-moon', 'inventory_invalid_selection'],
    ['Pro theme spoof', s => { s.den.theme = 'spirit-house'; s.plan = 'pro'; }, 'inventory_pro_required'],
    ['new relic', s => s.gear.relics.push({ uid: 'bad', xpPct: 999 }), 'inventory_relics_changed'],
  ]) await t.test(label + ' is rejected on generic settings', async () => {
    const state = r.seed(), settings = copy(state.settings); mutate(settings);
    await deny('/api/data/settings', settings, reason, 'PUT');
  });
  await t.test('fresh starter initialization and unrelated settings/Guide/Board title unlocks remain saveable', async () => {
    const state = r.seed({ settings: {} }), settings = { gear: { owned: [], relics: [], equipped: {} }, cosmetics: [],
      equipped: { frame: null, background: null, title: 'achievement title' }, boardV2Titles: ['Board title'],
      den: { owned: [...Policy.starterTokens], theme: 'workshop', slots: { wall: 'wall-map', floor: 'floor-traveller' } } };
    const result = await r.api('/api/data/settings', settings, 'PUT'); assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(r.read('settings'), settings);
    state.settings = settings;
    const guided = { ...copy(settings), guideV3: { version: 3, currentChapter: 'notes', currentStep: 'complete' } };
    assert.equal((await r.api('/api/guide/commit', envelope(state, { settings: guided }, 'guide'))).status, 200);
  });
  for (const route of ['economy', 'guide']) await t.test('exact catalog purchase remains admitted through ' + route, async () => {
    const state = r.seed(), settings = copy(state.settings); settings.gear.owned.push('w1'); settings.gear.equipped.weapon = 'w1';
    const purchases = [{ id: 'paid-' + route, gearId: 'w1', cost: 120, at: new Date().toISOString() }];
    const payload = envelope(state, { settings, purchases }, route);
    const result = await r.api('/api/' + route + '/commit', payload); assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(r.read('settings'), settings); assert.deepEqual(r.read('purchases'), purchases);
    const before = r.bytes(), replay = await r.api('/api/' + route + '/commit', payload);
    assert.equal(replay.status, 200); assert.equal(replay.body.replay, true); assert.deepEqual(r.bytes(), before);
  });
  await t.test('server-issued cosmetic chest is exact, replayable, and cannot be selected by the browser', async () => {
    const state = r.seed(), payload = { version: 1, requestId: 'chest_' + crypto.randomUUID(), timeZone: 'UTC',
      base: Object.fromEntries(Chest.FILES.map(n => [n, snap(state[n])])) };
    const before = r.bytes();
    assert.equal((await r.api('/api/rewards/chest', { ...payload, prize: { type: 'cosmetic_capsule', cosmeticId: 'fr_phoenix', rarity: 'legendary' } })).status, 400);
    assert.deepEqual(r.bytes(), before);
    const result = await r.api('/api/rewards/chest', payload); assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(Chest.receiptValid(result.body, payload), true); assert.equal(result.body.prize.type, 'cosmetic_capsule');
    assert.deepEqual(r.read('settings').cosmetics, [result.body.prize.cosmeticId]);
    const once = r.bytes(); assert.equal((await r.api('/api/rewards/chest', payload)).body.replayed, true);
    assert.deepEqual(r.bytes(), once);
  });
  for (const modern of [false, true]) await t.test((modern ? 'previewed' : 'legacy') + ' portable import preserves personal XP/gold/items and later selection', async () => {
    const state = r.seed(), settings = copy(state.settings);
    settings.gear.owned = ['w4', 'old-unknown', { old: 'token' }]; settings.gear.relics = [{ uid: 'old', xpPct: 8, name: 'Legacy' }];
    settings.cosmetics = ['fr_phoenix', 'legacy-cosmetic']; settings.den.owned = ['theme:moon-tower', 'old-den'];
    settings.den.theme = 'spirit-house'; settings.imported = { s: { xp: 1000 } };
    const data = { settings, lootbox: { goldWon: 12345, history: [{ old: 'kept' }] }, purchases: [{ id: 'old', cost: 1 }] };
    let payload = archive(data);
    if (modern) {
      payload = { ...payload, writeVersion: 2, requestId: 'import_' + crypto.randomUUID() };
      const preview = await r.api('/api/account/import/preview', payload); assert.equal(preview.status, 200, JSON.stringify(preview.body));
      payload.ticket = preview.body.ticket;
    }
    const result = await r.api('/api/account/import', payload); assert.equal(result.status, 200, JSON.stringify(result.body));
    for (const name of Object.keys(data)) assert.deepEqual(r.read(name), data[name]);
    const next = copy(settings); next.gear.equipped = { weapon: 'w4', relic: 'old' }; next.equipped.frame = 'fr_phoenix'; next.lang = 'de';
    assert.equal((await r.api('/api/data/settings', next, 'PUT')).status, 200);
    assert.deepEqual(r.read('settings'), next, 'previously imported selections do not acquire a new level restriction');
    next.gear.relics[0].xpPct = 999; await deny('/api/data/settings', next, 'inventory_relics_changed', 'PUT');
    const reset = await r.api('/api/account/import', archive({ settings: {}, tasks: [], purchases: [], lootbox: {} }));
    assert.equal(reset.status, 200, JSON.stringify(reset.body)); assert.deepEqual(r.read('settings'), {});
  });
  await t.test('actual Pro permits subscription selection without granting paid ownership', async () => {
    const state = r.seed(); r.role('pro'); const settings = copy(state.settings);
    settings.den.theme = 'spirit-house'; settings.den.slots.wall = 'wall-eyes';
    assert.equal((await r.api('/api/data/settings', settings, 'PUT')).status, 200);
    settings.den.owned.push('theme:moon-tower'); await deny('/api/data/settings', settings, undefined, 'PUT');
  });
  await t.test('ordinary settings cannot increase previously owned duplicate counts', async () => {
    const initial = fixture(); initial.settings.gear.owned = ['w4', 'w4'];
    const state = r.seed(initial), settings = copy(state.settings); settings.gear.owned.push('w4');
    await deny('/api/data/settings', settings, undefined, 'PUT');
    settings.gear.owned = ['w4']; assert.equal((await r.api('/api/data/settings', settings, 'PUT')).status, 200);
  });
  for (const method of ['PUT', 'POST']) await t.test('generic purchases ' + method + ' preserves debits and admits only a catalog append', async () => {
    const old = [{ id: 'historical', cost: 40, legacy: 'preserved' }];
    r.seed({ purchases: old, rewards: [{ id: 'reward', name: 'Personal reward', cost: 10 }] });
    for (const rows of [[], [{ ...old[0], cost: 0 }]]) await deny('/api/data/purchases', rows, 'purchase_history_changed', method);
    const paid = { id: 'new', rewardId: 'reward', cost: 10, at: new Date().toISOString() };
    await deny('/api/data/purchases', [...old, { ...paid, cost: 0 }], 'purchase_price_changed', method);
    await deny('/api/data/purchases', [...old, { ...paid, gearId: 'w1' }], 'invalid_purchase_target', method);
    const result = await r.api('/api/data/purchases', [...old, paid], method);
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.deepEqual(r.read('purchases'), [...old, paid]);
    await deny('/api/data/purchases', old, 'purchase_history_changed', method);
    const legacy = [null, { id: 'old-removed-catalog', cost: -1 }]; r.seed({ purchases: legacy });
    assert.equal((await r.api('/api/data/purchases', legacy, method)).status, 200, 'exact historical data has no new admission');
  });
  await t.test('admin restore and explicit backup text repair retain their recovery authority', async () => {
    const state = r.seed(), restored = copy(state.settings); restored.gear.owned = ['w4'];
    restored.gear.relics = [{ uid: 'old', name: 'Восстановленная реликвия', xpPct: 8 }];
    const backup = path.join(r.userDir, '.backups', 'settings'); fs.mkdirSync(backup, { recursive: true });
    fs.writeFileSync(path.join(backup, '9999-restore.json'), JSON.stringify(restored));
    assert.equal((await r.api('/api/admin/userdata/' + r.uid + '/restore', { name: 'settings', stamp: '9999-restore' })).status, 403);
    r.role('free', true);
    const result = await r.api('/api/admin/userdata/' + r.uid + '/restore', { name: 'settings', stamp: '9999-restore' });
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.deepEqual(r.read('settings'), restored);
    const damaged = copy(restored); damaged.gear.relics[0].name = 'Восстановленная �';
    fs.writeFileSync(path.join(r.userDir, 'settings.json'), JSON.stringify(damaged));
    const repair = await r.api('/api/account/repair-damage', { apply: true });
    assert.equal(repair.status, 200, JSON.stringify(repair.body)); assert.deepEqual(r.read('settings'), restored);
  });
});
