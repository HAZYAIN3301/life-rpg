'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Producer = require('../public/secretary-next-moves-producer-v1.js');
const Policy = require('../public/secretary-next-moves-v2.js');
const DAY = '2026-09-11';
const task = extra => ({ id: 'q1', date: DAY, startTime: '12:00', done: false, completedAt: null,
  title: 'Private task title', estimateMin: 30, actualMin: null, ...extra });
const snapshot = extra => ({ now: DAY + 'T12:00:00.000Z', today: DAY, utcOffsetMinutes: 0,
  tasks: [task()], habits: [], habitlog: {}, settings: {}, lapse: null,
  guideActive: false, activeSession: false, firstValueStatus: null, ...extra });
const build = extra => { const result = Producer.build(snapshot(extra)); assert.equal(result.ok, true, result.error); return result; };

test('planned start comes only from the saved task date/time and carries no owner text or guessed started flag', () => {
  const result = build({ plannedStart: { taskRef: 'quest:forged' } });
  assert.deepEqual(result.context.plannedStart, { taskRef: 'quest:q1', plannedAtLocal: '12:00',
    precision: 'exact_time', doneToday: false, observedAt: DAY + 'T12:00:00.000Z' });
  assert.equal(result.context.plannedStart.startedToday, undefined);
  assert.equal(result.nextDecisionAt, DAY + 'T12:46:00.000Z');
  assert.equal(JSON.stringify(result).includes('Private task title'), false);
  for (const estimateMin of [null, 0, 30, '30']) {
    assert.equal(build({ tasks: [task({ estimateMin, actualMin: 20 })] }).context.plannedStart.taskRef, 'quest:q1',
      'estimated/completed minutes are not evidence that a current session started');
  }
});

test('invalid or absent schedule/completion data cannot become a planned task', () => {
  for (const extra of [{ date: null }, { date: '2026-02-30' }, { date: '2026-09-10' }, { date: '2026-09-12' },
    { startTime: null }, { startTime: '12' }, { startTime: '24:00' }, { startTime: '12:60' }, { startTime: ' 12:00' },
    { startTime: 12 }, { done: true }, { done: 'false' }, { done: undefined }, { completedAt: DAY + 'T10:00:00.000Z' },
    { id: 'invalid/id' }, { id: 'x'.repeat(75) }]) {
    assert.equal(build({ tasks: [task(extra)] }).context.plannedStart, null, JSON.stringify(extra));
  }
});

test('nearest eligible task wins; equal distance chooses earlier time and then opaque id', () => {
  const rows = [task({ id: 'future', startTime: '12:05' }), task({ id: 'past_b', startTime: '11:55' }),
    task({ id: 'past_a', startTime: '11:55' }), task({ id: 'outside', startTime: '12:11' })];
  const first = build({ tasks: rows });
  assert.equal(first.context.plannedStart.taskRef, 'quest:past_a');
  assert.deepEqual(build({ tasks: rows.slice().reverse() }), first);
  assert.equal(build({ tasks: [...rows, task({ id: 'nearest', startTime: '12:01' })] }).context.plannedStart.taskRef, 'quest:nearest');
});

test('window includes minute -10 through +45 and schedules the exact foreground transitions', () => {
  const before = build({ now: DAY + 'T11:49:59.999Z' });
  assert.equal(before.context.plannedStart, null); assert.equal(before.nextDecisionAt, DAY + 'T11:50:00.000Z');
  assert.ok(build({ now: DAY + 'T11:50:00.000Z' }).context.plannedStart);
  assert.ok(build({ now: DAY + 'T12:45:59.999Z' }).context.plannedStart);
  const after = build({ now: DAY + 'T12:46:00.000Z' });
  assert.equal(after.context.plannedStart, null); assert.equal(after.nextDecisionAt, null);
});

test('future task openings, local midnight and UTC offsets use the saved task day', () => {
  const tomorrow = '2026-09-12';
  const end = build({ now: DAY + 'T21:55:00.000Z', utcOffsetMinutes: 120,
    tasks: [task({ startTime: '23:59' }), task({ id: 'tomorrow', date: tomorrow, startTime: '00:05' })] });
  assert.equal(end.context.plannedStart.taskRef, 'quest:q1');
  assert.equal(end.nextDecisionAt, DAY + 'T22:00:00.000Z', 'today ends and tomorrow becomes eligible at local midnight');
  const next = build({ now: DAY + 'T22:00:00.000Z', today: tomorrow, utcOffsetMinutes: 120,
    tasks: [task({ id: 'tomorrow', date: tomorrow, startTime: '00:05' })] });
  assert.equal(next.context.plannedStart.taskRef, 'quest:tomorrow');
  assert.equal(next.nextDecisionAt, DAY + 'T22:51:00.000Z');
  assert.equal(build({ tasks: [task({ date: tomorrow, startTime: '12:00' })] }).nextDecisionAt, tomorrow + 'T11:50:00.000Z');
});

test('the next wake is the earliest opening or closing; completed schedules never wake', () => {
  const result = build({ tasks: [task(), task({ id: 'later', startTime: '12:30' }), task({ id: 'done', startTime: '12:11', done: true })] });
  assert.equal(result.nextDecisionAt, DAY + 'T12:20:00.000Z');
  assert.equal(build({ tasks: [task({ done: true })] }).nextDecisionAt, null);
  assert.equal(build({ tasks: [task({ startTime: '12:40' })] }).nextDecisionAt, DAY + 'T12:30:00.000Z');
});

test('policy priority and explicit late schedules keep their established semantics', () => {
  const base = snapshot({ settings: { secretary: { configured: true, eveningTime: '11:00' } } });
  const input = { ...Producer.build(base).context, now: base.now, today: DAY, utcOffsetMinutes: 0,
    invocation: 'app_open', availableChannels: ['card'], enabledCapabilities: ['after-lapse-return', 'planned-start'], ledger: Policy.emptyLedger() };
  assert.equal(Policy.decide(input).offer.capabilityId, 'planned-start', 'a saved late schedule is explicit; planned policy has no invented sleep veto');
  const withLapse = { ...input, eveningContract: null, lapse: { confirmed: true, source: 'user_confirmed',
    eventKey: 'attention:e1', day: DAY, endedAt: base.now, observedAt: base.now, originalRef: 'quest:q1', originalStillActionable: true } };
  assert.equal(Policy.decide(withLapse).offer.capabilityId, 'after-lapse-return');
  assert.equal(Policy.decide({ ...input, activeSession: { active: true } }).offer, null);
  assert.equal(Policy.decide({ ...input, dayClosed: true }).offer, null);
});

test('schedule projection never mutates the saved tasks or clock', () => {
  const input = snapshot({ tasks: [task({ id: 'second' }), task({ id: 'first' })] }), before = JSON.stringify(input);
  assert.deepEqual(Producer.build(input), Producer.build(input)); assert.equal(JSON.stringify(input), before);
});
