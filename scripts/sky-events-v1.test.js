'use strict';
/* Небесные события: проверяем ФАКТЫ, а не то, что функция что-то вернула.
 *
 * Смысл модуля в том, что его можно проверить — в отличие от «ИИ подскажет концерт».
 * Поэтому тест сверяется с независимо известными величинами: реальным закатом в Дрездене,
 * реальными датами полнолуний, реальной датой пика Персеид. Если формулы поедут, тест
 * упадёт на конкретном числе, а не на «структура не та».
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/sky-events-v1.js');

const DRESDEN = { lat: 51.05, lon: 13.74 };   // где живёт Альберт
const SYDNEY = { lat: -33.87, lon: 151.21 };

test('фаза луны совпадает с реальными новолуниями и полнолуниями', () => {
  // Независимо известные даты (астрономические эфемериды), допуск — сутки.
  const newMoons = ['2026-01-18', '2026-08-12', '2026-12-09'];
  for (const day of newMoons) {
    assert.ok(S.moonPhase(day).illumination < 0.06, `${day}: ожидали новолуние, освещённость ${S.moonPhase(day).illumination}`);
  }
  const fullMoons = ['2026-01-03', '2026-08-28'];
  for (const day of fullMoons) {
    assert.ok(S.moonPhase(day).illumination > 0.94, `${day}: ожидали полнолуние, освещённость ${S.moonPhase(day).illumination}`);
  }
  // Цикл замкнут: через синодический месяц фаза почти та же.
  const a = S.moonPhase('2026-03-01').illumination;
  const b = S.moonPhase('2026-03-31').illumination; // +30 суток ≈ +1 синодический месяц
  assert.ok(Math.abs(a - b) < 0.12, `фаза не вернулась через месяц: ${a} vs ${b}`);
});

test('закат в Дрездене сходится с реальным временем года', () => {
  // Дрезден, UTC. Летом закат около 18:30–18:40 UTC (20:30+ CEST), зимой около 15:10 UTC.
  const summer = S.sunTimes('2026-06-21', DRESDEN.lat, DRESDEN.lon);
  assert.ok(Math.abs(summer.sunset - (19 * 60 + 0)) < 25, `летний закат ${S.hhmm(summer.sunset)} UTC не похож на правду`);
  const winter = S.sunTimes('2026-12-21', DRESDEN.lat, DRESDEN.lon);
  assert.ok(Math.abs(winter.sunset - (15 * 60 + 0)) < 25, `зимний закат ${S.hhmm(winter.sunset)} UTC не похож на правду`);
  // День длиннее ночи летом и короче зимой — базовая проверка знака.
  assert.ok(summer.sunset - summer.sunrise > 15 * 60, 'летний день короче 15 часов — формула перевёрнута');
  assert.ok(winter.sunset - winter.sunrise < 9 * 60, 'зимний день длиннее 9 часов — формула перевёрнута');
});

test('в белые ночи астрономической темноты не наступает и это видно в ответе', () => {
  // Санкт-Петербург в июне: солнце не опускается на 18° под горизонт вовсе.
  const spb = S.sunTimes('2026-06-21', 59.94, 30.31);
  assert.equal(spb.darkStart, null, 'в белые ночи не может быть «неба темнее 18°»');
  assert.notEqual(spb.sunset, null, 'но заход солнца там есть');
  // Мурманск в декабре — полярная ночь: солнце не восходит.
  const polar = S.sunTimes('2026-12-21', 68.97, 33.08);
  assert.equal(polar.polar, true);
  assert.equal(polar.sunset, null);
});

test('Персеиды 12 августа — пик, и полушарие учитывается', () => {
  const peak = S.showersOn('2026-08-12', DRESDEN.lat);
  const perseids = peak.find((x) => x.id === 'perseids');
  assert.ok(perseids, 'Персеиды 12 августа обязаны быть активны');
  assert.equal(perseids.isPeak, true);
  // За пределами окна поток молчит — иначе он был бы «всегда», то есть бесполезен.
  assert.equal(S.showersOn('2026-09-05', DRESDEN.lat).some((x) => x.id === 'perseids'), false);
  // Северный поток не обещаем южному полушарию.
  assert.equal(S.showersOn('2026-08-12', SYDNEY.lat).some((x) => x.id === 'perseids'), false);
  // И наоборот: Эта-Аквариды — южные.
  assert.equal(S.showersOn('2026-05-06', SYDNEY.lat).some((x) => x.id === 'eta-aquariids'), true);
  assert.equal(S.showersOn('2026-05-06', DRESDEN.lat).some((x) => x.id === 'eta-aquariids'), false);
});

test('пик через границу года не теряется', () => {
  // Квадрантиды 3 января: окно ±2 суток заходит в прошлый год, и наивная разница дат
  // дала бы 362 суток вместо −2.
  assert.equal(S.showersOn('2026-01-02', DRESDEN.lat).some((x) => x.id === 'quadrantids'), true);
  assert.equal(S.showersOn('2026-12-31', DRESDEN.lat).some((x) => x.id === 'quadrantids'), false);
  assert.equal(S.showersOn('2026-12-22', DRESDEN.lat).some((x) => x.id === 'ursids'), true);
});

test('луна портит поток — и модуль об этом говорит, а не молчит', () => {
  // Геминиды 2026-12-14 при яркой луне: обещать «120 метеоров в час» было бы обманом.
  const events = S.skyEvents({ ...DRESDEN, from: '2026-12-14', days: 1 });
  const gem = events.find((e) => e.id.includes('geminids'));
  assert.ok(gem, 'Геминиды 14 декабря должны быть в списке');
  const moon = S.moonPhase('2026-12-14');
  if (moon.illumination > 0.7) {
    assert.equal(gem.washedOut, true);
    assert.equal(gem.quality, 'мешает луна');
  } else {
    assert.equal(gem.washedOut, false);
  }
  // Персеиды-2026 попадают на новолуние — условия обязаны быть названы отличными.
  const aug = S.skyEvents({ ...DRESDEN, from: '2026-08-12', days: 1 }).find((e) => e.id.includes('perseids'));
  assert.equal(aug.quality, 'отличные');
  assert.equal(aug.washedOut, false);
});

test('одно и то же событие не дублируется день за днём', () => {
  // Полнолуние длится больше суток по фазе, но повод выйти — один, а не четыре подряд.
  const events = S.skyEvents({ ...DRESDEN, from: '2026-08-20', days: 20 });
  const fullMoons = events.filter((e) => e.kind === 'moon');
  const days = new Set(fullMoons.map((e) => e.day));
  assert.equal(fullMoons.length, days.size, 'полнолуние продублировалось в один день');
  assert.ok(fullMoons.length <= 1, `за 20 дней не может быть ${fullMoons.length} полнолуний`);
});

test('детерминированность и стойкость к мусору', () => {
  const a = JSON.stringify(S.skyEvents({ ...DRESDEN, from: '2026-08-10', days: 7 }));
  const b = JSON.stringify(S.skyEvents({ ...DRESDEN, from: '2026-08-10', days: 7 }));
  assert.equal(a, b, 'один и тот же запрос дал разные ответы');
  assert.deepEqual(S.skyEvents(null), []);
  assert.deepEqual(S.skyEvents({ from: 'вчера' }), []);
  assert.equal(S.moonPhase('не дата'), null);
  assert.equal(S.sunTimes('не дата', 0, 0), null);
  assert.deepEqual(S.showersOn('не дата', 0), []);
  // Кривые координаты не роняют расчёт.
  assert.ok(S.sunTimes('2026-08-12', 999, 999));
  assert.equal(S.hhmm(null), null);
  assert.equal(S.hhmm(21 * 60 + 3), '21:03');
});

test('модуль ничего не знает про ИИ, сеть и приложение', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/sky-events-v1.js'), 'utf8');
  // Ровно то решение, ради которого модуль и написан: небо считается, а не выдумывается.
  for (const bad of ['fetch(', 'XMLHttpRequest', '/api/', 'openai', 'State.', 'document.']) {
    assert.equal(src.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
  assert.equal(/\bt\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')), false, 'модуль зовёт переводчик');
});

test('доска берёт небо снимком, иначе взятое событие протухнет к утру', () => {
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/app.js'), 'utf8');
  // boardSkyOrders() считает от СЕГОДНЯШНЕЙ даты, поэтому завтра вчерашнего события в
  // списке уже нет. Если не сохранить снимок при взятии, у активного заказа утром
  // пропадёт заголовок и закрыть его станет нечем.
  assert.match(app, /if \(o\.sky && !boardCustomOrders\(\)\.some\(\(c\) => c\.id === o\.id\)\)/);
  assert.match(app, /next\.custom = boardCustomOrders\(\)\.concat\(\[\{ \.\.\.o, takenSnapshot: true \}\]\)/);
  // Снимок ищется РАНЬШЕ вычисляемого списка — иначе он бы им и перекрывался.
  const byId = app.slice(app.indexOf('function boardOrderById'), app.indexOf('function boardOrderTitle'));
  assert.ok(byId.indexOf('boardCustomOrders()') < byId.indexOf('boardSkyOrders()'), 'снимок обязан искаться первым');
  // Координаты округляются: точный адрес хранить незачем.
  assert.match(app, /Math\.round\(pos\.coords\.latitude \* 10\) \/ 10/);
  // Геолокация просится только по явному нажатию, а не на старте.
  assert.match(app, /action === 'board-place-geo'/);
  assert.doesNotMatch(app.slice(0, app.indexOf('function onClick')), /navigator\.geolocation\.getCurrentPosition/);
});
