const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const app=read('public/app.js'),css=read('public/design-next-v1.css'),index=read('public/index.html'),sw=read('public/sw.js');

test('redesign ships together with its local font and preserves the old UI entry',()=>{
 assert.match(index,/design-next-v1\.css\?v=20260909-design-v251-1/);
 assert.match(sw,/'design-next-v1\.css'/);
 assert.match(sw,/'fonts\/russo-one\/RussoOne\.ttf'/);
 assert.match(css,/\[data-theme=light\]/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(app,/href="\/compare\.html"/);
 assert.match(app,/dataset\.design = 'next'/);
 assert.match(index,/<html[^>]+data-design="next"/,'guest/login uses the same design before State is loaded');
});
test('draft retention stays inside the existing form and durable save path',()=>{
 const commit=app.slice(app.indexOf('function commitMainView('),app.indexOf('function renderMainView('));
 assert.match(commit,/_renderedMainView === view/);
 assert.match(commit,/oldComposer\.dataset\.persisted !== 'true'/);
 assert.match(commit,/newComposer\.replaceWith\(oldComposer\)/);
 assert.match(commit,/draftFocus\.setSelectionRange/);
 assert.doesNotMatch(commit,/Store\.save|localStorage|fetch\(/);
 const submit=app.slice(app.indexOf("if (f.id === 'add-task')"),app.indexOf("if (f.id === 'add-habit'"));
 assert.match(submit,/await Store\.saveNow\('tasks', State\.tasks\)/);
 assert.match(submit,/f\.dataset\.persisted = 'true'/);
});
test('work, time, voice, notes and completion stay visible without duplicated Day navigation',()=>{
 assert.match(app,/class="task-schedule" data-action="cal-edit-task"/);
 assert.match(app,/day-recap-direct.*data-action="day-recap"/);
 assert.match(app,/today-notes-link.*data-view="notes".*notes-nav/);
 assert.match(app,/subs && State\.view !== 'today'/);
 assert.match(app,/role="dialog" aria-modal="true" aria-labelledby="dayrec-heading"/);
 assert.match(css,/\.task\.habit\{grid-template-columns:44px minmax\(0,1fr\) auto/);
});
