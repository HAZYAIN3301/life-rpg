/* Satoru Board v2 — conservative standard-offer issuer.
 *
 * The approved catalog contains local, social and account-specific templates.
 * This module resolves only the small subset whose exact slots and eligibility
 * are already known. Missing context never becomes generic motivational copy.
 * Pure module: no DOM, State, fetch, clock or persistence.
 */
(function exposeBoardV2Issuer(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Issuer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Issuer() {
  'use strict';

  const VERSION = '1.0.0';
  const PROFILE_SCHEMA = 'satoru.board-issuer-profile/2';
  const SUPPORTED_TEMPLATE_IDS = Object.freeze([
    'full-workout-without-music',
    'long-guided-stretch',
    'walk-without-phone',
  ]);
  const VIDEO_FITS = Object.freeze(['beginner', 'regular', 'shorter']);
  const issued = new WeakMap();

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function unique(value, allowed, max) {
    const result = [];
    for (const candidate of Array.isArray(value) ? value : []) {
      const clean = text(candidate, max || 64);
      if (!clean || !allowed.has(clean) || result.includes(clean)) continue;
      result.push(clean);
    }
    return result;
  }
  function dependencies(boardApi, catalogApi, offersApi, pacingApi) {
    return !!(boardApi && typeof boardApi.compileTemplate === 'function' && typeof boardApi.instantiate === 'function'
      && catalogApi && Array.isArray(catalogApi.ENTRIES) && typeof catalogApi.compileCatalog === 'function'
      && offersApi && typeof offersApi.planStandard === 'function' && typeof offersApi.recordStandardDisplayed === 'function'
      && pacingApi && typeof pacingApi.normalizeState === 'function');
  }
  function vocabulary(catalogApi) {
    const interests = new Set(), tags = new Set(), gates = new Set();
    for (const entry of Array.isArray(catalogApi && catalogApi.ENTRIES) ? catalogApi.ENTRIES : []) {
      for (const interest of Array.isArray(entry.template && entry.template.interests) ? entry.template.interests : []) interests.add(interest);
      for (const tag of Array.isArray(entry.template && entry.template.tags) ? entry.template.tags : []) tags.add(tag);
      for (const gate of Array.isArray(entry.resolver && entry.resolver.gates) ? entry.resolver.gates : []) gates.add(gate);
    }
    return { interests, tags, gates, profileTerms: new Set([...interests, ...tags]) };
  }
  function normalizeWeights(value, allowed) {
    const out = {};
    if (!plain(value)) return out;
    for (const [key, raw] of Object.entries(value)) {
      if (!allowed.has(key)) continue;
      const number = Number(raw);
      if (Number.isFinite(number) && number !== 0) out[key] = Math.max(-4, Math.min(4, number));
    }
    return out;
  }
  function normalizeProfile(catalogApi, raw) {
    const words = vocabulary(catalogApi), source = plain(raw) ? raw : {};
    const tasteWeights = normalizeWeights(source.tasteWeights, words.profileTerms);
    const interests = unique(source.interests, words.profileTerms);
    const avoidTags = unique(source.avoidTags, words.tags);
    for (const [key, weight] of Object.entries(tasteWeights)) {
      if (weight >= 0.25 && !interests.includes(key)) interests.push(key);
      if (weight <= -0.75 && words.tags.has(key) && !avoidTags.includes(key)) avoidTags.push(key);
    }
    const gates = unique(source.gates, words.gates);
    const videoFit = VIDEO_FITS.includes(source.videoFit) ? source.videoFit : 'beginner';
    return deepFreeze({ schema: PROFILE_SCHEMA, interests, avoidTags, gates, tasteWeights, videoFit });
  }
  function gateEligible(entry, profile) {
    const held = new Set(profile.gates);
    return (entry.resolver.gates || []).every((gate) => held.has(gate));
  }
  function interestFit(entry, profile, baseConfidence) {
    const wanted = new Set(profile.interests);
    const terms = [...(entry.template.interests || []), ...(entry.template.tags || [])];
    const matches = terms.filter((term) => wanted.has(term));
    let weighted = 0;
    for (const term of terms) weighted += Math.max(0, profile.tasteWeights[term] || 0);
    return {
      interest: Math.min(2, matches.length * 0.5 + weighted * 0.25),
      confidence: Math.max(0, Math.min(1, baseConfidence + Math.min(0.2, matches.length * 0.05))),
    };
  }
  function resolutionFor(entry, profile, catalogApi) {
    if (!SUPPORTED_TEMPLATE_IDS.includes(entry.template.id) || !gateEligible(entry, profile)) return null;
    const fit = interestFit(entry, profile, entry.template.id === 'long-guided-stretch' ? 0.62 : 0.76);
    if (entry.template.id === 'long-guided-stretch') {
      if (profile.avoidTags.some((tag) => ['recovery', 'mobility', 'overloaded'].includes(tag))) return null;
      const options = Array.isArray(catalogApi.STRETCH_OPTIONS) ? catalogApi.STRETCH_OPTIONS : [];
      const selected = options.find((option) => option.fit === profile.videoFit) || options[0];
      if (!selected || !text(selected.label, 160) || !text(selected.url, 500)) return null;
      return {
        slots: { routine: { label: selected.label, url: selected.url } },
        primaryAction: { label: 'Открыть тренировку', url: selected.url },
        fit,
      };
    }
    if (entry.template.id === 'full-workout-without-music') return { slots: {}, fit };
    if (entry.template.id === 'walk-without-phone') return { slots: {}, fit };
    return null;
  }
  function resolvedInstances(boardApi, catalogApi, rawProfile) {
    if (!boardApi || !catalogApi) return [];
    const profile = normalizeProfile(catalogApi, rawProfile);
    let compiled;
    try { compiled = catalogApi.compileCatalog(boardApi); } catch { return []; }
    const result = [];
    for (let index = 0; index < catalogApi.ENTRIES.length; index += 1) {
      const entry = catalogApi.ENTRIES[index], resolution = resolutionFor(entry, profile, catalogApi);
      if (!resolution) continue;
      const instance = boardApi.instantiate(compiled.templates[index], resolution);
      if (instance && instance.ok) result.push(instance.quest);
    }
    return result;
  }
  function issueStandard(boardApi, catalogApi, offersApi, pacingApi, rawProfile, rawState, context) {
    if (!dependencies(boardApi, catalogApi, offersApi, pacingApi)) return { ok: false, reason: 'dependencies-unavailable' };
    const profile = normalizeProfile(catalogApi, rawProfile);
    const instances = resolvedInstances(boardApi, catalogApi, profile);
    const planned = offersApi.planStandard(boardApi, instances, profile, rawState, context);
    if (!planned.ok) return planned;
    const nextOffers = planned.plan
      ? offersApi.recordStandardDisplayed(rawState, planned.plan, [planned.primary, planned.reserve].filter(Boolean), pacingApi)
      : offersApi.normalizeState(rawState, pacingApi);
    const handle = deepFreeze({
      ok: true,
      source: planned.source,
      primary: planned.primary,
      reserve: planned.reserve || null,
      changed: !!planned.plan,
    });
    issued.set(handle, deepFreeze({ profile, nextOffers, instances: instances.map((quest) => quest.id) }));
    return handle;
  }
  function result(handle) { return issued.get(handle) || null; }

  return deepFreeze({
    VERSION,
    PROFILE_SCHEMA,
    SUPPORTED_TEMPLATE_IDS,
    VIDEO_FITS,
    normalizeProfile,
    resolvedInstances,
    issueStandard,
    result,
  });
});
