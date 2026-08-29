/* Browser Companion Discovery v1 — deterministic release notice timing.
   Pure UMD module: no DOM, State, fetch, Store or browser-extension APIs. */
(function browserCompanionDiscoveryModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BrowserCompanionDiscoveryV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBrowserCompanionDiscoveryV1() {
  'use strict';

  const VERSION = '1.0.0';
  const SCHEMA = 1;
  const RELEASE = 'browser-companion-v200';
  const RELEASE_AT = '2026-08-29T00:00:00.000Z';
  const NEW_USER_DELAY_MS = 24 * 60 * 60 * 1000;
  const REMIND_LATER_MS = 3 * 24 * 60 * 60 * 1000;
  const CHOICES = new Set(['pending', 'later', 'never', 'installing']);

  function time(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
  }
  function nowIso(value) {
    const parsed = typeof value === 'number' ? value : Date.parse(value || '');
    return new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
  }
  function isExistingAccount(createdAt) {
    const created = time(createdAt);
    return !created || Date.parse(created) < Date.parse(RELEASE_AT);
  }
  function create(options = {}) {
    const now = nowIso(options.now);
    const existing = isExistingAccount(options.accountCreatedAt);
    return Object.freeze({
      schema: SCHEMA,
      release: RELEASE,
      firstActiveAt: existing || options.active !== true ? '' : now,
      remindAfter: '',
      choice: 'pending',
      promptedAt: '',
    });
  }
  function normalize(value, options = {}) {
    const fallback = create(options);
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.release !== RELEASE) return fallback;
    const existing = isExistingAccount(options.accountCreatedAt);
    const firstActiveAt = time(value.firstActiveAt)
      || (!existing && options.active === true ? nowIso(options.now) : '');
    return Object.freeze({
      schema: SCHEMA,
      release: RELEASE,
      firstActiveAt,
      remindAfter: time(value.remindAfter),
      choice: CHOICES.has(value.choice) ? value.choice : 'pending',
      promptedAt: time(value.promptedAt),
    });
  }
  function shouldShow(value, options = {}) {
    const state = normalize(value, options);
    if (options.active !== true || options.probeComplete !== true || options.installed === true) return false;
    if (state.choice === 'never') return false;
    const now = Date.parse(nowIso(options.now));
    if (state.choice === 'later' && state.remindAfter && now < Date.parse(state.remindAfter)) return false;
    if (isExistingAccount(options.accountCreatedAt)) return true;
    return !!state.firstActiveAt && now - Date.parse(state.firstActiveAt) >= NEW_USER_DELAY_MS;
  }
  function reduce(value, event, options = {}) {
    const state = normalize(value, options);
    if (!event || typeof event !== 'object' || Array.isArray(event)) return state;
    const now = nowIso(event.now || options.now);
    if (event.type === 'prompted') return normalize({ ...state, promptedAt: now }, options);
    if (event.type === 'install') return normalize({ ...state, choice: 'installing', remindAfter: '', promptedAt: state.promptedAt || now }, options);
    if (event.type === 'later') return normalize({ ...state, choice: 'later', remindAfter: new Date(Date.parse(now) + REMIND_LATER_MS).toISOString(), promptedAt: state.promptedAt || now }, options);
    if (event.type === 'never') return normalize({ ...state, choice: 'never', remindAfter: '', promptedAt: state.promptedAt || now }, options);
    if (event.type === 'reset') return create(options);
    return state;
  }

  return Object.freeze({
    VERSION, SCHEMA, RELEASE, RELEASE_AT, NEW_USER_DELAY_MS, REMIND_LATER_MS,
    time, isExistingAccount, create, normalize, shouldShow, reduce,
  });
});
