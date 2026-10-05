'use strict';

// Погода для постоянного расписания (владелец 05.10, обобщено): гибкое занятие на улице в дождь
// меняется с гибким в помещении на сухой день той же недели или переносится; фиксированное
// (секция, велосипед до школы) не двигается — только предупреждение. Часы прогноза — местные.

const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../public/routine-weather-v1.js');

// Прогноз строится от местного времени, поэтому тест не зависит от часового пояса машины.
const hour = (date, h, extra = {}) => { const [y, m, d] = date.split('-').map(Number); return { t: new Date(y, m - 1, d, h).toISOString(), prob: 10, precip: 0, symbol: 'cloudy', temp: 12, ...extra }; };
function forecast(rainy = {}) {
  const out = [];
  for (const date of W.weekOf('2026-10-05')) for (let h = 0; h < 24; h++) {
    const wet = (rainy[date] || []).includes(h);
    out.push(hour(date, h, wet ? { prob: 90, precip: 1.4, symbol: 'rain' } : {}));
  }
  return out;
}
const occ = (key, date, start, end, extra = {}) => ({ key, blockId: key.split('|')[0], date, start, end, minutes: start ? (Number(end.slice(0, 2)) * 60 + Number(end.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))) : extra.minutes, title: key, skillId: 's', fixed: false, outdoor: false, ...extra });
const all = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);

test('owner example: rain on Thursday swaps the bike with Monday gym; the judo section never moves', () => {
  const occurrences = [
    occ('r-gym|2026-10-05', '2026-10-05', '18:00', '19:30'),
    occ('r-judo|2026-10-06', '2026-10-06', '18:00', '19:30', { fixed: true }),
    occ('r-bike|2026-10-08', '2026-10-08', '17:00', '18:00', { outdoor: true }),
    occ('r-judo|2026-10-09', '2026-10-09', '18:00', '19:30', { fixed: true }),
  ];
  const [s, ...rest] = W.plan({ occurrences, hours: forecast({ '2026-10-08': all(0, 24) }), today: '2026-10-05', nowTime: '08:00' });
  assert.equal(rest.length, 0);
  assert.equal(s.type, 'swap');
  assert.equal(s.a.key, 'r-bike|2026-10-08'); assert.equal(s.b.key, 'r-gym|2026-10-05');
  assert.deepEqual(s.aTo, { date: '2026-10-05', start: '17:00' }, 'the bike goes to the dry Monday at its own hour');
  assert.deepEqual(s.bTo, { date: '2026-10-08', start: '18:00' }, 'the gym takes Thursday at its own hour');
  assert.equal(s.weather.wet, true); assert.equal(s.then.wet, false);
});

test('a fixed outdoor slot is only a warning; a flexible run without an hour moves to the nearest dry day', () => {
  const occurrences = [
    occ('r-ride|2026-10-07', '2026-10-07', '07:30', '07:50', { outdoor: true, fixed: true }),
    occ('r-run|2026-10-07', '2026-10-07', null, null, { outdoor: true, minutes: 40 }),
  ];
  const out = W.plan({ occurrences, hours: forecast({ '2026-10-07': all(6, 21) }), today: '2026-10-05', nowTime: '08:00' });
  assert.deepEqual(out.map((s) => [s.type, s.a.key]), [['warn', 'r-ride|2026-10-07'], ['move', 'r-run|2026-10-07']]);
  assert.deepEqual(out[1].aTo, { date: '2026-10-06', start: null });
});

test('a busy dry slot is not offered; the swap falls back to exchanging the two slots', () => {
  const occurrences = [occ('r-gym|2026-10-05', '2026-10-05', '18:00', '19:30'), occ('r-bike|2026-10-08', '2026-10-08', '17:00', '18:00', { outdoor: true })];
  const tasks = [{ id: 'q', date: '2026-10-05', startTime: '16:30', estimateMin: 60, done: false }];
  const [s] = W.plan({ occurrences, tasks, hours: forecast({ '2026-10-08': all(0, 24) }), today: '2026-10-05', nowTime: '08:00' });
  assert.equal(s.type, 'swap');
  assert.deepEqual(s.aTo, { date: '2026-10-05', start: '18:00' });
  assert.deepEqual(s.bTo, { date: '2026-10-08', start: '17:00' });
});

test('no forecast, dry weather, past slots and indoor activities give no suggestion', () => {
  const bike = occ('r-bike|2026-10-08', '2026-10-08', '17:00', '18:00', { outdoor: true });
  assert.deepEqual(W.plan({ occurrences: [bike], hours: [], today: '2026-10-05' }), []);
  assert.deepEqual(W.plan({ occurrences: [bike], hours: forecast(), today: '2026-10-05' }), []);
  assert.deepEqual(W.plan({ occurrences: [bike], hours: forecast({ '2026-10-08': all(0, 24) }), today: '2026-10-08', nowTime: '18:30' }), [], 'already over');
  assert.deepEqual(W.plan({ occurrences: [{ ...bike, outdoor: false }], hours: forecast({ '2026-10-08': all(0, 24) }), today: '2026-10-05' }), []);
});

test('only the hours of the slot count: an evening run stays put when the rain stops at noon', () => {
  const run = occ('r-run|2026-10-06', '2026-10-06', '19:00', '19:45', { outdoor: true });
  assert.deepEqual(W.plan({ occurrences: [run], hours: forecast({ '2026-10-06': all(6, 12) }), today: '2026-10-05' }), []);
  assert.equal(W.weatherFor(W.byLocalHour(forecast({ '2026-10-06': all(6, 12) })), '2026-10-06', null, null, { untimed: true }).wet, false, 'half a dry day still allows a run');
});

test('wet means probable rain, real precipitation or thunder', () => {
  assert.equal(W.wetSlot({ prob: 70, precip: 0, thunder: null, symbol: 'cloudy' }), true);
  assert.equal(W.wetSlot({ prob: 20, precip: 0.8, thunder: null, symbol: 'cloudy' }), true);
  assert.equal(W.wetSlot({ prob: 10, precip: 0, thunder: 40, symbol: 'cloudy' }), true);
  assert.equal(W.wetSlot({ prob: null, precip: null, thunder: null, symbol: 'lightrain' }), true);
  assert.equal(W.wetSlot({ prob: 20, precip: 0.1, thunder: 0, symbol: 'lightrain' }), false, 'a symbol alone at low probability is not rain');
  assert.deepEqual(W.weekOf('2026-10-08'), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
});
