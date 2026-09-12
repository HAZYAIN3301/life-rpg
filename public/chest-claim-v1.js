/* Account-scoped daily-chest transport. Pure; no storage, clock, entropy or UI. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? require('./chest-reward-policy-v1') : root.ChestRewardPolicyV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChestClaimV1 = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (Policy) {
  'use strict';
  const TYPES = Object.freeze({ settings: 'object', tasks: 'array', habitlog: 'object', skilltree: 'object', lootbox: 'object' });
  const FILES = Object.freeze(Object.keys(TYPES));
  const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const clone = x => JSON.parse(JSON.stringify(x));
  const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
    : Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']'
      : '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  const equal = (a, b) => canonical(a) === canonical(b);
  const keys = (x, names) => record(x) && Object.keys(x).sort().join(',') === names.slice().sort().join(',');
  const requestIdValid = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{15,127}$/.test(x);
  const dateValid = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)
    && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
  const timestampValid = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
  function snapshotValid(name, x) {
    return keys(x, ['exists', 'value']) && typeof x.exists === 'boolean'
      && (x.exists ? TYPES[name] === 'array' ? Array.isArray(x.value) : record(x.value) : x.value === null);
  }
  const snapshotsValid = x => keys(x, FILES) && FILES.every(n => snapshotValid(n, x[n]));
  function requestValid(x) {
    if (!keys(x, ['version', 'requestId', 'timeZone', 'base']) || x.version !== 1
      || !requestIdValid(x.requestId) || !snapshotsValid(x.base)
      || typeof x.timeZone !== 'string' || x.timeZone.length > 100) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: x.timeZone }); return true; } catch { return false; }
  }
  function cursorValid(x) {
    return x === null || keys(x, ['day', 'opened', 'carry']) && dateValid(x.day)
      && Number.isSafeInteger(x.opened) && x.opened >= 0 && x.opened <= 8
      && Number.isSafeInteger(x.carry) && x.carry >= 0 && x.carry <= 5;
  }
  function context(base, cursor = null) {
    const result = Object.fromEntries(FILES.filter(n => base[n].exists).map(n => [n, clone(base[n].value)]));
    if (cursor) result.lootbox = { ...(result.lootbox || {}), ...clone(cursor) };
    return result;
  }
  function receiptValid(receipt, request) {
    try {
      if (!Policy || !requestValid(request) || !keys(receipt, ['ok', 'version', 'requestId', 'timeZone', 'prize', 'at', 'day', 'remaining', 'cursor', 'data', 'snapshots', 'replayed'])
        || receipt.ok !== true || receipt.version !== 1 || receipt.requestId !== request.requestId
        || receipt.timeZone !== request.timeZone || typeof receipt.replayed !== 'boolean'
        || !timestampValid(receipt.at) || !cursorValid(receipt.cursor) || !snapshotsValid(receipt.snapshots)) return false;
      const granted = Policy.grant(context(request.base, receipt.cursor), {
        now: receipt.at, timeZone: receipt.timeZone, requestId: request.requestId, prize: receipt.prize,
      });
      if (!granted.ok || !equal(granted.data, receipt.data) || !equal(granted.prize, receipt.prize)
        || granted.day !== receipt.day || granted.remaining !== receipt.remaining) return false;
      const expected = clone(request.base);
      // The shared WAL materializes its required settings/tasks pair when absent.
      for (const n of ['settings', 'tasks']) if (!expected[n].exists)
        expected[n] = { exists: true, value: n === 'tasks' ? [] : {} };
      for (const [n, value] of Object.entries(receipt.data)) expected[n] = { exists: true, value };
      return equal(expected, receipt.snapshots);
    } catch { return false; }
  }
  return Object.freeze({ VERSION: 1, FILES, TYPES, canonical, equal, requestIdValid, timestampValid,
    snapshotValid, snapshotsValid, requestValid, cursorValid, context, receiptValid });
});
