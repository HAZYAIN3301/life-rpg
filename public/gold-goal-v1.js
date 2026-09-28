/* One reference to an existing furniture item. No wallet, reservation or grant. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GoldGoalV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const collection = Object.freeze(['seat-forest', 'surface-alchemy', 'light-six']);
  function item(id, catalog) {
    return (Array.isArray(catalog) ? catalog : []).find(x => x.id === id && x.access === 'level'
      && Number.isFinite(x.cost) && x.cost > 0 && typeof x.slot === 'string') || null;
  }
  function select(id, catalog) { return item(id, catalog) ? { version: 1, itemId: id } : null; }
  function progress(goal, catalog, balance, level, owned) {
    const target = goal?.version === 1 && item(goal.itemId, catalog);
    if (!target) return null;
    const available = Number.isFinite(balance) ? Math.floor(balance) : 0;
    const acquired = Array.isArray(owned) && owned.includes(target.id);
    const remaining = Math.max(0, target.cost - available);
    const levelReady = Number.isFinite(level) && level >= target.level;
    return { item: target, available, remaining, levelReady, acquired,
      ready: !acquired && levelReady && remaining === 0,
      percent: Math.max(0, Math.min(100, Math.floor(available / target.cost * 100))) };
  }
  return Object.freeze({ collection, item, select, progress });
});
