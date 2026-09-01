'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DOWNLOADS = path.join(ROOT, 'public', 'downloads');
const readZipManifest = (name) => JSON.parse(execFileSync('unzip', ['-p', path.join(DOWNLOADS, name), 'manifest.json'], { encoding: 'utf8' }));

test('v211 produces installable packages for the three browser engines', () => {
  const names = ['satoru-attention-chromium-v211.zip', 'satoru-attention-firefox-v211.zip', 'satoru-attention-safari-v211.zip'];
  for (const name of names) {
    const file = path.join(DOWNLOADS, name);
    assert.ok(fs.existsSync(file), `${name} must exist`);
    assert.ok(fs.statSync(file).size > 10_000, `${name} must not be empty`);
    assert.equal(readZipManifest(name).version, '0.5.0');
  }
});

test('Chromium package keeps an MV3 service worker and narrow permanent origin', () => {
  const manifest = readZipManifest('satoru-attention-chromium-v211.zip');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.equal(manifest.background.scripts, undefined);
  assert.equal(manifest.minimum_chrome_version, '111');
  assert.deepEqual(manifest.host_permissions, ['https://life-rpg-production-416a.up.railway.app/*']);
});

test('Firefox package has a signed-build ID, disclosure and event-page background', () => {
  const manifest = readZipManifest('satoru-attention-firefox-v211.zip');
  assert.deepEqual(manifest.background, { scripts: ['service-worker.js'] });
  assert.equal(manifest.minimum_chrome_version, undefined);
  assert.equal(manifest.browser_specific_settings.gecko.id, 'satoru-attention@satoru.app');
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '128.0');
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
});

test('Safari package exposes both supported MV3 background environments', () => {
  const manifest = readZipManifest('satoru-attention-safari-v211.zip');
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.deepEqual(manifest.background.scripts, ['service-worker.js']);
  assert.deepEqual(manifest.background.preferred_environment, ['service_worker', 'document']);
  assert.equal(manifest.browser_specific_settings.safari.strict_min_version, '17.0');
});

test('store aliases are byte-identical to the matching engine package', () => {
  const same = (a, b) => assert.deepEqual(fs.readFileSync(path.join(DOWNLOADS, a)), fs.readFileSync(path.join(DOWNLOADS, b)));
  for (const name of ['satoru-attention-v211.zip', 'satoru-attention-store-v211.zip', 'satoru-attention-chrome-store-v211.zip', 'satoru-attention-edge-store-v211.zip', 'satoru-attention-opera-store-v211.zip']) {
    same('satoru-attention-chromium-v211.zip', name);
  }
  same('satoru-attention-firefox-v211.zip', 'satoru-attention-firefox-amo-v211.zip');
  same('satoru-attention-safari-v211.zip', 'satoru-attention-safari-app-store-v211.zip');
});

test('landing page has a persistent five-language selector and every target browser', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'browser-companion.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'browser-companion-landing-v1.js'), 'utf8');
  assert.match(html, /id="bc-language"/);
  for (const code of ['ru', 'en', 'de', 'uk', 'es']) assert.match(html, new RegExp(`<option value="${code}"`));
  for (const browser of ['chrome', 'edge', 'brave', 'firefox', 'opera', 'vivaldi', 'safari']) assert.match(html, new RegExp(`data-browser="${browser}"`));
  assert.match(js, /satoru-browser-companion-language/);
  assert.match(js, /history\.replaceState/);
  assert.match(js, /navigator\.userAgent/);
});
