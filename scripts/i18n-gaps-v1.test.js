'use strict';
// Ночная ветка 14.10: проход по 21 экрану на немецком нашёл русский текст вне данных человека.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');

test('«Правила внимания» переведены на все языки', () => {
  const i = APP.indexOf("  'Правила внимания': {"); assert.ok(i > 0);
  const line = APP.slice(i, APP.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), l);
});

test('название личной награды без ключа каталога тоже переводится — и в подписи кнопки удаления', () => {
  assert.equal((APP.match(/\$\{esc\(t\(r\.catalogNameKey \|\| r\.name\)\)\}/g) || []).length, 2);
  assert.ok(!APP.includes('${esc(r.catalogNameKey ? t(r.catalogNameKey) : r.name)}'));
});
