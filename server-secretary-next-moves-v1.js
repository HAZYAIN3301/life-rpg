'use strict';

// The only owner of v2 delivery: a synchronous read/check/fsync/rename transaction
// on this single-process account server. No awaits are permitted in transact().
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Policy = require('./public/secretary-next-moves-v2.js');
const Producer = require('./public/secretary-next-moves-producer-v1.js');
const Claims = require('./public/secretary-claim-v1.js');

const FILE = 'secretary';
const TTL_MS = 15 * 60 * 1000;
const RETAIN_MS = 30 * 86400000;
const TOKEN = /^[A-Za-z0-9_-]{1,100}$/;
const token = (value) => typeof value === 'string' && TOKEN.test(value);
const OUTCOMES = ['accepted', 'dismissed', 'expired'];
const CAPABILITIES = ['after-lapse-return', 'planned-start'];
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const iso = (value) => typeof value === 'string' && Policy.parseIso(value) !== null;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clone = (value) => JSON.parse(JSON.stringify(value));
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function earliestExpiry(values, now) {
  const at = Date.parse(now);
  let earliest = null;
  for (const value of values) {
    const expires = Date.parse(value);
    if (Number.isFinite(expires) && expires > at && (earliest === null || expires < earliest)) earliest = expires;
  }
  return earliest === null ? null : new Date(earliest).toISOString();
}
function failure(code, status = 422) { const e = new Error(code); e.code = code; e.status = status; throw e; }
function empty() { return { version: 1, nextMoves: Policy.emptyLedger(), delivery: { offers: {}, requests: {} } }; }
function validAction(action) {
  if (!object(action) || !object(action.args) || !Policy.isDay(action.args.day)) return false;
  if (action.type === 'task_open_prepared') return Producer.validOriginalRef(action.args.targetRef) && ['minimum', 'planned'].includes(action.args.size);
  return action.type === 'ask_one_question' && token(action.args.questionId);
}
function validOffer(offer) {
  return object(offer) && offer.version === 2 && CAPABILITIES.includes(offer.capabilityId)
    && typeof offer.offerId === 'string' && offer.offerId.length <= 200
    && offer.offerId.startsWith(offer.capabilityId + '|') && typeof offer.cooldownKey === 'string'
    && offer.cooldownKey === offer.capabilityId + '|' + offer.about?.day && iso(offer.expiresAt)
    && (offer.capabilityId !== 'planned-start' || object(offer.about?.planned)
      && Policy.isDay(offer.about.planned.date) && offer.about.planned.date === offer.about.day
      && /^([01]\d|2[0-3]):[0-5]\d$/.test(offer.about.planned.startTime)
      && offer.primary?.action?.type === 'task_open_prepared' && offer.primary.action.args?.size === 'planned'
      && offer.primary.action.args?.day === offer.about.day && typeof offer.about.targetRef === 'string'
      && offer.primary.action.args?.targetRef === offer.about.targetRef && offer.about.targetRef.startsWith('quest:'))
    && offer.channel === 'card' && offer.primary?.id === 'primary' && validAction(offer.primary?.action)
    && validAction(offer.action) && Array.isArray(offer.alternatives)
    && offer.alternatives.every((item) => object(item) && token(item.id) && validAction(item.action));
}
function sanitize(raw) {
  if (!object(raw) || raw.version !== 1 || !object(raw.delivery)
    || !object(raw.delivery.offers) || !object(raw.delivery.requests)) return null;
  const ledger = Policy.sanitizeLedger(raw.nextMoves);
  if (!ledger || stable(ledger) !== stable(raw.nextMoves)) return null;
  for (const [id, row] of Object.entries(raw.delivery.offers)) {
    if (!object(row) || !validOffer(row.offer) || row.offer.offerId !== id
      || !token(row.clientId) || !token(row.token) || !iso(row.claimedAt)
      || !iso(row.persistedAt) || !['offered', ...OUTCOMES].includes(row.state)) return null;
    const mark = ledger.offers[row.offer.cooldownKey];
    if (!mark || mark.offerId !== id || mark.state !== row.state) return null;
  }
  if (Object.keys(ledger.offers).length !== Object.keys(raw.delivery.offers).length) return null;
  for (const [key, receipt] of Object.entries(raw.delivery.requests)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !object(receipt) || !/^[a-f0-9]{64}$/.test(receipt.fingerprint)
      || !iso(receipt.persistedAt) || ![200, 409].includes(receipt.status)
      || !object(receipt.response) || receipt.response.persistedAt !== receipt.persistedAt || !['claim', 'outcome'].includes(receipt.op)
      || !own(raw.delivery.offers, receipt.offerId)) return null;
    if (receipt.status === 200 && receipt.response.ok !== true) return null;
    if (receipt.op === 'claim' && (!validOffer(receipt.response.offer)
      || receipt.response.token !== raw.delivery.offers[receipt.offerId].token)) return null;
    if (receipt.op === 'outcome' && receipt.status === 200
      && (!OUTCOMES.includes(receipt.response.outcome)
        || receipt.response.outcome === 'accepted' && !validAction(receipt.response.action))) return null;
  }
  return clone(raw);
}

function createService({ userDir, durableWrite, recoverAccount = () => {} }) {
  function supported(body) {
    const list = body.supportedCapabilities === undefined ? ['after-lapse-return'] : body.supportedCapabilities;
    if (!Array.isArray(list) || list.some((id) => !CAPABILITIES.includes(id)) || new Set(list).size !== list.length) failure('invalid_capabilities', 400);
    return list;
  }
  function readFile(uid, name, fallback, predicate) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(userDir(uid), name + '.json'), 'utf8')); }
    catch (e) {
      if (e.code === 'ENOENT') return clone(fallback);
      failure(e instanceof SyntaxError ? 'invalid_secretary_state' : 'secretary_read_failed', e instanceof SyntaxError ? 422 : 500);
    }
    if (!predicate(raw)) failure('invalid_secretary_state');
    return raw;
  }
  function read(uid) { return readFile(uid, FILE, empty(), (raw) => !!sanitize(raw)); }
  function persist(uid, state) {
    if (!sanitize(state)) failure('invalid_secretary_state');
    const file = path.join(userDir(uid), FILE + '.json');
    // One previous valid version, within the account's normal cascade-delete root.
    // Failure to preserve it is a write failure, not a successful new receipt.
    try {
      if (fs.existsSync(file)) durableWrite(path.join(userDir(uid), '.backups', FILE, 'previous.json'), read(uid));
      durableWrite(file, state);
    } catch (e) { if (e.status) throw e; failure('secretary_save_failed', 500); }
  }
  function mark(state, row, outcome, now) {
    const result = Policy.mark(state.nextMoves, row.offer, outcome, now);
    if (!result.ok) failure('invalid_secretary_state');
    state.nextMoves = result.ledger;
    row.state = outcome; row.persistedAt = now;
  }
  function expire(state, now) {
    let changed = false;
    for (const row of Object.values(state.delivery.offers)) {
      if (row.state === 'offered' && Date.parse(row.offer.expiresAt) <= Date.parse(now)) {
        mark(state, row, 'expired', now); changed = true;
      }
    }
    const oldest = Date.parse(now) - RETAIN_MS;
    for (const [key, receipt] of Object.entries(state.delivery.requests)) {
      if (Date.parse(receipt.persistedAt) < oldest) { delete state.delivery.requests[key]; changed = true; }
    }
    for (const [id, row] of Object.entries(state.delivery.offers)) {
      if (row.state !== 'offered' && Date.parse(row.persistedAt) < oldest
        && !Object.values(state.delivery.requests).some((r) => r.offerId === id)) {
        delete state.delivery.offers[id]; delete state.nextMoves.offers[row.offer.cooldownKey]; changed = true;
      }
    }
    return changed;
  }
  function held(uid, now) {
    return Object.values(read(uid).delivery.offers).some((row) => row.state === 'offered' && Date.parse(row.offer.expiresAt) > Date.parse(now));
  }
  function legacyRecheckAt(uid, now) {
    const raw = readFile(uid, 'secretary-claims', Claims.emptyClaims(), (v) => !!Claims.sanitizeClaims(v));
    const claims = Claims.sanitizeClaims(raw);
    return earliestExpiry(Object.keys(claims.claims).map((id) => Claims.activeClaim(claims, id, now)?.expiresAt), now);
  }
  function snapshot(uid, context, now, today, offset, plannedTaskRef) {
    if (!object(context)) failure('invalid_context', 400);
    for (const [name, key] of [['activeSession', 'active'], ['guide', 'active'], ['firstValue', 'pending']]) {
      if (!object(context[name]) || typeof context[name][key] !== 'boolean') failure('invalid_flag', 400);
    }
    recoverAccount(uid);
    const settings = readFile(uid, 'settings', {}, object);
    const tasks = readFile(uid, 'tasks', [], Array.isArray);
    const habits = readFile(uid, 'habits', [], Array.isArray);
    const habitlog = readFile(uid, 'habitlog', {}, object);
    const days = readFile(uid, 'days', {}, object);
    const firstValue = readFile(uid, 'first-value', null, object);
    const guide = settings.guideV3;
    if (guide != null && !object(guide)) failure('invalid_secretary_state');
    const result = Producer.build({ now, today, utcOffsetMinutes: offset, lapse: context.lapse ?? null,
      settings, tasks: plannedTaskRef ? tasks.filter((task) => 'quest:' + task.id === plannedTaskRef) : tasks, habits, habitlog,
      activeSession: context.activeSession.active,
      guideActive: context.guide.active || !!(guide && guide.enabled !== false && guide.currentChapter),
      firstValueStatus: context.firstValue.pending ? 'new' : firstValue?.status,
    });
    if (!result.ok) failure(result.error || 'invalid_context',
      ['invalid_owner_snapshot', 'invalid_evening_contract', 'invalid_flag'].includes(result.error) ? 422 : 400);
    return { ...result.context, dayClosed: !!days[today]?.closed };
  }
  function decide(uid, state, body, now, today, offset) {
    const context = snapshot(uid, body.context, now, today, offset);
    const result = Policy.decide({ ...context, now, today, utcOffsetMinutes: offset,
      invocation: body.invocation || 'app_open', ledger: state.nextMoves,
      availableChannels: ['card'], preferredChannel: 'card', enabledCapabilities: supported(body) });
    if (!result.ok) failure(result.error, 400);
    if (result.offer) {
      let windowEnds;
      if (result.offer.capabilityId === 'planned-start') {
        const time = context.plannedStart.plannedAtLocal;
        const at = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        windowEnds = Date.parse(today + 'T00:00:00.000Z') - offset * 60000 + Math.min(1440, at + 46) * 60000;
        result.offer = { ...result.offer, about: { ...result.offer.about, planned: { date: today, startTime: time } },
          // The first planned slice opens exactly this saved task. Unrelated
          // habit/commitment alternatives need their own reviewed executor flow.
          alternatives: [] };
      } else windowEnds = Date.parse(context.lapse.endedAt) + 3 * 3600000;
      result.offer = { ...result.offer, expiresAt: new Date(Math.min(Date.parse(result.offer.expiresAt),
        windowEnds, Date.parse(now) + TTL_MS)).toISOString() };
    }
    return { result, context };
  }
  function actionAlive(uid, row, action, now, today, offset) {
    // Resolve the original opaque reference again from current account-owned files.
    if (action.type === 'ask_one_question') return true;
    if (action.type !== 'task_open_prepared') return false;
    const ref = action.args?.targetRef;
    if (row.offer.capabilityId === 'planned-start') {
      if (ref !== row.offer.about.targetRef || row.offer.about.planned.date !== today) return false;
      // Revalidate the frozen task, not the current nearest-task winner.
      const current = snapshot(uid, { activeSession: { active: false }, guide: { active: false }, firstValue: { pending: false }, lapse: null },
        now, today, offset, ref);
      if (!current.plannedStart || current.plannedStart.taskRef !== ref
        || current.plannedStart.plannedAtLocal !== row.offer.about.planned.startTime) return false;
      const permission = Policy.decide({ ...current, now, today, utcOffsetMinutes: offset,
        invocation: 'manual', availableChannels: ['card'], enabledCapabilities: ['planned-start'], ledger: Policy.emptyLedger() });
      return permission.ok && permission.offer && stable(permission.offer.action) === stable(action);
    }
    const context = snapshot(uid, { activeSession: { active: false }, guide: { active: false }, firstValue: { pending: false },
      lapse: { confirmed: true, source: 'user_confirmed', eventKey: 'attention:revalidate',
        day: today, endedAt: now, originalRef: ref, screenEpisode: false, observedAt: now } }, now, today, offset);
    const permission = Policy.decide({ ...context, now, today, utcOffsetMinutes: offset,
      invocation: 'manual', availableChannels: ['card'], enabledCapabilities: ['after-lapse-return'], ledger: Policy.emptyLedger() });
    return permission.ok && permission.offer && stable(permission.offer.action) === stable(action);
  }
  function transact(uid, body, { now = new Date().toISOString(), today, offset } = {}) {
    if (!object(body) || !token(body.clientId) || !token(body.requestId)) failure('invalid_request', 400);
    if (!['decide', 'claim', 'outcome'].includes(body.op)) failure('invalid_op', 400);
    if (body.op === 'decide' || body.op === 'claim') supported(body);
    if (!iso(now) || !Number.isInteger(offset) || offset < -840 || offset > 840
      || Policy.localParts(Policy.parseIso(now), offset).day !== today) failure('invalid_time', 400);
    const state = read(uid);
    let changed = expire(state, now);
    // Receipts are keyed by opaque client + intent, never by channel alone.
    const digest = (v) => crypto.createHash('sha256').update(v).digest('hex');
    const key = digest(body.clientId + '\n' + body.requestId);
    const fingerprint = digest(stable(body));
    const prior = state.delivery.requests[key];
    if (prior) {
      if (prior.fingerprint !== fingerprint) failure('request_conflict', 409);
      if (changed) persist(uid, state);
      if (prior.op === 'claim' && state.delivery.offers[prior.offerId].state !== 'offered') failure('offer_expired', 409);
      return { status: prior.status, body: { ...prior.response, repeat: true } };
    }
    const saveExpiry = () => { if (changed) { persist(uid, state); changed = false; } };
    if (body.op === 'decide') {
      const { result, context } = decide(uid, state, body, now, today, offset);
      saveExpiry();
      const activeRows = Object.values(state.delivery.offers).filter((row) => row.state === 'offered');
      const active = activeRows[0];
      const blocked = context.activeSession.active || context.guide.active || context.firstValue.pending || context.dayClosed;
      if (active) return { status: 200, body: { ok: true, offer: null,
        silence: blocked ? { reason: 'context_blocked' }
          : { reason: 'held', recheckAt: earliestExpiry(activeRows.map((row) => row.offer.expiresAt), now) },
        resume: !blocked && active.clientId === body.clientId && supported(body).includes(active.offer.capabilityId)
          ? { offer: active.offer, token: active.token, persistedAt: active.claimedAt } : null } };
      const legacyAt = legacyRecheckAt(uid, now);
      if (legacyAt) return { status: 200, body: { ok: true, offer: null, silence: { reason: 'legacy_held', recheckAt: legacyAt }, resume: null } };
      return { status: 200, body: { ok: true, offer: result.offer, silence: result.silence, resume: null } };
    }
    saveExpiry();
    if (Object.keys(state.delivery.requests).length >= 2048) failure('receipt_capacity', 429);
    let response, status = 200;
    if (body.op === 'claim') {
      const recheckAt = earliestExpiry([legacyRecheckAt(uid, now), ...Object.values(state.delivery.offers)
        .filter((row) => row.state === 'offered').map((row) => row.offer.expiresAt)], now);
      if (recheckAt) return { status: 409, body: { error: 'held', recheckAt } };
      const { result } = decide(uid, state, body, now, today, offset);
      if (!result.offer || result.offer.offerId !== body.offerId) failure('stale_offer', 409);
      const row = { offer: result.offer, clientId: body.clientId, token: crypto.randomUUID(),
        state: 'offered', claimedAt: now, persistedAt: now };
      mark(state, row, 'offered', now);
      state.delivery.offers[row.offer.offerId] = row;
      response = { ok: true, offer: row.offer, token: row.token, persistedAt: now, repeat: false };
    } else {
      if (!OUTCOMES.includes(body.outcome)) failure('invalid_outcome', 400);
      const row = own(state.delivery.offers, body.offerId) ? state.delivery.offers[body.offerId] : null;
      if (!row) failure('offer_not_found', 404);
      if (row.clientId !== body.clientId || row.token !== body.token) failure('claim_not_owned', 403);
      if (row.state !== 'offered') {
        const previous = Object.values(state.delivery.requests).find((r) => r.offerId === body.offerId && r.op === 'outcome'
          && r.status === 200 && r.response.outcome === body.outcome);
        const selected = [row.offer.primary, ...row.offer.alternatives].find((item) => item.id === (body.actionId || 'primary'));
        if (previous && (body.outcome !== 'accepted' || selected && stable(selected.action) === stable(previous.response.action))) {
          return { status: 200, body: { ...previous.response, repeat: true } };
        }
        if (row.state === 'expired' && body.outcome === 'expired') {
          // The request sweep may already have settled this lease. A matching
          // client timer acknowledges that same durable outcome; it must not
          // increment ignoredInARow again or turn successful expiry into 409.
          const response = { ok: true, outcome: 'expired', action: null, persistedAt: row.persistedAt, repeat: true };
          state.delivery.requests[key] = { fingerprint, persistedAt: row.persistedAt,
            status: 200, response, offerId: body.offerId, op: 'outcome' };
          persist(uid, state);
          return { status: 200, body: response };
        }
        failure(row.state === 'expired' ? 'offer_expired' : 'terminal_outcome', 409);
      }
      let action = null;
      if (body.outcome === 'accepted') {
        const live = snapshot(uid, body.context, now, today, offset);
        if (live.activeSession.active || live.guide.active || live.firstValue.pending || live.dayClosed) failure('context_blocked', 409);
        const actionId = body.actionId || 'primary';
        const selected = [row.offer.primary, ...row.offer.alternatives].find((item) => item.id === actionId);
        if (!selected) failure('invalid_action', 400);
        action = selected.action;
        if (!actionAlive(uid, row, action, now, today, offset)) {
          mark(state, row, 'expired', now); status = 409;
          response = { ok: false, error: 'stale_target', outcome: 'expired', persistedAt: now, repeat: false };
        }
      }
      if (!response) {
        mark(state, row, body.outcome, now);
        response = { ok: true, outcome: body.outcome, action, persistedAt: now, repeat: false };
      }
    }
    state.delivery.requests[key] = { fingerprint, persistedAt: now, status, response, offerId: body.offerId, op: body.op };
    persist(uid, state);
    return { status, body: response };
  }
  return { transact, snapshot: read, held };
}

module.exports = { FILE, TTL_MS, RETAIN_MS, empty, sanitize, createService };
