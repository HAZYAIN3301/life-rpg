'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

test('Profile edits are labelled, await the write, and retain the visible draft on failure', () => {
  assert.match(app, /class="card profile-memory-card" aria-labelledby="profile-title"/);
  assert.match(app, /id="profile-text"[\s\S]{0,280}aria-label="\$\{t\('Текст профиля'\)\}"/);
  assert.match(app, /async function saveProfileCard\(\)[\s\S]{0,1000}await Store\.saveNow\('profile', next\)/);
  assert.match(app, /if \(!saved\) \{[\s\S]{0,700}Изменения профиля не сохранены\. Текст остался здесь — повтори попытку\./);
  assert.match(app, /ta\.focus\(\)/);
});

test('AI profile refresh does not claim success before profile persistence', () => {
  assert.match(app, /const visibleDraft = document\.getElementById\('profile-text'\);/);
  assert.match(app, /body: JSON\.stringify\(\{ provider: aiProvider\(\), system, prompt: mem\.buildPrompt\(profileFacts\(\), prof\.text, mem\.MAX_CHARS\) \}\)/);
  assert.match(app, /const saved = await Store\.saveNow\('profile', next\);/);
  assert.match(app, /if \(!saved\) \{[\s\S]{0,380}State\._profileSaveError/);
  assert.match(app, /State\.profile = next; State\._profileSaveError = '';/);
});

test('Body edits are transactional, failure-safe and focus-returned', () => {
  assert.match(app, /if \(f\.id === 'body-form'\) \{[\s\S]{0,1800}const saved = await Store\.updateNow\('settings', \(current\)/);
  assert.match(app, /State\.settings\.body = committed\.body/);
  assert.match(app, /if \(!saved\) \{[\s\S]{0,700}Изменения телосложения не сохранены\. Значения остались в форме — повтори попытку\./);
  assert.match(app, /State\._characterFocusAfterCommit = '#body-form button\[type="submit"\]';/);
  assert.match(app, /character-body-save-status" role="status" aria-live="polite"/);
});

test('Secondary Character panels keep a single disclosed panel and current offline shell', () => {
  assert.match(app, /character-secondary-panel\[open\]/);
  assert.match(app, /State\._characterSecondaryOpen = id;/);
  assert.match(app, /character-secondary-panel > summary/);
  assert.match(css, /character-secondary-panel > summary \{ display: flex; min-height: 54px;/);
  assert.match(sw, /const CACHE = 'satoru-v232'/);
});

test('Profile and body failure copy has every supported locale', () => {
  for (const key of ['Текст профиля', 'Изменения профиля не сохранены. Текст остался здесь — повтори попытку.', 'Изменения телосложения не сохранены. Значения остались в форме — повтори попытку.', 'Телосложение обновлено', 'Не удалось обновить профиль. Ничего не изменено — повтори попытку.']) {
    assert.match(app, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:\\s*\\{ en:[\\s\\S]{0,700}de:[\\s\\S]{0,700}uk:[\\s\\S]{0,700}es:`));
  }
});
