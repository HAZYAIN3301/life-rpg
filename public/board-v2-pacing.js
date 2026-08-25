/* Satoru Board v2 — deterministic Wildcard surfacing policy (dormant).
 *
 * Passive offers are capped at one successfully displayed Wildcard per local
 * ISO week. Manual requests are not week-capped, but still respect hard
 * profile avoids, resolver readiness, recent offers and explicit rejection.
 * Pure module: the adapter supplies local day/week keys and persists state.
 */
(function exposeBoardV2Pacing(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Pacing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Pacing() {
  'use strict';

  const VERSION = '1.0.0';
  const STATE_SCHEMA = 'satoru.board-pacing/2';
  const MODES = Object.freeze(['passive', 'manual-unexpected']);
  const MANUAL_LABEL_RU = 'Дай что-нибудь неожиданное';
  const OFFER_COOLDOWN_DAYS = 7;
  const REJECTION_COOLDOWN_DAYS = 30;
  const MAX_RECORDS = 100;
  const issuedPlans = new WeakSet();

  function plain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function day(value) {
    const out = text(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(out) && Number.isFinite(Date.parse(`${out}T00:00:00Z`)) ? out : '';
  }
  function week(value) {
    const out = text(value, 8);
    if (!/^\d{4}-W\d{2}$/.test(out)) return '';
    const number = Number(out.slice(-2));
    return number >= 1 && number <= 53 ? out : '';
  }
  function uniqueStrings(value, max) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const clean = text(item, max || 80);
      if (clean && !out.includes(clean)) out.push(clean);
    }
    return out;
  }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function dateDistance(from, to) {
    const left = Date.parse(`${from}T00:00:00Z`);
    const right = Date.parse(`${to}T00:00:00Z`);
    return Math.floor((right - left) / 86400000);
  }
  function recent(recordDay, currentDay, cooldown) {
    const distance = dateDistance(recordDay, currentDay);
    return distance >= 0 && distance < cooldown;
  }
  function hashUnit(value) {
    let hash = 2166136261;
    const source = String(value);
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  }

  function emptyState() {
    return { schema: STATE_SCHEMA, passiveWeeks: [], offers: [], rejections: [] };
  }

  function normalizeRecords(raw, allowedModes) {
    const records = [];
    for (const candidate of Array.isArray(raw) ? raw : []) {
      if (!plain(candidate)) continue;
      const templateId = text(candidate.templateId, 80);
      const at = day(candidate.at);
      const mode = allowedModes ? text(candidate.mode, 24) : '';
      if (!templateId || !at || (allowedModes && !MODES.includes(mode))) continue;
      const clean = { templateId, at };
      if (allowedModes) clean.mode = mode;
      records.push(clean);
    }
    return records.slice(-MAX_RECORDS);
  }

  function normalizeState(raw) {
    const source = plain(raw) ? raw : {};
    return {
      schema: STATE_SCHEMA,
      passiveWeeks: uniqueStrings(source.passiveWeeks, 8).filter(week).slice(-20),
      offers: normalizeRecords(source.offers, true),
      rejections: normalizeRecords(source.rejections, false),
    };
  }

  function passiveEligibility(rawState, weekKey) {
    const localWeek = week(weekKey);
    if (!localWeek) return { ok: false, reason: 'invalid-week-key' };
    const state = normalizeState(rawState);
    if (state.passiveWeeks.includes(localWeek)) return { ok: false, reason: 'weekly-cap' };
    return { ok: true, reason: null };
  }

  function hiddenByPacing(state, currentDay) {
    const hidden = new Set();
    for (const record of state.offers) {
      if (recent(record.at, currentDay, OFFER_COOLDOWN_DAYS)) hidden.add(record.templateId);
    }
    for (const record of state.rejections) {
      if (recent(record.at, currentDay, REJECTION_COOLDOWN_DAYS)) hidden.add(record.templateId);
    }
    return hidden;
  }

  function planUnexpected(boardApi, instances, profile, rawState, request) {
    if (!boardApi || typeof boardApi.select !== 'function' || typeof boardApi.questScore !== 'function') {
      return { ok: false, reason: 'board-v2-required' };
    }
    const source = plain(request) ? request : {};
    const mode = text(source.mode, 24);
    const currentDay = day(source.day);
    const localWeek = week(source.weekKey);
    if (!MODES.includes(mode)) return { ok: false, reason: 'invalid-mode' };
    if (!currentDay) return { ok: false, reason: 'invalid-day' };
    if (mode === 'passive') {
      const eligibility = passiveEligibility(rawState, localWeek);
      if (!eligibility.ok) return eligibility;
    }

    const state = normalizeState(rawState);
    const hidden = hiddenByPacing(state, currentDay);
    for (const templateId of uniqueStrings(source.hiddenTemplateIds, 80)) hidden.add(templateId);
    const adventureClasses = mode === 'passive' ? ['wildcard'] : ['wildcard', 'legendary'];
    const eligible = [];
    for (const quest of Array.isArray(instances) ? instances : []) {
      const selected = boardApi.select([quest], profile, {
        adventureClasses,
        hiddenTemplateIds: [...hidden],
      });
      if (selected.primary !== quest) continue;
      const score = Number(boardApi.questScore(quest, profile));
      if (!Number.isFinite(score)) continue;
      eligible.push({ quest, score });
    }
    if (!eligible.length) return { ok: false, reason: 'no-eligible-quest' };

    const seed = text(source.seed, 160) || `${mode}:${currentDay}:${localWeek || 'manual'}`;
    eligible.sort((left, right) => {
      const leftScore = left.score + hashUnit(`${seed}:${left.quest.id}`) * 1.25;
      const rightScore = right.score + hashUnit(`${seed}:${right.quest.id}`) * 1.25;
      if (Math.abs(rightScore - leftScore) > 1e-9) return rightScore - leftScore;
      return left.quest.id.localeCompare(right.quest.id);
    });

    const quest = eligible[0].quest;
    const plan = deepFreeze({
      schema: 'satoru.board-offer-plan/2',
      mode,
      day: currentDay,
      weekKey: mode === 'passive' ? localWeek : null,
      questId: quest.id,
      templateId: quest.templateId,
      nonce: `${currentDay}:${Math.floor(hashUnit(`${seed}:${quest.id}`) * 4294967296).toString(36)}`,
    });
    issuedPlans.add(plan);
    return { ok: true, quest, plan };
  }

  function recordDisplayed(rawState, plan, quest) {
    const state = normalizeState(rawState);
    if (!issuedPlans.has(plan) || !quest || plan.questId !== quest.id || plan.templateId !== quest.templateId) return state;
    state.offers.push({ templateId: plan.templateId, at: plan.day, mode: plan.mode });
    state.offers = state.offers.slice(-MAX_RECORDS);
    if (plan.mode === 'passive' && !state.passiveWeeks.includes(plan.weekKey)) {
      state.passiveWeeks.push(plan.weekKey);
      state.passiveWeeks = state.passiveWeeks.slice(-20);
    }
    return state;
  }

  function recordRejected(rawState, templateId, rejectedAt) {
    const state = normalizeState(rawState);
    const cleanId = text(templateId, 80);
    const cleanDay = day(rejectedAt);
    if (!cleanId || !cleanDay) return state;
    state.rejections.push({ templateId: cleanId, at: cleanDay });
    state.rejections = state.rejections.slice(-MAX_RECORDS);
    return state;
  }

  return deepFreeze({
    VERSION,
    STATE_SCHEMA,
    MODES,
    MANUAL_LABEL_RU,
    OFFER_COOLDOWN_DAYS,
    REJECTION_COOLDOWN_DAYS,
    emptyState,
    normalizeState,
    passiveEligibility,
    planUnexpected,
    recordDisplayed,
    recordRejected,
  });
});
