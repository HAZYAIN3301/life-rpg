'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const toad = require('../public/body-toad-v1.js');

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

assert.equal(toad.VERSION, '3.6.0');
assert.deepEqual(toad.TRAVELLER_GENDERS, ['male', 'female']);
assert.deepEqual(toad.AUTHORED_PAIR_GENDERS, ['male', 'female']);
assert.equal(toad.normalizeTravellerGender(), 'male');
assert.equal(toad.normalizeTravellerGender('female'), 'female');
assert.equal(toad.normalizeTravellerGender('unknown'), null);
assert.equal(toad.normalizeTravellerGender(''), null);
assert.equal(toad.normalizeTravellerGender(null), null);
assert.equal(toad.hasPairArt('male'), true);
assert.equal(toad.hasPairArt('female'), true);
assert.equal(toad.hasPairArt('unknown'), false);
assert.equal(toad.frameSrc('calm', true), '/art/pets/body-toad-v1/states/calm.png');
assert.equal(toad.frameSrc('strained', true), '/art/pets/body-toad-v1/states/strained.png');
assert.equal(toad.motionFrameSrc('air'), '/art/pets/body-toad-v1/motion-v4/hop-air.png?v=20260806-3');
assert.equal(toad.pairFrameSrc('greet-contact'), '/art/pets/body-toad-v1/pair-v4/greet-contact.png?v=20260806-3');
assert.equal(toad.pairFrameSrc('greet-contact', 'female'), '/art/pets/body-toad-v1/pair-v4/female/f2-v1/greet-contact.png?v=20260806-3');
assert.equal(toad.pairFrameSrc('greet-contact', ''), null);
assert.equal(toad.pairFrameSrc('unknown'), '/art/pets/body-toad-v1/pair-v4/rest-contact.png?v=20260806-3');
assert.match(toad.pairMarkup({ gender: 'female' }), /data-traveller-gender="female"/);
assert.equal(toad.pairMarkup({ gender: '' }), '');
assert.equal(toad.pairMarkup(null), '');
assert.deepEqual(toad.INTERACTIONS.whistle.pairFrames, ['whistle-a', 'whistle-b', 'whistle-c', 'whistle-d']);
assert.equal(typeof toad.playAmbient, 'function');
assert.equal(typeof toad.installHopFrames, 'function');
assert.equal(typeof toad.cancelPair, 'function');
assert.equal(toad.FRAME_CALIBRATION.stretch.scale, 1.12);

const motionRoot = path.join(root, 'public/art/pets/body-toad-v1/motion-v4');
for (const file of ['idle-blink.png', 'hop-crouch.png', 'hop-air.png', 'solo-stretch.png', 'solo-stretch-up.png', 'bench-sleep.png']) {
  assert.deepEqual(pngSize(path.join(motionRoot, file)), [1024, 1024]);
}

const pairRoot = path.join(root, 'public/art/pets/body-toad-v1/pair-v4');
for (const interaction of Object.values(toad.INTERACTIONS)) {
  for (const frame of interaction.pairFrames) {
    assert.deepEqual(pngSize(path.join(pairRoot, `${frame}.png`)), [1536, 1536]);
  }
}

for (const file of ['prop-portal-rim.png', 'prop-portal-core.png', 'traveller-portal-reach.png']) {
  assert.ok(fs.statSync(path.join(root, 'public/art/den/actors', file)).size > 1000);
}
assert.deepEqual(pngSize(path.join(root, 'public/art/avatars/traveller-core-v1/male/room-actions-v4/bench-portal-reach.png')), [640, 900]);

const blockedClasses = new Set(['is-active']);
const blockedAttributes = { 'aria-hidden': 'false' };
const blockedStage = { cleared: false, replaceChildren() { this.cleared = true; } };
const blockedPair = {
  dataset: {},
  isConnected: true,
  classList: {
    add(...names) { names.forEach((name) => blockedClasses.add(name)); },
    remove(...names) { names.forEach((name) => blockedClasses.delete(name)); },
  },
  setAttribute(name, value) { blockedAttributes[name] = String(value); },
  querySelector(selector) { return selector === '.body-pair-v2__stage' ? blockedStage : null; },
};

class FailingImage {
  constructor() { this.listeners = {}; this.complete = false; this.naturalWidth = 0; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  set src(value) {
    this._src = value;
    queueMicrotask(() => (this.listeners.error ? this.listeners.error() : this.onerror && this.onerror()));
  }
  get src() { return this._src; }
}

(async () => {
  assert.equal(await toad.setPairMode(blockedPair, 'greet', { gender: 'female' }), false);
  assert.equal(blockedStage.cleared, true);
  assert.equal(blockedPair.dataset.travellerGender, 'female');

  blockedStage.cleared = false;
  assert.equal(await toad.setPairMode(blockedPair, 'greet', { gender: '' }), false);
  assert.equal(blockedStage.cleared, true);
  assert.equal('travellerGender' in blockedPair.dataset, false);

  const malePrefetch = await toad.prefetch();
  const femalePrefetch = await toad.prefetch({ gender: 'female' });
  const invalidPrefetch = await toad.prefetch({ gender: '' });
  assert.equal(malePrefetch.some((result) => String(result.value || '').includes('/pair-v4/')), true);
  assert.equal(femalePrefetch.some((result) => String(result.value || '').includes('/pair-v4/female/f2-v1/')), true);
  assert.equal(invalidPrefetch.some((result) => String(result.value || '').includes('/pair-v4/')), false);

  const originalImage = global.Image;
  global.Image = FailingImage;
  blockedStage.cleared = false;
  blockedClasses.add('is-active');
  blockedAttributes['aria-hidden'] = 'false';
  try {
    assert.equal(await toad.setPairMode(blockedPair, 'greet', { gender: 'male' }), false);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
  assert.equal(blockedStage.cleared, true);
  assert.equal(blockedClasses.has('is-active'), false);
  assert.equal(blockedAttributes['aria-hidden'], 'true');
  console.log('BODY Guardian life v4: contract checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
