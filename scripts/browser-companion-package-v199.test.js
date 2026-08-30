'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extensions', 'satoru-attention');
const read = (name) => fs.readFileSync(path.join(EXT, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

test('installable MV3 package has only the permanent Satoru origin', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.host_permissions, ['https://life-rpg-production-416a.up.railway.app/*']);
  assert.ok(!manifest.permissions.includes('webNavigation'));
  assert.ok(!manifest.permissions.includes('tabs'), 'tabs must not be a declared global permission');
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://life-rpg-production-416a.up.railway.app/*']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
});

test('every manifest file exists and both v206 ZIPs are real artifacts', () => {
  const refs = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page]
    .concat(manifest.content_scripts.flatMap((entry) => entry.js || []))
    .concat(Object.values(manifest.icons || {}));
  for (const relative of refs) assert.ok(fs.existsSync(path.join(EXT, relative)), relative);
  for (const locale of ['ru', 'en', 'de', 'uk', 'es']) {
    const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
    assert.ok(messages.extensionName?.message);
    assert.ok(messages.extensionDescription?.message);
  }
  assert.equal(manifest.version, '0.3.0');
  for (const name of ['satoru-attention-v206.zip', 'satoru-attention-store-v206.zip']) {
    const zip = path.join(ROOT, 'public', 'downloads', name);
    assert.ok(fs.existsSync(zip), `${name}: install artifact must not ship as a 404`);
    assert.ok(fs.statSync(zip).size > 10_000, `${name}: ZIP is unexpectedly empty`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'), /'\.zip':\s*'application\/zip'/);
});

test('toolbar badge keeps the installed extension discoverable without changing enforcement', () => {
  const worker = read('service-worker.js');
  const options = read('options.html');
  assert.match(worker, /chrome\.action\.setBadgeText/);
  assert.match(worker, /Badge visibility is helpful, never part of the enforcement transaction/);
  assert.match(options, /data-i18n="pinTitle"/);
});

test('companion is local-only, exact-host and has no remote telemetry path', () => {
  const core = read('core.js');
  const options = read('options.js');
  const worker = read('service-worker.js');
  const bridge = read('bridge.js');
  const allJs = fs.readdirSync(EXT).filter((name) => name.endsWith('.js') && !name.endsWith('.test.js')).map(read).join('\n');
  assert.match(core, /return host \? \[`\*:\/\/\$\{host\}\/\*`\] : \[\]/);
  assert.match(options, /const origins = Core\.hostPatterns\(hostname\)[\s\S]*chrome\.permissions\.request\(\{ origins \}\)/);
  assert.match(options, /Core\.hostPatterns\(hostname\)/);
  assert.doesNotMatch(allJs, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|chrome\.storage\.sync/);
  assert.match(worker, /commitWithEnforcement[\s\S]*enforcement_recovery/);
  assert.match(core, /const activeSession = sessionPolicy \? candidateSession : null/);
  assert.match(bridge, /event\.source !== window|event\.source === window/);
  assert.match(bridge, /SATORU_ATTENTION_STATUS_REQUEST/);
});

test('gate exposes retryable failures and keyboard focus without a live timer flood', () => {
  const html = read('gate.html');
  const js = read('gate.js');
  const options = read('options.js');
  const css = read('styles.css');
  assert.match(html, /tabindex="-1"/);
  assert.match(js, /retry|runtime|storage|error/i);
  assert.match(options, /focus/i);
  assert.doesNotMatch(html, /id="emergency-countdown"[^>]*aria-live="polite"/);
  assert.match(css, /overflow-wrap:\s*anywhere|word-break:\s*break-word/);
});
