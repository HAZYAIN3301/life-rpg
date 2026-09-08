/* Shared work, not shared surveillance. Pure decisions; no DOM, storage or clocks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PartySessionV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000, READY_MS = 300000, RETENTION_MS = 30 * DAY;
  const fail = (error) => ({ ok: false, error });
  const iso = (now) => new Date(now).toISOString();
  const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  function label(value) {
    return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 160
      && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : null;
  }
  function status(session, now) {
    if (['cancelled', 'declined', 'finished'].includes(session.status)) return session.status;
    if (session.members.every((m) => !!m.outcome)) return 'finished';
    if (now >= Date.parse(session.expiresAt)) return 'expired';
    if (session.startedAt) return now >= Date.parse(session.endsAt) ? 'review' : 'running';
    return session.members.every((m) => !!m.acceptedAt) ? 'ready' : 'invited';
  }
  function active(session, now) {
    return ['invited', 'ready', 'running', 'review'].includes(status(session, now));
  }
  function validStored(s) {
    return !!s && s.version === 1 && validId(s.id) && validId(s.createdBy)
      && Number.isInteger(s.revision) && s.revision > 0 && Number.isInteger(s.minutes) && s.minutes >= 5 && s.minutes <= 120
      && ['invited', 'ready', 'running', 'finished', 'cancelled', 'declined'].includes(s.status)
      && ['createdAt', 'updatedAt', 'expiresAt'].every((key) => Number.isFinite(Date.parse(s[key])))
      && ['startedAt', 'endsAt', 'scheduledAt'].every((key) => s[key] === null || Number.isFinite(Date.parse(s[key])))
      && Array.isArray(s.receipts) && s.receipts.every((r) => r && validId(r.id) && validId(r.actor) && typeof r.fingerprint === 'string')
      && Array.isArray(s.members) && s.members.length === 2 && s.members[0]?.id !== s.members[1]?.id
      && s.members.every((m) => m && validId(m.id) && (m.taskId === null || validId(m.taskId))
        && (m.publicLabel === null || !!label(m.publicLabel)) && [null, 'done', 'partial', 'stopped'].includes(m.outcome));
  }
  function prune(sessions, now, memberIds) {
    return (sessions || []).filter((s) => s && s.version === 1 && Array.isArray(s.members)
      && s.members.length === 2 && now - Date.parse(s.createdAt) < RETENTION_MS
      && s.members.every((m) => memberIds.includes(m.id)));
  }
  function create({ id, actor, to, taskId, publicLabel, minutes, scheduledAt, share, now,
                    memberIds, mutedIds = [], sessions = [], taskAvailable }) {
    if (!Number.isFinite(now) || !validId(id) || !validId(taskId) || !label(publicLabel)) return fail('invalid_session');
    if (!memberIds.includes(actor) || !memberIds.includes(to) || actor === to) return fail('not_member');
    if (share !== true) return fail('sharing_required');
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) return fail('invalid_duration');
    const start = scheduledAt ? Date.parse(scheduledAt) : now;
    if (!Number.isFinite(start)) return fail('invalid_schedule');
    const previous = sessions.find((s) => s.id === id);
    if (previous) {
      if (previous.createdBy !== actor || previous.members[1].id !== to || previous.members[0].taskId !== taskId
        || previous.members[0].publicLabel !== label(publicLabel) || previous.minutes !== minutes
        || previous.scheduledAt !== (scheduledAt ? iso(start) : null)) return fail('id_conflict');
      return { ok: true, session: structuredClone(previous), duplicate: true };
    }
    if (mutedIds.includes(to)) return fail('invites_muted');
    if (!taskAvailable) return fail('task_unavailable');
    if (start < now - 60000 || start > now + 7 * DAY) return fail('invalid_schedule');
    if (sessions.some((s) => active(s, now) && s.members.some((m) => [actor, to].includes(m.id)))) return fail('session_busy');
    if (sessions.filter((s) => s.createdBy === actor && now - Date.parse(s.createdAt) < DAY).length >= 3) return fail('invite_limit');
    return { ok: true, session: {
      version: 1, id, revision: 1, createdBy: actor, createdAt: iso(now), updatedAt: iso(now),
      scheduledAt: scheduledAt ? iso(start) : null, expiresAt: iso(Math.max(start, now) + DAY),
      minutes, status: 'invited', startedAt: null, endsAt: null,
      members: [
        { id: actor, taskId, publicLabel: label(publicLabel), sharedAt: iso(now), acceptedAt: iso(now), readyAt: null, outcome: null },
        { id: to, taskId: null, publicLabel: null, sharedAt: null, acceptedAt: null, readyAt: null, outcome: null },
      ], receipts: [],
    } };
  }
  function transition(source, { actor, eventId, op, now, taskId, publicLabel, share, outcome, taskAvailable, taskDone }) {
    if (!source || !validId(eventId) || !Number.isFinite(now)) return fail('invalid_session');
    const current = source.members.find((m) => m.id === actor);
    if (!current) return fail('not_member');
    const fingerprint = JSON.stringify([actor, op, taskId || null, publicLabel || null, share === true, outcome || null]);
    const receipt = source.receipts.find((r) => r.id === eventId);
    if (receipt) return receipt.fingerprint === fingerprint
      ? { ok: true, session: structuredClone(source), duplicate: true } : fail('id_conflict');
    const phase = status(source, now);
    const session = structuredClone(source), member = session.members.find((m) => m.id === actor);
    if (op === 'withdraw') {
      member.publicLabel = null; member.taskId = null; member.sharedAt = null; member.readyAt = null;
      member.outcome = null; delete member.finishedAt;
      session.receipts = session.receipts.filter((r) => r.actor !== actor);
      if (active(source, now)) session.status = 'cancelled';
    } else if (op === 'decline') {
      if (phase !== 'invited' || member.acceptedAt) return fail('invalid_transition');
      session.status = 'declined';
      session.receipts = [];
      session.members.forEach((m) => { m.publicLabel = null; m.taskId = null; m.sharedAt = null; });
    } else if (op === 'accept') {
      if (phase !== 'invited' || member.acceptedAt) return fail('invalid_transition');
      if (share !== true) return fail('sharing_required');
      if (!validId(taskId) || !label(publicLabel) || !taskAvailable) return fail('task_unavailable');
      Object.assign(member, { taskId, publicLabel: label(publicLabel), sharedAt: iso(now), acceptedAt: iso(now) });
      session.status = 'ready';
    } else if (op === 'ready') {
      if (phase !== 'ready') return fail('invalid_transition');
      if (session.scheduledAt && now < Date.parse(session.scheduledAt)) return fail('too_early');
      member.readyAt = iso(now);
      if (session.members.every((m) => m.readyAt && now - Date.parse(m.readyAt) < READY_MS)) {
        session.startedAt = iso(now); session.endsAt = iso(now + session.minutes * 60000); session.status = 'running';
      }
    } else if (op === 'finish') {
      if (!['running', 'review'].includes(phase) || member.outcome) return fail('invalid_transition');
      if (!['done', 'partial', 'stopped'].includes(outcome)) return fail('invalid_outcome');
      if (outcome === 'done' && !taskDone) return fail('task_not_saved');
      member.outcome = outcome; member.finishedAt = iso(now);
      if (session.members.every((m) => !!m.outcome)) session.status = 'finished';
    } else return fail('invalid_operation');
    session.revision++; session.updatedAt = iso(now);
    session.receipts = [...session.receipts, { id: eventId, actor, fingerprint }].slice(-64);
    return { ok: true, session };
  }
  function view(session, actor, now) {
    if (!session.members.some((m) => m.id === actor)) return null;
    const phase = status(session, now);
    const own = session.members.find((m) => m.id === actor);
    const actions = [];
    if (phase === 'invited' && !own.acceptedAt) actions.push('accept', 'decline');
    if (phase === 'ready' && (!session.scheduledAt || now >= Date.parse(session.scheduledAt))
      && (!own.readyAt || now - Date.parse(own.readyAt) >= READY_MS)) actions.push('ready');
    if (['running', 'review'].includes(phase) && !own.outcome) actions.push('finish');
    if (own.sharedAt) actions.push('withdraw');
    return {
      id: session.id, revision: session.revision, createdBy: session.createdBy,
      status: phase, createdAt: session.createdAt, scheduledAt: session.scheduledAt,
      minutes: session.minutes, startedAt: session.startedAt, endsAt: session.endsAt,
      remainingMs: session.endsAt ? Math.max(0, Date.parse(session.endsAt) - now) : null,
      actions, members: session.members.map((m) => ({
        id: m.id, me: m.id === actor, label: m.sharedAt ? m.publicLabel : null,
        accepted: !!m.acceptedAt, ready: !!m.readyAt && now - Date.parse(m.readyAt) < READY_MS,
        outcome: m.sharedAt ? m.outcome : null,
        ...(m.id === actor ? { taskId: m.taskId } : {}),
      })),
    };
  }
  return Object.freeze({ VERSION: '1.0.0', READY_MS, RETENTION_MS, create, transition, view, status, active, prune, validStored });
});
