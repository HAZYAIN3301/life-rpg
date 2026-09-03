const test = require('node:test');
const assert = require('node:assert/strict');
const Two = require('../public/habit-two-minute-v1.js');

const habit = (twoMin = 'надеть кроссовки и выйти за дверь') => ({
  id: 'h_1', title: 'Движение 20 мин', estimateMin: 20, difficulty: 'normal',
  atomic: { identity: 'Я — человек, который двигается', cue: 'После завтрака', twoMin },
});

test('the exit shows in the person’s own words', () => {
  assert.deepEqual(Two.offerFor(habit(), { done: false, streak: 0 }),
    { text: 'надеть кроссовки и выйти за дверь', minutes: 2 });
  assert.equal(Two.MINUTES, 2);
});

test('a running streak does not need a spare entrance', () => {
  assert.equal(Two.offerFor(habit(), { done: false, streak: 1 }), null);
  assert.equal(Two.offerFor(habit(), { done: false, streak: 30 }), null);
  // новая привычка и прерванная — одинаково трудно начать, и обе получают выход
  assert.ok(Two.offerFor(habit(), { done: false, streak: 0 }));
  assert.ok(Two.offerFor(habit(), { done: false, streak: null }));
  assert.ok(Two.offerFor(habit(), { done: false }));
});

test('a habit already done today is not offered a smaller version of itself', () => {
  assert.equal(Two.offerFor(habit(), { done: true, streak: 0 }), null);
});

test('without written words there is nothing to offer', () => {
  for (const twoMin of ['', '   ', null, 42]) {
    assert.equal(Two.offerFor(habit(twoMin), { done: false, streak: 0 }), null, String(twoMin));
  }
  assert.equal(Two.offerFor({ id: 'h', atomic: {} }, { done: false, streak: 0 }), null, 'поле не заполняли');
  assert.equal(Two.offerFor({ id: 'h', atomic: null }, { done: false, streak: 0 }), null);
  assert.equal(Two.offerFor(null, { done: false, streak: 0 }), null);
  assert.equal(Two.textOf(habit()), 'надеть кроссовки и выйти за дверь');
  assert.equal(Two.textOf(null), '');
});

test('a long version is trimmed instead of taking over the row', () => {
  assert.equal(Two.offerFor(habit('к'.repeat(400)), { done: false, streak: 0 }).text.length, 200);
});

test('showing up counts fully — the smaller version is never paid less', () => {
  const record = Two.recordFor({ xp: 12, gold: 4, at: '2026-09-02T07:00:00.000Z' });
  assert.equal(record.xp, 12);
  assert.equal(record.gold, 4);
  assert.equal(record.at, '2026-09-02T07:00:00.000Z');
});

test('only the time becomes honest, and history knows which version was done', () => {
  const record = Two.recordFor({ xp: 12, gold: 4 });
  assert.equal(record.min, 2, 'две минуты, а не запланированные двадцать');
  assert.equal(record.twoMin, true);
  assert.equal('at' in record, false, 'выдуманного времени в записи не появляется');
});

test('junk numbers never become a payment', () => {
  const record = Two.recordFor({ xp: 'много', gold: NaN });
  assert.equal(record.xp, 0);
  assert.equal(record.gold, 0);
  assert.deepEqual(Two.recordFor(null), { xp: 0, gold: 0, min: 2, twoMin: true });
});

test('the module stays pure: no DOM, State, network or clock', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'habit-two-minute-v1.js'), 'utf8');
  for (const forbidden of ['document', 'window.State', 'fetch(', 'localStorage', 'Date.now', 'new Date()']) {
    assert.equal(source.includes(forbidden), false, `модуль не должен обращаться к ${forbidden}`);
  }
  assert.deepEqual(Object.keys(Two).sort(), ['MINUTES', 'offerFor', 'recordFor', 'textOf']);
});

// ── Клиентский контракт: выход стоит там, где привычку отмечают ──

const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'public');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('the module is loaded before app.js and cached once for offline', () => {
  const at = INDEX.indexOf('src="habit-two-minute-v1.js');
  assert.ok(at >= 0 && INDEX.indexOf('src="app.js') > at);
  assert.equal((SW.match(/'habit-two-minute-v1\.js'/g) || []).length, 1);
  assert.match(SW, /const CACHE = 'satoru-v242'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v242'/);
});

test('the exit sits in the habit row, in the person’s own words', () => {
  assert.match(APP, /function habitTwoMinuteButtonHTML\(h, done, streak, busy\)/);
  assert.match(APP, /\$\{habitTwoMinuteButtonHTML\(h, done, hs, busy\)\}<\/li>/, 'кнопка живёт в строке привычки');
  const at = APP.indexOf('function habitTwoMinuteButtonHTML');
  const body = APP.slice(at, APP.indexOf('\nfunction habitRow', at));
  assert.match(body, /T\.offerFor\(h, \{ done, streak \}\)/);
  assert.match(body, /if \(!offer\) return '';/, 'без модуля и без записанных слов ничего не рисуется');
  assert.match(body, /data-noi18n/, 'слова человека не переводятся');
  // отдельная строка под привычкой: сетка строки не меняется
  assert.match(CSS, /\.habit-two-min \{[^}]*grid-column: 1 \/ -1;/s);
});

test('the two-minute mark goes through the same idempotent completion', () => {
  assert.match(APP, /async function transactHabitCompletion\(h, \{ twoMinute = false \} = \{\}\)/);
  assert.match(APP, /twoMinute && T\n\s*\? T\.recordFor\(\{ xp: itemXp\(h\), gold: itemGold\(h\)/);
  const at = APP.indexOf("action === 'habit-two-minute'");
  const branch = APP.slice(at, APP.indexOf('\n  } else if', at));
  assert.match(branch, /!habitDone\(h, habitDayKey\(\)\)/, 'повторное нажатие не снимает уже сделанную привычку');
  assert.match(branch, /transactHabitCompletion\(h, \{ twoMinute: true \}\)/);
});

test('the habits screen is titled with the person’s own sentence when there is one', () => {
  const at = APP.indexOf('const heading = idg');
  assert.notEqual(at, -1);
  const body = APP.slice(at, APP.indexOf('return `<div class="card hb-intro">', at));
  assert.match(body, /hb-intro-identity" data-noi18n/);
  assert.match(body, /: esc\(t\('Строим привычки'\)\)/, 'родовой заголовок остаётся, пока фразы нет');
  assert.match(CSS, /\.hb-intro-identity \{/);
});

test('the new copy reaches every language', () => {
  for (const key of ['2 минуты', 'Сделать версию на две минуты', 'Кем ты становишься']) {
    const at = APP.indexOf(`'${key}':`);
    assert.notEqual(at, -1, key);
    const line = APP.slice(at, APP.indexOf('\n', at));
    for (const locale of ['en:', 'de:', 'uk:', 'es:']) assert.match(line, new RegExp(locale), `${key} · ${locale}`);
  }
});
