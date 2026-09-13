'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../public/settings-inventory-policy-v1');
const clone = value => structuredClone(value);
const fixture = () => ({ gear: { owned: ['w4', 'old-token', { legacy: 'kept' }],
  equipped: { weapon: 'w4' }, relics: [{ uid: 'old-relic', sphere: 's', xpPct: 8, legacy: { name: 'kept' } }] },
  cosmetics: ['fr_bronze', 'legacy-cosmetic'], equipped: { frame: 'fr_bronze', title: 'old-title' },
  den: { owned: ['theme:moon-tower', 'wall-moon', 'old-den'], theme: 'spirit-house', slots: { wall: 'wall-eyes' } } });
function check(before, next, grants, tier = 'free') {
  const saved = clone({ before, next, grants });
  const result = P.validate({ settings: before, tier }, next, grants);
  assert.deepEqual({ before, next, grants }, saved, 'pure policy never mutates inputs');
  return result;
}
test('existing unknown inventory, full relic data and expired unchanged Pro selections survive ordinary preferences', () => {
  const before = fixture(), next = clone(before); next.lang = 'de';
  assert.deepEqual(check(before, next), { ok: true });
});
for (const [label, mutate, reason] of [
  ['unpaid gear', s => s.gear.owned.push('w1'), 'inventory_ownership_changed'],
  ['unpaid cosmetic', s => s.cosmetics.push('fr_phoenix'), 'inventory_ownership_changed'],
  ['unpaid Den theme', s => s.den.owned.push('theme:voxel-hearth'), 'inventory_ownership_changed'],
  ['removed legacy token', s => s.gear.owned.pop(), 'inventory_ownership_changed'],
  ['new relic', s => s.gear.relics.push({ uid: 'new', xpPct: 999 }), 'inventory_relics_changed'],
  ['edited relic power', s => s.gear.relics[0].xpPct++, 'inventory_relics_changed'],
  ['edited legacy relic field', s => s.gear.relics[0].legacy.name = 'changed', 'inventory_relics_changed'],
  ['unowned weapon selection', s => s.gear.equipped.weapon = 'w1', 'inventory_invalid_selection'],
  ['wrong gear slot', s => s.gear.equipped.armor = 'w4', 'inventory_invalid_selection'],
  ['wrong cosmetic slot', s => s.equipped.background = 'fr_bronze', 'inventory_invalid_selection'],
  ['unowned relic UID', s => s.gear.equipped.relic = 'new', 'inventory_invalid_selection'],
  ['new Pro theme on free', s => s.den.theme = 'voxel-hearth', 'inventory_pro_required'],
  ['new Pro slot on free', s => s.den.slots.seat = 'seat-cloud', 'inventory_pro_required'],
  ['wrong Den slot', s => s.den.slots.floor = 'wall-moon', 'inventory_invalid_selection'],
]) test('rejects ' + label, () => {
  const before = fixture(), next = clone(before); mutate(next);
  assert.deepEqual(check(before, next), { ok: false, reason });
});
test('owned gear below current level, relics and paid Den items can still be selected', () => {
  const before = fixture(); before.gear.equipped = {};
  const next = clone(before); next.gear.equipped = { weapon: 'w4', relic: 'old-relic' };
  next.den.theme = 'moon-tower'; next.den.slots.wall = 'wall-moon';
  assert.equal(check(before, next).ok, true);
});
test('titles and boardV2Titles remain with their current achievement/Board/tree owners', () => {
  const before = fixture(), next = clone(before); next.equipped.title = 'new title'; next.boardV2Titles = ['new title'];
  assert.equal(check(before, next).ok, true);
});
test('exact starter initialization, nullable legacy arrays and empty selection reset remain valid', () => {
  const before = { gear: { owned: null, relics: null }, cosmetics: null, den: { owned: null } };
  const next = { gear: { owned: [], relics: [], equipped: {} }, cosmetics: [], equipped: { frame: null, title: null },
    den: { owned: [...P.starterTokens], theme: 'workshop', slots: { wall: 'wall-map', floor: 'floor-traveller' } } };
  assert.equal(P.starterTokens.length, 8); assert.equal(check(before, next).ok, true);
  const old = fixture(), reset = clone(old); reset.gear.equipped = {}; reset.equipped = {};
  reset.den.theme = 'workshop'; reset.den.slots = {};
  assert.equal(check(old, reset).ok, true);
});
test('malformed inactive legacy fields may stay unchanged or initialize empty, without new rights', () => {
  const before = { cosmetics: 'invalid', gear: { owned: {}, relics: 'invalid' }, den: { owned: false } };
  assert.equal(check(before, { ...clone(before), lang: 'de' }).ok, true);
  const next = { cosmetics: [], gear: { owned: [], relics: [], equipped: {} }, den: { owned: [...P.starterTokens] } };
  assert.equal(check(before, next).ok, true);
  next.gear.owned.push('w4'); assert.equal(check(before, next).ok, false);
});
test('server-internal exact grants permit only their admitted catalog additions', () => {
  const before = fixture(), next = clone(before);
  next.gear.owned.push('w1'); next.cosmetics.push('fr_phoenix'); next.den.owned.push('seat-forest');
  const grants = [{ kind: 'gear', id: 'w1' }, { kind: 'cosmetic', id: 'fr_phoenix' }, { kind: 'den', id: 'seat-forest' }];
  assert.equal(check(before, next, grants).ok, true);
  next.cosmetics.push('bg_void'); assert.equal(check(before, next, grants).ok, false);
  assert.equal(check(before, before, [{ kind: 'gear', id: 'w1' }]).ok, false, 'grant must actually be present');
  assert.equal(check(before, before, [{ kind: 'relic', id: 'old-relic' }]).reason, 'inventory_invalid_grant');
  assert.equal(check(before, before, [{ kind: 'den', id: 'spirit-house' }]).reason, 'inventory_invalid_grant');
});
test('ordinary writes cannot inflate duplicate counts; historical duplicates may stay or deduplicate', () => {
  const before = fixture(); before.gear.owned.push('w4');
  assert.equal(check(before, clone(before)).ok, true);
  const fewer = clone(before); fewer.gear.owned.pop(); assert.equal(check(before, fewer).ok, true);
  for (const kind of ['gear', 'cosmetic', 'den']) {
    const next = clone(before), rows = kind === 'gear' ? next.gear.owned : kind === 'cosmetic' ? next.cosmetics : next.den.owned;
    rows.push(rows[0]); assert.equal(check(before, next).reason, 'inventory_ownership_changed', kind);
  }
  assert.equal(check({}, { den: { owned: ['wall-map', 'wall-map'] } }).ok, false);
  assert.equal(check({}, { cosmetics: ['fr_bronze', 'fr_bronze'] }, [{ kind: 'cosmetic', id: 'fr_bronze' }]).ok, false);
});
test('only actual Pro or trial permits a new subscription selection, without minting owned tokens', () => {
  const before = fixture(), next = clone(before); next.den.theme = 'voxel-hearth'; next.den.slots.seat = 'seat-cloud';
  for (const tier of ['pro', 'trial']) assert.equal(check(before, next, [], tier).ok, true);
  next.den.owned.push('theme:voxel-hearth'); assert.equal(check(before, next, [], 'pro').ok, false);
});
