'use strict';
// v297: Satoru Attention 0.7.0 with the bundled OISD NSFW adult rulesets (owner decision 26.09).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ext = path.join(root, 'extensions/satoru-attention');
const receipt = JSON.parse(fs.readFileSync(path.join(ext, 'store-kit-v297/release.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('v297 package is exact-source, carries the adult rulesets and its GPL notice', () => {
  assert.equal(receipt.release, 'v297'); assert.equal(receipt.extensionVersion, '0.7.0'); assert.equal(receipt.published, false);
  assert.deepEqual(receipt.outputs.map(item => item.path), ['public/downloads/satoru-attention-chromium-v297.zip']);
  const zip = path.join(root, receipt.outputs[0].path);
  const bytes = fs.readFileSync(zip);
  assert.equal(hash(bytes), receipt.outputs[0].sha256); assert.equal(bytes.length, receipt.outputs[0].bytes);
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(entries, receipt.runtime.map(item => item.path).sort());
  for (const needed of ['adult-list.js', 'rules/adult-redirect.json', 'rules/adult-block.json', 'rules/LICENSE-OISD.txt', 'THIRD-PARTY-NOTICES.md', 'health.js'])
    assert.ok(entries.includes(needed), needed);
  assert.equal(entries.some(name => /\.test\.|store-kit|SUBMISSION|package\.json/.test(name)), false);
  for (const item of receipt.runtime) {
    assert.equal(hash(fs.readFileSync(path.join(ext, item.path))), item.sha256, `${item.path} requires a package rebuild`);
    assert.equal(hash(execFileSync('unzip', ['-p', zip, item.path], { maxBuffer: 64 * 1024 * 1024 })), item.sha256);
  }
  const current = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
  const previous = JSON.parse(execFileSync('unzip', ['-p', path.join(root, 'public/downloads/satoru-attention-chromium-v260.zip'), 'manifest.json'], { encoding: 'utf8' }));
  // The list needs no new permission: static DNR rulesets use the existing declarativeNetRequest grant.
  for (const field of ['permissions', 'host_permissions', 'optional_host_permissions']) assert.deepEqual(current[field], previous[field], field);
  assert.match(fs.readFileSync(path.join(ext, 'THIRD-PARTY-NOTICES.md'), 'utf8'), /## OISD NSFW[\s\S]*GNU General Public License v3\.0[\s\S]*rules\/LICENSE-OISD\.txt/);
});

test('the site offers the v297 package and no longer precaches the ~5 MB ZIP', () => {
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.match(app, /const BROWSER_COMPANION_DOWNLOAD = 'downloads\/satoru-attention-chromium-v297\.zip';/);
  assert.match(fs.readFileSync(path.join(root, 'public/browser-companion.html'), 'utf8'), /href="downloads\/satoru-attention-chromium-v297\.zip"/);
  const landing = fs.readFileSync(path.join(root, 'public/browser-companion-landing-v1.js'), 'utf8');
  assert.equal((landing.match(/downloads\/satoru-attention-chromium-v297\.zip/g) || []).length, 5);
  assert.doesNotMatch(landing, /v260\.zip/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), /downloads\//);
  assert.match(fs.readFileSync(path.join(root, 'public/browser-companion-privacy-v1.js'), 'utf8'), /Extension 0\.7\.0/);
});
