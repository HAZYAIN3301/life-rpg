(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SatoruAttentionHealth = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  const TEST_TIMEOUT_MS = 60_000;
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  function sameRules(actual, expected) {
    const normalize = rules => rules.map(rule => canonical({ id: rule.id, priority: rule.priority || 1, action: rule.action, condition: rule.condition })).sort();
    return canonical(normalize(actual)) === canonical(normalize(expected));
  }
  function sameScripts(actual, expected) {
    const normalize = scripts => scripts.map(script => canonical({ id: script.id, matches: [...script.matches].sort(), js: script.js,
      runAt: script.runAt, allFrames: script.allFrames === true, persistAcrossSessions: script.persistAcrossSessions !== false })).sort();
    return canonical(normalize(actual)) === canonical(normalize(expected));
  }
  function publicTest(record, version, at, fingerprint) {
    if (!record || !['pending', 'passed', 'failed'].includes(record.state)) return { state: 'never', checkedAt: null };
    const started = Date.parse(record.startedAt);
    const now = Date.parse(at);
    if (!Number.isFinite(started) || !Number.isFinite(now)) return { state: 'never', checkedAt: null };
    if (record.version !== version || record.fingerprint !== fingerprint) return { state: 'outdated', checkedAt: record.checkedAt || record.startedAt };
    if (record.state === 'pending' && (now < started || now - started > TEST_TIMEOUT_MS)) return { state: 'failed', checkedAt: at };
    return { state: record.state, checkedAt: record.checkedAt || record.startedAt };
  }
  return Object.freeze({ TEST_TIMEOUT_MS, canonical, sameRules, sameScripts, publicTest });
});
