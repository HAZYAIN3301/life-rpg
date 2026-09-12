/* Admission for purchases only; this does not own chest, import or ordinary
 * equipment writes. context is persisted server state. grants contains only
 * the new catalogue-checked purchase rows, never the historical prefix. */
(function(root, factory) {
  const api = typeof module === 'object' && module.exports
    ? factory(require('./shop-catalog-v1'), require('./economy-write-v1'))
    : factory(root.ShopCatalogV1, root.EconomyWriteV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PurchaseEntitlementV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Catalog, Writes) {
  'use strict';
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const fail = reason => ({ ok: false, reason });
  const same = (a, b) => Writes.canonical(a) === Writes.canonical(b);
  const empty = value => value === undefined || value === null || value === '';
  const starterTokens = Catalog.DEN_ITEMS.filter(item => item.access === 'starter').map(item => item.id)
    .concat(Catalog.DEN_THEMES.filter(item => item.access === 'starter').map(item => 'theme:' + item.id));
  const ownedValue = (settings, kind) => kind === 'gear' ? settings.gear?.owned
    : kind === 'cosmetic' ? settings.cosmetics : settings.den?.owned;
  const selections = value => record(value) ? value : {};

  // Compare selections, not the whole legacy object. Removing a selection is
  // safe, and an unchanged old selection is not a new grant after level/Pro loss.
  function changedSelections(before, after, allowed) {
    if (after != null && !record(after)) return false;
    const previous = selections(before), next = selections(after);
    return Object.keys(next).every(slot => same(previous[slot], next[slot])
      || empty(next[slot]) || allowed(slot, next[slot]));
  }

  function validate(context, data, grants) {
    if (!record(data) || !Object.hasOwn(data, 'purchases')) return { ok: true };
    if (!record(context) || !Array.isArray(grants)) return fail('invalid_purchase_target');
    const before = context.settings == null ? {} : context.settings;
    const after = Object.hasOwn(data, 'settings') ? data.settings : before;
    if (!record(before) || !record(after)) return fail('purchase_ownership_changed');
    const added = { gear: new Set(), cosmetic: new Set(), den: new Set() };
    for (const grant of grants) {
      if (!record(grant) || !['reward', 'gear', 'cosmetic', 'den'].includes(grant.kind)
        || !record(grant.item) || grant.item.id !== grant.id) return fail('invalid_purchase_target');
      const { kind, id, item } = grant;
      if (kind === 'den' && item.access !== 'level') return fail('invalid_purchase_target');
      const requiredLevel = kind === 'gear' ? item.lvl : kind === 'den' ? item.level : 0;
      if (requiredLevel > 0) {
        if (!Number.isSafeInteger(context.personalLevel) || context.personalLevel < 1)
          return fail('purchase_progress_unavailable');
        if (context.personalLevel < requiredLevel)
          return { ok: false, reason: 'purchase_level_required', requiredLevel };
      }
      if (kind !== 'reward') added[kind].add(kind === 'den' && !item.slot ? 'theme:' + id : id);
    }

    const owned = {};
    for (const kind of ['gear', 'cosmetic', 'den']) {
      const oldValue = ownedValue(before, kind), nextValue = ownedValue(after, kind);
      // Missing/null arrays are the pre-initialisation state of the current UI.
      // Existing unknown JSON tokens are retained by value, never newly granted.
      const previous = oldValue == null ? [] : oldValue, next = nextValue == null ? [] : nextValue;
      if (!Array.isArray(previous) || !Array.isArray(next)) return fail('purchase_ownership_changed');
      const oldSet = new Set(previous.map(Writes.canonical)), nextSet = new Set(next.map(Writes.canonical));
      const allowed = new Set([...added[kind], ...(kind === 'den' ? starterTokens : [])].map(Writes.canonical));
      if ([...oldSet].some(token => !nextSet.has(token))
        || [...nextSet].some(token => !oldSet.has(token) && !allowed.has(token))
        || [...added[kind]].some(token => !nextSet.has(Writes.canonical(token))))
        return fail('purchase_ownership_changed');
      owned[kind] = new Set(next.filter(token => typeof token === 'string'));
    }

    const oldRelics = before.gear?.relics ?? [], nextRelics = after.gear?.relics ?? [];
    if (!same(oldRelics, nextRelics)) return fail('purchase_relics_changed');
    if (!changedSelections(before.gear?.equipped, after.gear?.equipped, (slot, id) => {
      if (slot === 'relic') return typeof id === 'string' && Array.isArray(oldRelics)
        && oldRelics.some(relic => record(relic) && relic.uid === id);
      const item = Catalog.GEAR.find(item => item.id === id);
      return !!item && item.slot === slot && owned.gear.has(id);
    })) return fail('invalid_purchase_equipment');

    if (!changedSelections(before.equipped, after.equipped, (slot, id) => {
      const rows = slot === 'frame' ? Catalog.FRAMES : slot === 'background' ? Catalog.BACKGROUNDS : [];
      // A new title has a separate achievement/tree owner. Purchases do not grant it.
      return owned.cosmetic.has(id) && rows.some(item => item.id === id);
    })) return fail('invalid_purchase_equipment');

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
      return fail(missingPro ? 'purchase_pro_required' : 'invalid_purchase_equipment');
    if (!changedSelections(before.den?.slots, after.den?.slots, (slot, id) => {
      const item = Catalog.DEN_ITEMS.find(item => item.id === id);
      return !!item && item.slot === slot && allowedDen(item, id);
    })) return fail(missingPro ? 'purchase_pro_required' : 'invalid_purchase_equipment');
    return { ok: true };
  }
  return Object.freeze({ validate });
});
