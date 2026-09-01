'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const EXTENSION = join(ROOT, 'extensions', 'satoru-attention');
const options = readFileSync(join(EXTENSION, 'options.js'), 'utf8');
const worker = readFileSync(join(EXTENSION, 'service-worker.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(EXTENSION, 'manifest.json'), 'utf8'));

test('v0.5.2 sleep-safe lifecycle remains in later runtimes', () => {
  assert.ok(['0.5.2', '0.5.3'].includes(manifest.version));
  assert.doesNotMatch(options, /chrome\.runtime\.connect/);
  assert.doesNotMatch(options, /onDisconnect/);
  assert.doesNotMatch(options, /setInterval/);
  assert.doesNotMatch(worker, /satoru-options-heartbeat/);
  assert.match(options, /await chrome\.runtime\.sendMessage\(message\)/);
  assert.match(options, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
});

test('real request failures remain retryable and stale documents retain native recovery', () => {
  assert.match(options, /error: 'runtime_unavailable', retryable: true/);
  assert.match(options, /location\.replace\(freshOptionsUrl\('automatic'\)\)/);
  assert.match(options, /runtimeHelp\.hidden = !runtime/);
});

test('all v213 engine packages contain the sleep-safe runtime', () => {
  for (const engine of ['chromium', 'firefox', 'safari']) {
    const zip = join(ROOT, 'public', 'downloads', `satoru-attention-${engine}-v213.zip`);
    const zippedManifest = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
    const zippedOptions = execFileSync('unzip', ['-p', zip, 'options.js'], { encoding: 'utf8' });
    const zippedWorker = execFileSync('unzip', ['-p', zip, 'service-worker.js'], { encoding: 'utf8' });
    assert.equal(zippedManifest.version, '0.5.2', engine);
    assert.doesNotMatch(zippedOptions, /chrome\.runtime\.connect/, engine);
    assert.doesNotMatch(zippedWorker, /satoru-options-heartbeat/, engine);
  }
});
