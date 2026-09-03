'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

test('Pets v130 gives the route a heading and semantic interactive companions', () => {
  assert.match(app, /<section class="pets-shell"[^>]*aria-labelledby="pets-title">/);
  assert.match(app, /<h2 id="pets-title" tabindex="-1">/);
  assert.match(app, /<button type="button" class="pet-art pet-art-action" data-action="\$\{artAction\}"/);
  assert.match(app, /<button type="button" class="pet-sphere pet-hint muted" data-action="pet-hint"/);
  assert.match(app, /aria-label="\$\{t\('Погладить питомца'\)\}/);
});

test('Pets rename is awaited and failure preserves the unsaved form state', () => {
  assert.match(app, /pet-rename-form[\s\S]{0,700}const saved = await Store\.updateNow\('settings', \(current\)/);
  assert.match(app, /State\.settings\.petNames = committed\.petNames/);
  assert.match(app, /if \(!saved\) \{[\s\S]{0,420}State\._petRenameError = 'Не удалось сохранить\. Ничего не изменено — повтори попытку\.'/);
  assert.doesNotMatch(app, /pet-rename-form[\s\S]{0,1200}State\.settings = next;/);
  assert.match(app, /State\._petsFocusAfterCommit/);
});

test('Pets has localized labels and mobile/coarse operability', () => {
  for (const key of ['Что засчитывается в сферу', 'Погладить питомца', 'Имя питомца', 'Черты питомца', 'Побыть рядом с Кацую']) {
    assert.match(app, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:\\s*\\{ en:`));
  }
  assert.match(css, /Pets v130: one semantic route surface/);
  assert.match(css, /@media \(max-width: 600px\), \(pointer: coarse\)[\s\S]{0,900}\.pet-edit \{ min-width: var\(--touch-min\); min-height: var\(--touch-min\);/);
  assert.match(css, /\.pet-hint \{ min-height: var\(--touch-min\);/);
  assert.match(css, /\.pets-shell \.tts-btn \{ min-width: var\(--touch-min\); min-height: var\(--touch-min\);/);
});

test('Pets ships with the v138 offline shell', () => {
  assert.match(sw, /const CACHE = 'satoru-v242'/);
});
