'use strict';
// Ночная ветка 14.10: проход по 21 экрану на немецком нашёл русский текст вне данных человека.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');

test('«Правила внимания» переведены на все языки', () => {
  const i = APP.indexOf("  'Правила внимания': {"); assert.ok(i > 0);
  const line = APP.slice(i, APP.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), l);
});

test('название личной награды без ключа каталога тоже переводится — и в подписи кнопки удаления', () => {
  assert.equal((APP.match(/\$\{esc\(t\(r\.catalogNameKey \|\| r\.name\)\)\}/g) || []).length, 2);
  assert.ok(!APP.includes('${esc(r.catalogNameKey ? t(r.catalogNameKey) : r.name)}'));
});

test('выбор облика питомца не обрезает «Автоматически»: ширина по содержимому', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');
  assert.match(css, /\.pet-species-picker select \{ min-width: 0; width: auto; max-width: 62%;/);
});

test('таблицы переводов целые: каждое значение — строка, каждый ключ есть во всех языках', () => {
  // Страховка от ошибки 21.10: запись вида { en: … } в строковой таблице I18N_EN дала бы «[object Object]».
  const start = APP.indexOf('const I18N_EN = {');
  const end = APP.indexOf('\n', APP.indexOf('for (const ru in I18N_EXTRA)'));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(APP.slice(start, end) + '\n;this.__I = I18N;', ctx);
  const tables = ctx.__I; const keys = new Set(Object.values(tables).flatMap((d) => Object.keys(d)));
  for (const [lang, dict] of Object.entries(tables)) for (const [key, value] of Object.entries(dict)) assert.equal(typeof value, 'string', `${lang}: «${key.slice(0, 40)}»`);
  for (const key of keys) for (const lang of ['en', 'de', 'uk', 'es']) assert.ok(Object.prototype.hasOwnProperty.call(tables[lang], key), `${lang} нет «${key.slice(0, 40)}»`);
});
