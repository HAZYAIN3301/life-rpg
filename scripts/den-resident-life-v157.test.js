'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const resident = require('../public/den-resident-life-v1.js');
const traveller = require('../public/traveller-motion-v3.js');
const stage = require('../public/den-stage-v1.js');

test('micro-life uses authored blinks and never invents human eyes for Katsuya', () => {
  assert.equal(resident.VERSION, '1.0.0');
  assert.deepEqual(resident.BEATS, ['body', 'shadow', 'resources', 'shadow']);
  assert.equal(resident.BEATS.includes('recovery'), false);
  const source = read('public/den-resident-life-v1.js');
  assert.match(source, /BodyToadV1\.playAmbient\(toad, 'blink'/);
  assert.match(source, /ResourcesPenguinV1\.playSolo\(penguin, 'blink'/);
  assert.match(source, /dataset\.shadowBlink = 'closed'/);
});

test('east-lane movement is announced once and delegated by species', () => {
  assert.equal(traveller.VERSION, '3.3.0');
  assert.equal(stage.VERSION, '1.12.0');
  const travellerSource = read('public/traveller-motion-v3.js');
  const stageSource = read('public/den-stage-v1.js');
  assert.match(travellerSource, /satoru:den-traveller-motion/);
  assert.match(travellerSource, /announceLeg\(host, 'depart', destination, direction\)/);
  assert.match(stageSource, /RecoverySlugV1\.installGlideFrames/);
  assert.match(stageSource, /shadow\.dataset\.shadowFlight = direction/);
  assert.match(stageSource, /root\.document\.addEventListener\('satoru:den-traveller-motion'/);
});

test('Shadow blink and flight preserve all four canonical forms and reduced motion', () => {
  const css = read('public/styles.css');
  for (const form of ['spark', 'spirit', 'guardian', 'keeper']) {
    assert.match(css, new RegExp(`shadow-form-${form}[^}]*--shadow-eye-left`));
  }
  assert.match(css, /data-shadow-blink="closed"/);
  assert.match(css, /data-den-lane-motion/);
  assert.match(css, /animation-play-state: running !important/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*shadow-rig-body::after \{ display: none/);
});

test('Talk opens the existing two-way helper instead of replaying a canned line', () => {
  const app = read('public/app.js');
  const handler = app.slice(app.indexOf("if (action === 'shadow-den-solo')"), app.indexOf("if (action === 'shadow-den-pair')"));
  assert.match(handler, /mode === 'speak'/);
  assert.match(handler, /finally\(\(\) => openHelperChat\(\)\)/);
  assert.doesNotMatch(handler, /ttsSpeak/);
});

test('bench landing uses the canonical cushion lane rather than the floor', () => {
  const css = read('public/styles.css');
  assert.match(css, /bodyToadBenchAway[\s\S]*100% \{ translate: 272% -78%; scale: \.86; \}/);
  assert.match(css, /bodyToadBenchHome[\s\S]*0% \{ translate: 272% -78%; scale: \.86; \}/);
});

test('runtime pins the new director and micro-life bytes', () => {
  const index = read('public/index.html');
  for (const script of ['den-stage-v1', 'den-resident-life-v1', 'den-life-v1']) {
    assert.match(index, new RegExp(`${script}\\.js\\?v=20260815-den-life-v158-1`));
  }
  assert.match(index, /traveller-motion-v3\.js\?v=20260819-traveller-f2-runtime-v167-1/);
  assert.match(index, /app\.js\?v=20260902-write-fence-v215-1/);
  assert.match(index, /styles\.css\?v=20260902-write-fence-v215-1/);
});
