(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PartyRewardPolicyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const GOLD = 150, BOOST_PCT = 30, BOOST_MS = 6 * 60 * 60 * 1000;
  const time = (value) => typeof value === 'string' ? Date.parse(value) : NaN;
  const cycleValid = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(time(value)) && new Date(value).toISOString().slice(0, 10) === value && new Date(value).getUTCDay() === 1;
  function fail(code) { throw Object.assign(new Error(code), { code }); }
  function empty() { return { version: 1, receipts: [] }; }
  function validate(ledger) {
    if (!ledger || ledger.version !== 1 || !Array.isArray(ledger.receipts)) fail('reward_ledger_invalid');
    const cycles = new Set();
    for (const r of ledger.receipts) {
      if (!r || !cycleValid(r.cycle) || cycles.has(r.cycle) || r.id !== `party:${r.cycle}`
        || typeof r.partyId !== 'string' || !r.partyId || !Number.isFinite(time(r.at))
        || !['grant', 'legacy'].includes(r.kind)) fail('reward_ledger_invalid');
      if (r.kind === 'grant' && (r.gold !== GOLD || !r.boost || r.boost.pct !== BOOST_PCT
        || r.boost.from !== r.at || time(r.boost.until) !== time(r.at) + BOOST_MS)) fail('reward_ledger_invalid');
      if (r.kind === 'legacy' && (r.gold !== 0 || r.boost !== null)) fail('reward_ledger_invalid');
      cycles.add(r.cycle);
    }
    return ledger;
  }
  function receiptFor(ledger, cycle) { return validate(ledger).receipts.find((r) => r.cycle === cycle) || null; }
  function grant(ledger, { cycle, partyId, at, won, legacy = false }) {
    validate(ledger);
    if (!cycleValid(cycle) || typeof partyId !== 'string' || !partyId || !Number.isFinite(time(at))) fail('invalid_reward_request');
    const existing = receiptFor(ledger, cycle);
    if (existing) return { ledger, receipt: existing, replay: true };
    if (!won && !legacy) fail('not_won');
    const receipt = { id: `party:${cycle}`, cycle, partyId, at, kind: legacy ? 'legacy' : 'grant', gold: legacy ? 0 : GOLD,
      boost: legacy ? null : { pct: BOOST_PCT, from: at, until: new Date(time(at) + BOOST_MS).toISOString() } };
    return { ledger: { version: 1, receipts: [...ledger.receipts, receipt] }, receipt, replay: false };
  }
  function gold(ledger) { return validate(ledger).receipts.reduce((sum, r) => sum + r.gold, 0); }
  function isSuccessor(candidate, current) {
    validate(candidate); validate(current);
    return current.receipts.every((r) => JSON.stringify(receiptFor(candidate, r.cycle)) === JSON.stringify(r));
  }
  function boostPct(ledger, at) {
    const stamp = time(at); if (!Number.isFinite(stamp)) return 0;
    return validate(ledger).receipts.reduce((pct, r) => r.boost && stamp >= time(r.boost.from) && stamp < time(r.boost.until)
      ? Math.max(pct, r.boost.pct) : pct, 0); // adjacent weekly windows never stack
  }
  return Object.freeze({ GOLD, BOOST_PCT, BOOST_MS, empty, validate, cycleValid, receiptFor, grant, gold, boostPct, isSuccessor });
});
