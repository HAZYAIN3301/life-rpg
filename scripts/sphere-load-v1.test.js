'use strict';
// R04A: нагрузка сфер сравнивает только с наблюдённой базой и называет недостаток данных.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../public/sphere-load-v1.js');

const TODAY = '2026-09-25';
const day = (offset) => L.addDays(TODAY, offset);
function daily(skillId, from, to, xp, every = 1) {
  const out = [];
  for (let off = from; off <= to; off += every) out.push({ date: day(off), skillId, xp });
  return out;
}
const sphere = (id, extra = {}) => ({ id, name: id, color: '#123456', memberIds: [id], lifetimeXp: 100, ...extra });

test('young history is not divided by empty days before the first record', () => {
  // Ten days of steady records, then a normal week: the old 28-day divisor called this ×2.5.
  const events = [...daily('people', -16, -7, 20), ...daily('people', -6, 0, 20)];
  const result = L.compute({ events, spheres: [sphere('people', { lastActive: day(0) })], today: TODAY });
  assert.equal(result.observedBaseDays, 10);
  assert.equal(result.baseReady, false);
  assert.equal(result.needBaseDays, L.MIN_BASE_DAYS - 10);
  assert.equal(result.rows[0].state, 'unknown');
  assert.equal(result.rows[0].reason, 'history');
  assert.equal(result.rows[0].ratio, null);
  assert.equal(result.rows[0].hot, false);
  assert.equal(L.insight(result), null);
});

test('observed base uses its actual days, so an equal pace reads as usual', () => {
  const events = [...daily('people', -20, -7, 20), ...daily('people', -6, 0, 20)];
  const result = L.compute({ events, spheres: [sphere('people')], today: TODAY });
  assert.equal(result.observedBaseDays, 14);
  assert.equal(result.baseReady, true);
  assert.equal(result.rows[0].ratio, 1);
  assert.equal(result.rows[0].state, 'usual');
  assert.equal(result.rows[0].scalePct, result.normPct);
});

test('full history keeps the existing 7/28 and ×1.7 contract', () => {
  const events = [...daily('people', -34, -7, 10), ...daily('people', -6, 0, 30), ...daily('body', -34, -12, 10),
    ...daily('mind', -34, -7, 10), ...daily('mind', -6, -6, 10)];
  const spheres = [sphere('people', { lastActive: day(0) }), sphere('body', { lastActive: day(-12) }), sphere('mind', { lastActive: day(-6) })];
  const result = L.compute({ events, spheres, today: TODAY });
  assert.equal(result.observedBaseDays, L.BASE_DAYS);
  const people = result.rows[0];
  assert.equal(people.ratio, 3);
  assert.equal(people.state, 'higher');
  assert.equal(people.hot, true);
  assert.equal(people.scalePct, 100);
  assert.equal(result.rows[1].state, 'none');
  assert.equal(result.rows[2].state, 'lower');
  assert.equal(result.rows[2].ratio, 0.14);
  const insight = L.insight(result);
  assert.equal(insight.hot.id, 'people');
  assert.deepEqual(insight.quiet.map((row) => row.id), ['body']);
});

test('a known norm without records this week is «none», not ×0.0', () => {
  const events = [...daily('work', -34, -8, 12), ...daily('people', -34, 0, 10)];
  const result = L.compute({ events, spheres: [sphere('work', { lastActive: day(-8) })], today: TODAY });
  assert.equal(result.rows[0].ratio, 0);
  assert.equal(result.rows[0].state, 'none');
  assert.equal(result.rows[0].quietDays, 8);
});

test('a sphere with one busy base day has no norm yet', () => {
  const events = [...daily('people', -34, 0, 10), { date: day(-10), skillId: 'new', xp: 300 }, ...daily('new', -3, 0, 20)];
  const row = L.compute({ events, spheres: [sphere('new')], today: TODAY }).rows[0];
  assert.equal(row.baseActiveDays, 1);
  assert.equal(row.state, 'unknown');
  assert.equal(row.reason, 'sphere');
  assert.equal(row.hot, false);
});

test('a thin base below three XP per day is still insufficient', () => {
  const events = [...daily('people', -34, 0, 10), ...daily('rare', -34, -7, 1, 3)];
  const row = L.compute({ events, spheres: [sphere('rare')], today: TODAY }).rows[0];
  assert.ok(row.baseActiveDays >= L.MIN_ACTIVE_DAYS);
  assert.equal(row.reason, 'sphere');
});

test('restoring spheres keep their ratio but never become the warning', () => {
  const events = [...daily('rest', -34, -7, 10), ...daily('rest', -6, 0, 40)];
  const result = L.compute({ events, spheres: [sphere('rest', { restores: true })], today: TODAY });
  assert.equal(result.rows[0].state, 'higher');
  assert.equal(result.rows[0].hot, false);
  assert.equal(L.insight(result), null);
});

test('subtree members aggregate into the root sphere', () => {
  const events = [...daily('child', -34, -7, 10), ...daily('root', -6, 0, 10), ...daily('child', -6, 0, 10)];
  const row = L.compute({ events, spheres: [sphere('root', { memberIds: ['root', 'child'] })], today: TODAY }).rows[0];
  assert.equal(row.ratio, 2);
  assert.equal(row.state, 'higher');
});

test('explicit history start and malformed input are handled without guessing', () => {
  const events = [...daily('people', -34, 0, 10), { date: 'bad', skillId: 'people', xp: 99 }, { date: day(-1), skillId: null, xp: 50 }, null];
  const late = L.compute({ events, spheres: [sphere('people')], today: TODAY, historyStart: day(-9) });
  assert.equal(late.observedBaseDays, 3);
  assert.equal(late.rows[0].reason, 'history');
  assert.equal(L.compute({ events: [], spheres: [sphere('people')], today: TODAY }).rows[0].reason, 'history');
  assert.throws(() => L.compute({ events: [], spheres: [], today: '25.09.2026' }), TypeError);
});

test('quiet spheres require lifetime experience and are ranked by silence', () => {
  const events = [...daily('hot', -34, -7, 10), ...daily('hot', -6, 0, 40), ...daily('a', -34, -20, 10), ...daily('b', -34, -10, 10)];
  const spheres = [sphere('hot', { lastActive: day(0) }), sphere('a', { lastActive: day(-20) }), sphere('b', { lastActive: day(-10) }), sphere('empty', { lifetimeXp: 0, lastActive: null })];
  const insight = L.insight(L.compute({ events, spheres, today: TODAY }));
  assert.deepEqual(insight.quiet.map((row) => row.id), ['a', 'b']);
});

test('runtime loads the module before app.js, ships it offline and localizes the new meaning copy', () => {
  const fs = require('node:fs'), path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const moduleAt = index.indexOf('sphere-load-v1.js?v=');
  assert.ok(moduleAt > 0 && moduleAt < index.indexOf('app.js?v='), 'module must load before app.js');
  assert.match(sw, /'sphere-load-v1\.js'/);
  assert.match(app, /return L\.compute\(\{ events, spheres, today: todayStr\(\) \}\);/);
  for (const key of ['больше обычного', 'как обычно', 'меньше обычного', 'нет записей за 7 дней', 'мало записей для нормы',
    'Норма ещё не сложилась', 'Заметно больше обычного', 'Нет записей 7+ дней', 'от обычного за неделю', 'До уровня',
    'Меньше всего времени за 3 недели', 'Закрыто', 'Открытые дела сегодня пока не считаются невыполненными.',
    'Отметить сферы, которые восстанавливают']) {
    const at = app.indexOf(`'${key}': {`);
    assert.notEqual(at, -1, key);
    const row = app.slice(at, app.indexOf('\n', at));
    for (const lang of ['en', 'de', 'uk', 'es']) assert.match(row, new RegExp(`\\b${lang}: ['"]`), `${key} → ${lang}`);
  }
});
