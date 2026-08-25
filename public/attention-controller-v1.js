/* Satoru Attention Controller v1 — thin product adapter over the pure engine.
 *
 * The engine modules own invariants. This adapter turns bounded form values into
 * engine calls and returns complete next states for the app to persist. It does
 * not touch DOM, Store, timers, rewards or global State, so data transitions stay
 * executable in tests and the visible app never re-implements domain rules.
 */
(function exposeAttentionController(root, factory) {
  const policy = root && root.AttentionPolicyV1
    ? root.AttentionPolicyV1
    : typeof require === 'function' ? require('./attention-policy-v1.js') : null;
  const session = root && root.AttentionSessionV1
    ? root.AttentionSessionV1
    : typeof require === 'function' ? require('./attention-session-v1.js') : null;
  const episode = root && root.AttentionEpisodeV1
    ? root.AttentionEpisodeV1
    : typeof require === 'function' ? require('./attention-episode-v1.js') : null;
  const api = factory(policy, session, episode);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AttentionControllerV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAttentionController(P, S, E) {
  'use strict';

  const VERSION = '1.0.0';
  const DATASETS = Object.freeze({ policies: 'attention-policies', sessions: 'attention-sessions', episodes: 'attention-episodes' });

  function ready() { return !!(P && S && E); }
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj || {}, key); }
  function iso(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
  function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
  function integer(value, fallback, lo, hi) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  }
  function purposeValid(value) { return !!(P && own(P.PURPOSES, value)); }
  function modeValid(value) { return value === 'trust' || value === 'adaptive' || value === 'control'; }

  function strictState(value, listKey, normalize) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Number(value.version) !== 1 || !Array.isArray(value[listKey])) return false;
    const ids = value[listKey].map((row) => row && row.id);
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) return false;
    const cleaned = normalize(value);
    return Array.isArray(cleaned[listKey]) && cleaned[listKey].length === value[listKey].length;
  }

  function validatePolicies(value) { return ready() && strictState(value, 'policies', P.normalize); }
  function validateSessions(value) { return ready() && strictState(value, 'sessions', S.normalize); }
  function validateEpisodes(value) { return ready() && strictState(value, 'episodes', E.normalize); }

  function emptyBundle() {
    return {
      policies: P ? P.emptyState() : { version: 1, policies: [] },
      sessions: S ? S.emptyState() : { version: 1, sessions: [] },
      episodes: E ? E.emptyState() : { version: 1, episodes: [] },
    };
  }

  function policyDraftFromSetup(input, id) {
    if (!ready()) return { ok: false, error: 'engine_unavailable' };
    const name = text(input && input.targetLabel, 60);
    const purpose = input && input.purpose;
    const mode = modeValid(input && input.mode) ? input.mode : 'adaptive';
    const minutes = integer(input && input.minutes, 10, 1, P.MAX_MINUTES);
    const outcome = text(input && input.outcome, 120);
    if (!name || !purposeValid(purpose)) return { ok: false, error: 'invalid' };
    if (P.isWorkPurpose(purpose) && !outcome) return { ok: false, error: 'outcome_required' };
    const extensions = mode === 'trust' ? 3 : mode === 'adaptive' ? 1 : 0;
    const extensionMinutes = Math.min(5, minutes);
    const rule = {
      purpose,
      defaultMinutes: minutes,
      maxMinutes: Math.min(P.MAX_MINUTES, minutes + extensions * extensionMinutes),
      mode,
      extensions,
      extensionMinutes,
    };
    if (outcome) rule.outcome = outcome;
    if (purpose === 'research') { rule.requiresTopic = true; rule.captureCap = 3; }
    return {
      ok: true,
      draft: {
        id: text(id, 40), name, purposes: [rule],
        emergency: { ...P.DEFAULT_EMERGENCY }, modes: [], sync: false,
      },
    };
  }

  function upsertPolicy(policies, input, id) {
    const built = policyDraftFromSetup(input, id);
    if (!built.ok) return built;
    return P.upsert(policies, built.draft);
  }

  function calibrationFor(episodes, policyId, purpose, now) {
    if (!ready() || !iso(now)) return null;
    const row = E.calibration(episodes, policyId, purpose, now);
    if (!row.enough) return null;
    return { recorded: row.recorded, started: row.total, outsidePlan: row.offPlan };
  }

  function startSession(bundle, input, now) {
    if (!ready() || !bundle || !iso(now)) return { ok: false, error: 'invalid' };
    const policyId = text(input && input.policyId, 40);
    const purpose = input && input.purpose;
    const expectedOutcome = text(input && input.expectedOutcome, 120);
    const topic = text(input && input.topic, 80);
    const gate = P.canOpen(bundle.policies, policyId, purpose, { expectedOutcome, topic, mode: input && input.dayMode, now: input && input.hhmm });
    if (!gate.ok) return { ok: false, error: gate.reason };
    const rule = gate.rule;
    const draft = {
      id: text(input && input.id, 40), policyId, purpose,
      plannedMinutes: rule.defaultMinutes, mode: rule.mode,
      extensionsAllowed: rule.extensions, extensionMinutes: rule.extensionMinutes,
    };
    const outcome = expectedOutcome || rule.outcome || '';
    if (outcome) draft.expectedOutcome = outcome;
    if (topic) draft.topic = topic;
    const started = S.start(bundle.sessions, draft, now);
    return started.ok ? { ok: true, sessions: started.state, session: started.session } : started;
  }

  function extendSession(sessions, id, seq, minutes, now) {
    if (!ready()) return { ok: false, error: 'engine_unavailable' };
    return S.extend(sessions, id, { seq, minutes }, now);
  }

  function closeSession(bundle, id, outcome, now, source = 'manual') {
    if (!ready() || !bundle || !iso(now)) return { ok: false, error: 'invalid' };
    const closed = S.close(bundle.sessions, id, outcome, now);
    if (!closed.ok) return closed;
    const draft = S.toEpisode(closed.session);
    if (!draft) return { ok: false, error: 'episode_invalid' };
    draft.source = E.SOURCES.includes(source) ? source : 'manual';
    const recorded = E.record(bundle.episodes, draft);
    if (!recorded.ok) return recorded;
    return { ok: true, sessions: closed.state, episodes: recorded.state, session: closed.session, episode: E.byId(recorded.state, draft.id) };
  }

  function emergencyClose(bundle, id, reason, now, emergencyRule) {
    if (!ready() || !bundle || !iso(now)) return { ok: false, error: 'invalid' };
    const used = S.useEmergency(bundle.sessions, id, { delayConfirmed: true, reason: text(reason, 200) }, now, emergencyRule);
    if (!used.ok) return used;
    return closeSession({ ...bundle, sessions: used.state }, id, 'unknown', now, 'manual');
  }

  function boundaryViewModel(bundle, id, now) {
    if (!ready() || !bundle) return null;
    const current = S.byId(bundle.sessions, id) || S.active(bundle.sessions);
    if (!current) return null;
    const policy = P.policyById(bundle.policies, current.policyId);
    const options = S.boundaryOptions(current, now);
    if (!policy || !options) return null;
    const rule = P.ruleFor(bundle.policies, current.policyId, current.purpose);
    const emergency = policy.emergency;
    let emergencyAvailable = !!(emergency && emergency.passes > 0 && !current.emergency);
    if (emergencyAvailable) {
      const since = new Date(Date.parse(now) - emergency.perDays * 86400000).toISOString();
      emergencyAvailable = S.emergencyUsedSince(bundle.sessions, current.policyId, since) < emergency.passes;
    }
    return {
      sessionId: current.id,
      targetLabel: policy.name,
      expectedOutcome: current.expectedOutcome || '',
      mode: current.mode,
      canExtend: options.canExtend,
      extensionMinutes: current.extensionMinutes,
      extensionSeq: options.seq,
      emergencyAvailable,
      emergencyDelaySeconds: emergency ? emergency.delaySeconds : 0,
      policyEmergency: emergency,
      over: options.over,
      remainingMs: options.remainingMs,
      purpose: rule ? rule.purpose : current.purpose,
    };
  }

  return Object.freeze({
    VERSION, DATASETS, ready,
    validatePolicies, validateSessions, validateEpisodes, emptyBundle,
    policyDraftFromSetup, upsertPolicy, calibrationFor,
    startSession, extendSession, closeSession, emergencyClose, boundaryViewModel,
  });
});
