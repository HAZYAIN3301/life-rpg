'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const Discovery = require(path.join(ROOT, 'public', 'browser-companion-discovery-v1.js'));
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');

const NOW = '2026-09-02T12:00:00.000Z';

test('existing accounts see the release notice only after the extension probe', () => {
  const options = { now: NOW, accountCreatedAt: '2026-08-01T12:00:00.000Z', active: true };
  const state = Discovery.create(options);
  assert.equal(Discovery.shouldShow(state, { ...options, probeComplete: false, installed: false }), false);
  assert.equal(Discovery.shouldShow(state, { ...options, probeComplete: true, installed: false }), true);
  assert.equal(Discovery.shouldShow(state, { ...options, probeComplete: true, installed: true }), false);
});

test('new accounts wait for 24 hours of returning active use', () => {
  const accountCreatedAt = '2026-09-01T10:00:00.000Z';
  const first = Discovery.create({ now: '2026-09-01T12:00:00.000Z', accountCreatedAt, active: true });
  assert.equal(first.firstActiveAt, '2026-09-01T12:00:00.000Z');
  assert.equal(Discovery.shouldShow(first, { now: '2026-09-02T11:59:59.000Z', accountCreatedAt, active: true, probeComplete: true }), false);
  assert.equal(Discovery.shouldShow(first, { now: '2026-09-02T12:00:00.000Z', accountCreatedAt, active: true, probeComplete: true }), true);
  assert.equal(Discovery.shouldShow(first, { now: '2026-09-03T12:00:00.000Z', accountCreatedAt, active: false, probeComplete: true }), false);
});

test('later is three days, never is durable, and install stays recoverable', () => {
  const options = { now: NOW, accountCreatedAt: '2026-08-01T12:00:00.000Z', active: true, probeComplete: true };
  const base = Discovery.create(options);
  const later = Discovery.reduce(base, { type: 'later', now: NOW }, options);
  assert.equal(later.remindAfter, '2026-09-05T12:00:00.000Z');
  assert.equal(Discovery.shouldShow(later, { ...options, now: '2026-09-05T11:59:59.000Z' }), false);
  assert.equal(Discovery.shouldShow(later, { ...options, now: '2026-09-05T12:00:00.000Z' }), true);
  const never = Discovery.reduce(base, { type: 'never', now: NOW }, options);
  assert.equal(Discovery.shouldShow(never, options), false);
  const installing = Discovery.reduce(base, { type: 'install', now: NOW }, options);
  assert.equal(installing.choice, 'installing');
  assert.equal(Discovery.shouldShow(installing, options), true, 'an interrupted manual install must remain discoverable');
});

test('Today discovery is a temporary full-width release notice, not another permanent control panel', () => {
  assert.match(APP, /data-browser-companion-launch/);
  assert.match(APP, /browserCompanionLaunchHTML\(\)/);
  assert.match(APP, /browser-companion-install/);
  assert.match(APP, /browser-companion-later/);
  assert.match(APP, /browser-companion-never/);
  assert.match(CSS, /\.browser-companion-launch-slot\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(CSS, /\.browser-companion-launch-actions :is\(button, \.btn\) \{[^}]*min-height:\s*var\(--touch-min\)/s);
  assert.match(CSS, /prefers-reduced-motion:\s*reduce[\s\S]*browser-companion-launch/);
});

test('the installer has an independent landing page and a store-ready route', () => {
  const page = fs.readFileSync(path.join(ROOT, 'public', 'browser-companion.html'), 'utf8');
  assert.match(page, /Satoru Attention/);
  assert.match(page, /satoru-attention-v200\.zip/);
  assert.match(page, /brave:\/\/extensions/);
  assert.match(page, /Chrome Web Store/);
  assert.match(APP, /browser-companion\.html/);
  assert.match(APP, /event\.stopPropagation\(\); closeBrowserCompanionInstaller\(\)/,
    'Escape must not leak to the global keyboard handler after the modal is removed');
  assert.match(APP, /opener\?\.isConnected[\s\S]*browser-companion-install/,
    'focus return must recover after the async Today surface is replaced');
  assert.match(fs.readFileSync(path.join(ROOT, 'extensions', 'satoru-attention', 'STORE-LISTING.md'), 'utf8'), /Permission rationale/);
});
