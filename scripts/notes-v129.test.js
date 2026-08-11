'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

test('Notes v129 distinguishes failed loads from a genuine empty inbox', () => {
  assert.match(app, /function validateInboxPayload\(value\)/);
  assert.match(app, /Store\.loadChecked\('inbox', \[\], validateInboxPayload\)/);
  assert.match(app, /State\._inboxLoadError = inboxLoad\.error/);
  assert.match(app, /notesRecoveryCard\(\)/);
  assert.match(app, /if \(State\._inboxLoadError\) return notesRecoveryCard\(\)/);
  assert.match(app, /function inboxWriteAllowed/);
});

test('Notes writes are awaited, focus-safe, and retryable without false success', () => {
  assert.match(app, /async function commitInbox\(next\)/);
  assert.match(app, /await Store\.saveNow\('inbox', next\)/);
  assert.match(app, /const saved = await commitInbox\(\[item, \.\.\.\(State\.inbox \|\| \[\]\)\]\)/);
  assert.match(app, /Не удалось сохранить заметку\. Ничего не изменено/);
  assert.match(app, /State\._inboxFocusAfterCommit = `#note-\$\{CSS\.escape\(item\.id\)\}-title`/);
  assert.match(app, /maxlength="1000"/);
});

test('Notes deletion and task conversion preserve data boundaries', () => {
  assert.match(app, /function openNoteDeleteDialog/);
  assert.match(app, /role="dialog" aria-modal="true" aria-labelledby="note-delete-title"/);
  assert.match(app, /handleNoteDeleteDialogKeydown/);
  assert.match(app, /async function noteToQuest\(id\)/);
  assert.match(app, /noteSourceId: id/);
  assert.match(app, /find\(\(item\) => item\.noteSourceId === id\)/);
  assert.match(app, /const savedInbox = await commitInbox/);
});

test('Notes has a labelled mobile-first surface and v129 offline upgrade', () => {
  assert.match(app, /<section class="notes-screen" aria-labelledby="notes-title">/);
  assert.match(app, /<label class="sr-only" for="capture-text">/);
  assert.match(css, /Notes v129 — quiet capture/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]{0,1500}\.cap-row/);
  assert.match(css, /\.note-delete-box \{[\s\S]{0,260}var\(--measure-dialog/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,220}\.notes-screen/);
  // Пин версии кэша живёт в самом свежем тесте — обновляет его тот, кто бампает.
  // Каждый новый модуль в SHELL требует бампа, иначе офлайн-клиенты его не получат:
  // v130 — stuck-task-v1.js, v131 — «Первая строка назавтра», v132 — fights-v1.js,
  // v133 — доска контрактов, v134 — Pets, v135 — честный Stats surface.
  assert.match(sw, /const CACHE = 'satoru-v143'/);
});
