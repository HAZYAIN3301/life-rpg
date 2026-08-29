'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const I18n = require('./i18n.js');

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const worker = read('service-worker.js');
const options = read('options.js');
const gate = read('gate.js');
const gateHtml = read('gate.html');
const optionsHtml = read('options.html');
const popupHtml = read('popup.html');
const bridge = read('bridge.js');
const guard = read('site-guard.js');
const styles = read('styles.css');

test('Manifest V3 uses minimal permanent permissions and an exact production bridge host', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.host_permissions, ['https://life-rpg-production-416a.up.railway.app/*']);
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*']);
  for (const forbidden of ['tabs', 'history', 'cookies', 'identity', 'nativeMessaging', 'downloads', 'clipboardRead', 'clipboardWrite']) {
    assert.equal(manifest.permissions.includes(forbidden), false, forbidden);
  }
  assert.equal('externally_connectable' in manifest, false);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://life-rpg-production-416a.up.railway.app/*']);
  assert.equal(manifest.content_scripts.length, 1);
  assert.equal(manifest.permissions.includes('webNavigation'), false);
});

test('optional site permission request is narrowed to Core.hostPatterns of the chosen host', () => {
  assert.match(options, /const origins = Core\.hostPatterns\(hostname\);[\s\S]*chrome\.permissions\.request\(\{ origins \}\);/);
  assert.doesNotMatch(options, /permissions\.request\([^)]*<all_urls>/s);
  assert.doesNotMatch(options, /permissions\.request\([^)]*https:\/\/\*\/\*/s);
  assert.doesNotMatch(options, /\*:\/\/\*\./);
});

test('state mutations roll back or report an explicit committed recovery state', () => {
  assert.match(worker, /async function commitWithEnforcement/);
  assert.match(worker, /const restored = await saveState\(previousState\)/);
  assert.match(worker, /error: 'enforcement_failed', committed: false, retryable: true/);
  assert.match(worker, /error: 'enforcement_recovery', committed: true, retryable: true/);
  assert.match(worker, /scheduleRecovery\(\)/);
});

test('service worker has no network, account, destructive or reward command surface', () => {
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', "type === 'DELETE", "type === 'ACCOUNT", "type === 'ADMIN", "type === 'REWARD"] ) {
    assert.equal(worker.includes(forbidden), false, forbidden);
  }
  assert.match(worker, /chrome\.storage\.local/);
  assert.match(worker, /chrome\.declarativeNetRequest\.updateDynamicRules/);
});

test('clock observation is persisted on the serialized document-start guard path', () => {
  const siteStart = worker.indexOf('async function handleSiteMessage');
  const siteEnd = worker.indexOf('chrome.runtime.onMessage.addListener');
  const siteBlock = worker.slice(siteStart, siteEnd);
  assert.match(siteBlock, /return serialized\(async \(\) =>/);
  assert.match(siteBlock, /observeClockState\(at\)/);
  assert.doesNotMatch(worker, /chrome\.webNavigation/);
  assert.match(worker, /CLOCK_OBSERVE_INTERVAL_MS = 30_000/);
});

test('active tabs have three enforcement layers and no durable attempted URL', () => {
  assert.match(worker, /chrome\.tabs\.query\(\{\}\)/);
  assert.match(worker, /chrome\.tabs\.update\(tab\.id, \{ url: gateUrl/);
  assert.match(worker, /const attemptsByTab = new Map\(\)/);
  assert.doesNotMatch(worker, /saveState\([^)]*attemptsByTab/s);
  assert.match(guard, /CHECK_INTERVAL_MS = 15_000/);
  assert.match(guard, /visibilitychange/);
  assert.match(guard, /location\.replace/);
});

test('bridge schema is exact-origin, read-only and bounded', () => {
  assert.match(bridge, /const ORIGIN = 'https:\/\/life-rpg-production-416a\.up\.railway\.app'/);
  assert.match(bridge, /event\.source !== window \|\| event\.origin !== ORIGIN/);
  assert.match(bridge, /SATORU_ATTENTION_EXTENSION_READY/);
  assert.match(bridge, /SATORU_ATTENTION_STATUS_REQUEST/);
  assert.match(bridge, /SATORU_ATTENTION_STATUS_RESPONSE/);
  assert.match(bridge, /SATORU_ATTENTION_OPEN_OPTIONS_RESULT/);
  assert.match(bridge, /value\.length <= 64/);
  for (const privateField of ['policies', 'purpose', 'expectedOutcome', 'hostname', 'episodes']) {
    assert.equal(bridge.includes(privateField), false, privateField);
  }
});

test('all five runtime locale tables are complete and every visible i18n key exists', () => {
  const baseKeys = Object.keys(I18n.TABLES.en).sort();
  for (const locale of ['ru', 'en', 'de', 'uk', 'es']) {
    assert.deepEqual(Object.keys(I18n.TABLES[locale]).sort(), baseKeys, locale);
    const native = JSON.parse(read(`_locales/${locale}/messages.json`));
    assert.equal(typeof native.extensionName.message, 'string');
    assert.equal(typeof native.extensionDescription.message, 'string');
  }
  for (const html of [gateHtml, optionsHtml, popupHtml]) {
    for (const match of html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)) {
      assert.ok(Object.prototype.hasOwnProperty.call(I18n.TABLES.en, match[1]), match[1]);
    }
  }
});

test('gate accessibility includes programmatic focus, localized group name and action mutex', () => {
  const headings = [...gateHtml.matchAll(/<h1[^>]*>/g)].map((match) => match[0]);
  assert.ok(headings.length >= 4);
  headings.forEach((heading) => assert.match(heading, /tabindex="-1"/));
  assert.match(gateHtml, /data-i18n-aria-label="outcomeGroup"/);
  assert.match(gate, /heading\.focus\(\{ preventScroll: true \}\)/);
  assert.match(gate, /gateCard\.setAttribute\('aria-labelledby', heading\.id\)/);
  assert.match(gateHtml, /id="emergency-countdown"[^>]*aria-live="off"/);
  assert.match(options, /render\(button\.dataset\.policyId\)/);
  assert.match(gate, /let actionBusy = false/);
  assert.match(gate, /async function guarded/);
  assert.match(styles, /button, select, input \{ min-height: 44px; \}/);
  assert.match(styles, /:focus-visible/);
});

test('light, dark and reduced-motion paths are explicit', () => {
  assert.match(styles, /color-scheme: dark/);
  assert.match(styles, /prefers-color-scheme: light/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /animation: none !important/);
});

test('extension pages obey external-script CSP and contain no inline event handlers', () => {
  for (const html of [gateHtml, optionsHtml, popupHtml]) {
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    assert.doesNotMatch(html, /\son(?:click|submit|change|input)=/i);
  }
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.match(manifest.content_security_policy.extension_pages, /object-src 'none'/);
});

test('bundled extension icon is the unchanged project asset', () => {
  const bytes = fs.readFileSync(path.join(root, 'icon-192.png'));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '53dcc0c8f5c6e21d4db5b0dffe51f8224282562ec131af23786b14e873ca3438');
  assert.equal(manifest.icons['128'], 'icon-192.png');
});

test('README documents Brave install, exact grants, incognito and honest limits', () => {
  const readme = read('README.md');
  for (const phrase of ['brave://extensions', 'Load unpacked', 'exact hostname', 'Malformed storage', 'clock rollback', 'Incognito', 'disable or uninstall']) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), phrase);
  }
  assert.match(readme, /not an OS-level app\s+blocker/i);
});
