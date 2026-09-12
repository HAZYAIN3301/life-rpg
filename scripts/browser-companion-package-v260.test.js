'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const receipt = JSON.parse(fs.readFileSync(path.join(root, 'extensions/satoru-attention/store-kit-v260/release.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('v260 Chrome/Brave upload is exact-source, local-only and separate from store claims', () => {
  assert.equal(receipt.extensionVersion, '0.6.0'); assert.equal(receipt.published, false);
  assert.equal(receipt.outputs.length, 4);
  for (const item of receipt.outputs) {
    const bytes = fs.readFileSync(path.join(root, item.path));
    assert.equal(hash(bytes), item.sha256); assert.equal(bytes.length, item.bytes);
    assert.equal(item.sha256, receipt.outputs[0].sha256);
  }
  const zip = path.join(root, receipt.outputs[0].path);
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(entries, receipt.runtime.map(item => item.path).sort());
  assert.ok(entries.includes('health.js')); assert.ok(entries.includes('boundary-test-receipt.js'));
  assert.equal(entries.some(name => /\.test\.|store-kit|SUBMISSION|package\.json/.test(name)), false);
  for (const item of receipt.runtime) {
    assert.equal(hash(fs.readFileSync(path.join(root, 'extensions/satoru-attention', item.path))), item.sha256, `${item.path} requires a package rebuild`);
    assert.equal(hash(execFileSync('unzip', ['-p', zip, item.path])), item.sha256);
  }
  const current = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
  const previous = JSON.parse(execFileSync('unzip', ['-p', path.join(root, 'public/downloads/satoru-attention-chromium-v215.zip'), 'manifest.json'], { encoding: 'utf8' }));
  for (const field of ['permissions', 'host_permissions', 'optional_host_permissions']) assert.deepEqual(current[field], previous[field], field);
});
