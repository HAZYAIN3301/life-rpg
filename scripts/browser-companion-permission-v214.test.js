'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const EXTENSION = join(ROOT, 'extensions', 'satoru-attention');
const options = readFileSync(join(EXTENSION, 'options.js'), 'utf8');
const core = readFileSync(join(EXTENSION, 'core.js'), 'utf8');
const worker = readFileSync(join(EXTENSION, 'service-worker.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(EXTENSION, 'manifest.json'), 'utf8'));

test('v0.5.3 keeps the sleep-safe request lifecycle', () => {
  assert.equal(manifest.version, '0.5.3');
  assert.doesNotMatch(options, /chrome\.runtime\.connect/);
  assert.doesNotMatch(options, /onDisconnect/);
  assert.doesNotMatch(options, /setInterval/);
  assert.doesNotMatch(worker, /satoru-options-heartbeat/);
  assert.match(options, /await chrome\.runtime\.sendMessage\(message\)/);
  assert.match(options, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
});

test('Brave receives literal HTTPS and HTTP origins covered by optional_host_permissions', () => {
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*']);
  assert.match(core, /return host \? \[`https:\/\/\$\{host\}\/\*`, `http:\/\/\$\{host\}\/\*`\] : \[\]/);
  assert.doesNotMatch(core, /return host \? \[`\*:\/\/\$\{host\}\/\*`\]/);
});

test('a rejected permission request is not mislabeled as a dead background worker', () => {
  const permissionBlock = options.slice(options.indexOf('const origins = Core.hostPatterns(hostname);'), options.indexOf('const existing = editingPolicyId'));
  assert.match(permissionBlock, /chrome\.permissions\.request\(\{ origins \}\)/);
  assert.match(permissionBlock, /setStatus\(t\('permissionDenied'\), 'error'\)/);
  assert.doesNotMatch(permissionBlock, /errorText\('runtime_unavailable'\)/);
});

test('all v214 engine packages contain the exact-origin permission fix', () => {
  for (const engine of ['chromium', 'firefox', 'safari']) {
    const zip = join(ROOT, 'public', 'downloads', `satoru-attention-${engine}-v214.zip`);
    const zippedManifest = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
    const zippedOptions = execFileSync('unzip', ['-p', zip, 'options.js'], { encoding: 'utf8' });
    const zippedCore = execFileSync('unzip', ['-p', zip, 'core.js'], { encoding: 'utf8' });
    const zippedWorker = execFileSync('unzip', ['-p', zip, 'service-worker.js'], { encoding: 'utf8' });
    assert.equal(zippedManifest.version, '0.5.3', engine);
    assert.doesNotMatch(zippedOptions, /chrome\.runtime\.connect/, engine);
    assert.match(zippedOptions, /setStatus\(t\('permissionDenied'\), 'error'\)/, engine);
    assert.match(zippedCore, /`https:\/\/\$\{host\}\/\*`, `http:\/\/\$\{host\}\/\*`/, engine);
    assert.doesNotMatch(zippedWorker, /satoru-options-heartbeat/, engine);
  }
});
