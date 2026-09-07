/* PWA Lifecycle v1 — deterministic model for update, offline and reconnect UI.
   Pure UMD module: no DOM, navigator, service worker, State, fetch or Store. */
(function pwaLifecycleModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PwaLifecycleV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildPwaLifecycleV1() {
  'use strict';

  const VERSION = '1.0.0';
  const SCHEMA = 'satoru.pwa-lifecycle/1';
  const CACHE_RE = /^satoru-v\d{1,6}$/;

  function cacheVersion(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return CACHE_RE.test(normalized) ? normalized : '';
  }

  function create(options = {}) {
    return Object.freeze({
      schema: SCHEMA,
      currentVersion: cacheVersion(options.currentVersion),
      workerVersion: '',
      deferredVersion: '',
      online: options.online !== false,
      reconnected: false,
      updateReady: false,
      refreshing: false,
      error: '',
    });
  }

  function normalize(value, options = {}) {
    const fallback = create(options);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const currentVersion = cacheVersion(value.currentVersion) || fallback.currentVersion;
    const workerVersion = cacheVersion(value.workerVersion);
    const deferredVersion = cacheVersion(value.deferredVersion);
    return Object.freeze({
      schema: SCHEMA,
      currentVersion,
      workerVersion,
      deferredVersion,
      online: value.online !== false,
      reconnected: value.reconnected === true,
      updateReady: value.updateReady === true && !!workerVersion && workerVersion !== currentVersion && workerVersion !== deferredVersion,
      refreshing: value.refreshing === true,
      error: typeof value.error === 'string' ? value.error.slice(0, 80) : '',
    });
  }

  function reduce(value, event) {
    const state = normalize(value);
    if (!event || typeof event !== 'object' || Array.isArray(event)) return state;
    const next = { ...state, error: '' };
    if (event.type === 'network:offline') {
      next.online = false; next.reconnected = false; next.refreshing = false;
    } else if (event.type === 'network:online') {
      const recovered = !state.online;
      next.online = true; next.reconnected = recovered || state.reconnected;
    } else if (event.type === 'worker:version') {
      const workerVersion = cacheVersion(event.version);
      if (!workerVersion) return state;
      next.workerVersion = workerVersion;
      next.updateReady = !!state.currentVersion && workerVersion !== state.currentVersion && workerVersion !== state.deferredVersion;
    } else if (event.type === 'update:defer') {
      next.deferredVersion = state.workerVersion;
      next.updateReady = false;
    } else if (event.type === 'reconnect:dismiss') {
      next.reconnected = false;
    } else if (event.type === 'refresh:start') {
      if (!state.online || state.refreshing) return state;
      next.refreshing = true;
    } else if (event.type === 'refresh:failed') {
      next.refreshing = false;
      next.error = typeof event.error === 'string' ? event.error.slice(0, 80) : 'refresh-failed';
    } else return state;
    return normalize(next);
  }

  function surface(value) {
    const state = normalize(value);
    if (!state.online) return Object.freeze({ kind: 'offline', blocking: true, actions: [] });
    if (state.error) return Object.freeze({ kind: 'refresh-error', blocking: false, actions: ['refresh', 'dismiss'] });
    if (state.updateReady) return Object.freeze({ kind: 'update', blocking: false, actions: ['refresh', 'later'] });
    if (state.reconnected) return Object.freeze({ kind: 'reconnected', blocking: false, actions: ['refresh', 'dismiss'] });
    return null;
  }

  function canWrite(value) { return normalize(value).online; }

  return Object.freeze({ VERSION, SCHEMA, cacheVersion, create, normalize, reduce, surface, canWrite });
});
