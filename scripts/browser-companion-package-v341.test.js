'use strict';
// v341: Satoru Attention 0.10.3 — chess puzzles say their goal (owner 07.10); store candidate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ext = path.join(root, 'extensions/satoru-attention');
const receipt = JSON.parse(fs.readFileSync(path.join(ext, 'store-kit-v341/release.json')));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('v341 package is exact-source, carries the merged rulesets, the Reddit guard and every license', () => {
  assert.equal(receipt.release, 'v341'); assert.equal(receipt.extensionVersion, '0.10.3'); assert.equal(receipt.published, false);
  assert.deepEqual(receipt.outputs.map(item => item.path), ['public/downloads/satoru-attention-chromium-v341.zip']);
  const zip = path.join(root, receipt.outputs[0].path);
  const bytes = fs.readFileSync(zip);
  assert.equal(hash(bytes), receipt.outputs[0].sha256); assert.equal(bytes.length, receipt.outputs[0].bytes);
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(entries, receipt.runtime.map(item => item.path).sort());
  for (const needed of ['puzzle-core.js', 'puzzles.js', 'adult-list.js', 'reddit-guard.js', 'reddit-guard.css', 'rules/adult-redirect.json', 'rules/adult-block.json', 'rules/adult-extra.txt',
    'rules/LICENSE-GPL-3.0.txt', 'rules/LICENSE-MIT-StevenBlack.txt', 'THIRD-PARTY-NOTICES.md', 'health.js'])
    assert.ok(entries.includes(needed), needed);
  assert.equal(entries.some(name => /\.test\.|store-kit|SUBMISSION|package\.json/.test(name)), false);
  for (const item of receipt.runtime) {
    assert.equal(hash(fs.readFileSync(path.join(ext, item.path))), item.sha256, `${item.path} requires a package rebuild`);
    assert.equal(hash(execFileSync('unzip', ['-p', zip, item.path], { maxBuffer: 64 * 1024 * 1024 })), item.sha256);
  }
  const current = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
  const previous = JSON.parse(execFileSync('unzip', ['-p', path.join(root, 'public/downloads/satoru-attention-chromium-v260.zip'), 'manifest.json'], { encoding: 'utf8' }));
  // The list needs no new permission: static DNR rulesets use the existing declarativeNetRequest grant.
  // Since 0.10.1: exactly one extra permanent host — satoruapp.com — so the bridge works on the main address.
  for (const field of ['permissions', 'optional_host_permissions']) assert.deepEqual(current[field], previous[field], field);
  assert.deepEqual(current.host_permissions, ['https://satoruapp.com/*', ...previous.host_permissions]);
  const notices = fs.readFileSync(path.join(ext, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  for (const needed of ['OISD NSFW', "HaGeZi's NSFW", 'rules/LICENSE-GPL-3.0.txt', 'StevenBlack hosts', 'rules/LICENSE-MIT-StevenBlack.txt', 'rules/adult-extra.txt'])
    assert.ok(notices.includes(needed), needed);
});

test('the site offers the v341 package and no longer precaches the ZIP', () => {
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.match(app, /const BROWSER_COMPANION_DOWNLOAD = 'downloads\/satoru-attention-chromium-v341\.zip';/);
  assert.match(fs.readFileSync(path.join(root, 'public/browser-companion.html'), 'utf8'), /href="downloads\/satoru-attention-chromium-v341\.zip"/);
  const landing = fs.readFileSync(path.join(root, 'public/browser-companion-landing-v1.js'), 'utf8');
  assert.equal((landing.match(/downloads\/satoru-attention-chromium-v341\.zip/g) || []).length, 5);
  assert.doesNotMatch(landing, /v(260|297|299|300|304|305|322)\.zip/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), /downloads\//);
  // The landing and privacy scripts are cache-pinned to this release, or browsers keep the 0.10.2 link and date.
  for (const page of ['browser-companion.html', 'browser-companion-privacy.html'])
    assert.match(fs.readFileSync(path.join(root, 'public', page), 'utf8'), /-v1\.js\?v=20261007-puzzles-v341-1"/, page);
  assert.match(fs.readFileSync(path.join(root, 'public/browser-companion-privacy-v1.js'), 'utf8'), /Extension 0\.10\.3/);
  assert.match(fs.readFileSync(path.join(root, 'public/browser-companion-privacy-v1.js'), 'utf8'), /about\.json whether a community or profile/);
});
