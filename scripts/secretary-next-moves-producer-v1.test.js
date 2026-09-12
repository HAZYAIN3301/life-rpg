'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/secretary-next-moves-producer-v1.js');
const S = require('../public/attention-session-v1.js');
const E = require('../public/attention-episode-v1.js');
const C = require('../public/attention-controller-v1.js');

const now = '2026-09-10T12:00:00.000Z', today = '2026-09-10';
const episode = (extra = {}) => ({ id: 'att-1', sourcePolicyId: 'source-1', declaredPurpose: 'watch', startedAt: '2026-09-10T11:00:00.000Z', endedAt: '2026-09-10T11:30:00.000Z', plannedMinutes: 30, actualMinutes: 30, outcome: 'escaped', ...extra });
const habit = (extra = {}) => ({ id: 'h1', title: 'Private habit title', days: [4], archived: false, atomic: { twoMin: 'Open the saved page' }, ...extra });
const snapshot = (extra = {}) => ({ now, today, utcOffsetMinutes: 120, episodes: { version: 1, episodes: [episode({ originalRef: 'quest:q1' })] }, tasks: [{ id: 'q1', title: 'Private task title', date: today, done: false }], habits: [], habitlog: {}, settings: {}, guideActive: false, firstValueStatus: null, activeSession: false, ...extra });
const context = (extra) => { const result = P.build(snapshot(extra)); assert.equal(result.ok, true, result.error); return result.context; };

test('explicit reference survives controller start, extension, durable envelope, close and amendment', () => {
  const policy = C.upsertPolicy({ version: 1, policies: [] }, { targetLabel: 'Source', purpose: 'watch', minutes: 10, outcome: 'One note' }, 'source-1');
  let bundle = { ...C.emptyBundle(), policies: policy.state };
  const start = C.startSession(bundle, { id: 'att-1', policyId: 'source-1', purpose: 'watch', originalRef: 'quest:q1' }, '2026-09-10T11:00:00Z');
  assert.equal(start.ok, true);
  const extended = C.extendSession(start.sessions, 'att-1', 0, 5, '2026-09-10T11:10:00Z');
  bundle = C.fromEnvelope(JSON.parse(JSON.stringify(C.toEnvelope({ ...bundle, sessions: extended.state }))));
  const closed = C.closeSession(bundle, 'att-1', 'escaped', '2026-09-10T11:30:00Z');
  assert.equal(closed.episode.originalRef, 'quest:q1');
  assert.equal(S.byId(closed.sessions, 'att-1').originalRef, 'quest:q1');
  const amended = E.amend(closed.episodes, 'att-1', { outcome: 'rested', note: 'Correction' });
  assert.equal(E.byId(amended.state, 'att-1').originalRef, 'quest:q1');
  const oldRetry = { ...closed.episode }; delete oldRetry.originalRef;
  assert.equal(E.byId(E.record(closed.episodes, oldRetry).state, 'att-1').originalRef, 'quest:q1');
});

test('legacy records retain untyped avoidedThingId and never gain an inferred link', () => {
  const raw = episode({ avoidedThingId: 'q1', declaredPurpose: 'q1', note: 'quest:q1', topic: 'quest:q1' });
  const saved = E.record(E.emptyState(), raw);
  assert.equal(saved.ok, true);
  assert.equal(E.byId(saved.state, raw.id).avoidedThingId, 'q1');
  assert.equal(E.byId(saved.state, raw.id).originalRef, undefined);
  const value = context({ episodes: saved.state });
  assert.equal(value.lapse.originalStillActionable, false);
  assert.equal(value.lapse.originalRef, undefined);
  assert.equal(value.habitMinimum, null);
});

test('strict reference grammar rejects malformed writes without deleting legacy records', () => {
  const values = ['q1', 'task:q1', 'quest:', 'quest:q1/../../', 'quest:https://example.org', 'quest:q 1', ' quest:q1', 'quest:q1\n', 'habit:' + 'x'.repeat(75), 42, {}];
  const base = { id: 'att-1', policyId: 'source-1', purpose: 'watch', plannedMinutes: 10 };
  for (const originalRef of values) {
    assert.equal(S.start(S.emptyState(), { ...base, originalRef }, now).error, 'invalid_original_ref');
    assert.equal(E.record(E.emptyState(), episode({ originalRef })).error, 'invalid_original_ref');
    const state = E.record(E.emptyState(), episode({ originalRef: 'habit:h1' })).state;
    assert.equal(E.amend(state, 'att-1', { originalRef }).error, 'invalid_original_ref');
    const normalized = E.normalize({ version: 1, episodes: [episode({ originalRef })] });
    assert.equal(normalized.episodes.length, 1);
    assert.equal(normalized.episodes[0].originalRef, undefined);
  }
  assert.equal(P.validOriginalRef('quest:' + 'x'.repeat(74)), true);
  assert.equal(P.validOriginalRef('habit:h1'), true);
});

test('the most recent qualifying episode wins deterministically and owner text stays out', () => {
  const older = episode({ id: 'a', endedAt: '2026-09-10T11:10:00Z' });
  const latest = episode({ id: 'b', originalRef: 'quest:q1', note: 'private note' });
  const first = context({ episodes: [older, latest] });
  assert.equal(first.lapse.eventKey, 'attention:b');
  assert.equal(first.lapse.originalStillActionable, true);
  assert.deepEqual(first, context({ episodes: [latest, older] }));
  assert.equal(JSON.stringify(first).includes('Private task title'), false);
  assert.equal(JSON.stringify(first).includes('private note'), false);
});

test('unknown and missing measurements do not become escapes; explicit measured overrun is separate', () => {
  for (const extra of [{ outcome: 'unknown', actualMinutes: null }, { outcome: 'unknown', actualMinutes: undefined }, { outcome: 'unknown', actualMinutes: '31' }, { outcome: 'unknown', actualMinutes: 30 }, { outcome: 'done', actualMinutes: 20 }, { outcome: 'rested', actualMinutes: 30 }]) {
    assert.equal(context({ episodes: [episode(extra)] }).lapse, null);
  }
  const measured = context({ episodes: [episode({ outcome: 'unknown', actualMinutes: 31 })] }).lapse;
  assert.equal(measured.source, 'boundary_measured');
  assert.equal(measured.actualMinutes, 31);
  assert.equal(measured.plannedMinutes, 30);
  const escaped = context({ episodes: [episode({ actualMinutes: null })] }).lapse;
  assert.equal(escaped.source, 'user_confirmed');
});

test('closed time, same local day and a three-hour window are required', () => {
  for (const extra of [{ endedAt: null }, { endedAt: '2026-09-10T12:01:00Z' }, { endedAt: '2026-02-30T11:00:00Z' }, { startedAt: '2026-09-10T11:40:00Z' }, { startedAt: '2026-09-10T08:00:00Z', endedAt: '2026-09-10T08:59:59Z' }, { returnedAt: '2026-09-10T11:40:00Z' }, { returnedAt: 'broken' }]) {
    assert.equal(context({ episodes: [episode(extra)] }).lapse, null);
  }
  assert.ok(context({ episodes: [episode({ startedAt: '2026-09-10T08:00:00Z', endedAt: '2026-09-10T09:00:00Z' })] }).lapse);
  const crossMidnight = context({ now: '2026-09-10T22:15:00Z', today: '2026-09-11', episodes: [episode({ startedAt: '2026-09-10T21:00:00Z', endedAt: '2026-09-10T21:59:00Z' })] });
  assert.equal(crossMidnight.lapse, null);
});

test('server ingress independently rechecks proof, freshness and current owner, ignoring claimed actionability', () => {
  const signal = context().lapse;
  const removed = context({ lapse: { ...signal, originalStillActionable: true, title: 'ignored' }, tasks: [] });
  assert.equal(removed.lapse.originalStillActionable, false);
  assert.equal(removed.lapse.title, undefined);
  const measured = context({ episodes: [episode({ outcome: 'unknown', actualMinutes: 31 })] }).lapse;
  assert.ok(context({ lapse: measured }).lapse);
  assert.equal(P.build(snapshot({ lapse: { ...measured, actualMinutes: null } })).error, 'invalid_lapse');
  assert.equal(P.build(snapshot({ lapse: { ...signal, originalRef: 'task:q1' } })).error, 'invalid_original_ref');
  assert.equal(P.build(snapshot({ lapse: { ...signal, day: '2026-09-09' } })).error, 'invalid_lapse');
  assert.equal(P.build(snapshot({ lapse: { ...signal, observedAt: '2026-09-10T12:01:00Z' } })).error, 'invalid_lapse');
  assert.equal(context({ lapse: null }).lapse, null);
  assert.equal(P.build(snapshot({ lapse: false })).error, 'invalid_lapse');
});

test('deleted, completed and future tasks never remain actionable', () => {
  for (const tasks of [[], [{ id: 'q1', done: true }], [{ id: 'q1', done: 'false' }], [{ id: 'q1', done: false, completedAt: now }], [{ id: 'q1', done: false, date: '2026-09-11' }], [{ id: 'q1', done: false, date: '2026-02-30' }]]) {
    assert.equal(context({ tasks }).lapse.originalStillActionable, false);
  }
  assert.equal(context({ tasks: [{ id: 'q1', date: '2026-09-09', done: false }] }).lapse.originalStillActionable, true);
});

test('only the explicitly linked, due, unfinished habit with its saved minimum is eligible', () => {
  const extra = { episodes: [episode({ originalRef: 'habit:h1' })], habits: [habit()] };
  const result = context(extra);
  assert.deepEqual(result.habitMinimum, { habitRef: 'habit:h1', twoMin: 'Open the saved page', observedAt: now });
  assert.equal(result.lapse.originalStillActionable, true);
  for (const changes of [{ habits: [habit({ archived: true })] }, { habits: [habit({ days: [3] })] }, { habits: [habit({ atomic: { twoMin: '' } })] }, { habits: [habit({ atomic: null })] }, { habitlog: { [today]: { h1: { min: 2 } } } }, { habitlog: null }, { habits: [habit({ id: 'another' })] }]) {
    const value = context({ ...extra, ...changes });
    assert.equal(value.habitMinimum, null);
    assert.equal(value.lapse.originalStillActionable, false);
  }
  assert.equal(context({ habits: [habit()] }).habitMinimum, null, 'a random unrelated habit is not the original context');
});

test('evening boundary is mapped from configured settings; it does not enable another delivery', () => {
  const result = context({ settings: { secretary: { configured: true, eveningTime: '21:30', dailyReminder: false } } });
  assert.deepEqual(result.eveningContract, { configured: true, eveningTimeLocal: '21:30', dailyReminder: false, observedAt: now });
  assert.equal(result.plannedStart, null);
  assert.equal(result.tonightSchedule, null);
  assert.equal(context({ settings: { secretary: { configured: false, eveningTime: '21:30' } } }).eveningContract, null);
  assert.equal(P.build(snapshot({ settings: { secretary: { configured: true, eveningTime: '25:30' } } })).error, 'invalid_evening_contract');
});

test('actual RestProfile recipe selection and carrier mapping are reused, without inventing a store', () => {
  const recipe = (id, mode, extra = {}) => ({ id, title: 'Saved rest', mode, defaultMinutes: 10, setup: 'Prepared', steps: ['Begin'], ...extra });
  const profile = { version: 1, recipes: [recipe('screen', 'device'), recipe('offline', 'offline')] };
  const result = context({ lapse: { ...context().lapse, screenEpisode: true }, restProfile: profile });
  assert.deepEqual(result.restMenu, { recipeRef: 'offline', minutes: 10, screenMode: 'no_screen', observedAt: now });
  assert.equal(context({ restProfile: { version: 1, recipes: [recipe('r', 'mixed')] } }).restMenu.screenMode, 'either');
  assert.equal(context({ restProfile: { version: 1, recipes: [recipe('r', 'device')] } }).restMenu.screenMode, 'screen');
  assert.equal(context().restMenu, null);
  assert.equal(context({ settings: { restProfileV1: profile } }).restMenu, null);
  assert.equal(context({ restProfile: { version: 1, recipes: [recipe('r', 'offline', { archived: true })] } }).restMenu, null);
  assert.equal(P.build(snapshot({ restProfile: {} })).error, 'invalid_rest_profile');
});

test('strict clocks, offset, flags and malformed owner snapshots fail explicitly', () => {
  for (const [change, error] of [[{ now: '2026-02-30T12:00:00Z' }, 'invalid_time'], [{ now: '2026-09-10 12:00' }, 'invalid_time'], [{ today: '2026-09-09' }, 'invalid_day'], [{ utcOffsetMinutes: '120' }, 'invalid_offset'], [{ utcOffsetMinutes: 841 }, 'invalid_offset'], [{ activeSession: 'false' }, 'invalid_flag'], [{ guideActive: null }, 'invalid_flag'], [{ firstValueStatus: 'bad' }, 'invalid_flag'], [{ tasks: null }, 'invalid_owner_snapshot'], [{ tasks: [{ id: 'same' }, { id: 'same' }] }, 'invalid_owner_snapshot'], [{ episodes: {} }, 'invalid_episodes']]) {
    assert.equal(P.build(snapshot(change)).error, error);
  }
  for (const status of ['new', 'intent_known', 'action_ready', 'action_started']) assert.equal(context({ firstValueStatus: status }).firstValue.pending, true);
  for (const status of [null, 'first_value_reached', 'completed', 'deferred']) assert.equal(context({ firstValueStatus: status }).firstValue.pending, false);
  assert.equal(context({ guideActive: true }).guide.active, true);
  assert.equal(context({ activeSession: true }).activeSession.active, true);
});

test('projection is deterministic and never mutates owner arrays or records', () => {
  const input = snapshot(), before = JSON.stringify(input);
  assert.deepEqual(P.build(input), P.build(input));
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(context({ settings: { commitmentsV1: { version: 2, items: [{ id: 'not-a-task', kind: 'step', title: 'Private' }] } } }).commitmentItems, []);
});
