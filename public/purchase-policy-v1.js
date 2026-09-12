/* Pure purchase validation against a persisted account and the shared catalogue.
 * This is not a mint/immutable wallet: task/import credit remains client-owned. */
(function(factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./shop-catalog-v1'), require('./economy-write-v1'), require('./gamification-integrity-v1'),
    require('./personal-progress-v1'), require('./purchase-entitlement-v1'));
})(function(Catalog, Writes, Integrity, Progress, Entitlements) {
  'use strict';
  function earnedGold({ tasks = [], habitlog = {}, goals = [], lootbox = {}, adminGold = 0, partyGold = 0 }) {
    const taskGold = tasks.filter(t => t.done).reduce((sum, t) => sum + Number(t.goldAwarded || 0), 0);
    const habitGold = Object.values(habitlog).reduce((sum, day) =>
      sum + Object.values(day).reduce((s, r) => s + Number(r.gold || 0), 0), 0);
    const goalGold = goals.filter(g => g.completedAt).reduce((sum, g) =>
      sum + Math.round(Number(g.xpReward != null ? g.xpReward : 60) * 0.35), 0);
    const result = taskGold + habitGold + goalGold + Number(lootbox.goldWon || 0) + adminGold + partyGold;
    return Number.isFinite(result) ? result : null;
  }
  function validate(context, data) {
    if (!Object.hasOwn(data, 'purchases')) return { ok: true };
    const before = context.purchases || [], next = data.purchases;
    const fail = reason => ({ ok: false, reason });
    if (!Array.isArray(next) || next.length < before.length
      || before.some((row, i) => Writes.canonical(row) !== Writes.canonical(next[i]))) return fail('purchase_history_changed');
    const ids = new Set(before.map(row => row.id));
    const grants = [];
    let spent = before.reduce((sum, row) => sum + Integrity.spendablePurchaseCost(row), 0);
    const owned = { gear: new Set(context.settings?.gear?.owned || []),
      cosmetic: new Set(context.settings?.cosmetics || []), den: new Set(context.settings?.den?.owned || []) };
    for (const row of next.slice(before.length)) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)
        || /^(reckon_|oath_)/.test(row.id) || !Number.isFinite(Date.parse(row.at))) return fail('invalid_purchase');
      ids.add(row.id);
      const kinds = ['reward', 'gear', 'cosmetic', 'den'].filter(kind => Object.hasOwn(row, kind + 'Id'));
      if (kinds.length !== 1) return fail('invalid_purchase_target');
      const kind = kinds[0], id = row[kind + 'Id'], item = Catalog.item(kind, id, context.rewards);
      if (!item || typeof row.cost !== 'number' || !Number.isFinite(row.cost) || row.cost < 0
        || row.cost !== Number(item.cost)) return fail('purchase_price_changed');
      if (kind !== 'reward') {
        const token = kind === 'den' && !item.slot ? 'theme:' + id : id;
        if (owned[kind].has(token)) return fail('already_owned');
        // Free subscription/starter room items are acquired by their existing
        // entitlement path, not fabricated zero-cost purchase rows.
        if (kind === 'den' && item.access !== 'level') return fail('invalid_purchase_target');
        const afterOwned = kind === 'gear' ? data.settings?.gear?.owned
          : kind === 'cosmetic' ? data.settings?.cosmetics : data.settings?.den?.owned;
        if (!Array.isArray(afterOwned) || !afterOwned.includes(token)) return fail('missing_purchase_item');
        owned[kind].add(token);
      }
      if (context.earnedGold === null || !Number.isFinite(context.earnedGold)
        || Math.round(context.earnedGold - spent) < row.cost) return fail('insufficient_gold');
      spent += row.cost;
      grants.push({ kind, id, item });
    }
    // A purchase does not also open a chest, issue a voucher or edit its catalogue.
    // These have their own existing owner paths; even legacy batched clients may
    // carry an unchanged snapshot, but cannot smuggle a grant into this receipt.
    for (const [name, fallback] of [['lootbox', {}], ['skilltree', {}], ['rewards', []]]) {
      if (Object.hasOwn(data, name) && Writes.canonical(data[name]) !== Writes.canonical(context[name] ?? fallback)) {
        return fail('purchase_credit_changed');
      }
    }
    const progress = grants.some(({ kind }) => kind === 'gear' || kind === 'den') ? Progress.snapshot(context) : null;
    return Entitlements.validate({ settings: context.settings, tier: context.tier,
      personalLevel: progress?.ok ? progress.level : null }, data, grants);
  }
  return Object.freeze({ validate, earnedGold });
});
