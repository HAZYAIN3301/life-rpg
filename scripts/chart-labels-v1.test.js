'use strict';
/* Подписи столбцов не слипаются (fb_ms4m1ur2m1ip, он же давний
 * «накладывается текст друг на друга»). */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/chart-labels-v1.js');

// Реальный случай из репорта: viewBox 600, отступ 26, кегль 9 — как в barChartSVG.
const CHART = { width: 600, pad: 26, fontSize: 9 };
const DAYS = ['12.08', '13.08', '14.08', '15.08', '16.08', '17.08', '18.08'];
const SPHERES = ['Учёба', 'Здоровье', 'Восстановление', 'Отношения', 'Видео-студия', 'Jugend forscht', 'Немецкий', 'Наука'];

test('короткие подписи остаются горизонтальными', () => {
  const r = C.layout({ ...CHART, labels: DAYS });
  assert.equal(r.mode, 'horizontal');
  assert.equal(r.every, 1);
  assert.equal(r.angle, 0);
});

test('длинные имена сфер перестают быть горизонтальными', () => {
  // Ровно тот график, где текст слипался.
  const r = C.layout({ ...CHART, labels: SPHERES });
  assert.notEqual(r.mode, 'horizontal');
  assert.ok(r.angle < 0, 'подписи должны наклоняться');
});

test('🔴 имена сфер НИКОГДА не прореживаются молча', () => {
  // Существующий showEvery выбрасывает каждую вторую подпись. Для дат это
  // нормально, для имён — потеря данных: столбец есть, а чей он — неизвестно.
  const r = C.layout({ ...CHART, labels: SPHERES });
  assert.equal(r.every, 1, 'подпись сферы выброшена — человек не узнает столбец');
});

test('даты прореживать можно — пропуск восстанавливается по соседям', () => {
  const many = Array.from({ length: 60 }, (_, i) => `0${(i % 9) + 1}.08`);
  const thin = C.layout({ ...CHART, labels: many, thinnable: true });
  assert.ok(thin.every > 1, 'при 60 датах часть подписей должна уйти');
  const keep = C.layout({ ...CHART, labels: many });
  assert.equal(keep.every, 1, 'без явного разрешения прореживать нельзя');
});

test('очень тесный график доходит до обрезки, но не до пустоты', () => {
  const crowded = Array.from({ length: 26 }, () => 'Восстановление и отдых');
  const r = C.layout({ ...CHART, labels: crowded });
  assert.equal(r.mode, 'truncated');
  assert.ok(r.maxChars >= C.MIN_CHARS, 'обрезка не должна оставлять загадку вместо подписи');
  const short = C.clip('Восстановление и отдых', r.maxChars);
  assert.ok(short.length <= r.maxChars);
  assert.ok(short.endsWith('…'));
  assert.ok(short.startsWith('Вос'), 'начало имени обязано остаться узнаваемым');
});

test('clip не трогает то, что и так помещается', () => {
  assert.equal(C.clip('Учёба', 10), 'Учёба');
  assert.equal(C.clip('Учёба', 0), 'Учёба');
  assert.equal(C.clip(null, 5), '');
});

test('решение зависит от ширины слота, а не от числа столбцов самого по себе', () => {
  const four = ['Восстановление', 'Восстановление', 'Восстановление', 'Восстановление'];
  assert.equal(C.layout({ ...CHART, labels: four }).mode, 'horizontal', 'на четырёх столбцах места хватает');
  const twelve = Array.from({ length: 12 }, () => 'Восстановление');
  assert.notEqual(C.layout({ ...CHART, labels: twelve }).mode, 'horizontal');
});

test('пустой и мусорный вход не роняют расчёт', () => {
  assert.equal(C.layout({ ...CHART, labels: [] }).mode, 'horizontal');
  assert.equal(C.layout(null).mode, 'horizontal');
  assert.equal(C.layout({ labels: [null, undefined, 42] }).every, 1);
});

test('модуль ничего не измеряет в DOM', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/chart-labels-v1.js'), 'utf8');
  for (const bad of ['document', 'getBBox', 'getComputedStyle', 'canvas']) {
    assert.ok(!src.includes(bad), `модуль полез в DOM: «${bad}»`);
  }
});
