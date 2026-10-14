'use strict';
// Ночная ветка 14.10: копии повторяющегося дела в «Незавершённых» сворачиваются под одну строку.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');

test('копии одного дела группируются, свежая — первой; разные сферы не смешиваются', () => {
  const code = APP.slice(APP.indexOf('function overdueCopyKey('), APP.indexOf('function questRow(q, links) {'));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
  const groups = ctx.groupOverdueCopies([
    { id: 'a1', title: 'Ответить на письма', skillId: 'work', date: '2026-10-10' },
    { id: 'b', title: 'Постирать', skillId: 'home', date: '2026-10-11' },
    { id: 'a2', title: 'ответить на письма ', skillId: 'work', date: '2026-10-12' },
    { id: 'c', title: 'Ответить на письма', skillId: 'study', date: '2026-10-12' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(groups.map((g) => g.map((x) => x.id)))), [['b'], ['a2', 'a1'], ['c']], 'группа стоит на месте свежей копии');
});

test('ключ копии учитывает все сферы, а не только первую', () => {
  const code = APP.slice(APP.indexOf('function overdueCopyKey('), APP.indexOf('function questRow(q, links) {'));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
  const groups = ctx.groupOverdueCopies([
    { id: 'x1', title: 'Позвонить', skillIds: ['work', 'family'], date: '2026-10-10' },
    { id: 'x2', title: 'Позвонить', skillIds: ['work'], date: '2026-10-11' },
    { id: 'x3', title: 'Позвонить', skillIds: ['family', 'work'], date: '2026-10-12' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(groups.map((g) => g.map((x) => x.id)))), [['x2'], ['x3', 'x1']]);
});

test('раскрытый список копий переживает перерисовку и открывается под шаг гида', () => {
  assert.match(APP, /data-overdue-copies="\$\{esc\(overdueCopyKey\(list\[0\]\)\)\}"/);
  assert.match(APP, /State\._overdueCopiesOpen\?\.has\(overdueCopyKey\(list\[0\]\)\) \|\| list\.slice\(1\)\.some\(\(task\) => guideV3TaskTarget\(task\.id\)\)/);
  const at = APP.indexOf('function render() {');
  const body = APP.slice(at, APP.indexOf('syncDeviceAccount();', at));
  assert.match(body, /State\._overdueCopiesOpen = new Set\(/, 'render() запоминает раскрытые списки до перерисовки');
});

test('в «Незавершённых» видна свежая копия, остальные — под строкой с числом; кнопки у копий остаются', () => {
  assert.match(APP, /groupOverdueCopies\(overdue\)\.map\(\(list\) => questRow\(list\[0\], questGoalLinks\)/);
  assert.match(APP, /list\.slice\(1\)\.map\(\(task\) => questRow\(task, questGoalLinks\)\)/, 'копии рисуются той же строкой квеста — со всеми действиями');
  const at = APP.indexOf("  'Ещё копии этого дела за прошлые дни':"); assert.ok(at > 0);
  const line = APP.slice(at, APP.indexOf('\n', at)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), l);
  assert.match(APP, /\$\{t\('Незавершённые дела'\)\} · \$\{overdue\.length\}/, 'счётчик по-прежнему считает все дела');
});
