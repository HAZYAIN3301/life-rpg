'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const completionUi = fs.readFileSync(path.join(ROOT, 'public/board-v2-completion-ui.js'), 'utf8');

test('v176 loads completion presentation before runtime and caches it exactly once', () => {
  const completion = index.indexOf('board-v2-completion.js'), ui = index.indexOf('board-v2-completion-ui.js');
  const runtime = index.indexOf('board-v2-runtime.js'), appPos = index.indexOf('app.js?v=');
  assert.ok(completion >= 0 && completion < ui && ui < runtime && runtime < appPos);
  assert.equal((sw.match(/'board-v2-completion-ui\.js'/g) || []).length, 1);
  assert.match(sw, /const CACHE = 'satoru-v216';/);
  assert.match(index, /app\.js\?v=20260902-browser-protection-v215-1/);
});

test('Board completion opens a real form instead of attempting a null proof', () => {
  const doneStart = app.indexOf("} else if (action === 'board-done')");
  const doneEnd = app.indexOf("} else if (action === 'board-return')", doneStart);
  const done = app.slice(doneStart, doneEnd);
  assert.match(done, /boardV2CompletionStart\(id\)/);
  assert.doesNotMatch(done, /proof:\s*null|prepareBoardV2Action\('complete'/);
  assert.match(app, /id="board-v2-complete-form"/);
  assert.match(app, /Фото и ответы остаются в твоём аккаунте/);
  assert.match(completionUi, /Отдельное видеохранилище ещё не подключено/);
  assert.match(app, /const completedIds = new Set\(st\.done\.map\(\(entry\) => entry\.orderId\)\)/);
  assert.match(app, /!takenIds\.has\(order\.id\) && !completedIds\.has\(order\.id\)/);
});

test('private photo, settings and completion task share one atomic board commit', () => {
  const submitStart = app.indexOf("if (f.id === 'board-v2-complete-form')");
  const submitEnd = app.indexOf("if (f.id === 'board-wildcard-form')", submitStart);
  const submit = app.slice(submitStart, submitEnd);
  assert.ok(submit.indexOf('readAttachment(file)') < submit.indexOf("prepareBoardV2Action('complete'"));
  assert.ok(submit.indexOf("prepareBoardV2Action('complete'") < submit.indexOf('await commitBoardV2Transaction'));
  assert.match(submit, /boardMedia = \{ \.\.\.boardMediaAll\(\), \[snapshotId\]: \{ dataUrl: attachment\.dataUrl \} \}/);
  assert.doesNotMatch(submit, /Store\.saveNow\('boardmedia'/);
  assert.match(server, /\['settings', 'settings,tasks', 'boardmedia,settings,tasks'\]/);
  assert.match(server, /boardMediaCommitPayloadValid\(data\.boardmedia\)/);
});

test('Shadow answer uses the issued runtime transaction and no free text', () => {
  assert.match(app, /data-action="board-follow-up-answer"/);
  assert.match(app, /prepareBoardV2Action\('answer-follow-up', id, \{ outcome: el\.dataset\.outcome \}\)/);
  assert.doesNotMatch(app, /board-follow-up[\s\S]{0,1200}<textarea/);
});

test('Board titles are visible, ownership-checked and durably equipped', () => {
  assert.match(app, /\.\.\.fromTree, \.\.\.fromBoard/);
  assert.match(app, /if \(selected && !earnedTitles\(\)\.includes\(selected\)\) return/);
  assert.match(app, /async function boardV2EquipTitle\(title\)/);
  assert.match(app, /async function boardV2EquipTitle\(title\)[\s\S]{0,900}Store\.updateNow\('settings', \(current\)/);
  assert.match(app, /State\.settings\.equipped = committed\.equipped/);
  assert.match(app, /data-action="board-title-equip"/);
});

test('completion, receipt and follow-up controls satisfy responsive touch contracts', () => {
  assert.match(styles, /\.board-proof-choice[^}]*min-height:\s*var\(--touch-min\)/);
  assert.match(styles, /\.board-proof-actions \.btn,[\s\S]*min-height:\s*var\(--touch-min\)/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.board-proof-choices \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.board-screen :is\([^}]*textarea\):focus-visible/);
});
