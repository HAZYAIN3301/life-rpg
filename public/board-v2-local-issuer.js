/* Satoru Board v2 — verified local recommendation issuer.
 *
 * The server may return only direct-source-verified discovery candidates. This
 * pure bridge rehydrates that contract, resolves one approved catalog
 * template and stores an immutable Board snapshot. It never accepts a client
 * query, URL, coordinates or free-form place copy.
 */
(function exposeBoardV2LocalIssuer(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2LocalIssuer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2LocalIssuer() {
  'use strict';

  const VERSION = '1.0.0';
  const MODE = 'manual-local';
  const ALLOWED_AUTO_FLAGS = Object.freeze(['current-availability']);
  const issued = new WeakMap();

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function day(value) {
    const out = typeof value === 'string' ? value.trim() : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(out) && Number.isFinite(Date.parse(`${out}T00:00:00Z`)) ? out : '';
  }
  function instant(value) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && Number.isFinite(Date.parse(out)) ? new Date(out).toISOString() : '';
  }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function dependencies(boardApi, catalogApi, offersApi, discoveryApi) {
    return !!(boardApi && typeof boardApi.instantiate === 'function'
      && catalogApi && Array.isArray(catalogApi.ENTRIES) && typeof catalogApi.compileCatalog === 'function'
      && offersApi && typeof offersApi.snapshotQuest === 'function' && typeof offersApi.recordLocalDisplayed === 'function'
      && discoveryApi && typeof discoveryApi.hydrateCache === 'function');
  }
  function hydratedRecommendation(discoveryApi, raw, at) {
    if (!plain(raw) || raw.schema !== discoveryApi.RECOMMENDATION_SCHEMA || !plain(raw.primary)) return null;
    const entries = [raw.primary, raw.reserve].filter(Boolean);
    const hydrated = discoveryApi.hydrateCache({
      schema: discoveryApi.CACHE_SCHEMA, createdAt: at, entries,
    }, at);
    const primary = hydrated.find((item) => item.candidateId === raw.primary.candidateId) || null;
    const reserve = plain(raw.reserve)
      ? hydrated.find((item) => item.candidateId === raw.reserve.candidateId) || null : null;
    if (!primary || (raw.reserve && !reserve)) return null;
    if (reserve && JSON.stringify(reserve.request) !== JSON.stringify(primary.request)) return null;
    return { primary, reserve };
  }
  function slotValue(candidate) {
    const value = {
      label: candidate.title,
      address: candidate.address,
      url: candidate.action.url,
    };
    if (candidate.startsAt) value.startsAt = candidate.startsAt;
    if (candidate.price && candidate.price.label) value.price = candidate.price.label;
    if (candidate.route) {
      value.distanceKm = candidate.route.distanceKm;
      value.difficulty = candidate.route.difficulty;
    }
    return value;
  }
  function resolvedQuest(boardApi, catalogApi, candidate, reserve) {
    let compiled;
    try { compiled = catalogApi.compileCatalog(boardApi); } catch { return { ok: false, reason: 'catalog-unavailable' }; }
    const index = catalogApi.ENTRIES.findIndex((entry) => entry && entry.template
      && entry.template.id === candidate.request.templateId);
    const entry = index >= 0 ? catalogApi.ENTRIES[index] : null;
    const template = index >= 0 ? compiled.templates[index] : null;
    if (!entry || !template) return { ok: false, reason: 'unknown-local-template' };
    const required = template.slots.filter((slot) => slot.required);
    if (required.length !== 1 || required[0].id !== candidate.request.slotId
      || !required[0].type.startsWith('local-')) return { ok: false, reason: 'single-local-slot-required' };
    if (template.adventure.requiredFlags.some((flag) => !ALLOWED_AUTO_FLAGS.includes(flag))) {
      return { ok: false, reason: 'user-readiness-required' };
    }
    const alternatives = reserve ? [{ label: reserve.title, url: reserve.action.url }] : [];
    const built = boardApi.instantiate(template, {
      slots: { [required[0].id]: slotValue(candidate) },
      primaryAction: candidate.action,
      alternatives,
      readinessFlags: template.adventure.requiredFlags,
      fit: { confidence: candidate.relevance, distanceKm: null, interest: 1 },
    });
    return built && built.ok ? { ok: true, quest: built.quest } : { ok: false, reason: built && built.error || 'unresolved-local-quest' };
  }
  function issue(boardApi, catalogApi, offersApi, pacingApi, discoveryApi, rawState, rawRecommendation, context) {
    if (!dependencies(boardApi, catalogApi, offersApi, discoveryApi)) return { ok: false, reason: 'dependencies-unavailable' };
    const currentDay = day(context && context.day), at = instant(context && context.at);
    if (!currentDay || !at) return { ok: false, reason: 'invalid-context' };
    const recommendation = hydratedRecommendation(discoveryApi, rawRecommendation, at);
    if (!recommendation) return { ok: false, reason: 'invalid-verified-recommendation' };
    const built = resolvedQuest(boardApi, catalogApi, recommendation.primary, recommendation.reserve);
    if (!built.ok) return built;
    const snapshot = offersApi.snapshotQuest(boardApi, built.quest, { day: currentDay, mode: MODE });
    if (!snapshot) return { ok: false, reason: 'snapshot-failed' };
    const nextOffers = offersApi.recordLocalDisplayed(rawState, snapshot, pacingApi);
    const handle = deepFreeze({ ok: true, changed: true, primary: snapshot, mode: MODE });
    issued.set(handle, deepFreeze({ nextOffers, candidateId: recommendation.primary.candidateId }));
    return handle;
  }
  function result(handle) { return issued.get(handle) || null; }

  return deepFreeze({ VERSION, MODE, ALLOWED_AUTO_FLAGS, issue, result });
});
