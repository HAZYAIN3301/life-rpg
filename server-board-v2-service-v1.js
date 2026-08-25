'use strict';

/* Board v2 account discovery service.
 *
 * Persists only city-level consent, a normalized direct-source cache and a
 * bounded billing ledger. Searches serialize per account so two tabs cannot
 * spend twice for the same empty cache.
 */

const crypto = require('node:crypto');
const BoardDiscovery = require('./public/board-v2-discovery.js');
const DefaultRegistry = require('./server-board-v2-registry-v1.js');

const VERSION = '1.0.0';
const ACCOUNT_SCHEMA = 'satoru.board-discovery-account/1';
const DAILY_SEARCH_LIMIT = 10;

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function userId(value) {
  const out = typeof value === 'string' ? value : '';
  return /^[a-z0-9_-]{1,32}$/.test(out) ? out : '';
}
function nowIso(clock) {
  const value = clock();
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('invalid-clock');
  return new Date(value).toISOString();
}
function emptyCache(at) {
  return { schema: BoardDiscovery.CACHE_SCHEMA, createdAt: at, entries: [] };
}
function normalizeLedger(value, day) {
  const source = plain(value) ? value : {};
  if (source.day !== day) return { day, searches: 0 };
  const searches = Number(source.searches);
  return { day, searches: Number.isSafeInteger(searches) && searches >= 0 ? searches : 0 };
}
function normalizeAccount(value, at) {
  const source = plain(value) && value.schema === ACCOUNT_SCHEMA ? value : {};
  const day = at.slice(0, 10);
  const sourceCache = plain(source.cache) ? source.cache : emptyCache(at);
  return {
    schema: ACCOUNT_SCHEMA,
    consent: BoardDiscovery.normalizeConsent(source.consent),
    cache: {
      schema: sourceCache.schema,
      createdAt: sourceCache.createdAt,
      entries: Array.isArray(sourceCache.entries) ? sourceCache.entries.slice(0, 2) : [],
    },
    ledger: normalizeLedger(source.ledger, day),
    updatedAt: typeof source.updatedAt === 'string' && Number.isFinite(Date.parse(source.updatedAt)) ? source.updatedAt : at,
  };
}
function consentChanged(left, right) {
  return left.enabled !== right.enabled || left.city !== right.city || left.countryCode !== right.countryCode
    || left.timezone !== right.timezone || left.locale !== right.locale;
}
function requestIdFor(spec, consent) {
  const digest = crypto.createHash('sha256')
    .update(`${consent.city}\n${consent.countryCode}\n${spec.searchTerms.join(',')}`)
    .digest('hex').slice(0, 12);
  return `${spec.templateId}-${spec.slotId}-${digest}`.slice(0, 100);
}
function publicRecommendation(recommendation) {
  return recommendation ? structuredClone(recommendation) : null;
}

function createService(options) {
  const settings = plain(options) ? options : {};
  const adapter = settings.adapter;
  const registry = settings.registry || DefaultRegistry;
  const clock = typeof settings.clock === 'function' ? settings.clock : () => new Date().toISOString();
  const readAccount = typeof settings.readAccount === 'function' ? settings.readAccount : () => null;
  const writeAccount = typeof settings.writeAccount === 'function' ? settings.writeAccount : () => { throw new Error('account-writer-required'); };
  const dailyLimit = Number.isSafeInteger(settings.dailyLimit) && settings.dailyLimit > 0
    ? Math.min(settings.dailyLimit, DAILY_SEARCH_LIMIT) : DAILY_SEARCH_LIMIT;
  const queues = new Map();

  function load(uid, at) {
    if (!userId(uid)) throw new Error('invalid-account');
    return normalizeAccount(readAccount(uid), at);
  }
  function save(uid, state, at) {
    const payload = {
      schema: ACCOUNT_SCHEMA,
      consent: state.consent,
      cache: state.cache,
      ledger: state.ledger,
      updatedAt: at,
    };
    writeAccount(uid, payload);
    return payload;
  }
  function withLock(uid, operation) {
    const previous = queues.get(uid) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    const settled = current.finally(() => { if (queues.get(uid) === settled) queues.delete(uid); });
    queues.set(uid, settled);
    return current;
  }

  function status(uid) {
    const at = nowIso(clock);
    const state = load(uid, at);
    const fresh = BoardDiscovery.hydrateCache(state.cache, at);
    return {
      schema: ACCOUNT_SCHEMA,
      consent: state.consent,
      providerAvailable: !!(adapter && adapter.available),
      options: typeof registry.publicOptions === 'function' ? registry.publicOptions() : [],
      cache: { freshCandidates: fresh.length },
      billing: { day: state.ledger.day, searches: state.ledger.searches, limit: dailyLimit },
    };
  }

  function setConsent(uid, raw) {
    return withLock(uid, async () => {
      const at = nowIso(clock);
      const state = load(uid, at);
      const source = plain(raw) ? raw : {};
      const consent = source.enabled === true ? BoardDiscovery.normalizeConsent({
        enabled: true,
        city: source.city,
        countryCode: source.countryCode,
        timezone: source.timezone,
        locale: source.locale,
        approvedAt: at,
      }) : BoardDiscovery.normalizeConsent({ enabled: false });
      if (source.enabled === true && !consent.enabled) throw new Error('invalid-city-consent');
      if (consentChanged(state.consent, consent)) state.cache = emptyCache(at);
      state.consent = consent;
      save(uid, state, at);
      return status(uid);
    });
  }

  function resolve(uid, input, runOptions) {
    return withLock(uid, async () => {
      const at = nowIso(clock);
      const state = load(uid, at);
      if (!state.consent.enabled) return { ok: false, reason: 'city-consent-required' };
      let partial;
      try { partial = registry.createSpec(input, 'temporary-request-id'); }
      catch (error) { return { ok: false, reason: error && error.message ? error.message : 'invalid-request' }; }
      const spec = registry.createSpec(input, requestIdFor(partial, state.consent));
      const request = BoardDiscovery.createRequest(state.consent, spec);
      const cached = BoardDiscovery.recommend(request, BoardDiscovery.hydrateCache(state.cache, at), at);
      if (cached.ok) return { ok: true, source: 'account-cache', recommendation: publicRecommendation(cached.recommendation), billing: { searchRequests: 0, estimatedUsd: 0 } };
      if (!adapter || !adapter.available) return { ok: false, reason: 'provider-unavailable' };
      if (state.ledger.searches >= dailyLimit) return { ok: false, reason: 'daily-search-limit' };

      state.ledger.searches += 1;
      save(uid, state, at); // Reserve budget before the billable provider call.
      const result = await adapter.resolve(state.consent, spec, runOptions);
      if (!result || !result.ok) return result || { ok: false, reason: 'provider-error' };
      const candidates = [result.recommendation.primary, result.recommendation.reserve].filter(Boolean);
      state.cache = BoardDiscovery.buildCache(candidates, at);
      save(uid, state, at);
      return {
        ok: true,
        source: 'live-direct-verification',
        recommendation: publicRecommendation(result.recommendation),
        billing: result.billing,
        audit: result.audit,
      };
    });
  }

  return Object.freeze({ VERSION, status, setConsent, resolve });
}

module.exports = Object.freeze({
  VERSION,
  ACCOUNT_SCHEMA,
  DAILY_SEARCH_LIMIT,
  normalizeAccount,
  createService,
});
