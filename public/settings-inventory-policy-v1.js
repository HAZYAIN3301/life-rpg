/* Ordinary settings writes preserve inventory. grants is a server-internal
 * result of an admitted purchase or issued chest, never request metadata.
 * Portable import/reset and explicit restoration retain their separate owner. */
(function(root, factory) {
  const api = typeof module === 'object' && module.exports
    ? factory(require('./shop-catalog-v1'), require('./economy-write-v1'))
    : factory(root.ShopCatalogV1, root.EconomyWriteV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SettingsInventoryPolicyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Catalog, Writes) {
  'use strict';
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const same = (a, b) => Writes.canonical(a) === Writes.canonical(b);
  const empty = value => value === undefined || value === null || value === '';
  const fail = reason => ({ ok: false, reason });
  const starterTokens = Object.freeze(Catalog.DEN_ITEMS.filter(item => item.access === 'starter').map(item => item.id)
    .concat(Catalog.DEN_THEMES.filter(item => item.access === 'starter').map(item => 'theme:' + item.id)));
  const ownedValue = (settings, kind) => kind === 'gear' ? settings.gear?.owned
    : kind === 'cosmetic' ? settings.cosmetics : settings.den?.owned;
  function counts(values) {
    const result = new Map();
    for (const value of values) { const key = Writes.canonical(value); result.set(key, (result.get(key) || 0) + 1); }
    return result;
  }

  function changedSelections(before, after, allowed, slots) {
    if (same(before, after)) return true;
    if (after != null && !record(after)) return false;
    const previous = record(before) ? before : {}, next = record(after) ? after : {};
    return (slots || Object.keys(next)).every(slot => same(previous[slot], next[slot])
      || empty(next[slot]) || allowed(slot, next[slot]));
  }

  function validate(context, after, grants = []) {
    if (!record(context)) return fail('inventory_state_not_supported');
    const before = context?.settings == null ? {} : context.settings;
    if (!record(before) || !record(after) || !Array.isArray(grants)) return fail('inventory_state_not_supported');
    const added = { gear: new Set(), cosmetic: new Set(), den: new Set() };
    for (const grant of grants) {
      if (!record(grant) || Object.keys(grant).sort().join(',') !== 'id,kind'
        || !Object.hasOwn(added, grant.kind) || typeof grant.id !== 'string') return fail('inventory_invalid_grant');
      const item = Catalog.item(grant.kind, grant.id);
      if (!item || (grant.kind === 'den' && item.access !== 'level')) return fail('inventory_invalid_grant');
      added[grant.kind].add(grant.kind === 'den' && !item.slot ? 'theme:' + item.id : item.id);
    }

    const owned = {};
    for (const kind of ['gear', 'cosmetic', 'den']) {
      const oldValue = ownedValue(before, kind), nextValue = ownedValue(after, kind);
      // Keep unknown legacy JSON tokens. UI initialisers turn missing/malformed
      // non-arrays into empty arrays; this cannot create an owned paid item.
      const previous = Array.isArray(oldValue) ? oldValue : [];
      if (nextValue != null && !Array.isArray(nextValue) && !same(oldValue, nextValue))
        return fail('inventory_ownership_changed');
      const next = Array.isArray(nextValue) ? nextValue : [];
      const oldCounts = counts(previous), nextCounts = counts(next);
      const oldSet = new Set(oldCounts.keys()), nextSet = new Set(nextCounts.keys());
      const allowed = new Set([...added[kind], ...(kind === 'den' ? starterTokens : [])].map(Writes.canonical));
      if ([...oldSet].some(token => !nextSet.has(token))
        || [...nextSet].some(token => !oldSet.has(token) && !allowed.has(token))
        || [...nextCounts].some(([token, count]) => count > Math.max(oldCounts.get(token) || 0, allowed.has(token) ? 1 : 0))
        || [...added[kind]].some(token => !nextSet.has(Writes.canonical(token))))
        return fail('inventory_ownership_changed');
      owned[kind] = new Set(next.filter(token => typeof token === 'string'));
    }

    const oldRelics = before.gear?.relics, nextRelics = after.gear?.relics;
    // There is no current relic producer. Preserve complete previously earned
    // rows, including legacy fields; only empty-array initialisation is free.
    if (!same(oldRelics, nextRelics)
      && !same(Array.isArray(oldRelics) ? oldRelics : [], nextRelics == null ? [] : nextRelics))
      return fail('inventory_relics_changed');
    if (!changedSelections(before.gear?.equipped, after.gear?.equipped, (slot, id) => {
      if (slot === 'relic') return typeof id === 'string' && Array.isArray(oldRelics)
        && oldRelics.some(relic => record(relic) && relic.uid === id);
      const item = Catalog.GEAR.find(item => item.id === id);
      return !!item && item.slot === slot && owned.gear.has(id);
    })) return fail('inventory_invalid_selection');

    // Titles have achievement/tree/Board owners and are outside this slice.
    if (!changedSelections(before.equipped, after.equipped, (slot, id) => {
      const rows = slot === 'frame' ? Catalog.FRAMES : Catalog.BACKGROUNDS;
      return owned.cosmetic.has(id) && rows.some(item => item.id === id);
    }, ['frame', 'background'])) return fail('inventory_invalid_selection');

    const pro = context.tier === 'pro' || context.tier === 'trial';
    let missingPro = false;
    function allowedDen(item, token) {
      if (!item) return false;
      if (item.access === 'pro') { if (!pro) missingPro = true; return pro; }
      return item.access === 'starter' || owned.den.has(token);
    }
    const oldTheme = before.den?.theme, nextTheme = after.den?.theme;
    if (!same(oldTheme, nextTheme) && !empty(nextTheme)
      && !allowedDen(Catalog.DEN_THEMES.find(item => item.id === nextTheme), 'theme:' + nextTheme))
      return fail(missingPro ? 'inventory_pro_required' : 'inventory_invalid_selection');
    if (!changedSelections(before.den?.slots, after.den?.slots, (slot, id) => {
      const item = Catalog.DEN_ITEMS.find(item => item.id === id);
      return !!item && item.slot === slot && allowedDen(item, id);
    })) return fail(missingPro ? 'inventory_pro_required' : 'inventory_invalid_selection');
    return { ok: true };
  }
  return Object.freeze({ validate, starterTokens });
});
