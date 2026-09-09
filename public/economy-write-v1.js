/* Exact-base decisions only. The existing account journal owns durability. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EconomyWriteV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createPolicy(types) {
  const TYPES = Object.freeze({ ...types });
  const record = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  function valueValid(name, value) {
    return TYPES[name] === 'array' ? Array.isArray(value) : TYPES[name] === 'object' && record(value);
  }
  function snapshotValid(name, s) {
    return record(s) && Object.keys(s).sort().join(',') === 'exists,value' && typeof s.exists === 'boolean'
      && (s.exists ? valueValid(name, s.value) : s.value === null);
  }
  function canonical(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    return Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']'
      : '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  }
  function decide(actual, data, base) {
    if (!record(data) || !Object.keys(data).length) return 'invalid';
    const names = Object.keys(data);
    if (names.some((n) => !valueValid(n, data[n]) || !snapshotValid(n, actual?.[n]))) return 'invalid';
    if (base !== undefined && (!record(base) || Object.keys(base).sort().join(',') !== names.sort().join(',')
      || names.some((n) => !snapshotValid(n, base[n])))) return 'invalid';
    // A lost response may be retried with its original base. Never rewrite an
    // already committed result, or overwrite newer data to manufacture a replay.
    if (names.every((n) => actual[n].exists && canonical(actual[n].value) === canonical(data[n]))) return 'replay';
    if (base !== undefined && names.some((n) => canonical(actual[n]) !== canonical(base[n]))) return 'conflict';
    return 'commit';
  }
  return Object.freeze({ TYPES, valueValid, snapshotValid, decide, canonical });
  }
  return Object.freeze({
    ...createPolicy({ settings: 'object', purchases: 'array', rewards: 'array', lootbox: 'object', skilltree: 'object' }),
    guide: createPolicy({ settings: 'object', tasks: 'array', inbox: 'array', purchases: 'array' }),
    habits: createPolicy({ settings: 'object', habits: 'array', habitlog: 'object', antihabits: 'array' }),
  });
});
