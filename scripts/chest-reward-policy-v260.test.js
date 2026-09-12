'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Policy = require('../public/chest-reward-policy-v1');
const Rewards = require('../public/reward-catalog-v1');
const Shop = require('../public/shop-catalog-v1');
const day = '2026-09-12';
const options = (extra = {}) => ({ now: '2026-09-12T12:00:00.000Z', timeZone: 'Europe/Berlin', requestId: 'chest_test_request_0001', entropy: [0, 0, 0], ...extra });
const tasks = (count, date = day) => Array.from({ length: count }, (_, i) => ({ id: 'task-' + i, done: true, date }));
const state = (extra = {}) => ({ settings: {}, tasks: tasks(5), habitlog: {}, skilltree: {}, ...extra });
const normalize = value => Policy.normalize(value, options());
const grant = (value = state(), extra = {}) => Policy.grant(value, options(extra));
const explicit = (value, prize, extra = {}) => Policy.grant(value, { now: options().now, timeZone: options().timeZone, requestId: options().requestId, prize, ...extra });
const clone = value => structuredClone(value);
function good(value) { assert.equal(value.ok, true, JSON.stringify(value)); return value; }
function rejected(value, reason) { assert.deepEqual(value, { ok: false, reason }); }

test('reward catalogue exactly preserves the v259 names, costs, order, emoji and icon IDs', () => {
  // Digest from the actual REWARD_CATALOG + REWARD_ICON_KEYS initialization at
  // origin/master 3f0da11, before extracting it. This protects all 33 exact rows.
  assert.equal(createHash('sha256').update(JSON.stringify(Rewards.REWARD_CATALOG)).digest('hex'),
    'c48525facb90ba465c95ad945a8fc1e6812e40c151f4de48874771cf014bdc46');
  assert.equal(Rewards.REWARD_CATALOG.length, 33);
  assert.ok(Object.isFrozen(Rewards.REWARD_CATALOG));
  assert.ok(Rewards.REWARD_CATALOG.every(Object.isFrozen));
  for (const [gold, rarity] of [[449, 'common'], [450, 'rare'], [899, 'rare'], [900, 'epic'], [1799, 'epic'], [1800, 'legendary']]) {
    assert.equal(Rewards.rewardRarityByCost(gold), rarity);
  }
});

test('daily eligibility remains thresholds 1/3/5 with no tier advantage', () => {
  for (const [count, expected] of [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [50, 3]]) {
    for (const tier of ['free', 'pro', 'trial']) {
      const result = good(normalize(state({ tasks: tasks(count), tier })));
      assert.equal(result.available, expected);
      assert.equal(result.earned, expected);
    }
  }
  rejected(grant(state({ tasks: [] })), 'chest_unavailable');
});

test('only completed ordinary tasks and present habit check-in keys count', () => {
  const owner = state({ tasks: [
    { done: true, date: day }, { done: true, date: day, entry: true },
    { done: false, date: day }, { done: true, date: '2026-09-11' },
    { done: true, date: day, completedAt: 'invalid' },
  ], habitlog: { [day]: { a: { xp: 0 }, b: 0, c: false }, '2026-09-11': { old: true } } });
  const result = good(normalize(owner));
  assert.equal(result.activity, 4); assert.equal(result.earned, 2);
});

test('completedAt civil day uses the supplied IANA zone and overrides task date', () => {
  const owner = state({ tasks: [{ done: true, date: day, completedAt: '2026-09-11T22:30:00.000Z' }] });
  assert.equal(good(Policy.normalize(owner, options({ timeZone: 'Europe/Berlin' }))).activity, 1);
  assert.equal(good(Policy.normalize(owner, options({ timeZone: 'America/New_York' }))).activity, 0);
  const localLegacy = state({ tasks: [{ done: true, completedAt: '2026-09-12T01:30' }] });
  assert.equal(good(Policy.normalize(localLegacy, options({ timeZone: 'Asia/Tokyo' }))).activity, 1);
  const dateOnly = state({ tasks: [{ done: true, completedAt: '2026-09-12' }] });
  assert.equal(good(Policy.normalize(dateOnly, options({ timeZone: 'America/New_York' }))).activity, 0);
});

test('DST gaps, folds and non-hour offsets preserve actual local completion day', () => {
  for (const [timeZone, now, stamps, civilDay] of [
    ['Europe/Berlin', '2026-03-29T12:00:00.000Z', ['2026-03-28T23:30:00.000Z', '2026-03-29T01:30:00.000Z'], '2026-03-29'],
    ['America/New_York', '2026-11-01T12:00:00.000Z', ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z'], '2026-11-01'],
    ['Asia/Kathmandu', '2026-09-12T00:00:00.000Z', ['2026-09-11T18:15:00.000Z', '2026-09-12T00:00:00.000Z'], day],
  ]) {
    const value = good(Policy.normalize(state({ tasks: stamps.map(completedAt => ({ done: true, completedAt })) }), options({ timeZone, now })));
    assert.equal(value.day, civilDay); assert.equal(value.activity, 2);
  }
});

test('policy result does not depend on server process timezone', () => {
  const script = `const P=require(${JSON.stringify(path.resolve(__dirname, '../public/chest-reward-policy-v1'))});process.stdout.write(JSON.stringify(P.grant(${JSON.stringify(state({ tasks: [{ done: true, completedAt: '2026-09-11T22:30:00.000Z' }] }))},${JSON.stringify(options())})));`;
  const results = ['UTC', 'Pacific/Honolulu', 'Asia/Tokyo'].map(TZ => {
    const execution = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(execution.status, 0, execution.stderr); return execution.stdout;
  });
  assert.equal(results[0], results[1]); assert.equal(results[1], results[2]);
});

test('clock and civil-date validation reject rollovers, unknown zones and implicit host timezone', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-9-12', null]) assert.equal(Policy.civilDateValid(value), false);
  assert.equal(Policy.civilDateValid('2024-02-29'), true);
  for (const now of [NaN, Infinity, {}, '2026-02-30T12:00:00Z', '2026-09-12T12:00:00', '2026-09-12T24:00:00Z', 1e20]) {
    rejected(Policy.normalize({}, options({ now })), 'chest_invalid_time');
  }
  for (const timeZone of [undefined, '', '+02:00', 'Mars/Olympus', {}, 'X'.repeat(129)]) {
    rejected(Policy.normalize({}, options({ timeZone })), 'chest_invalid_timezone');
  }
  assert.equal(good(Policy.normalize({}, options({ now: Date.parse(options().now), timeZone: 'UTC' }))).day, day);
});

test('invalid and future task dates never turn into recorded activity', () => {
  const value = good(normalize(state({ tasks: [
    { done: true, date: '2026-02-30' }, { done: true, completedAt: '2026-02-30T00:00:00Z' },
    { done: true, date: '2030-09-12' }, { done: true, completedAt: '2026-09-12T25:00:00Z' },
  ] })));
  assert.equal(value.available, 0);
});

test('rollover subtracts openings from combined earned and carry, and never accrues absence days', () => {
  const owner = state({ tasks: [...tasks(5), ...tasks(5, '2026-08-01'), ...tasks(5, '2026-09-11')],
    lootbox: { day: '2026-08-01', carry: 4, opened: 2, goldWon: 500 } });
  const current = good(normalize(owner));
  assert.equal(current.lootbox.carry, 5); assert.equal(current.lootbox.opened, 0);
  assert.equal(current.available, 8);
  const empty = good(normalize(state({ tasks: tasks(5, '2026-09-11'), lootbox: { day: '2026-08-01', carry: 0, opened: 0 } })));
  assert.equal(empty.available, 0, 'intervening days cannot create banked rewards');
  const spent = good(normalize(state({ tasks: tasks(5, '2026-09-11'), lootbox: { day: '2026-09-11', carry: 4, opened: 6 } })));
  assert.equal(spent.lootbox.carry, 1);
});

test('future recorded day blocks claims without mutating the owner or resetting opened', () => {
  const owner = state({ lootbox: { day: '2026-09-13', opened: 3, carry: 4, goldWon: 120 } }), before = clone(owner);
  rejected(normalize(owner), 'chest_future_day'); rejected(grant(owner), 'chest_future_day');
  assert.deepEqual(owner, before);
});

test('invalid or missing recorded day credits only unspent carry and valid current activity', () => {
  for (const oldDay of [undefined, '2026-02-30', 'nonsense', 123]) {
    const owner = state({ tasks: [], lootbox: { ...(oldDay === undefined ? {} : { day: oldDay }), carry: 4, opened: 2 } });
    const value = good(normalize(owner));
    assert.equal(value.lootbox.day, day); assert.equal(value.available, 2); assert.equal(value.lootbox.opened, 0);
  }
});

test('legacy carry, numeric vouchers and unknown imported fields survive bounded migration', () => {
  const owner = state({ lootbox: { day, carry: '4', opened: '1', goldWon: '420', vouchers: 2.9,
    customWeights: { common: 1 }, titles: ['legacy-title'], boost: { legacy: true }, equipped: 'legacy-title',
    history: [{ at: 'old', label: 'Старый приз' }], importedExtra: { keep: 'yes' } } });
  const before = clone(owner), value = good(normalize(owner));
  assert.equal(value.available, 6); assert.equal(value.lootbox.goldWon, 420);
  assert.deepEqual(value.lootbox.vouchers, ['common', 'common']);
  assert.deepEqual(value.lootbox.titles, ['legacy-title']); assert.deepEqual(value.lootbox.boost, { legacy: true });
  assert.equal(value.lootbox.equipped, 'legacy-title'); assert.deepEqual(value.lootbox.importedExtra, { keep: 'yes' });
  assert.equal(value.lootbox.customWeights, undefined); assert.equal(value.lootbox.economyV124, true);
  assert.deepEqual(owner, before);
  const tokens = ['rare', 'unknown-import-token', { oldVoucher: true }];
  assert.deepEqual(good(normalize(state({ lootbox: { day, vouchers: tokens } }))).lootbox.vouchers, tokens);
});

test('absence defaults empty; explicit malformed owner slots never become guessed eligibility', () => {
  assert.equal(good(normalize({})).available, 0);
  for (const name of ['settings', 'tasks', 'habitlog', 'skilltree', 'lootbox']) {
    rejected(normalize(state({ [name]: null })), 'chest_invalid_context');
  }
  for (const extra of [{ tasks: [null] }, { habitlog: { [day]: [] } }, { settings: { cosmetics: 'bad' } },
    { skilltree: { x: null } }, { skilltree: { x: { nodes: [null] } } }, { skilltree: { x: { nodes: [{ perks: [false] }] } } }]) {
    rejected(normalize(state(extra)), 'chest_invalid_context');
  }
});

test('absurd counts, structures and voucher allocations fail within bounds', () => {
  for (const value of [Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1e1000', {}]) {
    rejected(normalize(state({ lootbox: { day, vouchers: value } })), 'chest_invalid_context');
  }
  rejected(normalize(state({ lootbox: { day, vouchers: Policy.COLLECTION_LIMIT + 1 } })), 'chest_capacity');
  rejected(normalize(state({ tasks: new Array(Policy.COLLECTION_LIMIT + 1).fill({}) })), 'chest_capacity');
  rejected(normalize(state({ lootbox: { day, opened: 0.5 } })), 'chest_invalid_context');
  const cycle = {}; cycle.x = cycle;
  rejected(normalize(state({ settings: cycle })), 'chest_invalid_context');
  let deep = {}; for (let i = 0; i < 70; i++) deep = { child: deep };
  rejected(normalize(state({ settings: deep })), 'chest_capacity');
});

test('JSON owner copy does not run getters or let inherited/prototype tokens become grants', () => {
  let calls = 0; const settings = {};
  Object.defineProperty(settings, 'cosmetics', { enumerable: true, get() { calls++; return []; } });
  rejected(normalize(state({ settings })), 'chest_invalid_context'); assert.equal(calls, 0);
  rejected(normalize(state({ settings: Object.create({ cosmetics: ['fr_bronze'] }) })), 'chest_invalid_context');
  const imported = JSON.parse('{"__proto__":{"polluted":true},"cosmetics":[]}');
  const value = good(explicit(state({ settings: imported }), { type: 'cosmetic_capsule', rarity: 'common', cosmeticId: 'fr_bronze' }));
  assert.deepEqual(value.data.settings.__proto__, { polluted: true }); assert.equal({}.polluted, undefined);
});

test('daily gold perk counts unlocked practice nodes, with existing per-area and global caps', () => {
  const node = (val, extra = {}) => ({ unlocked: true, perks: [{ kind: 'dailyRewardGoldPct', val }], ...extra });
  const owner = state({ skilltree: {
    a: { nodes: [node(50), node(30, { kind: 'capability' }), node(30, { milestone: true }), node(30, { unlocked: false })] },
    b: { nodes: [node(-5)] },
  } });
  assert.equal(good(normalize(owner)).bonusPct, 25, 'each area caps before the global sum');
  assert.equal(good(grant(owner)).prize.amount, 50);
  owner.skilltree.c = { nodes: [node(12, { kind: 'practice', milestone: true })] };
  assert.equal(good(normalize(owner)).bonusPct, 30);
  assert.equal(good(grant(owner)).prize.amount, 52);
  const negative = state({ skilltree: { a: { nodes: [node(-20)] } } });
  assert.equal(good(grant(negative)).prize.amount, 40);
});

test('rarity draw preserves exact 60/28/10/2 boundaries and gold values', () => {
  for (const [unit, rarity, amount] of [[0, 'common', 40], [.6, 'common', 40], [.60001, 'rare', 80], [.88, 'rare', 80], [.88001, 'epic', 150], [.98, 'epic', 150], [.98001, 'legendary', 300], [.99999999, 'legendary', 300]]) {
    assert.deepEqual(good(grant(state(), { entropy: [unit, 0, 0] })).prize, { type: 'gold', rarity, amount });
  }
});

test('type draw preserves 55/30/15 and uniformly selects actual available cosmetics/rewards', () => {
  assert.equal(good(grant(state(), { entropy: [0, .55, 0] })).prize.type, 'gold');
  assert.deepEqual(good(grant(state(), { entropy: [0, .55001, 0] })).prize, { type: 'cosmetic_capsule', rarity: 'common', cosmeticId: 'fr_bronze' });
  assert.equal(good(grant(state(), { entropy: [0, .85, .99999] })).prize.cosmeticId, 'bg_moss');
  assert.deepEqual(good(grant(state(), { entropy: [0, .85001, 0] })).prize, { type: 'reward_voucher', rarity: 'common', rewardName: 'Кофе в любимой кофейне' });
  assert.equal(good(grant(state(), { entropy: [0, .99, .99999] })).prize.rewardName, Rewards.byRarity('common').at(-1).name);
});

test('depleted cosmetic rarity redistributes only its type weight and never gives a duplicate', () => {
  const allCommon = Shop.FRAMES.concat(Shop.BACKGROUNDS).filter(row => row.rarity === 'common').map(row => row.id);
  const owner = state({ settings: { cosmetics: allCommon } });
  const odds = good(Policy.odds(owner, options())).rows.find(row => row.rarity === 'common');
  assert.deepEqual(odds.types.map(row => row.kind), ['gold', 'voucher']);
  assert.equal(odds.types[0].pct, 55 / 70 * 100);
  assert.equal(odds.pct, 60);
  assert.equal(good(grant(owner, { entropy: [0, .70, 0] })).prize.type, 'gold');
  assert.equal(good(grant(owner, { entropy: [0, .80, 0] })).prize.type, 'reward_voucher');
  const oneLeft = state({ settings: { cosmetics: allCommon.slice(0, -1) } });
  for (const unit of [0, .2, .8, .999999]) assert.equal(good(grant(oneLeft, { entropy: [0, .7, unit] })).prize.cosmeticId, allCommon.at(-1));
});

test('no implicit entropy or browser entropy shape can quietly choose a prize', () => {
  for (const entropy of [undefined, [], [0, 0], [0, 0, 0, 0], [0, 0, 1], [-1, 0, 0], [NaN, 0, 0], ['0', 0, 0], new Array(3)]) {
    rejected(grant(state(), { entropy }), 'chest_invalid_entropy');
  }
  rejected(grant(state(), { prize: { type: 'gold', rarity: 'common', amount: 40 } }), 'chest_invalid_entropy');
});

test('gold transition changes only its counter, opening and bounded readable history', () => {
  const history = Array.from({ length: 45 }, (_, i) => ({ at: 'old-' + i, label: 'Прежняя награда ' + i }));
  const owner = state({ lootbox: { day, opened: 1, carry: 2, goldWon: '50', vouchers: ['rare'], history,
    titles: ['legacy'], cosmeticsWon: 2, unknown: { retain: true }, economyV124: true } });
  const before = clone(owner), value = good(grant(owner));
  assert.deepEqual(Object.keys(value.data), ['lootbox']);
  assert.equal(value.data.lootbox.goldWon, 90); assert.equal(value.data.lootbox.opened, 2);
  assert.equal(value.data.lootbox.history.length, 40); assert.equal(value.remaining, 3);
  assert.equal(value.historyEntry.requestId, options().requestId); assert.equal(value.historyEntry.label, '+40');
  assert.equal(value.historyEntry.at, options().now); assert.equal(value.historyEntry.deterministic, false);
  assert.deepEqual(value.data.lootbox.history[1], history[0]);
  assert.deepEqual(value.data.lootbox.vouchers, ['rare']); assert.deepEqual(value.data.lootbox.titles, ['legacy']);
  assert.deepEqual(value.data.lootbox.unknown, { retain: true }); assert.deepEqual(owner, before);
});

test('voucher transition adds one rarity while preserving exact named prize and settings', () => {
  const owner = state({ lootbox: { day, vouchers: 2, goldWon: 12 }, settings: { other: 'retain' } });
  const value = good(grant(owner, { entropy: [.99, .99, 0] }));
  assert.equal(value.prize.rewardName, 'Поездка на выходные');
  assert.deepEqual(value.data.lootbox.vouchers, ['common', 'common', 'legendary']);
  assert.equal(value.data.lootbox.goldWon, 12); assert.equal(value.historyEntry.label, value.prize.rewardName);
  assert.equal(value.data.settings, undefined);
});

test('cosmetic transition adds exactly one unowned token and keeps unrelated settings', () => {
  const owner = state({ settings: { cosmetics: ['legacy-token'], equipped: { frame: 'legacy-token' }, privatePreference: { theme: 'dark' } },
    lootbox: { day, cosmeticsWon: 2, goldWon: 71, vouchers: ['epic'] } });
  const before = clone(owner), value = good(grant(owner, { entropy: [.65, .7, 0] }));
  assert.deepEqual(value.prize, { type: 'cosmetic_capsule', rarity: 'rare', cosmeticId: 'fr_silver' });
  assert.deepEqual(value.data.settings, { ...owner.settings, cosmetics: ['legacy-token', 'fr_silver'] });
  assert.equal(value.data.lootbox.cosmeticsWon, 3); assert.equal(value.data.lootbox.goldWon, 71);
  assert.equal(value.historyEntry.label, 'Серебро'); assert.equal(value.historyEntry.cosmeticId, 'fr_silver');
  assert.deepEqual(owner, before);
});

test('same request ID cannot be applied again from owner history', () => {
  const first = good(grant());
  rejected(grant(state({ lootbox: first.data.lootbox })), 'chest_request_already_applied');
  assert.equal(good(grant(state({ lootbox: first.data.lootbox }), { requestId: 'chest_test_request_0002' })).data.lootbox.opened, 2);
});

test('explicit receipt prize validates exact catalogue, rarity, perk amount and ownership', () => {
  for (const prize of [
    { type: 'gold', rarity: 'common', amount: 41 }, { type: 'gold', rarity: 'legendary', amount: 5000 },
    { type: 'gold', rarity: 'common', amount: 40, label: '+100' },
    { type: 'cosmetic_capsule', rarity: 'legendary', cosmeticId: 'fr_bronze' },
    { type: 'cosmetic_capsule', rarity: 'common', cosmeticId: 'nonexistent' },
    { type: 'reward_voucher', rarity: 'common', rewardName: 'Отпуск мечты' },
    { type: 'reward_voucher', rarity: 'common', rewardName: 'Forged reward' },
    { type: 'relic', rarity: 'rare', id: 'r1' },
  ]) rejected(explicit(state(), prize), 'chest_invalid_prize');
  rejected(explicit(state({ settings: { cosmetics: ['fr_bronze'] } }),
    { type: 'cosmetic_capsule', rarity: 'common', cosmeticId: 'fr_bronze' }), 'chest_invalid_prize');
  for (const entropy of [[0, 0, 0], [.65, .7, 0], [.99, .99, .5]]) {
    const drawn = good(grant(state(), { entropy }));
    assert.deepEqual(good(explicit(state(), drawn.prize)), drawn);
  }
});

test('request IDs and numeric capacity fail before producing any grant', () => {
  for (const requestId of ['', 'short', 'x'.repeat(129), '../request-0001', 'a b c d e f', null]) {
    rejected(grant(state(), { requestId }), 'chest_invalid_request_id');
  }
  rejected(grant(state({ lootbox: { day, goldWon: Number.MAX_SAFE_INTEGER } })), 'chest_capacity');
  rejected(grant(state({ lootbox: { day, cosmeticsWon: Number.MAX_SAFE_INTEGER } }), { entropy: [0, .7, 0] }), 'chest_capacity');
});

test('grant validation rejects every extra or altered write and accepts transport projection', () => {
  const owner = state(), opts = options(), value = good(grant(owner));
  assert.equal(Policy.grantValid(owner, opts, value), true);
  const projection = { prize: value.prize, at: value.historyEntry.at, day: value.day, remaining: value.remaining, data: value.data };
  assert.equal(Policy.grantValid(owner, opts, projection), true);
  for (const mutate of [
    x => { x.data.lootbox.goldWon++; }, x => { x.data.lootbox.opened--; },
    x => { x.data.settings = { cosmetics: ['fr_gold'] }; }, x => { x.data.purchases = []; },
    x => { x.data.lootbox.vouchers.push('legendary'); }, x => { x.data.lootbox.history[0].requestId = 'different_request_01'; },
    x => { x.remaining++; }, x => { x.day = '2026-09-11'; }, x => { x.prize.amount = 41; },
    x => { x.surplus = true; }, x => { delete x.historyEntry; },
  ]) {
    const changed = clone(value); mutate(changed); assert.equal(Policy.grantValid(owner, opts, changed), false);
  }
  assert.equal(Policy.grantValid(owner, options({ requestId: 'other_request_0001' }), value), false);
  assert.equal(Policy.grantValid(owner, options({ now: '2026-09-12T12:00:01.000Z' }), value), false);
});

test('browser and Node pure modules return identical grants without runtime globals', () => {
  const context = {};
  for (const file of ['shop-catalog-v1.js', 'reward-catalog-v1.js', 'chest-reward-policy-v1.js']) {
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../public', file), 'utf8'), context, { timeout: 1000 });
  }
  context.owner = state(); context.opts = options({ entropy: [.99, .99, .25] });
  vm.runInNewContext('result=ChestRewardPolicyV1.grant(owner,opts)', context, { timeout: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), grant(context.owner, { entropy: context.opts.entropy }));
});
