/* Bounded owner snapshots for return, planned start and the saved evening boundary.
 * No DOM, storage, clocks, inference from text, or user-data mutation.
 * The caller supplies freshly read owner data and an explicit local clock.
 */
(function exposeSecretaryNextMovesProducer(root, factory) {
  const get = (name, file) => root && root[name] || (typeof require === 'function' ? require(file) : null);
  const api = factory(get('AttentionSessionV1', './attention-session-v1.js'), get('RestProfileV1', './rest-profile-v1.js'), get('HabitTwoMinuteV1', './habit-two-minute-v1.js'));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryNextMovesProducerV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildProducer(Session, Rest, HabitMinimum) {
  'use strict';
  const VERSION = '1.0.0';
  const WINDOW_MINUTES = 180;
  const FIRST_VALUE_STATES = ['new', 'intent_known', 'action_ready', 'action_started', 'first_value_reached', 'completed', 'deferred'];
  const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const validOriginalRef = (v) => !!(Session && Session.validOriginalRef(v));
  const opaqueId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
  const minutes = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1440;

  function validDay(v) {
    if (typeof v !== 'string' || !/^(19[7-9]\d|2\d{3})-\d{2}-\d{2}$/.test(v)) return false;
    const stamp = Date.parse(v + 'T00:00:00.000Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === v;
  }
  function parseIso(v) {
    const match = typeof v === 'string' && /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.exec(v);
    if (!match || !validDay(match[1])) return null;
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const localDay = (stamp, offset) => new Date(stamp + offset * 60000).toISOString().slice(0, 10);
  const timeMinutes = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;

  function plannedSchedule(snapshot, nowMs) {
    const localMinute = Math.floor((nowMs + snapshot.utcOffsetMinutes * 60000) / 60000) % 1440;
    const candidates = [];
    let nextDecision = null;
    for (const task of snapshot.tasks) {
      const at = timeMinutes(task.startTime), ref = 'quest:' + task.id;
      if (!validOriginalRef(ref) || !validDay(task.date) || task.date < snapshot.today || at === null
        || task.done !== false || task.completedAt) continue;
      const midnight = Date.parse(task.date + 'T00:00:00.000Z') - snapshot.utcOffsetMinutes * 60000;
      const opens = midnight + Math.max(0, at - 10) * 60000;
      // Policy compares integer local minutes: +45:59 is eligible, +46:00 is not.
      const closes = midnight + Math.min(1440, at + 46) * 60000;
      for (const transition of [opens, closes]) if (transition > nowMs && (nextDecision === null || transition < nextDecision)) nextDecision = transition;
      if (task.date === snapshot.today && localMinute - at >= -10 && localMinute - at <= 45) {
        candidates.push({ task, at, distance: Math.abs(localMinute - at) });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.at - b.at || (a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0));
    const task = candidates[0]?.task;
    return {
      plannedStart: task ? { taskRef: 'quest:' + task.id, plannedAtLocal: task.startTime,
        precision: 'exact_time', doneToday: false, observedAt: snapshot.now } : null,
      nextDecisionAt: nextDecision === null ? null : new Date(nextDecision).toISOString(),
    };
  }

  function eveningSchedule(snapshot, nowMs, contract) {
    const midnight = Date.parse(snapshot.today + 'T00:00:00.000Z') - snapshot.utcOffsetMinutes * 60000;
    const intervals = [];
    for (const task of snapshot.tasks) {
      const at = timeMinutes(task.startTime);
      if (!validOriginalRef('quest:' + task.id) || !validDay(task.date) || at === null
        || task.done !== false || task.completedAt || !Number.isFinite(task.estimateMin) || task.estimateMin <= 0) continue;
      const start = Date.parse(task.date + 'T00:00:00.000Z') - snapshot.utcOffsetMinutes * 60000 + at * 60000;
      const end = start + task.estimateMin * 60000;
      if (Number.isFinite(end) && Math.abs(end) <= 8640000000000000 && end > nowMs) intervals.push({ start, end });
    }
    intervals.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const interval of intervals) {
      const previous = merged[merged.length - 1];
      if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
      else merged.push({ ...interval });
    }
    const current = merged.find(interval => interval.start <= nowMs && interval.end > nowMs);
    const busyUntilAt = current ? new Date(current.end).toISOString() : null;
    // HH:MM alone cannot represent the next calendar day. Keep that limitation
    // explicit and let the delivery owner use the exact absolute boundary.
    const tonightSchedule = current ? { busyUntilAt,
      busyUntilLocal: localDay(current.end, snapshot.utcOffsetMinutes) === snapshot.today
        ? new Date(current.end + snapshot.utcOffsetMinutes * 60000).toISOString().slice(11, 16) : null,
      observedAt: snapshot.now } : null;
    let nextDecision = null;
    if (contract?.dailyReminder) {
      const boundary = timeMinutes(contract.eveningTimeLocal);
      const opens = midnight + boundary * 60000, closes = midnight + Math.min(1440, boundary + 121) * 60000;
      const transitions = [opens, closes, opens + 86400000];
      for (const interval of merged) {
        if (interval.start >= opens && interval.start < closes) transitions.push(interval.start);
        if (interval.end > opens && interval.end < closes) transitions.push(interval.end);
      }
      for (const at of transitions) if (at > nowMs && (nextDecision === null || at < nextDecision)) nextDecision = at;
    }
    return { tonightSchedule, nextDecisionAt: nextDecision === null ? null : new Date(nextDecision).toISOString() };
  }

  function ownerRows(raw) {
    if (!Array.isArray(raw)) return null;
    const ids = new Set();
    for (const row of raw) {
      if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) return null;
      ids.add(row.id);
    }
    return raw;
  }

  /** Resolve against the current owner's authoritative arrays, never client flags. */
  function resolveOriginal(snapshot, ref) {
    if (!validOriginalRef(ref)) return null;
    const colon = ref.indexOf(':'), type = ref.slice(0, colon), id = ref.slice(colon + 1);
    const row = (type === 'quest' ? snapshot.tasks : snapshot.habits)?.find((item) => item.id === id);
    if (!row) return null;
    if (type === 'quest') {
      if (row.done !== false || row.completedAt) return null;
      if (row.date != null && row.date !== '' && (!validDay(row.date) || row.date > snapshot.today)) return null;
      return { type, row };
    }
    // app habitScheduledOn/ habitDone: weekday membership and habitlog[day][id].
    if (row.archived || !Array.isArray(row.days) || !row.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return null;
    if (!row.days.includes(new Date(snapshot.today + 'T00:00:00Z').getUTCDay())) return null;
    if (!object(snapshot.habitlog)) return null; // Missing completion data is unknown.
    const log = snapshot.habitlog[snapshot.today];
    if (log != null && !object(log)) return null;
    if (log && log[id]) return null;
    const twoMin = HabitMinimum && HabitMinimum.textOf(row);
    return twoMin ? { type, row, twoMin } : null;
  }

  function projectEpisode(episode, snapshot, nowMs) {
    if (!object(episode) || !opaqueId(episode.id)) return null;
    const start = parseIso(episode.startedAt), end = parseIso(episode.endedAt);
    if (start === null || end === null || start > end || end > nowMs) return null;
    if (nowMs - end > WINDOW_MINUTES * 60000 || localDay(end, snapshot.utcOffsetMinutes) !== snapshot.today) return null;
    if (episode.returnedAt != null) return null;
    const measured = minutes(episode.actualMinutes) && minutes(episode.plannedMinutes) && episode.actualMinutes > episode.plannedMinutes;
    if (episode.outcome !== 'escaped' && !measured) return null;
    const lapse = {
      confirmed: true, source: episode.outcome === 'escaped' ? 'user_confirmed' : 'boundary_measured',
      eventKey: `attention:${episode.id}`, day: snapshot.today, endedAt: episode.endedAt,
      observedAt: snapshot.now,
    };
    if (lapse.source === 'boundary_measured') {
      lapse.plannedMinutes = episode.plannedMinutes;
      lapse.actualMinutes = episode.actualMinutes;
    }
    if (validOriginalRef(episode.originalRef)) lapse.originalRef = episode.originalRef;
    return lapse;
  }

  /** Strict ingress for the bounded client signal; stale is silence, malformed is error. */
  function validateLapse(raw, snapshot, nowMs) {
    if (raw == null) return { ok: true, lapse: null };
    if (!object(raw) || raw.confirmed !== true || !['user_confirmed', 'boundary_measured'].includes(raw.source)
      || typeof raw.eventKey !== 'string' || !/^attention:[A-Za-z0-9_-]{1,40}$/.test(raw.eventKey)
      || !validDay(raw.day)) return { ok: false, error: 'invalid_lapse' };
    const end = parseIso(raw.endedAt), observed = parseIso(raw.observedAt);
    if (end === null || observed === null || end > nowMs || observed > nowMs || observed < end
      || localDay(end, snapshot.utcOffsetMinutes) !== raw.day) return { ok: false, error: 'invalid_lapse' };
    if (own(raw, 'originalRef') && !validOriginalRef(raw.originalRef)) return { ok: false, error: 'invalid_original_ref' };
    if (own(raw, 'screenEpisode') && typeof raw.screenEpisode !== 'boolean') return { ok: false, error: 'invalid_lapse' };
    if (raw.source === 'boundary_measured' && !(minutes(raw.actualMinutes) && minutes(raw.plannedMinutes) && raw.actualMinutes > raw.plannedMinutes)) return { ok: false, error: 'invalid_lapse' };
    if (raw.day !== snapshot.today || nowMs - end > WINDOW_MINUTES * 60000) return { ok: true, lapse: null };
    const lapse = { confirmed: true, source: raw.source, eventKey: raw.eventKey, day: raw.day, endedAt: raw.endedAt, observedAt: snapshot.now };
    if (raw.originalRef) lapse.originalRef = raw.originalRef;
    if (raw.screenEpisode === true) lapse.screenEpisode = true;
    if (raw.source === 'boundary_measured') { lapse.plannedMinutes = raw.plannedMinutes; lapse.actualMinutes = raw.actualMinutes; }
    return { ok: true, lapse };
  }

  function build(snapshot) {
    if (!object(snapshot)) return { ok: false, error: 'invalid_snapshot' };
    const nowMs = parseIso(snapshot.now);
    if (nowMs === null) return { ok: false, error: 'invalid_time' };
    if (!Number.isInteger(snapshot.utcOffsetMinutes) || Math.abs(snapshot.utcOffsetMinutes) > 840) return { ok: false, error: 'invalid_offset' };
    if (!validDay(snapshot.today) || localDay(nowMs, snapshot.utcOffsetMinutes) !== snapshot.today) return { ok: false, error: 'invalid_day' };
    if (typeof snapshot.guideActive !== 'boolean' || typeof snapshot.activeSession !== 'boolean'
      || (snapshot.firstValueStatus != null && !FIRST_VALUE_STATES.includes(snapshot.firstValueStatus))) return { ok: false, error: 'invalid_flag' };
    if (!ownerRows(snapshot.tasks) || !ownerRows(snapshot.habits) || !object(snapshot.settings)
      || (snapshot.habitlog != null && !object(snapshot.habitlog))) return { ok: false, error: 'invalid_owner_snapshot' };
    let lapse = null;
    if (own(snapshot, 'lapse')) {
      const input = validateLapse(snapshot.lapse, snapshot, nowMs);
      if (!input.ok) return input;
      lapse = input.lapse;
    } else {
      const state = snapshot.episodes;
      const episodes = Array.isArray(state) ? state : object(state) && state.version === 1 ? state.episodes : null;
      if (!Array.isArray(episodes) || episodes.length > 2000) return { ok: false, error: 'invalid_episodes' };
      const ids = new Set();
      for (const episode of episodes) {
        if (!object(episode) || typeof episode.id !== 'string' || ids.has(episode.id)) return { ok: false, error: 'invalid_episodes' };
        ids.add(episode.id);
        const candidate = projectEpisode(episode, snapshot, nowMs);
        if (candidate && (!lapse || parseIso(candidate.endedAt) > parseIso(lapse.endedAt)
          || (parseIso(candidate.endedAt) === parseIso(lapse.endedAt) && candidate.eventKey < lapse.eventKey))) lapse = candidate;
      }
    }
    const original = lapse && resolveOriginal(snapshot, lapse.originalRef);
    if (lapse) lapse.originalStillActionable = !!original;
    const habitMinimum = original && original.type === 'habit'
      ? { habitRef: lapse.originalRef, twoMin: original.twoMin, observedAt: snapshot.now } : null;
    const cfg = snapshot.settings.secretary;
    let eveningContract = null;
    if (cfg != null) {
      if (!object(cfg) || (cfg.configured != null && typeof cfg.configured !== 'boolean')
        || (cfg.dailyReminder != null && typeof cfg.dailyReminder !== 'boolean')
        || (cfg.eveningTime != null && cfg.eveningTime !== '' && (typeof cfg.eveningTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(cfg.eveningTime)))) return { ok: false, error: 'invalid_evening_contract' };
      if (cfg.configured === true && cfg.eveningTime) eveningContract = { configured: true, eveningTimeLocal: cfg.eveningTime,
        dailyReminder: cfg.dailyReminder === true, observedAt: snapshot.now };
    }
    let restMenu = null;
    if (snapshot.restProfile != null) {
      if (!Rest) return { ok: false, error: 'engine_unavailable' };
      if (!object(snapshot.restProfile) || !Array.isArray(snapshot.restProfile.recipes)
        || !snapshot.restProfile.recipes.every((recipe) => object(recipe)
          && ['offline', 'device', 'mixed'].includes(recipe.mode)
          && Number.isInteger(recipe.defaultMinutes) && recipe.defaultMinutes >= 5 && recipe.defaultMinutes <= 240)) return { ok: false, error: 'invalid_rest_profile' };
      const profile = Rest.sanitizeProfile(snapshot.restProfile);
      if (!profile) return { ok: false, error: 'invalid_rest_profile' };
      const chosen = Rest.pickForLowResource(profile, { preferOffline: !!(lapse && lapse.screenEpisode) });
      if (chosen && /^[A-Za-z0-9_-]{1,40}$/.test(chosen.id) && chosen.defaultMinutes <= 180) {
        restMenu = { recipeRef: chosen.id, minutes: chosen.defaultMinutes, screenMode: { offline: 'no_screen', device: 'screen', mixed: 'either' }[chosen.mode], observedAt: snapshot.now };
      }
    }
    const schedule = plannedSchedule(snapshot, nowMs);
    const evening = eveningSchedule(snapshot, nowMs, eveningContract);
    const nextDecisionAt = [schedule.nextDecisionAt, evening.nextDecisionAt].filter(Boolean).sort()[0] || null;
    return { ok: true, nextDecisionAt, context: {
      lapse, habitMinimum, restMenu, eveningContract, tonightSchedule: evening.tonightSchedule, plannedStart: schedule.plannedStart,
      // settings.commitmentsV1 is now CommitmentV2. Raw V1 step ids cannot be
      // executed as tasks; no invented link or lossy V2 -> V1 conversion.
      commitmentItems: [],
      guide: { active: snapshot.guideActive }, activeSession: { active: snapshot.activeSession },
      firstValue: { pending: snapshot.firstValueStatus != null && !['first_value_reached', 'completed', 'deferred'].includes(snapshot.firstValueStatus) },
    } };
  }
  return Object.freeze({ VERSION, WINDOW_MINUTES, validOriginalRef, validDay, parseIso, resolveOriginal, build });
});
