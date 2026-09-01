'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const EXTENSION = join(ROOT, 'extensions', 'satoru-attention');
const options = readFileSync(join(EXTENSION, 'options.js'), 'utf8');
const optionsHtml = readFileSync(join(EXTENSION, 'options.html'), 'utf8');
const worker = readFileSync(join(EXTENSION, 'service-worker.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(EXTENSION, 'manifest.json'), 'utf8'));

test('the v0.5.1 Brave sender boundary remains in later runtimes', () => {
  assert.ok(['0.5.1', '0.5.2', '0.5.3', '0.5.4'].includes(manifest.version));
  assert.match(worker, /sender\.tab && sender\.tab\.url/);
  assert.match(worker, /sender\.id === chrome\.runtime\.id && \(extensionUrl \|\| extensionOrigin\)/);
  assert.match(worker, /if \(message && message\.type === 'CHECK_ACCESS'\) work = handleSiteMessage/);
});

test('the recovery control is a native navigation and does not need chrome.runtime', () => {
  assert.match(optionsHtml, /<a id="runtime-reload"[^>]+href="options\.html\?runtime-reconnect=manual"/);
  assert.match(options, /new URL\('options\.html', location\.href\)/);
  assert.match(options, /location\.replace\(freshOptionsUrl\('automatic'\)\)/);
  assert.doesNotMatch(options, /runtimeReload\.addEventListener/);
  assert.doesNotMatch(options, /location\.reload\(\)/);
});

test('all v212 engine packages contain the fixed runtime and matching version', () => {
  for (const engine of ['chromium', 'firefox', 'safari']) {
    const zip = join(ROOT, 'public', 'downloads', `satoru-attention-${engine}-v212.zip`);
    const zippedManifest = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
    const zippedOptions = execFileSync('unzip', ['-p', zip, 'options.html'], { encoding: 'utf8' });
    const zippedWorker = execFileSync('unzip', ['-p', zip, 'service-worker.js'], { encoding: 'utf8' });
    assert.equal(zippedManifest.version, '0.5.1', engine);
    assert.match(zippedOptions, /runtime-reconnect=manual/, engine);
    assert.match(zippedWorker, /sender\.id === chrome\.runtime\.id/, engine);
  }
});
