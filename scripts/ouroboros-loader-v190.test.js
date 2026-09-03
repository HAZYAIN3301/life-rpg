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
const ASSETS = [
  path.join(ROOT, 'public/art/ui/boot/ouroboros-body.png'),
  path.join(ROOT, 'public/art/ui/boot/ouroboros-jaw.png'),
];

test('boot screen uses the articulated ouroboros instead of the generic seal', () => {
  assert.match(INDEX, /<div id="satoru-boot" class="satoru-boot" role="status"/);
  assert.match(INDEX, /<div class="boot-ouroboros" aria-hidden="true">/);
  assert.match(INDEX, /<span class="boot-ouroboros-orbit">/);
  assert.match(INDEX, /boot-ouroboros-body" src="art\/ui\/boot\/ouroboros-body\.png" alt=""/);
  assert.match(INDEX, /boot-ouroboros-jaw" src="art\/ui\/boot\/ouroboros-jaw\.png" alt=""/);
  assert.doesNotMatch(INDEX, /class="boot-seal"/);
  assert.doesNotMatch(CSS, /\.boot-seal/);
});

test('both immutable layers are preloaded, compact, transparent and offline-complete', () => {
  for (const name of ['ouroboros-body', 'ouroboros-jaw']) {
    assert.match(INDEX, new RegExp(`rel="preload" href="art\\/ui\\/boot\\/${name}\\.png" as="image" type="image\\/png"`));
    assert.match(SW, new RegExp(`'art\\/ui\\/boot\\/${name}\\.png'`));
  }

  let bytes = 0;
  for (const asset of ASSETS) {
    const png = fs.readFileSync(asset);
    bytes += png.length;
    assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1254);
    assert.equal(png.readUInt32BE(20), 1254);
    assert.equal(png[25], 6, 'PNG must retain RGBA transparency');
  }
  assert.ok(bytes < 200_000, 'loader art must not delay the loader itself');
});

test('the orbit chases while the detached jaw visibly bites its tail', () => {
  assert.match(CSS, /\.boot-ouroboros-orbit[\s\S]*animation: boot-ouroboros-chase 3\.2s linear infinite/);
  assert.match(CSS, /\.boot-ouroboros-jaw[\s\S]*transform-origin: 52% 27\.5%/);
  assert.match(CSS, /\.boot-ouroboros-jaw[\s\S]*animation: boot-ouroboros-bite \.8s linear infinite/);
  assert.match(CSS, /@keyframes boot-ouroboros-chase/);
  assert.match(CSS, /@keyframes boot-ouroboros-bite/);
});

test('reduced motion freezes every ornamental loader animation', () => {
  const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)', CSS.indexOf('.boot-ouroboros')));
  assert.match(reduced, /\.boot-ouroboros-orbit/);
  assert.match(reduced, /\.boot-ouroboros-jaw/);
  assert.match(reduced, /\.boot-progress i/);
  assert.match(reduced, /animation: none !important/);
});

test('the latest shell release keeps the v190 loader and advances app/SW together', () => {
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v231'/);
  assert.match(SW, /const CACHE = 'satoru-v231'/);
  assert.match(INDEX, /styles\.css\?v=20260903-write-fence-v215-7/);
  assert.match(INDEX, /app\.js\?v=20260903-write-fence-v215-7/);
});
