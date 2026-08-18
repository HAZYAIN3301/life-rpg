'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const slug = require('../public/recovery-slug-v1.js');

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

assert.equal(slug.VERSION, '2.4.0');
assert.deepEqual(slug.TRAVELLER_GENDERS, ['male', 'female']);
assert.deepEqual(slug.AUTHORED_PAIR_GENDERS, ['male']);
assert.equal(slug.normalizeTravellerGender(), 'male');
assert.equal(slug.normalizeTravellerGender('female'), 'female');
assert.equal(slug.normalizeTravellerGender('unknown'), null);
assert.equal(slug.normalizeTravellerGender(''), null);
assert.equal(slug.normalizeTravellerGender(null), null);
assert.equal(slug.hasPairArt('male'), true);
assert.equal(slug.hasPairArt('female'), false);
assert.equal(slug.hasPairArt('unknown'), false);
assert.equal(slug.deriveState({ restGapDays: 7, energyPct: 90 }), 'strained');
assert.equal(slug.deriveState({ restGapDays: 0, energyPct: 48 }), 'restoring');
assert.equal(slug.deriveState({ restGapDays: 0, energyPct: 88 }), 'thriving');
assert.equal(slug.deriveState({ restGapDays: 3, energyPct: 70 }), 'calm');
assert.equal(slug.frameSrc('calm', true), '/art/pets/recovery-slug-v1/states/calm.png');
assert.equal(slug.pairFrameSrc('greet-contact'), '/art/pets/recovery-slug-v1/pair-v2/greet-contact.png?v=20260806-2');
assert.equal(slug.pairFrameSrc('greet-contact', 'female'), '/art/pets/recovery-slug-v1/pair-v2/female/greet-contact.png?v=20260806-2');
assert.equal(slug.pairFrameSrc('stretch-soft-b', 'female'), '/art/pets/recovery-slug-v1/pair-v3/female/stretch-soft-b-v155.png?v=20260814-1');
assert.equal(slug.pairFrameSrc('greet-contact', ''), null);
assert.match(slug.pairMarkup({ gender: 'female' }), /data-traveller-gender="female"/);
assert.equal(slug.pairMarkup({ gender: '' }), '');
assert.equal(slug.pairMarkup(null), '');
assert.equal(typeof slug.cancelPair, 'function');
assert.deepEqual(slug.INTERACTIONS.stretch.pairFrames, ['stretch-a', 'stretch-soft-b']);
assert.equal(slug.FRAME_CALIBRATION.compress.scale, 1.1);

const artRoot = path.join(root, 'public/art/pets/recovery-slug-v1');
for (const state of slug.STATES) assert.deepEqual(pngSize(path.join(artRoot, 'states', `${state}.png`)), [1024, 1024]);
assert.deepEqual(Object.keys(slug.MOTION_FRAMES), ['compress', 'extend', 'stretch', 'sleep', 'helpers']);
assert.deepEqual(Object.keys(slug.INTERACTIONS), ['greet', 'breathe', 'restore', 'stretch']);
for (const file of Object.values(slug.MOTION_FRAMES)) {
  assert.deepEqual(pngSize(path.join(artRoot, 'motion-v2', file)), [1024, 1024]);
}
for (const interaction of Object.values(slug.INTERACTIONS)) {
  for (const frame of interaction.pairFrames) {
    const resolved = path.join(root, 'public', slug.pairFrameSrc(frame).split('?')[0].replace(/^\/+/, ''));
    assert.deepEqual(pngSize(resolved), [1536, 1536]);
  }
}

const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
assert.match(app, /recoverySlugState/);
assert.match(app, /recovery-guardian/);
assert.match(app, /playRecoverySlugScene/);
assert.match(app, /playDenRecoveryBeat/);
assert.match(app, /const spherePetLimit = Math\.max\(0, den\.petCount - \(recoveryGuardianActive \? 1 : 0\)\)/);
assert.match(styles, /\.den-recovery-slug\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1;[\s\S]*height:\s*auto\s*!important;/);
assert.match(styles, /\.recovery-pair-v2/);
assert.match(styles, /recoverySlugTourAway/);
assert.match(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), /recovery-slug-v1\.js/);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), /recovery-slug-v1\/motion\/idle-softbody\.gif/);
assert.match(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), /recovery-slug-v1\/pair-v2\/restore-contact\.png/);

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
  querySelector(selector) { return selector === '.recovery-pair-v2__stage' ? blockedStage : null; },
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
  assert.equal(await slug.setPairMode(blockedPair, 'greet', { gender: 'female' }), false);
  assert.equal(blockedStage.cleared, true);
  assert.equal(blockedPair.dataset.travellerGender, 'female');

  blockedStage.cleared = false;
  assert.equal(await slug.setPairMode(blockedPair, 'greet', { gender: '' }), false);
  assert.equal(blockedStage.cleared, true);
  assert.equal('travellerGender' in blockedPair.dataset, false);

  const malePrefetch = await slug.prefetch();
  const femalePrefetch = await slug.prefetch({ gender: 'female' });
  const invalidPrefetch = await slug.prefetch({ gender: '' });
  const isPair = (result) => /\/pair-v[23]\//.test(String(result.value || ''));
  assert.equal(malePrefetch.some(isPair), true);
  assert.equal(femalePrefetch.some(isPair), false);
  assert.equal(invalidPrefetch.some(isPair), false);

  const originalImage = global.Image;
  global.Image = FailingImage;
  blockedStage.cleared = false;
  blockedClasses.add('is-active');
  blockedAttributes['aria-hidden'] = 'false';
  try {
    assert.equal(await slug.setPairMode(blockedPair, 'greet', { gender: 'male' }), false);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
  assert.equal(blockedStage.cleared, true);
  assert.equal(blockedClasses.has('is-active'), false);
  assert.equal(blockedAttributes['aria-hidden'], 'true');
  console.log('RECOVERY Guardian v2: contract checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
