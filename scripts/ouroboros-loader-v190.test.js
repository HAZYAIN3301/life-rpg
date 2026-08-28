'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const INDEX = read('public/index.html');
const CSS = read('public/styles.css');
const APP = read('public/app.js');
const SW = read('public/sw.js');
const ASSET = path.join(ROOT, 'public/art/ui/ouroboros-loader-v1.png');

test('boot screen uses one explicit ouroboros artwork instead of the generic seal', () => {
  assert.match(INDEX, /<div id="satoru-boot" class="satoru-boot" role="status"/);
  assert.match(INDEX, /<div class="boot-ouroboros" aria-hidden="true">/);
  assert.match(INDEX, /<img class="boot-ouroboros-art" src="art\/ui\/ouroboros-loader-v1\.png" alt=""/);
  assert.doesNotMatch(INDEX, /class="boot-seal"/);
  assert.doesNotMatch(CSS, /\.boot-seal/);
});

test('immutable artwork is preloaded, compact, transparent and offline-complete', () => {
  assert.match(INDEX, /rel="preload" href="art\/ui\/ouroboros-loader-v1\.png" as="image" type="image\/png"/);
  assert.match(SW, /'art\/ui\/ouroboros-loader-v1\.png'/);

  const png = fs.readFileSync(ASSET);
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.equal(png[25], 6, 'PNG must retain RGBA transparency');
  assert.ok(png.length < 400_000, 'loader art must not delay the loader itself');
});

test('the creature stays legible while light communicates progress', () => {
  assert.match(CSS, /\.boot-ouroboros-art[\s\S]*animation: boot-ouroboros-breathe/);
  assert.match(CSS, /\.boot-ouroboros-sheen[\s\S]*mask: url\("art\/ui\/ouroboros-loader-v1\.png"\)/);
  assert.match(CSS, /\.boot-ouroboros-sheen[\s\S]*animation: boot-cycle-light/);
  assert.match(CSS, /@keyframes boot-cycle-light/);
  assert.doesNotMatch(CSS, /\.boot-ouroboros-art[^}]*boot-cycle-light/);
});

test('reduced motion freezes every ornamental loader animation', () => {
  const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)', CSS.indexOf('.boot-ouroboros')));
  assert.match(reduced, /\.boot-ouroboros-aura/);
  assert.match(reduced, /\.boot-ouroboros-art/);
  assert.match(reduced, /\.boot-ouroboros-sheen/);
  assert.match(reduced, /\.boot-progress i/);
  assert.match(reduced, /animation: none !important/);
});

test('v190 advances the app and service-worker lifecycle together', () => {
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v190'/);
  assert.match(SW, /const CACHE = 'satoru-v190'/);
  assert.match(INDEX, /styles\.css\?v=20260828-ouroboros-loader-v190-1/);
  assert.match(INDEX, /app\.js\?v=20260828-ouroboros-loader-v190-1/);
});
