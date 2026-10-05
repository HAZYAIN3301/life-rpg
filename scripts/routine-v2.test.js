'use strict';

// «Постоянное расписание 2.0» (владелец 05.10): фиксированные и гибкие занятия, время неизвестно,
// чередование по неделям, сфера у каждого занятия. Слой расписания — не долг: квестом занятие
// становится только после действия человека.

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/routine-v2.js');

test('v1 blocks stay valid: same busy time, fixed by default, stable ids', () => {
  const v1 = { text: 'пары', blocks: [{ day: 1, start: '08:00', end: '13:30', title: 'Пары' }], from: '09:00', to: '18:00' };
  const r = R.normalize(v1);
  assert.equal(r.blocks.length, 1);
  assert.deepEqual({ ...r.blocks[0], id: 'x' }, { day: 1, start: '08:00', end: '13:30', minutes: 330, title: 'Пары', skillId: null, fixed: true, outdoor: false, every: 1, week: 1, id: 'x' });
  assert.equal(R.normalize(v1).blocks[0].id, r.blocks[0].id, 'content id is stable');
  assert.deepEqual(R.busyBlocks(v1, '2026-10-07', []), [{ day: 1, start: '08:00', end: '13:30', title: 'Пары' }]);
});

test('an activity without an hour keeps its duration and is always flexible', () => {
  const b = R.block({ day: 2, title: 'Бег', minutes: 40, fixed: true });
  assert.equal(b.start, null); assert.equal(b.minutes, 40); assert.equal(b.fixed, false);
  assert.throws(() => R.block({ day: 2, title: 'Бег' }), /invalid_block/, 'no hour needs a duration');
  assert.throws(() => R.block({ day: 2, start: '18:00', title: 'X' }), /invalid_block/, 'one bare end is incomplete');
  assert.equal(R.block({ day: 2, start: '18:00', minutes: 90, title: 'Дзюдо' }).end, '19:30', 'start plus duration is complete');
  assert.throws(() => R.block({ day: 2, start: '19:00', end: '18:00', title: 'X' }));
  assert.throws(() => R.block({ day: 7, start: '18:00', end: '19:00', title: 'X' }));
  assert.equal(R.busyBlocks({ blocks: [b] }, '2026-10-05', []).length, 0, 'no hour → nothing held');
});

test('rotation: week 1 gym, week 2 run, week 3 rest, week 4 study on the same Tuesday', () => {
  const routine = { cycleStart: '2026-10-05', blocks: [
    { day: 2, start: '18:00', end: '19:30', title: 'Зал', skillId: 'gym', every: 4, week: 1, fixed: false },
    { day: 2, start: '18:00', end: '19:30', title: 'Бег', skillId: 'run', every: 4, week: 2, fixed: false, outdoor: true },
    { day: 2, start: '18:00', end: '19:30', title: 'Учёба', skillId: 'study', every: 4, week: 4, fixed: false },
    { day: 5, start: '17:00', end: '18:30', title: 'Дзюдо', skillId: 'judo' },
  ] };
  const titles = (ws) => R.occurrences(routine, ws).map((o) => `${o.date} ${o.title}`);
  assert.deepEqual(titles('2026-10-05'), ['2026-10-06 Зал', '2026-10-09 Дзюдо']);
  assert.deepEqual(titles('2026-10-12'), ['2026-10-13 Бег', '2026-10-16 Дзюдо']);
  assert.deepEqual(titles('2026-10-19'), ['2026-10-23 Дзюдо'], 'week 3 is rest');
  assert.deepEqual(titles('2026-10-26'), ['2026-10-27 Учёба', '2026-10-30 Дзюдо']);
  assert.deepEqual(titles('2026-11-02'), ['2026-11-03 Зал', '2026-11-06 Дзюдо'], 'the cycle repeats');
  assert.deepEqual(titles('2026-09-28'), ['2026-09-29 Учёба', '2026-10-02 Дзюдо'], 'the week before week 1 is week 4 of the same cycle');
  assert.equal(R.occurrences(routine, '2026-10-08')[0].date, '2026-10-06', 'any day of the week selects that week');
});

test('rotation choices are named by their nearest date', () => {
  const choices = R.cycleChoices('2026-10-05', '2026-10-05', 2);
  assert.deepEqual(choices[0], { every: 1, week: 1, next: '2026-10-06' });
  assert.deepEqual(choices.filter((c) => c.every === 2).map((c) => [c.week, c.next]), [[1, '2026-10-06'], [2, '2026-10-13']]);
  assert.equal(choices.length, 1 + 2 + 3 + 4);
});

test('a rotation drafted against this week keeps its real weeks under an older anchor', () => {
  const draft = { day: 2, start: '18:00', end: '19:00', title: 'Бег', every: 4, week: 2 };
  for (const anchor of ['2026-09-14', '2026-09-21', '2026-10-05', '2026-11-30']) {
    const saved = { cycleStart: anchor, blocks: [R.rebase(draft, '2026-10-05', anchor)] };
    assert.deepEqual(R.occurrences(saved, '2026-10-12').map((o) => o.title), ['Бег'], anchor);
    assert.deepEqual(R.occurrences(saved, '2026-10-05').map((o) => o.title), [], anchor);
  }
  assert.equal(R.rebase({ every: 1, week: 1 }, '2026-10-05', '2024-01-01').week, 1);
});

test('acted-on and skipped occurrences leave the layer; skipped keys are bounded', () => {
  const routine = { blocks: [{ id: 'r-judo1', day: 2, start: '18:00', end: '19:30', title: 'Дзюдо' }, { id: 'r-run01', day: 4, title: 'Бег', minutes: 40 }],
    skips: ['r-run01|2026-10-08', 'garbage', 'r-run01|2026-10-08'] };
  assert.deepEqual(R.normalize(routine).skips, ['r-run01|2026-10-08']);
  assert.deepEqual(R.occurrences(routine, '2026-10-05').map((o) => o.key), ['r-judo1|2026-10-06']);
  assert.equal(R.occurrences(routine, '2026-10-05', { withSkipped: true }).length, 2);
  assert.deepEqual(R.pending(routine, '2026-10-05', new Set(['r-judo1|2026-10-06'])), []);
  assert.deepEqual(R.busyBlocks(routine, '2026-10-05', ['r-judo1|2026-10-06']), [], 'a moved occurrence holds its new time as a quest');
});

test('a quest from an occurrence is an ordinary quest with the routine key', () => {
  const [occ] = R.occurrences({ blocks: [{ id: 'r-judo1', day: 2, start: '18:00', end: '19:30', title: 'Дзюдо', skillId: 'judo' }] }, '2026-10-05');
  const q = R.questFrom(occ, { id: 'q1', nowIso: '2026-10-06T19:40:00.000Z' });
  assert.deepEqual(q, { id: 'q1', title: 'Дзюдо', skillId: 'judo', skillIds: ['judo'], estimateMin: 90, difficulty: 'normal', date: '2026-10-06',
    done: false, completedAt: null, xpAwarded: 0, goldAwarded: 0, actualMin: null, startTime: '18:00', createdAt: '2026-10-06T19:40:00.000Z',
    source: 'routine', routineKey: 'r-judo1|2026-10-06' });
  assert.equal(R.questFrom(occ, { id: 'q2', date: '2026-10-05', startTime: '17:00' }).routineKey, 'r-judo1|2026-10-06', 'a moved occurrence keeps its identity');
});

test('AI drafts: weekday lists expand, unknown spheres drop, invented ids are impossible', () => {
  const out = R.fromAi({ blocks: [
    { days: [2, 5], start: '18:00', end: '19:30', title: 'Дзюдо', sphere: 'judo', fixed: true },
    { day: 3, title: 'Бег', minutes: 40, sphere: 'not-mine', outdoor: true },
    { day: 9, start: '10:00', end: '11:00', title: 'bad' },
    { day: 1, start: 'evening', title: 'bad' },
  ] }, { skillIds: ['judo'] });
  assert.deepEqual(out.map((b) => [b.day, b.title, b.skillId, b.start, b.fixed, b.outdoor]),
    [[2, 'Дзюдо', 'judo', '18:00', true, false], [5, 'Дзюдо', 'judo', '18:00', true, false], [3, 'Бег', null, null, false, true]]);
  assert.equal(new Set(out.map((b) => b.id)).size, 3);
});

test('a searched place is rounded to about a kilometre; the routine itself keeps no place', () => {
  assert.deepEqual(R.placeOf({ name: 'Herford', lat: 52.11523, lon: 8.67342 }), { name: 'Herford', lat: 52.12, lon: 8.67 });
  assert.equal(R.placeOf({ lat: 120, lon: 0 }), null);
  assert.equal('place' in R.normalize({ place: { lat: 1, lon: 1 } }), false);
});

test('limits: at most 70 rows; broken saved rows are skipped on read but rejected by the editor', () => {
  assert.throws(() => R.blocks(Array.from({ length: 71 }, (_, i) => ({ day: 1, start: '08:00', end: '09:00', title: 'x' + i }))));
  assert.equal(R.normalize({ blocks: [{ day: 1, start: '25:00', end: '26:00' }, { day: 1, start: '08:00', end: '09:00', title: 'ok' }] }).blocks.length, 1);
  assert.throws(() => R.blocks([{ day: 1, start: '25:00', end: '26:00' }]));
});
