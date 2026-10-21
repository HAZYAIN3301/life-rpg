'use strict';
// Ночная ветка 21.10 (проверка окон): редактор облика Fortune Cat держал фокус снаружи, не закрывался
// по Esc и показывал «ПРИМЕРОЧНАЯ», «Сохраняется сразу», «Окрас», «Занятие» по-русски на всех языках.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');

test('окно монтируется общим помощником, вкладки меняют только содержимое, Esc и «Готово» — одно закрытие', () => {
  const at = APP.indexOf('function showFortuneEditor('); const body = APP.slice(at, APP.indexOf('\nfunction closeFortuneEditor()', at));
  assert.match(body, /mountAccountDialog\(next, \{ initial: '#fortune-editor-title', dismissible: false \}\)/);
  assert.match(body, /existing\.replaceChildren\(\.\.\.next\.childNodes\)/, 'вкладка не перемонтирует окно');
  assert.match(body, /if \(event\.key !== 'Escape'\) return;[\s\S]*closeFortuneEditor\(\);/);
  assert.match(APP, /if \(action === 'close-fortune-editor'\) \{ closeFortuneEditor\(\); return; \}/);
  const close = APP.slice(APP.indexOf('function closeFortuneEditor()'), APP.indexOf('function closeFortuneEditor()') + 600);
  assert.match(close, /closeAccountDialog\('fortune-editor', \{ restoreFocus: false \}\);\n  render\(\);/);
  assert.match(close, /\[data-action="open-fortune-editor"\]\[data-id="\$\{CSS\.escape\(sphereId\)\}"\]/, 'фокус возвращается к кнопке питомца');
  assert.match(APP, /<h2 id="fortune-editor-title" tabindex="-1">/);
});

test('строки редактора переводятся на все языки', () => {
  assert.match(APP, /<span class="fortune-editor-kicker">Fortune Cat · \$\{t\('Примерочная'\)\}<\/span>/);
  assert.equal(APP.includes('FORTUNE CAT · ПРИМЕРОЧНАЯ'), false);
  for (const key of ["'Примерочная':", "'Сохраняется сразу':", "'Окрас':", "'Занятие':", "'Категории внешности':"]) {
    const i = APP.indexOf('  ' + key); assert.ok(i > 0, key);
    const line = APP.slice(i, APP.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), key + l);
  }
  assert.match(CSS, /\.fortune-editor-tab \{ font-size: 12px; hyphens: auto; overflow-wrap: anywhere; \}/);
});
