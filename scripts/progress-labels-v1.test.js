'use strict';
// Ночная ветка 20.10 (PROGRESS-METRICS.md пп. 2 и 5): числа Логова подписаны видимо — на телефоне
// подсказка title не видна; у «формы» на «Герое» есть пояснение. Экономика не меняется.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');

test('в Логове у «дела сегодня» и «серии» есть видимая подпись', () => {
  assert.match(APP, /\$\{p\.dayDone\}\/\$\{p\.dayTot \|\| 0\} <small class="den-stat-label">\$\{t\('дела'\)\}<\/small>/);
  assert.match(APP, /\$\{p\.streak\} <small class="den-stat-label">\$\{t\('дн\. подряд'\)\}<\/small>/);
  assert.match(CSS, /\.den-stat-label \{/);
});

test('у «формы» на «Герое» есть пояснение, что уровень не падает', () => {
  assert.match(APP, /<p class="character-form-hint">\$\{t\('Форма показывает, давно ли были дела в твоих сферах\. Уровень от неё не падает\.'\)\}<\/p>/);
  assert.match(CSS, /\.character-form-hint \{/);
});

test('новые подписи переведены на все языки', () => {
  for (const key of ["'дела':", "'дн. подряд':", "'Форма показывает, давно ли были дела в твоих сферах. Уровень от неё не падает.':"]) {
    const i = APP.indexOf('  ' + key); assert.ok(i > 0, key);
    const line = APP.slice(i, APP.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), key + l);
  }
});
