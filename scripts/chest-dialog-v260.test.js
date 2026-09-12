'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Claim = require('../public/chest-claim-v1');
const Policy = require('../public/chest-reward-policy-v1');
const APP = fs.readFileSync(path.resolve(__dirname, '../public/app.js'), 'utf8');
const clone = value => structuredClone(value);
const day = '2026-09-12';
function appFunction(name) {
  const start = APP.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'actual app function exists: ' + name);
  const firstEnd = APP.indexOf('\n', start), firstLine = APP.slice(start, firstEnd);
  try { new vm.Script(firstLine); return firstLine; }
  catch { return APP.slice(start, APP.indexOf('\n}', start) + 2); }
}
const FUNCTIONS = ['ensureLootbox', 'rewardActivityCountForDate', 'todayRewardActivityCount', 'lootTierCap', 'lootChestsAvailable'].map(appFunction).join('\n');
const tasks = (count, date = day) => Array.from({ length: count }, (_, i) => ({ id: 'task-' + i, done: true, date }));
function fixture(extra = {}, today = day) {
  const input = { phase: 'app', settings: { cosmetics: ['imported-old-frame'], imported: { gold: 9000 } },
    tasks: tasks(5), habitlog: {}, me: { dailyChest: { version: 1, cursor: null } },
    lootbox: { day, opened: 0, carry: 0, goldWon: 4321, history: [{ at: 'old', label: 'Imported reward' }],
      vouchers: ['rare'], cosmeticsWon: 7, titles: ['legacy-title'], equipped: 'legacy-title',
      boost: { xpPct: 10 }, economyV124: true }, ...extra };
  const saves = [], allocations = [];
  const context = vm.createContext({ State: clone(input), today, allocations, structuredClone,
    window: { ChestClaimV1: Claim, ChestRewardPolicyV1: Policy },
    Store: { save(name, value) { saves.push({ name, value: clone(value) }); } },
    DAILY_REWARD_TRACK: [{ threshold: 1 }, { threshold: 3 }, { threshold: 5 }],
    LOOT_THRESHOLDS: [1, 3, 5], LOOT_CARRY_CAP: 5,
    todayStr: () => context.today,
    dayOf: task => task.completedAt ? new Date(task.completedAt).toISOString().slice(0, 10) : task.date,
  });
  vm.runInContext(`const originalArrayFrom = Array.from;
    Array.from = function(input, ...args) { allocations.push(input?.length); return originalArrayFrom.call(this, input, ...args); };
    ${FUNCTIONS}`, context, { timeout: 1000 });
  return { context, input, saves, allocations,
    ensure: () => vm.runInContext('ensureLootbox()', context, { timeout: 1000 }),
    available: () => vm.runInContext('lootChestsAvailable()', context, { timeout: 1000 }),
    state: () => clone(context.State) };
}

test('actual dialog overlays only issued counters and preserves imported gold/history/cosmetics', () => {
  const f = fixture({ me: { dailyChest: { version: 1, cursor: { day, opened: 3, carry: 0 } } } });
  const before = f.state(), value = f.ensure();
  assert.equal(value.opened, 3); assert.equal(value.carry, 0); assert.equal(value.day, day);
  assert.deepEqual(f.state().lootbox, { ...before.lootbox, day, opened: 3, carry: 0 });
  assert.deepEqual(f.state().settings, before.settings);
  assert.equal(f.available(), 0); assert.equal(f.available(), 0);
  assert.deepEqual(f.saves, []); assert.deepEqual(f.allocations, []);
});

test('old import cannot make consumed issued slots available even after counter reset or lootbox removal', () => {
  for (const imported of [null, { day: '2026-01-01', opened: 0, carry: 5, goldWon: 900, history: [], vouchers: [], economyV124: true }]) {
    const f = fixture({ me: { dailyChest: { version: 1, cursor: { day, opened: 3, carry: 0 } } }, lootbox: imported });
    assert.equal(f.available(), 0);
    assert.equal(f.state().lootbox.opened, 3); assert.equal(f.state().lootbox.carry, 0);
    if (imported) assert.equal(f.state().lootbox.goldWon, 900);
  }
});

test('next civil day carries only previously earned unspent issued tickets and stays stable across renders', () => {
  const f = fixture({ me: { dailyChest: { version: 1, cursor: { day, opened: 1, carry: 0 } } },
    tasks: [...tasks(5), ...tasks(1, '2026-09-13')] }, '2026-09-13');
  assert.equal(f.available(), 3); assert.equal(f.state().lootbox.carry, 2); assert.equal(f.state().lootbox.opened, 0);
  const first = f.state().lootbox;
  assert.equal(f.available(), 3); assert.deepEqual(f.state().lootbox, first);
  assert.equal(f.state().lootbox.goldWon, 4321); assert.equal(f.saves.length, 0);
  assert.deepEqual(f.state().me.dailyChest.cursor, { day, opened: 1, carry: 0 }, 'render does not claim to have advanced the server cursor');
});

test('issued carry subtraction and cap match shared policy without gaining rewards for absence', () => {
  for (const [cursor, oldCount, expected] of [
    [{ day, opened: 2, carry: 4 }, 5, 5], [{ day, opened: 6, carry: 4 }, 5, 1],
    [{ day, opened: 1, carry: 0 }, 1, 0], [{ day, opened: 0, carry: 0 }, 0, 0],
  ]) {
    const f = fixture({ me: { dailyChest: { version: 1, cursor } }, tasks: [...tasks(oldCount), ...tasks(5, '2026-09-13')] }, '2026-10-01');
    assert.equal(f.available(), expected); assert.equal(f.state().lootbox.carry, expected);
  }
});

test('future issued cursor and server corruption marker disable openings and preserve personal rewards', () => {
  for (const summary of [
    { version: 1, cursor: { day: '2026-09-13', opened: 1, carry: 3 } },
    { version: 1, cursor: null, error: 'chest_receipts_corrupt' },
  ]) {
    const f = fixture({ me: { dailyChest: summary } }), before = f.state();
    assert.equal(f.available(), 0); assert.equal(f.available(), 0);
    assert.equal(f.state().lootbox.goldWon, before.lootbox.goldWon);
    assert.deepEqual(f.state().lootbox.history, before.lootbox.history);
    assert.deepEqual(f.state().settings, before.settings); assert.equal(f.saves.length, 0);
  }
});

test('future raw legacy day remains blocked without rollover or background save when no issued cursor exists', () => {
  const lootbox = { day: '2026-09-13', opened: 2, carry: 4, goldWon: 4321,
    vouchers: 2, history: [{ label: 'Imported future record' }], customWeights: { legacy: true } };
  const f = fixture({ lootbox });
  assert.equal(f.available(), 0); assert.equal(f.available(), 0);
  assert.deepEqual(f.state().lootbox, lootbox);
  assert.deepEqual(f.saves, []); assert.deepEqual(f.allocations, []);
});

test('valid issued cursor takes precedence over a future date in an imported personal lootbox', () => {
  const f = fixture({ me: { dailyChest: { version: 1, cursor: { day, opened: 1, carry: 0 } } },
    lootbox: { day: '2030-01-01', opened: 0, carry: 5, goldWon: 8000, vouchers: ['epic'], history: [], economyV124: true } });
  assert.equal(f.available(), 2); assert.equal(f.state().lootbox.day, day);
  assert.equal(f.state().lootbox.opened, 1); assert.equal(f.state().lootbox.carry, 0);
  assert.equal(f.state().lootbox.goldWon, 8000); assert.equal(f.saves.length, 0);
});

test('ordinary legacy accounts retain the old thresholds and bounded numeric voucher migration', () => {
  for (const [count, expected] of [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3]]) {
    const f = fixture({ tasks: tasks(count), me: {} }); assert.equal(f.available(), expected);
  }
  const f = fixture({ lootbox: { day, opened: 0, carry: 0, goldWon: 300, history: [], vouchers: '3', customWeights: { common: 10 } } });
  assert.equal(f.available(), 3); assert.deepEqual(f.state().lootbox.vouchers, ['common', 'common', 'common']);
  assert.deepEqual(f.allocations, [3]); assert.equal(f.saves.length, 1);
  assert.equal(f.saves[0].name, 'lootbox'); assert.equal(f.state().lootbox.goldWon, 300);
  assert.equal(f.state().lootbox.customWeights, undefined);
});

test('absurd or fractional legacy voucher count returns unsupported without allocation or background Store write', () => {
  for (const vouchers of [100001, Number.MAX_SAFE_INTEGER, '1e1000', Infinity, -Infinity, NaN,
    2.9, '1.5', -1, '-3', 'not-a-number', 'NaN', true, false, {}]) {
    const lootbox = { day, opened: 0, carry: 0, goldWon: 800, vouchers, history: [{ label: 'Preserve' }], customWeights: { old: true } };
    const f = fixture({ lootbox });
    assert.equal(f.available(), 0); assert.equal(f.state()._lootboxReadUnsupported, true);
    assert.deepEqual(f.state().lootbox.vouchers, vouchers); assert.equal(f.state().lootbox.goldWon, 800);
    assert.deepEqual(f.state().lootbox.history, lootbox.history);
    assert.deepEqual(f.allocations, []); assert.deepEqual(f.saves, []);
    assert.equal(f.state().lootbox.economyV124, undefined);
    assert.deepEqual(f.state().lootbox.customWeights, { old: true });
  }
});

test('issued tickets still require real activity; generated Entry does not create new eligibility', () => {
  const f = fixture({ me: { dailyChest: { version: 1, cursor: { day, opened: 0, carry: 0 } } },
    tasks: [{ done: true, date: day, entry: true }, { done: false, date: day }], habitlog: {} });
  assert.equal(f.available(), 0);
  f.context.State.habitlog[day] = { realHabit: { xp: 5 } };
  assert.equal(f.available(), 1);
});
