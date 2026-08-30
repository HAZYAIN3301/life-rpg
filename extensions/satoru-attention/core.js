/* Satoru Attention Browser Companion v2 — pure policy/session engine.
 *
 * This module deliberately has no DOM, chrome.*, network, account, reward or remote
 * storage access. The service worker owns browser enforcement; this file owns only
 * deterministic validation and transitions. Detailed state stays on this device.
 */
(function exposeSatoruAttentionCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SatoruAttentionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCore() {
  'use strict';

  const VERSION = '0.4.0';
  const STATE_VERSION = 2;
  const MINUTE = 60_000;
  const DAY = 86_400_000;
  const MAX_POLICIES = 30;
  const MAX_EPISODES = 100;
  const MAX_MINUTES = 240;
  const MAX_DAILY_BUDGET_MINUTES = 1440;
  const MAX_SESSIONS_PER_DAY = 20;
  const MAX_COOLDOWN_MINUTES = 240;
  const MAX_EXTENSIONS = 1;
  const EMERGENCY_DELAY_SECONDS = 90;
  const EMERGENCY_MINUTES = 5;
  const EMERGENCY_WINDOW_DAYS = 7;
  const EMERGENCY_PASSES = 1;
  const CLOCK_ROLLBACK_TOLERANCE_MS = 120_000;
  const SATORU_ORIGIN = 'https://life-rpg-production-416a.up.railway.app';

  const MODES = Object.freeze({ trust: 'trust', adaptive: 'adaptive', control: 'control' });
  const PURPOSES = Object.freeze({
    publish: 'publish',
    create: 'create',
    reply: 'reply',
    research: 'research',
    watch: 'watch',
    rest: 'rest',
    unsure: 'unsure',
  });
  const WORK_PURPOSES = Object.freeze(['publish', 'create', 'reply', 'research', 'watch']);
  const OUTCOMES = Object.freeze(['done', 'unfinished', 'rested', 'escaped', 'unknown']);
  const APP_KEYS = Object.freeze(['tiktok', 'youtube', 'instagram', 'x', 'reddit', 'web']);
  const RESERVED_HOSTS = Object.freeze(['life-rpg-production-416a.up.railway.app']);

  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
  const isIso = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
  const atMs = (value) => (isIso(value) ? Date.parse(value) : NaN);
  const nowIso = (value) => new Date(value).toISOString();
  const trim = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const clampInt = (value, lo, hi, fallback = null) => {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) ? Math.min(hi, Math.max(lo, number)) : fallback;
  };
  const strictInt = (value, lo, hi) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= lo && number <= hi ? number : null;
  };
  const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function dayKey(value) {
    return isIso(value) ? String(value).slice(0, 10) : null;
  }

  function safeId(value, max = 48) {
    const id = trim(value, max);
    return /^[a-z0-9][a-z0-9_-]*$/i.test(id) ? id : null;
  }

  function normalizeHostname(value) {
    const raw = trim(value, 253).toLowerCase();
    if (!raw || /[\s@]/.test(raw)) return null;
    let parsed;
    try { parsed = new URL(raw.includes('://') ? raw : `https://${raw}`); }
    catch { return null; }
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.replace(/\.$/, '');
    if (!host || host === 'localhost' || RESERVED_HOSTS.includes(host) || !host.includes('.')) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null;
    const labels = host.split('.');
    if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
    return host;
  }

  function hostPatterns(hostname) {
    const host = normalizeHostname(hostname);
    return host ? [`*://${host}/*`] : [];
  }

  function cleanEmergency(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      passes: clampInt(source.passes, 0, 3, EMERGENCY_PASSES),
      perDays: clampInt(source.perDays, 1, 30, EMERGENCY_WINDOW_DAYS),
      delaySeconds: clampInt(source.delaySeconds, 30, 600, EMERGENCY_DELAY_SECONDS),
      accessMinutes: clampInt(source.accessMinutes, 1, 15, EMERGENCY_MINUTES),
    };
  }

  function cleanPurpose(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !own(PURPOSES, raw.purpose)) return null;
    const defaultMinutes = strictInt(raw.defaultMinutes, 1, MAX_MINUTES);
    if (defaultMinutes === null) return null;
    const mode = own(MODES, raw.mode) ? raw.mode : MODES.adaptive;
    const rawMax = strictInt(raw.maxMinutes, defaultMinutes, MAX_MINUTES);
    const extensionsAllowed = mode === MODES.control
      ? 0
      : clampInt(raw.extensionsAllowed, 0, MAX_EXTENSIONS, mode === MODES.adaptive ? 1 : 1);
    const extensionMinutes = clampInt(raw.extensionMinutes, 1, 60, Math.min(5, defaultMinutes));
    const minimumMax = defaultMinutes + extensionsAllowed * extensionMinutes;
    const maxMinutes = Math.max(minimumMax, rawMax === null ? minimumMax : rawMax);
    const purpose = {
      purpose: raw.purpose,
      mode,
      defaultMinutes,
      maxMinutes: Math.min(MAX_MINUTES, maxMinutes),
      extensionsAllowed,
      extensionMinutes,
      requiresTopic: raw.purpose === PURPOSES.research || raw.requiresTopic === true,
      requiresDetail: raw.requiresDetail === true,
    };
    const expectedOutcome = trim(raw.expectedOutcome, 120);
    if (expectedOutcome) purpose.expectedOutcome = expectedOutcome;
    return purpose;
  }

  function cleanPolicy(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const hostname = normalizeHostname(raw.hostname);
    const id = safeId(raw.id);
    const label = trim(raw.label, 60);
    if (!id || !hostname || !label) return null;
    const seen = new Set();
    const purposes = [];
    for (const item of Array.isArray(raw.purposes) ? raw.purposes : []) {
      const purpose = cleanPurpose(item);
      if (!purpose || seen.has(purpose.purpose)) continue;
      seen.add(purpose.purpose);
      purposes.push(purpose);
    }
    if (!purposes.length) return null;
    const appKey = APP_KEYS.includes(raw.appKey) ? raw.appKey : 'web';
    return {
      id,
      label,
      hostname,
      homeUrl: `https://${hostname}/`,
      appKey,
      enabled: raw.enabled !== false,
      dailyBudgetMinutes: clampInt(raw.dailyBudgetMinutes, 1, MAX_DAILY_BUDGET_MINUTES, MAX_MINUTES),
      maxSessionsPerDay: clampInt(raw.maxSessionsPerDay, 1, MAX_SESSIONS_PER_DAY, 10),
      cooldownMinutes: clampInt(raw.cooldownMinutes, 0, MAX_COOLDOWN_MINUTES, 0),
      purposes,
      emergency: cleanEmergency(raw.emergency),
    };
  }

  function cleanSession(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = safeId(raw.id, 64);
    const policyId = safeId(raw.policyId);
    const hostname = normalizeHostname(raw.hostname);
    const purpose = own(PURPOSES, raw.purpose) ? raw.purpose : null;
    const mode = own(MODES, raw.mode) ? raw.mode : null;
    if (!id || !policyId || !hostname || !purpose || !mode || !isIso(raw.startedAt) || !isIso(raw.deadlineAt)) return null;
    const plannedMinutes = strictInt(raw.plannedMinutes, 1, MAX_MINUTES);
    const maxMinutes = strictInt(raw.maxMinutes, plannedMinutes || 1, MAX_MINUTES);
    if (plannedMinutes === null || maxMinutes === null || atMs(raw.deadlineAt) < atMs(raw.startedAt)) return null;
    const session = {
      id,
      policyId,
      hostname,
      appKey: APP_KEYS.includes(raw.appKey) ? raw.appKey : 'web',
      purpose,
      mode,
      startedAt: raw.startedAt,
      deadlineAt: raw.deadlineAt,
      plannedMinutes,
      maxMinutes,
      expectedOutcome: trim(raw.expectedOutcome, 120),
      extensionsAllowed: mode === MODES.control ? 0 : clampInt(raw.extensionsAllowed, 0, MAX_EXTENSIONS, 0),
      extensionMinutes: clampInt(raw.extensionMinutes, 1, 60, 5),
      extensionCount: clampInt(raw.extensionCount, 0, MAX_EXTENSIONS, 0),
      emergencyUsed: raw.emergencyUsed === true,
      emergencyAccess: raw.emergencyAccess === true,
      dayKey: DAY_KEY_RE.test(raw.dayKey) ? raw.dayKey : dayKey(raw.startedAt),
    };
    const topic = trim(raw.topic, 80);
    if (topic) session.topic = topic;
    const detail = trim(raw.detail, 120);
    if (detail) session.detail = detail;
    if (isIso(raw.emergencyRequestedAt)) session.emergencyRequestedAt = raw.emergencyRequestedAt;
    if (isIso(raw.emergencyUntil)) session.emergencyUntil = raw.emergencyUntil;
    return session;
  }

  function cleanEmergencyEvent(raw) {
    if (!raw || typeof raw !== 'object' || !safeId(raw.policyId) || !isIso(raw.at)) return null;
    return { policyId: safeId(raw.policyId), at: raw.at };
  }

  function cleanEpisode(raw) {
    if (!raw || typeof raw !== 'object' || !safeId(raw.id, 64) || !safeId(raw.policyId) || !isIso(raw.startedAt) || !isIso(raw.endedAt)) return null;
    const purpose = own(PURPOSES, raw.purpose) ? raw.purpose : null;
    if (!purpose) return null;
    return {
      id: safeId(raw.id, 64),
      policyId: safeId(raw.policyId),
      appKey: APP_KEYS.includes(raw.appKey) ? raw.appKey : 'web',
      purpose,
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      plannedMinutes: clampInt(raw.plannedMinutes, 1, MAX_MINUTES, 1),
      actualMinutes: clampInt(raw.actualMinutes, 0, 1440, 0),
      outcome: OUTCOMES.includes(raw.outcome) ? raw.outcome : 'unknown',
      extensionCount: clampInt(raw.extensionCount, 0, MAX_EXTENSIONS, 0),
      emergencyUsed: raw.emergencyUsed === true,
      dayKey: DAY_KEY_RE.test(raw.dayKey) ? raw.dayKey : dayKey(raw.startedAt),
    };
  }

  function cleanPendingPolicy(raw) {
    if (!raw || typeof raw !== 'object' || !isIso(raw.activatesAt)) return null;
    const policy = cleanPolicy(raw.policy);
    return policy ? { policyId: policy.id, activatesAt: raw.activatesAt, policy } : null;
  }

  function emptyState() {
    return {
      version: STATE_VERSION,
      locale: 'auto',
      policies: [],
      pendingPolicies: [],
      activeSession: null,
      emergencyEvents: [],
      episodes: [],
      lastSeenAt: null,
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
    const policies = [];
    const ids = new Set();
    const hosts = new Set();
    for (const item of Array.isArray(raw.policies) ? raw.policies : []) {
      const policy = cleanPolicy(item);
      if (!policy || ids.has(policy.id) || hosts.has(policy.hostname)) continue;
      ids.add(policy.id);
      hosts.add(policy.hostname);
      policies.push(policy);
      if (policies.length >= MAX_POLICIES) break;
    }
    const candidateSession = cleanSession(raw.activeSession);
    const sessionPolicy = candidateSession
      ? policies.find((policy) => policy.id === candidateSession.policyId
        && policy.hostname === candidateSession.hostname)
      : null;
    // A corrupt/orphan session must not become an uncloseable global lock. It is
    // quarantined by dropping it; no episode or outcome is inferred from corruption.
    const activeSession = sessionPolicy ? candidateSession : null;
    const emergencyEvents = (Array.isArray(raw.emergencyEvents) ? raw.emergencyEvents : [])
      .map(cleanEmergencyEvent).filter(Boolean).slice(-100);
    const episodes = (Array.isArray(raw.episodes) ? raw.episodes : [])
      .map(cleanEpisode).filter(Boolean).slice(-MAX_EPISODES);
    const pendingIds = new Set();
    const pendingPolicies = [];
    for (const item of Array.isArray(raw.pendingPolicies) ? raw.pendingPolicies : []) {
      const pending = cleanPendingPolicy(item);
      if (!pending || pendingIds.has(pending.policyId)) continue;
      const currentPolicy = policies.find((policy) => policy.id === pending.policyId);
      if (!currentPolicy || currentPolicy.hostname !== pending.policy.hostname) continue;
      pendingIds.add(pending.policyId);
      pendingPolicies.push(pending);
    }
    return {
      version: STATE_VERSION,
      locale: ['auto', 'ru', 'en', 'de', 'uk', 'es'].includes(raw.locale) ? raw.locale : 'auto',
      policies,
      pendingPolicies,
      activeSession,
      emergencyEvents,
      episodes,
      lastSeenAt: isIso(raw.lastSeenAt) ? raw.lastSeenAt : null,
    };
  }

  function clockRolledBack(state, at) {
    const current = normalizeState(state);
    return !!(current.lastSeenAt && isIso(at)
      && atMs(at) + CLOCK_ROLLBACK_TOLERANCE_MS < atMs(current.lastSeenAt));
  }

  function touchClock(state, at) {
    const current = normalizeState(state);
    if (!isIso(at)) return current;
    if (!current.lastSeenAt || atMs(at) > atMs(current.lastSeenAt)) return { ...current, lastSeenAt: at };
    return current;
  }

  function policyById(state, id) {
    return normalizeState(state).policies.find((policy) => policy.id === String(id)) || null;
  }

  function policyForUrl(state, value) {
    let host;
    try { host = new URL(value).hostname.toLowerCase(); }
    catch { return null; }
    return normalizeState(state).policies.find((policy) => policy.enabled
      && host === policy.hostname) || null;
  }

  function isWorkPurpose(purpose) { return WORK_PURPOSES.includes(purpose); }

  function dailyUsage(state, policyId, at, explicitDayKey) {
    const current = normalizeState(state);
    const key = DAY_KEY_RE.test(explicitDayKey) ? explicitDayKey : dayKey(at);
    const episodes = current.episodes.filter((episode) => episode.policyId === String(policyId)
      && episode.dayKey === key);
    return {
      dayKey: key,
      sessions: episodes.length,
      plannedMinutes: episodes.reduce((sum, episode) => sum + episode.plannedMinutes, 0),
      lastEndedAt: episodes.reduce((latest, episode) => (!latest || atMs(episode.endedAt) > atMs(latest) ? episode.endedAt : latest), null),
    };
  }

  function quotaStatus(state, policyId, at, explicitDayKey) {
    const current = normalizeState(state);
    const policy = current.policies.find((item) => item.id === String(policyId) && item.enabled);
    if (!policy || !isIso(at)) return null;
    const usage = dailyUsage(current, policy.id, at, explicitDayKey);
    const cooldownUntil = usage.lastEndedAt
      ? nowIso(atMs(usage.lastEndedAt) + policy.cooldownMinutes * MINUTE)
      : null;
    const cooldownRemainingMs = cooldownUntil ? Math.max(0, atMs(cooldownUntil) - atMs(at)) : 0;
    return {
      dayKey: usage.dayKey,
      usedMinutes: usage.plannedMinutes,
      remainingMinutes: Math.max(0, policy.dailyBudgetMinutes - usage.plannedMinutes),
      sessionsUsed: usage.sessions,
      sessionsRemaining: Math.max(0, policy.maxSessionsPerDay - usage.sessions),
      dailyBudgetMinutes: policy.dailyBudgetMinutes,
      maxSessionsPerDay: policy.maxSessionsPerDay,
      cooldownMinutes: policy.cooldownMinutes,
      cooldownUntil,
      cooldownRemainingMs,
      canStart: usage.sessions < policy.maxSessionsPerDay
        && usage.plannedMinutes < policy.dailyBudgetMinutes
        && cooldownRemainingMs <= 0,
    };
  }

  function canStart(state, input, at) {
    const current = normalizeState(state);
    if (current.activeSession) return { ok: false, error: 'session_open' };
    const policy = current.policies.find((item) => item.id === String(input && input.policyId) && item.enabled);
    if (!policy) return { ok: false, error: 'policy_unavailable' };
    const rule = policy.purposes.find((item) => item.purpose === (input && input.purpose));
    if (!rule) return { ok: false, error: 'purpose_unavailable' };
    if (rule.mode === MODES.control && rule.purpose === PURPOSES.unsure) return { ok: false, error: 'unsure_in_control' };
    const minutes = strictInt(input && input.minutes, 1, rule.maxMinutes);
    if (minutes === null) return { ok: false, error: 'duration_invalid' };
    const expectedOutcome = trim((input && input.expectedOutcome) || rule.expectedOutcome, 120);
    if (isWorkPurpose(rule.purpose) && !expectedOutcome) return { ok: false, error: 'outcome_required' };
    const topic = trim(input && input.topic, 80);
    if (rule.requiresTopic && !topic) return { ok: false, error: 'topic_required' };
    const detail = trim(input && input.detail, 120);
    if (rule.requiresDetail && !detail) return { ok: false, error: 'detail_required' };
    const quota = isIso(at) ? quotaStatus(current, policy.id, at, input && input.dayKey) : null;
    if (quota) {
      if (quota.sessionsRemaining <= 0) return { ok: false, error: 'daily_sessions_spent', quota };
      if (minutes > quota.remainingMinutes) return { ok: false, error: 'daily_budget_spent', quota };
      if (quota.cooldownRemainingMs > 0) return { ok: false, error: 'cooldown_active', quota };
    }
    return { ok: true, policy, rule, minutes, expectedOutcome, topic, detail, quota };
  }

  function startSession(state, input, at) {
    const current = normalizeState(state);
    if (!isIso(at)) return { ok: false, error: 'time_invalid' };
    if (clockRolledBack(current, at)) return { ok: false, error: 'clock_rollback' };
    const allowed = canStart(current, input, at);
    if (!allowed.ok) return allowed;
    const id = safeId(input && input.id, 64);
    if (!id) return { ok: false, error: 'id_invalid' };
    const session = {
      id,
      policyId: allowed.policy.id,
      hostname: allowed.policy.hostname,
      appKey: allowed.policy.appKey,
      purpose: allowed.rule.purpose,
      mode: allowed.rule.mode,
      startedAt: at,
      deadlineAt: nowIso(atMs(at) + allowed.minutes * MINUTE),
      plannedMinutes: allowed.minutes,
      maxMinutes: allowed.rule.maxMinutes,
      expectedOutcome: allowed.expectedOutcome,
      extensionsAllowed: allowed.rule.extensionsAllowed,
      extensionMinutes: allowed.rule.extensionMinutes,
      extensionCount: 0,
      emergencyUsed: false,
      dayKey: allowed.quota ? allowed.quota.dayKey : (DAY_KEY_RE.test(input && input.dayKey) ? input.dayKey : dayKey(at)),
    };
    if (allowed.topic) session.topic = allowed.topic;
    if (allowed.detail) session.detail = allowed.detail;
    return { ok: true, state: touchClock({ ...current, activeSession: session }, at), session };
  }

  function accessDecision(state, url, at) {
    const current = normalizeState(state);
    const policy = policyForUrl(current, url);
    if (!policy) return { allowed: true, reason: 'unmanaged', policy: null, remainingMs: null };
    if (clockRolledBack(current, at)) return { allowed: false, reason: 'clock_rollback', policy, session: current.activeSession, remainingMs: 0 };
    const session = current.activeSession;
    const time = isIso(at) ? atMs(at) : NaN;
    if (session && session.policyId === policy.id && !Number.isNaN(time) && time < atMs(session.deadlineAt)) {
      return { allowed: true, reason: 'active', policy, session, remainingMs: atMs(session.deadlineAt) - time };
    }
    return {
      allowed: false,
      reason: session && session.policyId === policy.id ? 'boundary' : 'no_session',
      policy,
      session: session && session.policyId === policy.id ? session : null,
      remainingMs: 0,
    };
  }

  function boundaryOptions(state, at) {
    const current = normalizeState(state);
    const session = current.activeSession;
    if (!session || !isIso(at)) return null;
    const remainingMs = atMs(session.deadlineAt) - atMs(at);
    const absoluteMax = atMs(session.startedAt) + session.maxMinutes * MINUTE;
    const policy = policyById(current, session.policyId);
    const usage = policy ? dailyUsage(current, policy.id, at, session.dayKey) : null;
    const reservedMinutes = usage ? usage.plannedMinutes + session.plannedMinutes : session.plannedMinutes;
    const budgetLeft = policy ? Math.max(0, policy.dailyBudgetMinutes - reservedMinutes) : 0;
    const requestedExtension = Math.min(session.extensionMinutes, budgetLeft);
    return {
      over: remainingMs <= 0,
      remainingMs: Math.max(0, remainingMs),
      mode: session.mode,
      canExtend: remainingMs <= 0 && session.mode !== MODES.control
        && session.extensionCount < session.extensionsAllowed
        && atMs(at) < absoluteMax
        && requestedExtension > 0,
      extensionsLeft: Math.max(0, session.extensionsAllowed - session.extensionCount),
      extensionMinutesAvailable: requestedExtension,
      dailyBudgetRemainingMinutes: budgetLeft,
      emergencyAvailable: session.mode === MODES.control && !session.emergencyUsed,
    };
  }

  function extendSession(state, at) {
    const current = normalizeState(state);
    if (clockRolledBack(current, at)) return { ok: false, error: 'clock_rollback' };
    const session = current.activeSession;
    const options = boundaryOptions(current, at);
    if (!session || !options) return { ok: false, error: 'session_missing' };
    if (!options.over) return { ok: false, error: 'boundary_not_reached' };
    if (!options.canExtend) return { ok: false, error: 'extension_unavailable' };
    const absoluteMax = atMs(session.startedAt) + session.maxMinutes * MINUTE;
    const extensionMinutes = Math.min(session.extensionMinutes, options.extensionMinutesAvailable);
    const proposed = atMs(at) + extensionMinutes * MINUTE;
    const deadline = Math.min(absoluteMax, proposed);
    if (deadline <= atMs(at)) return { ok: false, error: 'maximum_reached' };
    const grantedMinutes = Math.max(1, Math.ceil((deadline - atMs(at)) / MINUTE));
    const next = {
      ...session,
      deadlineAt: nowIso(deadline),
      plannedMinutes: Math.min(MAX_MINUTES, session.plannedMinutes + grantedMinutes),
      extensionCount: session.extensionCount + 1,
    };
    return { ok: true, state: touchClock({ ...current, activeSession: next }, at), session: next };
  }

  function emergencyCount(state, policyId, at, rule) {
    const current = normalizeState(state);
    const source = rule || cleanEmergency();
    const since = atMs(at) - source.perDays * DAY;
    return current.emergencyEvents.filter((event) => event.policyId === policyId && atMs(event.at) >= since && atMs(event.at) <= atMs(at)).length;
  }

  function requestEmergency(state, at) {
    const current = normalizeState(state);
    if (clockRolledBack(current, at)) return { ok: false, error: 'clock_rollback' };
    const session = current.activeSession;
    const options = boundaryOptions(current, at);
    if (!session || !options) return { ok: false, error: 'session_missing' };
    if (session.mode !== MODES.control) return { ok: false, error: 'emergency_unavailable' };
    if (session.emergencyUsed) return { ok: false, error: 'emergency_used' };
    const policy = policyById(current, session.policyId);
    if (!policy || policy.emergency.passes <= 0) return { ok: false, error: 'emergency_disabled' };
    if (emergencyCount(current, session.policyId, at, policy.emergency) >= policy.emergency.passes) {
      return { ok: false, error: 'emergency_budget_spent' };
    }
    if (session.emergencyRequestedAt) return { ok: true, state: current, session, alreadyRequested: true };
    const next = { ...session, emergencyRequestedAt: at };
    return { ok: true, state: touchClock({ ...current, activeSession: next }, at), session: next, alreadyRequested: false };
  }

  function emergencyStatus(state, at) {
    const current = normalizeState(state);
    const session = current.activeSession;
    if (!session || session.mode !== MODES.control || !session.emergencyRequestedAt || !isIso(at)) return null;
    const policy = policyById(current, session.policyId);
    if (!policy) return null;
    const unlockAt = atMs(session.emergencyRequestedAt) + policy.emergency.delaySeconds * 1000;
    return { ready: atMs(at) >= unlockAt, remainingMs: Math.max(0, unlockAt - atMs(at)), unlockAt: nowIso(unlockAt) };
  }

  function grantEmergency(state, reason, at) {
    const current = normalizeState(state);
    if (clockRolledBack(current, at)) return { ok: false, error: 'clock_rollback' };
    const session = current.activeSession;
    const status = emergencyStatus(current, at);
    const explanation = trim(reason, 200);
    if (!session || !status) return { ok: false, error: 'emergency_not_requested' };
    if (!status.ready) return { ok: false, error: 'emergency_delay' };
    if (explanation.length < 2) return { ok: false, error: 'reason_required' };
    const policy = policyById(current, session.policyId);
    if (!policy || emergencyCount(current, session.policyId, at, policy.emergency) >= policy.emergency.passes) {
      return { ok: false, error: 'emergency_budget_spent' };
    }
    const until = nowIso(atMs(at) + policy.emergency.accessMinutes * MINUTE);
    const closedEpisode = {
      id: session.id,
      policyId: session.policyId,
      appKey: session.appKey,
      purpose: session.purpose,
      startedAt: session.startedAt,
      endedAt: at,
      plannedMinutes: session.plannedMinutes,
      actualMinutes: Math.max(0, Math.min(1440, Math.round((atMs(at) - atMs(session.startedAt)) / MINUTE))),
      outcome: 'unknown',
      extensionCount: session.extensionCount,
      emergencyUsed: true,
      dayKey: session.dayKey,
    };
    const next = {
      id: `${session.id.slice(0, 44)}_emergency_${Math.max(0, atMs(at)).toString(36)}`.slice(0, 64),
      policyId: session.policyId,
      hostname: session.hostname,
      appKey: session.appKey,
      purpose: session.purpose,
      mode: MODES.control,
      startedAt: at,
      deadlineAt: until,
      plannedMinutes: policy.emergency.accessMinutes,
      maxMinutes: policy.emergency.accessMinutes,
      expectedOutcome: '',
      extensionsAllowed: 0,
      extensionMinutes: 1,
      extensionCount: 0,
      emergencyUsed: true,
      emergencyAccess: true,
      emergencyUntil: until,
      dayKey: session.dayKey,
    };
    const event = { policyId: session.policyId, at };
    return {
      ok: true,
      state: touchClock({
        ...current,
        activeSession: next,
        emergencyEvents: current.emergencyEvents.concat([event]).slice(-100),
        episodes: current.episodes.concat([closedEpisode]).slice(-MAX_EPISODES),
      }, at),
      session: next,
      closedEpisode,
    };
  }

  function closeSession(state, outcome, at) {
    const current = normalizeState(state);
    const session = current.activeSession;
    if (!session) return { ok: false, error: 'session_missing' };
    if (!isIso(at)) return { ok: false, error: 'time_invalid' };
    if (clockRolledBack(current, at)) return { ok: false, error: 'clock_rollback' };
    const result = OUTCOMES.includes(outcome) ? outcome : 'unknown';
    const episode = {
      id: session.id,
      policyId: session.policyId,
      appKey: session.appKey,
      purpose: session.purpose,
      startedAt: session.startedAt,
      endedAt: at,
      plannedMinutes: session.plannedMinutes,
      actualMinutes: Math.max(0, Math.min(1440, Math.round((atMs(at) - atMs(session.startedAt)) / MINUTE))),
      outcome: result,
      extensionCount: session.extensionCount,
      emergencyUsed: session.emergencyUsed,
      dayKey: session.dayKey,
    };
    return {
      ok: true,
      state: touchClock({ ...current, activeSession: null, episodes: current.episodes.concat([episode]).slice(-MAX_EPISODES) }, at),
      episode,
    };
  }

  function canEditPolicy(state, policyId) {
    const session = normalizeState(state).activeSession;
    return !(session && session.policyId === String(policyId) && session.mode === MODES.control);
  }

  function policyLoosens(previous, next) {
    if (!previous || !next) return false;
    if (previous.enabled && !next.enabled) return true;
    if (next.dailyBudgetMinutes > previous.dailyBudgetMinutes
      || next.maxSessionsPerDay > previous.maxSessionsPerDay
      || next.cooldownMinutes < previous.cooldownMinutes
      || next.emergency.passes > previous.emergency.passes
      || next.emergency.accessMinutes > previous.emergency.accessMinutes
      || next.emergency.delaySeconds < previous.emergency.delaySeconds) return true;
    const strength = { trust: 0, adaptive: 1, control: 2 };
    const nextRules = new Map(next.purposes.map((rule) => [rule.purpose, rule]));
    for (const rule of previous.purposes) {
      const candidate = nextRules.get(rule.purpose);
      if (!candidate) continue;
      if (strength[candidate.mode] < strength[rule.mode]
        || candidate.maxMinutes > rule.maxMinutes
        || candidate.defaultMinutes > rule.defaultMinutes
        || candidate.extensionsAllowed > rule.extensionsAllowed
        || candidate.extensionMinutes > rule.extensionMinutes) return true;
    }
    return next.purposes.some((rule) => !previous.purposes.some((item) => item.purpose === rule.purpose));
  }

  function queuePolicy(current, policy, activatesAt) {
    if (!isIso(activatesAt)) return { ok: false, error: 'activation_time_invalid' };
    const pending = { policyId: policy.id, activatesAt, policy };
    const pendingPolicies = current.pendingPolicies.filter((item) => item.policyId !== policy.id).concat([pending]);
    return { ok: true, pending: true, activatesAt, state: { ...current, pendingPolicies }, policy };
  }

  function activatePendingPolicies(state, at) {
    const current = normalizeState(state);
    if (!isIso(at)) return { changed: false, state: current, activated: [] };
    const active = current.activeSession;
    const activated = [];
    let policies = current.policies;
    const pendingPolicies = [];
    for (const pending of current.pendingPolicies) {
      if (atMs(pending.activatesAt) > atMs(at)
        || (active && active.policyId === pending.policyId && active.mode === MODES.control)) {
        pendingPolicies.push(pending);
        continue;
      }
      const index = policies.findIndex((policy) => policy.id === pending.policyId);
      if (index < 0) continue;
      policies = policies.map((policy, offset) => (offset === index ? pending.policy : policy));
      activated.push(pending.policyId);
    }
    return {
      changed: activated.length > 0 || pendingPolicies.length !== current.pendingPolicies.length,
      state: { ...current, policies, pendingPolicies },
      activated,
    };
  }

  function cancelPendingPolicy(state, policyId) {
    const current = normalizeState(state);
    const pendingPolicies = current.pendingPolicies.filter((item) => item.policyId !== String(policyId));
    if (pendingPolicies.length === current.pendingPolicies.length) return { ok: false, error: 'pending_policy_missing' };
    return { ok: true, state: { ...current, pendingPolicies } };
  }

  function upsertPolicy(state, draft, options = {}) {
    const current = normalizeState(state);
    let policy = cleanPolicy(draft);
    if (!policy) return { ok: false, error: 'policy_invalid' };
    if (!canEditPolicy(current, policy.id)) return { ok: false, error: 'control_locked' };
    const hostOwner = current.policies.find((item) => item.hostname === policy.hostname && item.id !== policy.id);
    if (hostOwner) return { ok: false, error: 'host_already_configured' };
    const index = current.policies.findIndex((item) => item.id === policy.id);
    if (index < 0 && current.policies.length >= MAX_POLICIES) return { ok: false, error: 'policy_limit' };
    if (index >= 0 && options.replacePurposes !== true) {
      const incoming = new Set(policy.purposes.map((item) => item.purpose));
      policy = cleanPolicy({
        ...current.policies[index],
        ...policy,
        purposes: current.policies[index].purposes.filter((item) => !incoming.has(item.purpose)).concat(policy.purposes),
      });
    }
    if (index >= 0 && options.deferLoosening === true && policyLoosens(current.policies[index], policy)) {
      return queuePolicy(current, policy, options.activatesAt);
    }
    const policies = index < 0
      ? current.policies.concat([policy])
      : current.policies.map((item, at) => (at === index ? policy : item));
    const pendingPolicies = current.pendingPolicies.filter((item) => item.policyId !== policy.id);
    return { ok: true, state: { ...current, policies, pendingPolicies }, policy, pending: false };
  }

  function setPolicyEnabled(state, policyId, enabled, options = {}) {
    const current = normalizeState(state);
    if (!canEditPolicy(current, policyId)) return { ok: false, error: 'control_locked' };
    const index = current.policies.findIndex((item) => item.id === String(policyId));
    if (index < 0) return { ok: false, error: 'policy_unavailable' };
    const policy = cleanPolicy({ ...current.policies[index], enabled: enabled === true });
    if (options.deferLoosening === true && policyLoosens(current.policies[index], policy)) {
      return queuePolicy(current, policy, options.activatesAt);
    }
    const policies = current.policies.map((item, at) => (at === index ? policy : item));
    const pendingPolicies = current.pendingPolicies.filter((item) => item.policyId !== policy.id);
    return { ok: true, state: { ...current, policies, pendingPolicies }, policy, pending: false };
  }

  function publicStatus(state, at) {
    const current = normalizeState(state);
    const session = current.activeSession;
    let active = null;
    if (session && isIso(at)) {
      const remaining = Math.max(0, atMs(session.deadlineAt) - atMs(at));
      active = {
        app: APP_KEYS.includes(session.appKey) ? session.appKey : 'web',
        phase: remaining > 0 ? 'active' : 'boundary',
        remainingSeconds: Math.ceil(remaining / 1000),
        mode: session.mode,
      };
    }
    return {
      installed: true,
      version: VERSION,
      configuredSites: current.policies.filter((policy) => policy.enabled).length,
      active,
    };
  }

  function satoruDeepLink(action, appKey) {
    if (!['gate', 'return'].includes(action) || !APP_KEYS.includes(appKey)) return null;
    const url = new URL('/', SATORU_ORIGIN);
    url.searchParams.set('do', action);
    url.searchParams.set('app', appKey);
    url.searchParams.set('source', 'extension');
    return url.toString();
  }

  function policyIdForHost(hostname) {
    const host = normalizeHostname(hostname);
    if (!host) return null;
    let hash = 2166136261;
    for (let index = 0; index < host.length; index += 1) {
      hash ^= host.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `site_${(hash >>> 0).toString(36)}`;
  }

  return Object.freeze({
    VERSION,
    STATE_VERSION,
    MINUTE,
    DAY,
    MAX_POLICIES,
    MAX_EPISODES,
    MAX_MINUTES,
    MAX_DAILY_BUDGET_MINUTES,
    MAX_SESSIONS_PER_DAY,
    MAX_COOLDOWN_MINUTES,
    MAX_EXTENSIONS,
    EMERGENCY_DELAY_SECONDS,
    EMERGENCY_MINUTES,
    EMERGENCY_WINDOW_DAYS,
    EMERGENCY_PASSES,
    CLOCK_ROLLBACK_TOLERANCE_MS,
    SATORU_ORIGIN,
    MODES,
    PURPOSES,
    WORK_PURPOSES,
    OUTCOMES,
    APP_KEYS,
    RESERVED_HOSTS,
    emptyState,
    normalizeState,
    clockRolledBack,
    touchClock,
    normalizeHostname,
    hostPatterns,
    cleanPolicy,
    policyById,
    policyForUrl,
    policyIdForHost,
    isWorkPurpose,
    dailyUsage,
    quotaStatus,
    canStart,
    startSession,
    accessDecision,
    boundaryOptions,
    extendSession,
    emergencyCount,
    requestEmergency,
    emergencyStatus,
    grantEmergency,
    closeSession,
    canEditPolicy,
    policyLoosens,
    activatePendingPolicies,
    cancelPendingPolicy,
    upsertPolicy,
    setPolicyEnabled,
    publicStatus,
    satoruDeepLink,
  });
});
