'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const E = require('../public/purchase-entitlement-v1'), C = require('../public/shop-catalog-v1');
const W = require('../public/economy-write-v1');
const grant = (kind, id) => ({ kind, id, item: C.item(kind, id, [{ id: 'reward', cost: 10 }]) });
const context = (settings = {}, patch = {}) => ({ settings, personalLevel: 20, tier: 'free', ...patch });
const data = settings => ({ purchases: [], ...(settings === undefined ? {} : { settings }) });
const result = (c, settings, grants = []) => E.validate(c, data(settings), grants);
const ok = { ok: true };
const no = reason => ({ ok: false, reason });

test('only new gear and paid Den grants use the persisted personal level', () => {
  for (const [g, settings, requiredLevel] of [
    [grant('gear', 'm4'), { gear: { owned: ['m4'] } }, 20],
    [grant('den', 'moon-tower'), { den: { owned: ['theme:moon-tower'] } }, 5],
    [grant('den', 'wall-moon'), { den: { owned: ['wall-moon'] } }, 4],
  ]) {
    const c = context({}, { personalLevel: requiredLevel - 1 });
    assert.deepEqual(result(c, settings, [g]), { ok: false, reason: 'purchase_level_required', requiredLevel });
    c.personalLevel = requiredLevel; assert.deepEqual(result(c, settings, [g]), ok);
  }
  assert.deepEqual(result(context({}, { personalLevel: 1 }), { gear: { owned: ['w1'] } }, [grant('gear', 'w1')]), ok);
});

test('unavailable or forged progress cannot open a level gate; ungated purchases still work', () => {
  for (const personalLevel of [null, undefined, NaN, Infinity, '20', 0, -1, 20.5]) {
    const c = context({}, { personalLevel });
    const next = { personalLevel: 999, curve: { base: 1, growth: 1 }, importedXp: 1e9, gear: { owned: ['m4'] } };
    assert.deepEqual(result(c, next, [grant('gear', 'm4')]), no('purchase_progress_unavailable'));
    assert.deepEqual(result(c, { cosmetics: ['fr_leaf'] }, [grant('cosmetic', 'fr_leaf')]), ok);
    assert.deepEqual(result(c, undefined, [grant('reward', 'reward')]), ok);
  }
  assert.deepEqual(result(context({}, { personalLevel: 1 }),
    { personalLevel: 99, gear: { owned: ['m4'] } }, [grant('gear', 'm4')]),
  { ok: false, reason: 'purchase_level_required', requiredLevel: 20 });
});

test('one paid row cannot smuggle another item in any ownership namespace', () => {
  for (const extra of [
    settings => settings.gear.owned.push('w4'),
    settings => settings.cosmetics = ['fr_phoenix'],
    settings => settings.den = { owned: ['theme:moon-tower'] },
    settings => settings.den = { owned: ['wall-eyes'] },
    settings => settings.den = { owned: ['theme:spirit-house'] },
    settings => settings.gear.owned.push('unknown'),
    settings => settings.gear.owned.push({ id: 'w4' }),
  ]) {
    const settings = { gear: { owned: ['w1'] } }; extra(settings);
    assert.deepEqual(result(context(), settings, [grant('gear', 'w1')]), no('purchase_ownership_changed'));
  }
  assert.deepEqual(result(context(), { gear: { owned: ['w1', 'm1'] }, cosmetics: ['bg_moss'],
    den: { owned: ['wall-moon', 'theme:moon-tower'] } },
  [grant('gear', 'w1'), grant('gear', 'm1'), grant('cosmetic', 'bg_moss'),
    grant('den', 'wall-moon'), grant('den', 'moon-tower')]), ok);
});

test('reward rows and an unchanged purchase prefix cannot carry ownership grants', () => {
  for (const grants of [[], [grant('reward', 'reward')]]) {
    assert.deepEqual(result(context(), { guideV3: { version: 3 }, gear: { owned: ['w4'] } }, grants),
      no('purchase_ownership_changed'));
    assert.deepEqual(result(context(), { guideV3: { version: 3 }, cosmetics: ['fr_gold'] }, grants),
      no('purchase_ownership_changed'));
  }
});

test('all paid grants must appear and old ownership is preserved, including unknown legacy tokens', () => {
  const c = context({ gear: { owned: ['legacy_weapon', 'a4', 'legacy_weapon'] },
    cosmetics: ['retired_frame'], den: { owned: ['theme:retired', { old: true }] } });
  const next = structuredClone(c.settings); next.gear.owned.push('w1');
  assert.deepEqual(result(c, next, [grant('gear', 'w1')]), ok);
  next.gear.owned = ['a4', 'w1', 'legacy_weapon']; // Set identity, not incidental order/duplicates.
  assert.deepEqual(result(c, next, [grant('gear', 'w1')]), ok);
  next.gear.owned = ['a4', 'w1'];
  assert.deepEqual(result(c, next, [grant('gear', 'w1')]), no('purchase_ownership_changed'));
  assert.deepEqual(result(context(), {}, [grant('gear', 'w1')]), no('purchase_ownership_changed'));
  assert.deepEqual(result(c, { gear: c.settings.gear }), no('purchase_ownership_changed'));
  assert.deepEqual(result(c, undefined), ok);
});

test('actual ensureDen migration adds only starter tokens during any purchase', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const c = { State: { settings: {} }, DEN_THEMES: C.DEN_THEMES, DEN_ITEMS: C.DEN_ITEMS,
    DEN_SLOT_META: Object.fromEntries(C.DEN_ITEMS.map(item => [item.slot, {}])),
    DEN_STARTER_SLOTS: Object.fromEntries(C.DEN_ITEMS.filter(item => item.access === 'starter')
      .map(item => [item.slot, item.id])) };
  vm.createContext(c); vm.runInContext(app.slice(app.indexOf('function ensureDen()'), app.indexOf('function denTheme()')), c);
  c.ensureDen();
  const migrated = JSON.parse(JSON.stringify(c.State.settings));
  assert.equal(migrated.den.owned.length, 8);
  assert.deepEqual(result(context(), migrated, [grant('reward', 'reward')]), ok);
  migrated.gear = { owned: ['w1'], equipped: { weapon: 'w1' }, relics: [] };
  assert.deepEqual(result(context(), migrated, [grant('gear', 'w1')]), ok);
  migrated.den.owned.push('wall-eyes');
  assert.deepEqual(result(context({}, { tier: 'pro' }), migrated, [grant('gear', 'w1')]),
    no('purchase_ownership_changed'));
});

test('empty gear and cosmetics initialisation is compatible with historical missing fields', () => {
  assert.deepEqual(result(context({ gear: { owned: null }, cosmetics: null }), {
    gear: { owned: [], equipped: {}, relics: [] }, cosmetics: [],
    equipped: { frame: null, background: null, title: null },
  }, [grant('reward', 'reward')]), ok);
  for (const settings of [{ gear: { owned: 'w1' } }, { cosmetics: {} }, { den: { owned: false } }])
    assert.deepEqual(result(context(), settings), no('purchase_ownership_changed'));
});

test('new gear selection must be owned and match the slot; existing high-level ownership remains usable', () => {
  const c = context({ gear: { owned: ['w4', 'a4'] } }, { personalLevel: 1 });
  for (const equipped of [{ weapon: 'w4', armor: 'a4' }, { weapon: null }, { weapon: '' }])
    assert.deepEqual(result(c, { gear: { owned: ['w4', 'a4'], equipped } }), ok);
  for (const equipped of [{ weapon: 'm4' }, { armor: 'w4' }, { unknown: 'w4' }, { weapon: { id: 'w4' } }])
    assert.deepEqual(result(c, { gear: { owned: ['w4', 'a4'], equipped } }), no('invalid_purchase_equipment'));
  assert.deepEqual(result(context(), { gear: { owned: ['w1'], equipped: { weapon: 'w4' } } },
    [grant('gear', 'w1')]), no('invalid_purchase_equipment'));
  assert.deepEqual(result(context(), { gear: { owned: ['w1'], equipped: { weapon: 'w1' } } },
    [grant('gear', 'w1')]), ok);
});

test('unchanged legacy equipment is grandfathered; only newly selected values are checked', () => {
  const c = context({ gear: { owned: [], equipped: { weapon: 'retired_unowned', mystery: 'legacy' } },
    equipped: { frame: 'retired_frame', title: 'Legacy achievement' },
    den: { owned: [], theme: 'spirit-house', slots: { wall: 'wall-eyes', custom: 'legacy' } } },
  { personalLevel: null, tier: 'free' });
  const next = structuredClone(c.settings); next.guideV3 = { version: 3 };
  assert.deepEqual(result(c, next, [grant('reward', 'reward')]), ok);
  next.gear.equipped.weapon = 'w4';
  assert.deepEqual(result(c, next, [grant('reward', 'reward')]), no('invalid_purchase_equipment'));
});

test('relic minting, replacement, deletion and stat edits cannot ride on a purchase', () => {
  const relic = { uid: 'r_old', sphere: 's1', xpPct: 5, extra: { vintage: true } };
  const c = context({ gear: { owned: [], relics: [relic] } });
  const next = { gear: { owned: ['w1'], relics: [structuredClone(relic)], equipped: { weapon: 'w1', relic: 'r_old' } } };
  assert.deepEqual(result(c, next, [grant('gear', 'w1')]), ok);
  for (const relics of [[], [relic, { uid: 'new', xpPct: 99 }], [{ ...relic, xpPct: 100 }], [{ ...relic, sphere: 'other' }]])
    assert.deepEqual(result(c, { gear: { ...next.gear, relics } }, [grant('gear', 'w1')]), no('purchase_relics_changed'));
  next.gear.equipped.relic = 'absent';
  assert.deepEqual(result(c, next, [grant('gear', 'w1')]), no('invalid_purchase_equipment'));
  assert.deepEqual(result(context(), { gear: { relics: [{ uid: 'new', xpPct: 999 }] } }), no('purchase_relics_changed'));
});

test('cosmetic selections require ownership and correct frame/background kind', () => {
  const c = context({ cosmetics: ['fr_leaf', 'bg_moss'] });
  assert.deepEqual(result(c, { ...c.settings, equipped: { frame: 'fr_leaf', background: 'bg_moss' } }), ok);
  for (const equipped of [{ frame: 'fr_gold' }, { frame: 'bg_moss' }, { background: 'fr_leaf' },
    { custom: 'fr_leaf' }, { title: 'Fabricated title' }])
    assert.deepEqual(result(c, { ...c.settings, equipped }), no('invalid_purchase_equipment'));
  assert.deepEqual(result(context(), { cosmetics: ['fr_leaf'], equipped: { frame: 'fr_leaf' } },
    [grant('cosmetic', 'fr_leaf')]), ok);
});

test('new Den placements require ownership and slot; already owned items survive level loss', () => {
  const c = context({ den: { owned: ['wall-moon', 'theme:moon-tower'] } }, { personalLevel: 1 });
  assert.deepEqual(result(c, { den: { ...c.settings.den, theme: 'moon-tower', slots: { wall: 'wall-moon' } } }), ok);
  for (const change of [{ theme: 'absent' }, { slots: { seat: 'wall-moon' } },
    { slots: { wall: 'wall-map', seat: 'seat-forest' } }])
    assert.deepEqual(result(c, { den: { ...c.settings.den, ...change } }), no('invalid_purchase_equipment'));
  assert.deepEqual(result(context(), { den: { theme: 'workshop', slots: { wall: 'wall-map' } } }), ok);
});

test('new Pro Den choices use only authoritative tier, never an owned token or candidate entitlement', () => {
  for (const tier of ['free', null, undefined, 'unknown']) {
    const c = context({ den: { owned: ['theme:spirit-house', 'wall-eyes'] } }, { tier });
    for (const change of [{ theme: 'spirit-house' }, { slots: { wall: 'wall-eyes' } }])
      assert.deepEqual(result(c, { entitlement: { tier: 'pro' }, tier: 'pro',
        den: { ...c.settings.den, ...change } }), no('purchase_pro_required'));
  }
  for (const tier of ['pro', 'trial'])
    assert.deepEqual(result(context({}, { tier }), { den: { theme: 'spirit-house', slots: { wall: 'wall-eyes' } } }), ok);
  for (const id of ['workshop', 'spirit-house', 'wall-map', 'wall-eyes'])
    assert.deepEqual(result(context({}, { tier: 'pro' }), {}, [grant('den', id)]), no('invalid_purchase_target'));
});

test('clearing equipment is allowed without deleting owned items or claiming a new entitlement', () => {
  const c = context({ gear: { owned: ['w4'], equipped: { weapon: 'w4' } },
    cosmetics: ['fr_gold'], equipped: { frame: 'fr_gold', title: 'Legacy' },
    den: { owned: [], theme: 'spirit-house', slots: { wall: 'wall-eyes' } } });
  assert.deepEqual(result(c, { gear: { owned: ['w4'], equipped: {} }, cosmetics: ['fr_gold'],
    equipped: { frame: null, title: '' }, den: { owned: [], theme: 'workshop', slots: { wall: '' } } }), ok);
});

test('chest, ordinary Pro/starter equipment and import-like data without purchases remain outside this guard', () => {
  for (const candidate of [
    { lootbox: { goldWon: 30 }, settings: { cosmetics: ['fr_gold'] } },
    { settings: { den: { theme: 'spirit-house', slots: { wall: 'wall-eyes' } } } },
    { settings: { gear: { owned: ['w4'] } } },
  ]) assert.deepEqual(E.validate(context(), candidate, []), ok);
});

test('malformed inputs fail honestly, and validation never mutates server context or candidate', () => {
  assert.deepEqual(E.validate(null, data({}), []), no('invalid_purchase_target'));
  assert.deepEqual(result(context(), null), no('purchase_ownership_changed'));
  assert.deepEqual(E.validate(context(), data({}), null), no('invalid_purchase_target'));
  assert.deepEqual(result(context(), {}, [{ kind: 'gear', id: 'w1', item: { id: 'w4' } }]), no('invalid_purchase_target'));
  const c = context({ gear: { owned: ['m1'], relics: [{ uid: 'relic', xpPct: 4 }] } });
  const next = { gear: { ...structuredClone(c.settings.gear), owned: ['m1', 'w1'], equipped: { weapon: 'w1' } } };
  const snapshot = JSON.stringify({ c, next });
  assert.deepEqual(result(c, next, [grant('gear', 'w1')]), ok);
  assert.equal(JSON.stringify({ c, next }), snapshot);
});

test('browser and Node exports produce the same admission result', () => {
  const c = { ShopCatalogV1: C, EconomyWriteV1: W }; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/purchase-entitlement-v1.js'), 'utf8'), c);
  const candidate = data({ gear: { owned: ['w4'] } }), ctx = context({}, { personalLevel: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(c.PurchaseEntitlementV1.validate(ctx, candidate, [grant('gear', 'w4')]))),
    E.validate(ctx, candidate, [grant('gear', 'w4')]));
  assert.equal(Object.isFrozen(c.PurchaseEntitlementV1), true);
});
