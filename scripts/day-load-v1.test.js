'use strict';
/* Нагрузка дня — замена выдуманной шкалы энергии.
 *
 * Главное, что тут стережётся: модуль отвечает «не знаю», когда сравнивать не с чем, и
 * НЕ подменяет незнание нулём. Старая шкала именно этим и врала — человек, не заходивший
 * неделю, получал уставшего аватара, потому что полоска не успела восстановиться.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../public/day-load-v1.js');
const F = require('../public/failure-context-v1.js');

test('обычный день — это медиана самого человека, а не константа', () => {
  // У двоих людей «обычный день» разный, и один и тот же объём для них значит разное.
  const busy = D.dayLoad({ done: 6, typical: 6 });
  const calm = D.dayLoad({ done: 6, typical: 2 });
  assert.equal(busy.state, 'normal', 'шесть дел при норме шесть — обычный день');
  assert.equal(calm.state, 'over', 'шесть дел при норме два — перебор');
});

test('«не знаю» вместо выдуманного нуля, пока наблюдений мало', () => {
  const unknown = D.dayLoad({ done: 3, typical: null });
  assert.equal(unknown.state, 'unknown');
  assert.equal(unknown.known, false);
  assert.equal(unknown.ratio, null);
  // 🔴 Главное: незнание НЕ равно «лёгкий день» и НЕ равно «устал».
  assert.equal(D.isTired(unknown), false);
  assert.equal(D.shouldSuggestStop(unknown), false);
});

test('усталость наступает от сделанного, а не от простоя', () => {
  // Это и был баг старой шкалы: не заходил неделю → полоска низкая → аватар «устал».
  const didNothing = D.dayLoad({ done: 0, typical: 4 });
  assert.equal(didNothing.state, 'light');
  assert.equal(D.isTired(didNothing), false, 'ничего не делал — значит не устал');

  const didALot = D.dayLoad({ done: 9, typical: 4 });
  assert.equal(D.isTired(didALot), true);
});

test('границы: обычный день колеблется, но не становится событием', () => {
  const typical = 10;
  // ±30% вокруг медианы — всё ещё обычный день, а не повод что-то говорить человеку.
  for (const done of [7, 10, 13]) {
    assert.equal(D.dayLoad({ done, typical }).state, 'normal', `${done} из ${typical} должно быть обычным`);
  }
  assert.equal(D.dayLoad({ done: 5, typical }).state, 'light');
  assert.equal(D.dayLoad({ done: 14, typical }).state, 'heavy');
  assert.equal(D.dayLoad({ done: 22, typical }).state, 'over');
  // Предложение остановиться — только на явном переборе.
  assert.equal(D.shouldSuggestStop(D.dayLoad({ done: 14, typical })), false);
  assert.equal(D.shouldSuggestStop(D.dayLoad({ done: 22, typical })), true);
});

test('стыкуется с тем же источником нормы, что и остальная арена', () => {
  // Второго расчёта «обычного дня» в проекте быть не должно: два модуля разошлись бы
  // в ответе про один и тот же день. Проверяем связку целиком.
  const history = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ date: `2026-08-0${n}`, doneCount: n <= 4 ? 3 : 5 }));
  const typical = F.typicalDone(history);
  assert.ok(typical > 0, 'медиана должна посчитаться на семи днях');
  const load = D.dayLoad({ done: typical, typical });
  assert.equal(load.state, 'normal');

  // Малая выборка: арена отказывается называть норму — значит и нагрузка «не знает».
  const tiny = F.typicalDone([{ doneCount: 3 }, { doneCount: 5 }]);
  assert.equal(tiny, null);
  assert.equal(D.dayLoad({ done: 4, typical: tiny }).state, 'unknown');
});

test('терпимость к мусору', () => {
  assert.equal(D.dayLoad(null).state, 'unknown');
  assert.equal(D.dayLoad({}).state, 'unknown');
  assert.equal(D.dayLoad({ done: -5, typical: 4 }).state, 'light');
  assert.equal(D.dayLoad({ done: 'три', typical: 4 }).state, 'light');
  assert.equal(D.dayLoad({ done: 4, typical: 0 }).state, 'unknown', 'нулевая норма — это отсутствие нормы');
  assert.equal(D.isTired(null), false);
});

test('модуль не знает ни про State, ни про DOM, ни про переводчик', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/day-load-v1.js'), 'utf8');
  for (const bad of ['State.', 'document.', 'fetch(', 'window.']) {
    assert.equal(src.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
});
