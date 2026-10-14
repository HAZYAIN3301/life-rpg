'use strict';
// Ночная ветка 14.10: «Заметка → Квест» больше не теряет текст длиннее 120 знаков и доступ к записи
// голоса/видео — такая заметка остаётся рядом с квестом; короткая текстовая уходит, как раньше.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');

function load() {
  const code = APP.slice(APP.indexOf('function noteKeptAfterQuest('), APP.indexOf('async function noteToQuest(id) {'));
  const ctx = { State: { tasks: [] } }; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx;
}

test('заметка остаётся, если квест не вмещает её текст или у неё есть запись', () => {
  const { noteKeptAfterQuest } = load();
  assert.equal(noteKeptAfterQuest({ text: 'Позвонить маме' }), false, 'короткая текстовая уходит, как раньше');
  assert.equal(noteKeptAfterQuest({ text: 'я'.repeat(120) }), false, 'ровно 120 знаков помещаются');
  assert.equal(noteKeptAfterQuest({ text: 'я'.repeat(121) }), true);
  assert.equal(noteKeptAfterQuest({ kind: 'voice', text: '', file: 'a.weba' }), true, 'запись голоса не теряет доступ');
  assert.equal(noteKeptAfterQuest(null), false);
});

test('у карточки с созданным квестом вместо «→ Квест» — отметка, повтор невозможен', () => {
  const ctx = load();
  ctx.State.tasks = [{ id: 't1', noteSourceId: 'n1' }];
  assert.equal(ctx.noteQuestTask('n1').id, 't1'); assert.equal(ctx.noteQuestTask('n2'), null);
  assert.match(APP, /\$\{noteQuestTask\(it\.id\) \? `<span class="note-quest-done muted">\$\{t\('✓ Квест создан'\)\}<\/span>` : `<button class="btn ghost sm" data-action="note-quest"/);
});

test('название обрезается с многоточием, заметка остаётся до попытки удалить её из списка', () => {
  const at = APP.indexOf('async function noteToQuest(id) {'); const body = APP.slice(at, APP.indexOf('\n}', at));
  assert.match(body, /const title = full\.length > 120 \? `\$\{full\.slice\(0, 119\)\}…` : full;/);
  const keep = body.indexOf('if (noteKeptAfterQuest(note))'), remove = body.indexOf('const savedInbox = await commitInbox(');
  assert.ok(keep > 0 && remove > keep, 'проверка «оставить» стоит до удаления заметки');
  for (const key of ["'→ В квестах на сегодня. Заметка осталась: в ней полный текст или запись.':", "'✓ Квест создан':"]) {
    const i = APP.indexOf(key); assert.ok(i > 0, key);
    const line = APP.slice(i, APP.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), key + l);
  }
});
