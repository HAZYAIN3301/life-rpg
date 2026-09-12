'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Producer = require('../public/secretary-next-moves-producer-v1.js');
const Policy = require('../public/secretary-next-moves-v2.js');
const day = '2026-09-12', now = day + 'T22:00:00.000Z';
const task = extra => ({ id: 'q1', date: day, startTime: '21:30', estimateMin: 60, done: false, title: 'Private evening plan', ...extra });
const snapshot = extra => ({ now, today: day, utcOffsetMinutes: 0, tasks: [], habits: [], habitlog: {}, lapse: null,
  settings: { secretary: { configured: true, eveningTime: '22:00', dailyReminder: true } },
  activeSession: false, guideActive: false, firstValueStatus: null, ...extra });
const build = extra => { const value = Producer.build(snapshot(extra)); assert.equal(value.ok, true, value.error); return value; };

test('saved reminder opt-out retains its sleep boundary but has no scheduled wake', () => {
  for (const dailyReminder of [false, undefined]) {
    const result = build({ settings: { secretary: { configured: true, eveningTime: '22:00', dailyReminder } } });
    assert.equal(result.context.eveningContract.dailyReminder, false);
    assert.equal(result.context.eveningContract.eveningTimeLocal, '22:00');
    assert.equal(result.nextDecisionAt, null);
  }
  assert.equal(Producer.build(snapshot({ settings: { secretary: { configured: true, eveningTime: '22:00', dailyReminder: 'true' } } })).error, 'invalid_evening_contract');
});
test('known busy projection contains an exact saved interval, never owner text or actual-start inference', () => {
  const result = build({ tasks: [task({ actualMin: 0 })] });
  assert.deepEqual(result.context.tonightSchedule, { busyUntilLocal: '22:30', busyUntilAt: day + 'T22:30:00.000Z', observedAt: now });
  assert.equal(JSON.stringify(result).includes('Private'), false);
  assert.deepEqual(build({ tasks: [task({ actualMin: 700 })] }).context.tonightSchedule, result.context.tonightSchedule);
  assert.equal(result.context.plannedStart?.startedToday, undefined);
});
test('overlapping and adjacent saved intervals join; a future interval across a free gap does not hold now', () => {
  const rows = [task(), task({ id: 'q2', startTime: '22:20', estimateMin: 30 }), task({ id: 'q3', startTime: '22:50', estimateMin: 10 }),
    task({ id: 'q4', startTime: '23:10', estimateMin: 30 })];
  assert.equal(build({ tasks: rows }).context.tonightSchedule.busyUntilLocal, '23:00');
  assert.deepEqual(build({ tasks: rows }), build({ tasks: rows.slice().reverse() }));
  assert.equal(build({ tasks: [rows[3]] }).context.tonightSchedule, null);
});
test('a cross-midnight estimate uses absolute time and carries into the next day without fabricated HH:MM', () => {
  const tasks = [task({ startTime: '23:30', estimateMin: 90 })];
  const result = build({ now: day + 'T23:45:00.000Z', tasks });
  assert.deepEqual(result.context.tonightSchedule, { busyUntilAt: '2026-09-13T01:00:00.000Z', busyUntilLocal: null, observedAt: day + 'T23:45:00.000Z' });
  const next = build({ now: '2026-09-13T00:30:00.000Z', today: '2026-09-13', tasks });
  assert.equal(next.context.tonightSchedule.busyUntilLocal, '01:00');
});
test('duration keeps real positive numeric estimates including over 24 hours and fractional minutes', () => {
  assert.equal(build({ tasks: [task({ estimateMin: 1499 })] }).context.tonightSchedule.busyUntilAt, '2026-09-13T22:29:00.000Z');
  assert.equal(build({ tasks: [task({ startTime: '21:59', estimateMin: 1.5 })] }).context.tonightSchedule.busyUntilAt, day + 'T22:00:30.000Z');
  for (const estimateMin of [0, -1, '60', null, undefined, NaN, Infinity, Number.MAX_VALUE]) {
    assert.equal(build({ tasks: [task({ estimateMin })] }).context.tonightSchedule, null);
  }
});
test('malformed dates/times, completed tasks and untyped references cannot become busy evidence', () => {
  for (const extra of [{ date: '2026-02-30' }, { startTime: '24:00' }, { startTime: '22:60' }, { startTime: ['21:30'] },
    { done: true }, { completedAt: now }, { done: 'false' }, { id: '../private' }]) {
    assert.equal(build({ tasks: [task(extra)] }).context.tonightSchedule, null);
  }
});
test('evening wake opens at its configured minute and closes at +121 or local midnight', () => {
  assert.equal(build({ now: day + 'T21:59:59.999Z' }).nextDecisionAt, day + 'T22:00:00.000Z');
  assert.equal(build().nextDecisionAt, '2026-09-13T00:00:00.000Z');
  const earlier = { secretary: { configured: true, dailyReminder: true, eveningTime: '20:00' } };
  assert.equal(build({ now: day + 'T21:59:00.000Z', settings: earlier }).nextDecisionAt, day + 'T22:01:00.000Z');
  assert.equal(build({ now: day + 'T22:01:00.000Z', settings: earlier }).nextDecisionAt, '2026-09-13T20:00:00.000Z');
});
test('schedule start/end boundaries wake a foreground client and use its explicit UTC offset', () => {
  const result = build({ now: day + 'T20:00:00.000Z', utcOffsetMinutes: 120, tasks: [task({ startTime: '22:05', estimateMin: 30 })] });
  assert.equal(result.nextDecisionAt, day + 'T20:05:00.000Z');
  const busy = build({ now: day + 'T20:10:00.000Z', utcOffsetMinutes: 120, tasks: [task({ startTime: '22:05', estimateMin: 30 })] });
  // Planned-start has its own earlier opening/closing boundaries, merged by the producer.
  assert.equal(busy.context.tonightSchedule.busyUntilAt, day + 'T20:35:00.000Z');
  assert.equal(busy.nextDecisionAt, day + 'T20:35:00.000Z');
});
test('policy preserves user-scheduled day-closed semantics and defers an active session', () => {
  const input = { ...build().context, now, today: day, utcOffsetMinutes: 0, invocation: 'app_open',
    availableChannels: ['card'], enabledCapabilities: ['evening-close'], ledger: Policy.emptyLedger(), dayClosed: true };
  assert.equal(Policy.decide(input).offer.capabilityId, 'evening-close');
  const active = Policy.decide({ ...input, activeSession: { active: true } }).offer;
  assert.equal(active.interrupt, false); assert.equal(active.deferUntil, 'session_end');
  const original = snapshot({ tasks: [task()] }), before = JSON.stringify(original);
  Producer.build(original); assert.equal(JSON.stringify(original), before);
});
