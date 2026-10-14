'use strict';
// Ночная ветка 14.10: поиск по заметкам. Поле — с восьми заметок, фильтр на месте, без перерисовки.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public/styles.css'), 'utf8');

function load(state) {
  const code = APP.slice(APP.indexOf('function noteTitle(it) {'), APP.indexOf('\n}', APP.indexOf('function noteTitle(it) {')) + 2)
    + APP.slice(APP.indexOf('const NOTES_FILTER_MIN = 8;'), APP.indexOf('function applyNotesFilter() {'));
  const ctx = { State: state, t: (x) => x, esc: (x) => String(x) }; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx;
}
const notes = (n) => Array.from({ length: n }, (_, i) => ({ id: 'n' + i, kind: 'text', text: i === 3 ? 'Купить МОЛОКО и хлеб' : `Заметка номер ${i}` }));

test('поле появляется с восьми заметок; поиск без регистра; пустой запрос показывает всё', () => {
  const few = load({ inbox: notes(7), _notesFilter: 'молоко' });
  assert.equal(few.notesFilterHTML(notes(7)), '', 'семь заметок — поля нет');
  assert.equal(few.notesFilterQuery(notes(7)), '', 'и старый запрос не прячет карточки');
  const many = load({ inbox: notes(12), _notesFilter: '  молоко ' });
  const q = many.notesFilterQuery(notes(12)); assert.equal(q, 'молоко');
  assert.deepEqual(notes(12).filter((it) => many.noteMatchesFilter(it, q)).map((it) => it.id), ['n3']);
  assert.equal(many.notesFilterStatus(notes(12), q), 'Найдено заметок: 1');
  assert.equal(many.notesFilterStatus(notes(12), 'ничего такого'), 'Ничего не нашлось');
  assert.equal(many.noteMatchesFilter({ kind: 'voice', text: '' }, 'голосовая'), true, 'голосовая без текста находится по своему названию');
  assert.match(many.notesFilterHTML(notes(12)), /<label for="notes-filter">Найти в заметках<\/label><input id="notes-filter" type="search"/);
});

test('поиск подключён к вводу, карточки прячутся и CSS это уважает', () => {
  assert.match(APP, /function onSettingsInput\(e\) \{\n  if \(e\.target\.id === 'notes-filter'\) \{ State\._notesFilter = e\.target\.value; applyNotesFilter\(\); return; \}/);
  assert.match(APP, /notes\.map\(\(it\) => noteCard\(it, \{ hidden: !noteMatchesFilter\(it, notesFilterQuery\(notes\)\) \}\)\)/);
  assert.match(CSS, /\.notes-list > \.note-card\[hidden\] \{ display: none; \}/);
  const composition = fs.readFileSync(path.join(__dirname, '..', 'public/interface-composition-v1.js'), 'utf8');
  assert.match(composition, /region\(shell, 'notes-workspace', \[composer, q\('\.notes-filter'\), list\]\)/, 'поиск стоит между формой и списком');
  for (const key of ["'Найти в заметках':", "'Найдено заметок':"]) { const i = APP.indexOf(key); assert.ok(i > 0); const line = APP.slice(i, APP.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), key + l); }
});
