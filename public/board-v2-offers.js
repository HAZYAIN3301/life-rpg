/* Satoru Board v2 — stable account offer snapshots (dormant foundation).
 *
 * A resolver may refresh a venue, recipe or CTA after a quest was shown. A
 * taken quest must not silently change, so the board stores the exact resolved
 * copy. This module also owns one-primary/one-reserve display and Wildcard
 * pacing. Pure module: no DOM, State, fetch, location or persistence.
 */
(function exposeBoardV2Offers(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardV2Offers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBoardV2Offers() {
  'use strict';

  const VERSION = '1.0.0';
  const STATE_SCHEMA = 'satoru.board-offers/2';
  const SNAPSHOT_SCHEMA = 'satoru.board-offer-snapshot/2';
  const PLAN_SCHEMA = 'satoru.board-standard-plan/2';
  const MAX_SNAPSHOTS = 100;
  const MAX_HISTORY = 200;
  const standardPlans = new WeakSet();

  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function text(value, max) {
    const out = typeof value === 'string' ? value.trim() : '';
    return out && out.length <= max ? out : '';
  }
  function day(value) {
    const out = text(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(out) && Number.isFinite(Date.parse(`${out}T00:00:00Z`)) ? out : '';
  }
  function period(value) { return text(value, 40); }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  function hash(value) {
    let out = 2166136261;
    const source = String(value);
    for (let index = 0; index < source.length; index += 1) {
      out ^= source.charCodeAt(index);
      out = Math.imul(out, 16777619);
    }
    return (out >>> 0).toString(36);
  }
  function safeHttps(value) {
    const source = text(value, 500);
    if (!source) return '';
    try {
      const url = new URL(source);
      return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? source : '';
    } catch { return ''; }
  }
  function uniqueStrings(value, max) {
    const out = [];
    for (const item of Array.isArray(value) ? value : []) {
      const clean = text(item, max || 80);
      if (clean && !out.includes(clean)) out.push(clean);
    }
    return out;
  }
  function emptyState(pacingApi) {
    return {
      schema: STATE_SCHEMA, current: null, snapshots: [], history: [],
      pacing: pacingApi && typeof pacingApi.emptyState === 'function' ? pacingApi.emptyState() : null,
    };
  }
  function normalizeAction(value) {
    if (!plain(value)) return null;
    const label = text(value.label, 80), url = safeHttps(value.url);
    return label && url ? { label, url } : null;
  }
  function normalizeReward(value) {
    if (!plain(value)) return null;
    const tier = Number(value.tier), xp = Number(value.xp);
    if (!Number.isSafeInteger(tier) || tier < 1 || tier > 4 || !Number.isSafeInteger(xp) || xp < 1 || xp > 1000) return null;
    const reward = { tier, xp, titleEligible: value.titleEligible === true };
    const title = text(value.title, 80); if (title) reward.title = title;
    return reward;
  }
  function normalizeSnapshot(value) {
    if (!plain(value) || value.schema !== SNAPSHOT_SCHEMA) return null;
    const id = text(value.id, 120), questId = text(value.questId, 100), templateId = text(value.templateId, 80);
    const title = text(value.title, 180), details = text(value.details, 360), issuedAt = day(value.issuedAt);
    const mode = text(value.mode, 24), reward = normalizeReward(value.reward);
    if (!/^[a-z0-9@.-]+$/.test(id) || !questId || !templateId || !title || !issuedAt || !['standard', 'passive', 'manual-unexpected', 'manual-local'].includes(mode) || !reward) return null;
    const proofModes = uniqueStrings(value.completion && value.completion.proofModes, 32).slice(0, 5);
    if (!proofModes.length) return null;
    const snapshot = {
      schema: SNAPSHOT_SCHEMA, id, questId, templateId, title, details, issuedAt, mode,
      kind: text(value.kind, 32), scale: text(value.scale, 32), tags: uniqueStrings(value.tags, 64).slice(0, 16),
      primaryAction: normalizeAction(value.primaryAction),
      alternative: plain(value.alternative) ? {
        label: text(value.alternative.label || value.alternative.name || value.alternative.title, 160),
        url: safeHttps(value.alternative.url),
      } : null,
      completion: {
        proofModes, proofRequired: !!(value.completion && value.completion.proofRequired),
        share: value.completion && value.completion.share === 'optional' ? 'optional' : 'none',
      },
      followUp: plain(value.followUp) ? {
        interventionId: text(value.followUp.interventionId, 80), question: text(value.followUp.question, 220),
        contextTags: uniqueStrings(value.followUp.contextTags, 64).slice(0, 12),
      } : null,
      adventure: plain(value.adventure) ? {
        class: text(value.adventure.class, 24), safetyTier: text(value.adventure.safetyTier, 32),
        requiredFlags: uniqueStrings(value.adventure.requiredFlags, 40).slice(0, 12),
      } : null,
      reward,
    };
    if (snapshot.alternative && (!snapshot.alternative.label || !snapshot.alternative.url)) snapshot.alternative = null;
    if (snapshot.followUp && (!snapshot.followUp.interventionId || !snapshot.followUp.question || !snapshot.followUp.contextTags.length)) snapshot.followUp = null;
    return snapshot;
  }
  function normalizeHistory(value) {
    const out = [];
    for (const entry of Array.isArray(value) ? value : []) {
      if (!plain(entry)) continue;
      const snapshotId = text(entry.snapshotId, 120), templateId = text(entry.templateId, 80), at = day(entry.at), outcome = text(entry.outcome, 20);
      if (!snapshotId || !templateId || !at || !['displayed', 'taken', 'completed', 'returned', 'rejected'].includes(outcome)) continue;
      out.push({ snapshotId, templateId, at, outcome });
    }
    return out.slice(-MAX_HISTORY);
  }
  function normalizeState(raw, pacingApi) {
    const source = plain(raw) && raw.schema === STATE_SCHEMA ? raw : {};
    const snapshots = [], seen = new Set();
    for (const candidate of Array.isArray(source.snapshots) ? source.snapshots : []) {
      const clean = normalizeSnapshot(candidate);
      if (!clean || seen.has(clean.id)) continue;
      seen.add(clean.id); snapshots.push(clean);
    }
    const keptSnapshots = snapshots.slice(-MAX_SNAPSHOTS);
    const ids = new Set(keptSnapshots.map((item) => item.id));
    const currentSource = plain(source.current) ? source.current : null;
    const currentIds = uniqueStrings(currentSource && currentSource.snapshotIds, 120).filter((id) => ids.has(id)).slice(0, 2);
    const current = currentSource && period(currentSource.periodKey) && currentIds.length
      ? { periodKey: period(currentSource.periodKey), snapshotIds: currentIds, selectedId: currentIds.includes(currentSource.selectedId) ? currentSource.selectedId : currentIds[0] }
      : null;
    return {
      schema: STATE_SCHEMA, current, snapshots: keptSnapshots, history: normalizeHistory(source.history),
      pacing: pacingApi && typeof pacingApi.normalizeState === 'function' ? pacingApi.normalizeState(source.pacing) : null,
    };
  }
  function isResolved(boardApi, quest) {
    return !!(boardApi && typeof boardApi.questScore === 'function' && plain(quest)
      && quest.schema === 'satoru.board-quest/2' && Number.isFinite(boardApi.questScore(quest, {})));
  }
  function snapshotQuest(boardApi, quest, context) {
    const source = plain(context) ? context : {};
    const issuedAt = day(source.day), mode = text(source.mode, 24);
    if (!isResolved(boardApi, quest) || !issuedAt || !['standard', 'passive', 'manual-unexpected', 'manual-local'].includes(mode)) return null;
    const fingerprint = JSON.stringify([quest.id, quest.title, quest.details, quest.resolvedSlots, quest.primaryAction, quest.reward]);
    return deepFreeze(normalizeSnapshot({
      schema: SNAPSHOT_SCHEMA, id: `${quest.templateId}@${quest.id.split('@').pop()}.${hash(fingerprint)}`,
      questId: quest.id, templateId: quest.templateId, title: quest.title, details: quest.details, issuedAt, mode,
      kind: quest.kind, scale: quest.scale, tags: quest.tags, primaryAction: quest.primaryAction, alternative: quest.alternative,
      completion: quest.completion, followUp: quest.followUp, adventure: quest.adventure, reward: quest.reward,
    }));
  }
  function hiddenTemplates(state, currentDay) {
    const hidden = [];
    for (const entry of state.history) {
      if (!['completed', 'returned', 'rejected'].includes(entry.outcome)) continue;
      const distance = Math.floor((Date.parse(`${currentDay}T00:00:00Z`) - Date.parse(`${entry.at}T00:00:00Z`)) / 86400000);
      const cooldown = entry.outcome === 'completed' ? 120 : entry.outcome === 'rejected' ? 30 : 14;
      if (distance >= 0 && distance < cooldown && !hidden.includes(entry.templateId)) hidden.push(entry.templateId);
    }
    return hidden;
  }
  function planStandard(boardApi, instances, profile, rawState, context) {
    const source = plain(context) ? context : {};
    const currentDay = day(source.day), periodKey = period(source.periodKey);
    if (!currentDay || !periodKey || !boardApi || typeof boardApi.select !== 'function') return { ok: false, reason: 'invalid-context' };
    const state = normalizeState(rawState);
    if (state.current && state.current.periodKey === periodKey) {
      const snapshots = state.current.snapshotIds.map((id) => state.snapshots.find((item) => item.id === id)).filter(Boolean);
      if (snapshots.length) return { ok: true, source: 'account-snapshot', primary: snapshots[0], reserve: snapshots[1] || null, plan: null };
    }
    const selection = boardApi.select(instances, profile, {
      adventureClasses: ['standard'], reserveLimit: 1,
      hiddenTemplateIds: hiddenTemplates(state, currentDay).concat(uniqueStrings(source.hiddenTemplateIds, 80)),
    });
    if (!selection.primary) return { ok: false, reason: 'no-resolved-standard' };
    const snapshots = [selection.primary].concat(selection.reserves.slice(0, 1))
      .map((quest) => snapshotQuest(boardApi, quest, { day: currentDay, mode: 'standard' })).filter(Boolean);
    if (!snapshots.length) return { ok: false, reason: 'no-resolved-standard' };
    const plan = deepFreeze({ schema: PLAN_SCHEMA, periodKey, day: currentDay, snapshotIds: snapshots.map((item) => item.id), nonce: hash(`${periodKey}:${snapshots.map((item) => item.id).join(':')}`) });
    standardPlans.add(plan);
    return { ok: true, source: 'resolved-now', primary: snapshots[0], reserve: snapshots[1] || null, plan };
  }
  function recordStandardDisplayed(rawState, plan, snapshots, pacingApi) {
    const state = normalizeState(rawState, pacingApi);
    const clean = (Array.isArray(snapshots) ? snapshots : []).map(normalizeSnapshot).filter(Boolean).slice(0, 2);
    if (!standardPlans.has(plan) || !clean.length || plan.snapshotIds.join('|') !== clean.map((item) => item.id).join('|')) return state;
    const byId = new Map(state.snapshots.map((item) => [item.id, item]));
    for (const item of clean) byId.set(item.id, item);
    return normalizeState({
      ...state,
      current: { periodKey: plan.periodKey, snapshotIds: clean.map((item) => item.id), selectedId: clean[0].id },
      snapshots: [...byId.values()].slice(-MAX_SNAPSHOTS),
      history: state.history.concat(clean.map((item) => ({ snapshotId: item.id, templateId: item.templateId, at: plan.day, outcome: 'displayed' }))).slice(-MAX_HISTORY),
    }, pacingApi);
  }
  function planUnexpected(boardApi, pacingApi, instances, profile, rawState, request) {
    if (!pacingApi || typeof pacingApi.planUnexpected !== 'function') return { ok: false, reason: 'pacing-required' };
    const state = normalizeState(rawState, pacingApi);
    const planned = pacingApi.planUnexpected(boardApi, instances, profile, state.pacing, request);
    if (!planned.ok) return planned;
    const snapshot = snapshotQuest(boardApi, planned.quest, { day: planned.plan.day, mode: planned.plan.mode });
    return snapshot ? { ok: true, quest: planned.quest, snapshot, plan: planned.plan } : { ok: false, reason: 'invalid-resolved-quest' };
  }
  function recordUnexpectedDisplayed(rawState, planned, pacingApi) {
    const state = normalizeState(rawState, pacingApi);
    if (!plain(planned) || !planned.snapshot || !planned.quest || !planned.plan) return state;
    const nextPacing = pacingApi.recordDisplayed(state.pacing, planned.plan, planned.quest);
    if (JSON.stringify(nextPacing) === JSON.stringify(state.pacing)) return state;
    const snapshot = normalizeSnapshot(planned.snapshot); if (!snapshot) return state;
    const byId = new Map(state.snapshots.map((item) => [item.id, item])); byId.set(snapshot.id, snapshot);
    return normalizeState({ ...state, snapshots: [...byId.values()].slice(-MAX_SNAPSHOTS), pacing: nextPacing, history: state.history.concat([{ snapshotId: snapshot.id, templateId: snapshot.templateId, at: snapshot.issuedAt, outcome: 'displayed' }]).slice(-MAX_HISTORY) }, pacingApi);
  }
  function recordLocalDisplayed(rawState, rawSnapshot, pacingApi) {
    const state = normalizeState(rawState, pacingApi);
    const snapshot = normalizeSnapshot(rawSnapshot);
    if (!snapshot || snapshot.mode !== 'manual-local') return state;
    const byId = new Map(state.snapshots.map((item) => [item.id, item]));
    byId.set(snapshot.id, snapshot);
    return normalizeState({
      ...state,
      snapshots: [...byId.values()].slice(-MAX_SNAPSHOTS),
      history: state.history.concat([{
        snapshotId: snapshot.id, templateId: snapshot.templateId,
        at: snapshot.issuedAt, outcome: 'displayed',
      }]).slice(-MAX_HISTORY),
    }, pacingApi);
  }
  function recordOutcome(rawState, snapshotId, outcome, at, pacingApi) {
    const state = normalizeState(rawState, pacingApi), id = text(snapshotId, 120), when = day(at);
    if (!id || !when || !['taken', 'completed', 'returned', 'rejected'].includes(outcome)) return state;
    const snapshot = state.snapshots.find((item) => item.id === id); if (!snapshot) return state;
    const next = { ...state, history: state.history.concat([{ snapshotId: id, templateId: snapshot.templateId, at: when, outcome }]).slice(-MAX_HISTORY) };
    if (outcome === 'rejected' && pacingApi) next.pacing = pacingApi.recordRejected(state.pacing, snapshot.templateId, when);
    return normalizeState(next, pacingApi);
  }
  function snapshotById(rawState, snapshotId, pacingApi) {
    return normalizeState(rawState, pacingApi).snapshots.find((item) => item.id === String(snapshotId)) || null;
  }
  function latestUnexpected(rawState, pacingApi) {
    const state = normalizeState(rawState, pacingApi);
    const snapshot = state.snapshots.slice().reverse().find((item) => item.mode === 'manual-unexpected');
    if (!snapshot) return null;
    const outcome = state.history.slice().reverse().find((entry) => entry.snapshotId === snapshot.id);
    return outcome && ['displayed', 'taken'].includes(outcome.outcome) ? snapshot : null;
  }
  function latestLocal(rawState, pacingApi) {
    const state = normalizeState(rawState, pacingApi);
    const snapshot = state.snapshots.slice().reverse().find((item) => item.mode === 'manual-local');
    if (!snapshot) return null;
    const outcome = state.history.slice().reverse().find((entry) => entry.snapshotId === snapshot.id);
    return outcome && ['displayed', 'taken'].includes(outcome.outcome) ? snapshot : null;
  }

  return deepFreeze({
    VERSION, STATE_SCHEMA, SNAPSHOT_SCHEMA, PLAN_SCHEMA, MAX_SNAPSHOTS, MAX_HISTORY,
    emptyState, normalizeState, normalizeSnapshot, snapshotQuest, planStandard, recordStandardDisplayed,
    planUnexpected, recordUnexpectedDisplayed, recordLocalDisplayed, recordOutcome,
    snapshotById, latestUnexpected, latestLocal,
  });
});
