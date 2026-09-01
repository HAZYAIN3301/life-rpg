'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const EXTENSION = join(ROOT, 'extensions', 'satoru-attention');
const options = readFileSync(join(EXTENSION, 'options.js'), 'utf8');
const html = readFileSync(join(EXTENSION, 'options.html'), 'utf8');
const i18n = readFileSync(join(EXTENSION, 'i18n.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(EXTENSION, 'manifest.json'), 'utf8'));

test('v0.5.4 cannot present selected protection rules as active while the master switch is off', () => {
  assert.equal(manifest.version, '0.5.4');
  assert.match(html, /id="protection-inactive-warning"/);
  assert.match(html, /id="activate-protection"/);
  assert.match(options, /configuredProtectionCount/);
  assert.match(options, /protectionDraft/);
  assert.match(i18n, /Правила выбраны, но защита выключена/);
});

test('a category or strict-filter change turns protection on and applies from the same gesture', () => {
  const change = options.slice(options.indexOf("protectionForm.addEventListener('change'"), options.indexOf("activateProtection.addEventListener"));
  assert.match(change, /target\.matches\('\[data-category\]'\)/);
  assert.match(change, /target === safeSearch/);
  assert.match(change, /target === youtubeRestricted/);
  assert.match(change, /target === blockBypass/);
  assert.match(change, /protectionEnabled\.checked = true/);
  assert.match(change, /queueProtectionSave\(\)/);
});

test('v215 packages retain autosave, one-click activation and broad optional permission declarations', () => {
  for (const engine of ['chromium', 'firefox', 'safari']) {
    const zip = join(ROOT, 'public', 'downloads', `satoru-attention-${engine}-v215.zip`);
    const zippedManifest = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
    const zippedOptions = execFileSync('unzip', ['-p', zip, 'options.js'], { encoding: 'utf8' });
    const zippedHtml = execFileSync('unzip', ['-p', zip, 'options.html'], { encoding: 'utf8' });
    assert.equal(zippedManifest.version, '0.5.4', engine);
    assert.deepEqual(zippedManifest.optional_host_permissions, ['http://*/*', 'https://*/*'], engine);
    assert.match(zippedOptions, /queueProtectionSave\(\)/, engine);
    assert.match(zippedHtml, /id="activate-protection"/, engine);
  }
});
