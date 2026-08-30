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
const blockHtml = read('block.html');
const block = read('block.js');
const bridge = read('bridge.js');
const guard = read('site-guard.js');
const styles = read('styles.css');
const protection = read('protection.js');
const catalog = read('protection-catalog.js');

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

test('attention sites stay exact-host while protection asks broadly only from its explicit submit', () => {
  assert.match(options, /const origins = Core\.hostPatterns\(hostname\);[\s\S]*chrome\.permissions\.request\(\{ origins \}\);/);
  assert.doesNotMatch(options, /permissions\.request\([^)]*<all_urls>/s);
  assert.doesNotMatch(options, /\*:\/\/\*\./);
  const protectionSubmit = options.slice(options.indexOf("protectionForm.addEventListener('submit'"), options.indexOf("runtimeReload.addEventListener"));
  assert.match(protectionSubmit, /chrome\.permissions\.request\(\{ origins: \['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\] \}\)/);
  const policySubmit = options.slice(options.indexOf("form.addEventListener('submit'"));
  assert.match(policySubmit, /Core\.hostPatterns\(hostname\)/);
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
  for (const html of [gateHtml, optionsHtml, popupHtml, blockHtml]) {
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
  for (const html of [gateHtml, optionsHtml, popupHtml, blockHtml]) {
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    assert.doesNotMatch(html, /\son(?:click|submit|change|input)=/i);
  }
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.match(manifest.content_security_policy.extension_pages, /object-src 'none'/);
});

test('bundled extension icon is the dedicated Satoru Attention asset', () => {
  const bytes = fs.readFileSync(path.join(root, 'icon-192.png'));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), 'b652539f04dce6b98bf8ef3d47609fedf2e4c63b19b9f042339ee0b8e76825d8');
  assert.equal(manifest.icons['128'], 'icon-192.png');
  assert.match(optionsHtml, /<img class="brand-mark" src="icon-192\.png" alt="">/);
  assert.match(gateHtml, /<img class="brand-mark" src="icon-192\.png" alt="">/);
});

test('README documents Brave install, exact grants, incognito and honest limits', () => {
  const readme = read('README.md');
  for (const phrase of ['brave://extensions', 'Load unpacked', 'exact hostname', 'Malformed storage', 'clock rollback', 'Incognito', 'disable or uninstall']) {
    assert.match(readme, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), phrase);
  }
  assert.match(readme, /not an OS-level app\s+blocker/i);
});

test('one site is configured as several pre-approved scenarios with a shared daily guard', () => {
  assert.match(options, /purposes: \['publish', 'create', 'research', 'watch'\]/);
  assert.match(options, /dailyBudgetMinutes: 50, maxSessionsPerDay: 3, cooldownMinutes: 10/);
  assert.match(options, /replacePurposes: true/);
  assert.match(optionsHtml, /id="scenario-list"/);
  assert.match(optionsHtml, /id="daily-budget"/);
  assert.match(optionsHtml, /id="daily-sessions"/);
  assert.match(optionsHtml, /id="cooldown-minutes"/);
  assert.doesNotMatch(optionsHtml, /id="policy-outcome"/,
    'a generic permanent outcome field must not masquerade as the concrete entry contract');
});

test('the gate can only shorten a scenario and requires the concrete entry instance', () => {
  assert.match(gateHtml, /<select id="minutes"/);
  assert.match(gateHtml, /id="detail-field"/);
  assert.match(gate, /value <= available/);
  assert.match(gate, /detail: detailInput\.value/);
  assert.match(gate, /expectedOutcome: selectedRule\.expectedOutcome/);
  assert.doesNotMatch(gate, /minutesInput\.max\s*=/,
    'the gate no longer exposes a free numeric maximum that can be expanded in the impulse');
});

test('Control weakening is delayed and the runtime error names a lost background connection', () => {
  assert.match(worker, /nextLocalMidnightIso/);
  assert.match(worker, /deferLoosening: true/);
  assert.match(worker, /CANCEL_PENDING_POLICY/);
  assert.match(I18n.TABLES.ru.error_runtime_unavailable, /фоновым модулем/i);
  assert.doesNotMatch(I18n.TABLES.ru.error_runtime_unavailable, /очищен/i);
  assert.match(optionsHtml, /id="runtime-help"/);
});

test('stale options pages reconnect once and keep a live heartbeat after extension reload', () => {
  assert.match(options, /chrome\.runtime\.connect\(\{ name: 'satoru-options-heartbeat' \}\)/);
  assert.match(options, /extension context invalidated\|receiving end does not exist/i);
  assert.match(options, /url\.searchParams\.has\('runtime-reconnect'\)/);
  assert.match(options, /location\.replace\(url\.toString\(\)\)/);
  assert.match(options, /recoverStaleOptions\('extension context invalidated', true\)/);
  assert.match(optionsHtml, /id="runtime-reload"/);
  assert.match(worker, /chrome\.runtime\.onConnect\.addListener/);
  assert.match(worker, /type: 'PONG'/);
});

test('browser protection is local, category-backed and fail-closed at navigation', () => {
  assert.match(worker, /Protection\.buildRules/);
  assert.match(worker, /Protection\.decision/);
  assert.match(worker, /SAVE_PROTECTION/);
  assert.match(worker, /PROTECTION_ALARM/);
  assert.match(protection, /priority: 10_000/);
  assert.match(protection, /priority: 9_000/);
  assert.match(protection, /YouTube-Restrict/);
  assert.match(protection, /queryTransform/);
  assert.match(catalog, /"piracy"/);
  assert.match(catalog, /"bypass"/);
  assert.doesNotMatch(catalog, /https?:\/\//);
  assert.match(blockHtml, /id="block-title"/);
  assert.doesNotMatch(blockHtml, /<(?:button|a)[^>]*(?:override|continue-anyway)/i);
  assert.match(block, /chrome\.runtime\.openOptionsPage/);
  assert.match(styles, /button, \.button \{[\s\S]*min-height: 44px/);
});

test('expiry keeps distinct work outcomes and mission-specific launch routes', () => {
  assert.match(gateHtml, /data-outcome="unfinished"/);
  assert.match(gate, /finish\('done', event\.currentTarget\)/,
    'finishing early closes the access window instead of cancelling Control');
  assert.match(worker, /tiktokstudio\/upload/);
  assert.match(worker, /\/search\?q=/);
  assert.match(worker, /\/favorites/);
});

test('a stale gate cannot silently adopt a paused or unrelated site policy', () => {
  assert.match(worker, /requestedPolicy && requestedPolicy\.enabled \? requestedPolicy : null/);
  assert.match(worker, /!siteId \? state\.policies\.find\(\(item\) => item\.enabled\) : null/);
});
