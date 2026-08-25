/* Satoru Board v2 — local discovery/privacy contract (dormant).
 *
 * Search providers may suggest URLs, but they cannot create a quest. A local
 * candidate becomes usable only after direct source evidence confirms every
 * critical field. Exact coordinates, provider snippets and ephemeral place
 * identifiers are never retained by this module.
 *
 * Pure module: no DOM, State, fetch, geolocation, storage or provider SDK.
 */
(function exposeBoardV2Discovery(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Discovery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Discovery() {
  'use strict';

  const VERSION = '1.0.0';
  const CONSENT_SCHEMA = 'satoru.board-discovery-consent/1';
  const REQUEST_SCHEMA = 'satoru.board-discovery-request/1';
  const CANDIDATE_SCHEMA = 'satoru.board-discovery-candidate/1';
  const CACHE_SCHEMA = 'satoru.board-discovery-cache/1';
  const RECOMMENDATION_SCHEMA = 'satoru.board-discovery-recommendation/1';
  const PROVIDER_ID = 'brave-web-v1';
  const INTENTS = Object.freeze(['place', 'class', 'event', 'route']);
  const SOURCE_KINDS = Object.freeze(['official', 'organizer', 'venue', 'aggregator']);
  const DIRECT_SOURCE_KINDS = Object.freeze(['official', 'organizer', 'venue']);
  const VERIFIED_FIELDS = Object.freeze([
    'title', 'address', 'startsAt', 'price', 'actionUrl', 'availability', 'route',
  ]);
  const BUDGET_TIERS = Object.freeze(['free', 'low', 'medium', 'open']);
  const AVAILABILITY = Object.freeze(['confirmed']);
  const TTL_MS = Object.freeze({
    class: 12 * 60 * 60 * 1000,
    event: 12 * 60 * 60 * 1000,
    place: 24 * 60 * 60 * 1000,
    route: 7 * 24 * 60 * 60 * 1000,
  });
  const issuedRequests = new WeakSet();
  const verifiedCandidates = new WeakSet();

  class BoardDiscoveryError extends Error {
    constructor(code, detail) {
      super(detail ? `${code}: ${detail}` : code);
      this.name = 'BoardDiscoveryError';
      this.code = code;
      if (detail) this.detail = detail;
    }
  }

  function plain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function id(value, max) {
    const out = text(value, max || 80);
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out) ? out : '';
  }
  function uniqueIds(value, maxItems) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const clean = id(item, 48);
      if (clean && !out.includes(clean)) out.push(clean);
      if (out.length >= maxItems) break;
    }
    return out;
  }
  function uniqueFields(value) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const clean = text(item, 32);
      if (VERIFIED_FIELDS.includes(clean) && !out.includes(clean)) out.push(clean);
    }
    return out;
  }
  function iso(value) {
    const out = text(value, 40);
    return out && Number.isFinite(Date.parse(out)) && /T\d{2}:\d{2}/.test(out) ? out : '';
  }
  function timezone(value) {
    const out = text(value, 80);
    if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(out)) return '';
    try {
      new Intl.DateTimeFormat('en', { timeZone: out }).format(0);
      return out;
    } catch {
      return '';
    }
  }
  function locale(value) {
    const out = text(value, 12);
    return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(out) ? out : '';
  }
  function safeHttps(value) {
    const source = text(value, 600);
    if (!source) return '';
    try {
      const url = new URL(source);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
      return url.href;
    } catch {
      return '';
    }
  }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function finiteNumber(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  function disabledConsent() {
    return { schema: CONSENT_SCHEMA, enabled: false };
  }

  function normalizeConsent(raw) {
    const source = plain(raw) ? raw : {};
    if (source.enabled !== true) return disabledConsent();
    const city = text(source.city, 100);
    const countryCode = text(source.countryCode, 2).toUpperCase();
    const zone = timezone(source.timezone);
    const language = locale(source.locale);
    const approvedAt = iso(source.approvedAt);
    if (!city || !/^[A-Z]{2}$/.test(countryCode) || !zone || !language || !approvedAt) {
      return disabledConsent();
    }
    return deepFreeze({
      schema: CONSENT_SCHEMA,
      enabled: true,
      city,
      countryCode,
      timezone: zone,
      locale: language,
      approvedAt,
    });
  }

  function normalizeConstraints(raw) {
    const source = plain(raw) ? raw : {};
    const budgetTier = BUDGET_TIERS.includes(source.budgetTier) ? source.budgetTier : 'open';
    const maxTravelMinutes = Math.round(finiteNumber(source.maxTravelMinutes, 5, 360) || 60);
    return {
      budgetTier,
      maxTravelMinutes,
      accessibility: uniqueIds(source.accessibility, 8),
      avoidTags: uniqueIds(source.avoidTags, 16),
    };
  }

  function createRequest(rawConsent, raw) {
    const consent = normalizeConsent(rawConsent);
    if (!consent.enabled) throw new BoardDiscoveryError('city-consent-required');
    const source = plain(raw) ? raw : {};
    const requestId = id(source.requestId, 100);
    const templateId = id(source.templateId, 80);
    const slotId = id(source.slotId, 48);
    const intent = text(source.intent, 16);
    const searchTerms = uniqueIds(source.searchTerms, 8);
    if (!requestId || !templateId || !slotId) throw new BoardDiscoveryError('invalid-request-id');
    if (!INTENTS.includes(intent)) throw new BoardDiscoveryError('invalid-intent');
    if (!searchTerms.length) throw new BoardDiscoveryError('authored-search-terms-required');
    const request = deepFreeze({
      schema: REQUEST_SCHEMA,
      requestId,
      provider: PROVIDER_ID,
      templateId,
      slotId,
      intent,
      city: consent.city,
      countryCode: consent.countryCode,
      timezone: consent.timezone,
      locale: consent.locale,
      searchTerms,
      interests: uniqueIds(source.interests, 16),
      constraints: normalizeConstraints(source.constraints),
    });
    issuedRequests.add(request);
    return request;
  }

  function normalizeSource(raw, defaultCheckedAt) {
    if (!plain(raw)) return null;
    const kind = text(raw.kind, 16);
    const url = safeHttps(raw.url);
    const fields = uniqueFields(raw.fields);
    const checkedAt = iso(raw.checkedAt) || defaultCheckedAt;
    if (!SOURCE_KINDS.includes(kind) || !url || !fields.length || !checkedAt) return null;
    return { kind, url, fields, checkedAt };
  }

  function criticalFields(intent) {
    if (intent === 'class' || intent === 'event') {
      return ['title', 'address', 'startsAt', 'price', 'actionUrl', 'availability'];
    }
    if (intent === 'route') return ['title', 'address', 'route', 'actionUrl', 'availability'];
    return ['title', 'address', 'actionUrl', 'availability'];
  }

  function directEvidence(sources, field) {
    return sources.some((source) => DIRECT_SOURCE_KINDS.includes(source.kind) && source.fields.includes(field));
  }

  function normalizePrice(raw, required) {
    if (raw == null && !required) return null;
    if (!plain(raw)) throw new BoardDiscoveryError('verified-price-required');
    if (raw.type === 'free') return { type: 'free', label: text(raw.label, 40) || 'Free' };
    const amount = finiteNumber(raw.amount, 0, 1000000);
    const currency = text(raw.currency, 3).toUpperCase();
    const label = text(raw.label, 40);
    if (raw.type !== 'fixed' || amount == null || !/^[A-Z]{3}$/.test(currency) || !label) {
      throw new BoardDiscoveryError('verified-price-required');
    }
    return { type: 'fixed', amount, currency, label };
  }

  function computeExpiry(intent, checkedAt, startsAt) {
    let expiry = Date.parse(checkedAt) + TTL_MS[intent];
    if (startsAt) expiry = Math.min(expiry, Date.parse(startsAt));
    return new Date(expiry).toISOString();
  }

  function candidateFromRaw(request, raw, options) {
    if (!plain(raw)) throw new BoardDiscoveryError('invalid-candidate');
    const hydrating = options && options.hydrating === true;
    const candidateId = id(raw.candidateId, 100);
    const title = text(raw.title, 180);
    const address = text(raw.address, 220);
    const checkedAt = iso(raw.checkedAt);
    const action = plain(raw.action) ? {
      label: text(raw.action.label, 80),
      url: safeHttps(raw.action.url),
    } : { label: '', url: '' };
    const availability = text(raw.availability, 16);
    const sources = (Array.isArray(raw.sources) ? raw.sources : [])
      .map((source) => normalizeSource(source, checkedAt))
      .filter(Boolean);
    if (!candidateId || !title || !address || !checkedAt || !action.label || !action.url) {
      throw new BoardDiscoveryError('incomplete-candidate');
    }
    if (!AVAILABILITY.includes(availability)) throw new BoardDiscoveryError('availability-not-confirmed');
    if (!sources.length) throw new BoardDiscoveryError('source-evidence-required');
    for (const evidence of sources) {
      const distance = Date.parse(checkedAt) - Date.parse(evidence.checkedAt);
      if (distance < -5 * 60 * 1000 || distance > 15 * 60 * 1000) {
        throw new BoardDiscoveryError('source-check-time-mismatch');
      }
    }
    for (const field of criticalFields(request.intent)) {
      if (!directEvidence(sources, field)) throw new BoardDiscoveryError('direct-source-required', field);
    }

    const startsAt = (request.intent === 'class' || request.intent === 'event') ? iso(raw.startsAt) : '';
    if ((request.intent === 'class' || request.intent === 'event')
        && (!startsAt || Date.parse(startsAt) <= Date.parse(checkedAt))) {
      throw new BoardDiscoveryError('future-start-required');
    }
    const price = normalizePrice(raw.price, request.intent === 'class' || request.intent === 'event');
    let route = null;
    if (request.intent === 'route') {
      const routeSource = plain(raw.route) ? raw.route : {};
      const distanceKm = finiteNumber(routeSource.distanceKm, 0.1, 5000);
      const difficulty = text(routeSource.difficulty, 80);
      if (distanceKm == null || !difficulty) throw new BoardDiscoveryError('verified-route-required');
      route = { distanceKm, difficulty };
    }
    const travelMinutes = finiteNumber(raw.travelMinutes, 0, 1440);
    if (travelMinutes != null && travelMinutes > request.constraints.maxTravelMinutes) {
      throw new BoardDiscoveryError('travel-limit-exceeded');
    }
    const relevance = finiteNumber(raw.relevance, 0, 1);
    const candidate = {
      schema: CANDIDATE_SCHEMA,
      candidateId,
      provider: PROVIDER_ID,
      request: {
        requestId: request.requestId,
        templateId: request.templateId,
        slotId: request.slotId,
        intent: request.intent,
        city: request.city,
        countryCode: request.countryCode,
      },
      title,
      address,
      startsAt: startsAt || null,
      price,
      route,
      availability,
      action,
      travelMinutes,
      relevance: relevance == null ? 0 : relevance,
      checkedAt,
      expiresAt: computeExpiry(request.intent, checkedAt, startsAt),
      sources,
      storage: {
        providerPayloadStored: false,
        providerSnippetStored: false,
        ephemeralProviderIdStored: false,
        exactCoordinatesStored: false,
      },
    };
    if (hydrating && raw.expiresAt !== candidate.expiresAt) {
      throw new BoardDiscoveryError('cache-expiry-mismatch');
    }
    deepFreeze(candidate);
    verifiedCandidates.add(candidate);
    return candidate;
  }

  function verifyCandidate(request, raw) {
    if (!issuedRequests.has(request)) throw new BoardDiscoveryError('issued-request-required');
    return candidateFromRaw(request, raw);
  }

  function isFresh(candidate, at) {
    if (!verifiedCandidates.has(candidate)) return false;
    const current = iso(at);
    if (!current) return false;
    const now = Date.parse(current);
    if (now < Date.parse(candidate.checkedAt) - 5 * 60 * 1000) return false;
    if (now >= Date.parse(candidate.expiresAt)) return false;
    if (candidate.startsAt && now >= Date.parse(candidate.startsAt)) return false;
    return true;
  }

  function contextMatches(request, candidate) {
    const context = candidate.request;
    return context.requestId === request.requestId
      && context.templateId === request.templateId
      && context.slotId === request.slotId
      && context.intent === request.intent
      && context.city === request.city
      && context.countryCode === request.countryCode;
  }

  function recommend(request, candidates, at) {
    if (!issuedRequests.has(request)) return { ok: false, reason: 'issued-request-required' };
    const usable = [];
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      if (!verifiedCandidates.has(candidate) || !contextMatches(request, candidate) || !isFresh(candidate, at)) continue;
      usable.push(candidate);
    }
    usable.sort((left, right) => {
      if (right.relevance !== left.relevance) return right.relevance - left.relevance;
      const leftTravel = left.travelMinutes == null ? 100000 : left.travelMinutes;
      const rightTravel = right.travelMinutes == null ? 100000 : right.travelMinutes;
      if (leftTravel !== rightTravel) return leftTravel - rightTravel;
      return left.candidateId.localeCompare(right.candidateId);
    });
    if (!usable.length) return { ok: false, reason: 'no-verified-candidate' };
    return deepFreeze({
      ok: true,
      recommendation: {
        schema: RECOMMENDATION_SCHEMA,
        requestId: request.requestId,
        primary: usable[0],
        reserve: usable[1] || null,
      },
    });
  }

  function buildCache(candidates, createdAt) {
    const timestamp = iso(createdAt);
    if (!timestamp) throw new BoardDiscoveryError('invalid-cache-time');
    const entries = [];
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      if (verifiedCandidates.has(candidate) && !entries.includes(candidate)) entries.push(candidate);
    }
    return deepFreeze({ schema: CACHE_SCHEMA, createdAt: timestamp, entries });
  }

  function requestFromStoredContext(raw) {
    if (!plain(raw) || raw.schema !== CANDIDATE_SCHEMA || !plain(raw.request)) {
      throw new BoardDiscoveryError('invalid-cache-entry');
    }
    const context = raw.request;
    const request = deepFreeze({
      schema: REQUEST_SCHEMA,
      requestId: id(context.requestId, 100),
      provider: PROVIDER_ID,
      templateId: id(context.templateId, 80),
      slotId: id(context.slotId, 48),
      intent: text(context.intent, 16),
      city: text(context.city, 100),
      countryCode: text(context.countryCode, 2),
      timezone: 'UTC',
      locale: 'en',
      searchTerms: ['cache-hydration'],
      interests: [],
      constraints: normalizeConstraints({ maxTravelMinutes: 360 }),
    });
    if (!request.requestId || !request.templateId || !request.slotId || !INTENTS.includes(request.intent)
        || !request.city || !/^[A-Z]{2}$/.test(request.countryCode)) {
      throw new BoardDiscoveryError('invalid-cache-context');
    }
    return request;
  }

  function hydrateCache(raw, at) {
    const source = plain(raw) ? raw : {};
    if (source.schema !== CACHE_SCHEMA || !iso(source.createdAt)) return [];
    const hydrated = [];
    for (const entry of Array.isArray(source.entries) ? source.entries : []) {
      try {
        const request = requestFromStoredContext(entry);
        const candidate = candidateFromRaw(request, entry, { hydrating: true });
        if (isFresh(candidate, at)) hydrated.push(candidate);
      } catch {
        // A corrupt, stale or future-shaped cache row is ignored fail-closed.
      }
    }
    return hydrated;
  }

  function providerPolicy() {
    return deepFreeze({
      id: PROVIDER_ID,
      rawSearchPersistence: 'forbidden-without-storage-rights',
      snippetsInAccount: false,
      ephemeralPlaceIdsInAccount: false,
      exactCoordinatesInAccount: false,
      persistentCandidateSource: 'direct-source-verification-only',
    });
  }

  return deepFreeze({
    VERSION,
    CONSENT_SCHEMA,
    REQUEST_SCHEMA,
    CANDIDATE_SCHEMA,
    CACHE_SCHEMA,
    RECOMMENDATION_SCHEMA,
    PROVIDER_ID,
    INTENTS,
    SOURCE_KINDS,
    TTL_MS,
    BoardDiscoveryError,
    normalizeConsent,
    createRequest,
    verifyCandidate,
    isFresh,
    recommend,
    buildCache,
    hydrateCache,
    providerPolicy,
  });
});
