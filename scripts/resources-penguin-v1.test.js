'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const penguin = require('../public/resources-penguin-v1.js');

function pngInfo(file) {
  const header = fs.readFileSync(file).subarray(0, 26);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return {
    size: [header.readUInt32BE(16), header.readUInt32BE(20)],
    colorType: header[25],
  };
}

assert.equal(penguin.VERSION, '1.3.0');
assert.deepEqual(penguin.TRAVELLER_GENDERS, ['male', 'female']);
assert.deepEqual(penguin.AUTHORED_PAIR_GENDERS, ['male', 'female']);
assert.equal(penguin.normalizeTravellerGender(), 'male');
assert.equal(penguin.normalizeTravellerGender('female'), 'female');
assert.equal(penguin.normalizeTravellerGender('unknown'), null);
assert.equal(penguin.normalizeTravellerGender(''), null);
assert.equal(penguin.normalizeTravellerGender(null), null);
assert.equal(penguin.hasPairArt('male'), true);
assert.equal(penguin.hasPairArt('female'), true);
assert.equal(penguin.hasPairArt('unknown'), false);
assert.equal(penguin.pairSrc('greet-contact'), '/art/pets/resources-penguin-v1/pair-v1/greet-contact.png?v=20260807-1');
assert.equal(penguin.pairSrc('greet-contact', 'female'), '/art/pets/resources-penguin-v1/pair-v1/female/f2-v1/greet-contact.png?v=20260807-1');
assert.equal(penguin.pairSrc('greet-contact', ''), null);
assert.match(penguin.pairMarkup({ gender: 'female' }), /data-traveller-gender="female"/);
assert.equal(penguin.pairMarkup({ gender: '' }), '');
assert.equal(penguin.pairMarkup(null), '');
assert.deepEqual(penguin.STATES, ['calm', 'thriving', 'strained', 'restoring']);
assert.equal(penguin.stateFromPetState('hungry'), 'strained');
assert.equal(penguin.stateFromPetState('full'), 'thriving');
assert.equal(penguin.stateFromPetState('overfed'), 'restoring');
assert.equal(typeof penguin.installWaddleFrames, 'function');
assert.equal(typeof penguin.playSolo, 'function');
assert.equal(typeof penguin.playPair, 'function');
assert.equal(typeof penguin.cancelPair, 'function');
assert.deepEqual(Object.keys(penguin.INTERACTIONS), ['greet', 'budget', 'count', 'reserve', 'focus', 'close']);

const artRoot = path.join(root, 'public/art/pets/resources-penguin-v1');
for (const state of penguin.STATES) {
  const info = pngInfo(path.join(artRoot, 'states', `${state}.png`));
  assert.deepEqual(info.size, [1024, 1024]);
  assert.equal(info.colorType, 6);
}
for (const action of Object.values(penguin.SOLO)) {
  for (const frame of action.frames) {
    const info = pngInfo(path.join(artRoot, frame));
    assert.deepEqual(info.size, [1024, 1024]);
    assert.equal(info.colorType, 6);
  }
}
for (const interaction of Object.values(penguin.INTERACTIONS)) {
  for (const frame of interaction.frames) {
    const info = pngInfo(path.join(artRoot, 'pair-v1', `${frame}.png`));
    assert.deepEqual(info.size, [1536, 1536]);
    assert.equal(info.colorType, 6);
  }
}

const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
assert.match(app, /canonOf\(sphere\) === 'money'/);
assert.match(app, /\{ name: 'Деньги \/ Ресурсы', color: '#d8a44b' \}/);
assert.match(app, /demoX7Requested\(\) && !State\.settings\.skills\.some\(\(skill\) => canonOf\(skill\) === 'money'\)/);
assert.match(app, /playResourcesPenguinScene/);
assert.match(app, /resources-penguin-interact/);
assert.match(styles, /is-resources-pair-approaching/);
assert.match(styles, /resourcesWaddleA/);
assert.match(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), /resources-penguin-v1\.js/);
assert.match(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), /resources-penguin-v1\/pair-v1\/focus-work\.png/);

const blockedClasses = new Set(['is-active']);
const inertClassList = {
  add(...names) { names.forEach((name) => blockedClasses.add(name)); },
  remove(...names) { names.forEach((name) => blockedClasses.delete(name)); },
};
const blockedAttributes = { 'aria-hidden': 'false' };
const blockedStage = { cleared: false, replaceChildren() { this.cleared = true; } };
const blockedPair = {
  dataset: {},
  isConnected: true,
  classList: inertClassList,
  setAttribute(name, value) { blockedAttributes[name] = String(value); },
  querySelector(selector) { return selector === '.resources-pair-v1__stage' ? blockedStage : null; },
};
const blockedScope = {
  classList: inertClassList,
  querySelector(selector) { return selector === '[data-resources-pair-v1]' ? blockedPair : null; },
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
  // Authored F2 passes the pair-art gate; this disconnected fixture exits
  // without pretending that the female pack is missing.
  assert.equal(await penguin.playPair(blockedScope, 'greet', { gender: 'female' }), false);
  assert.equal(blockedStage.cleared, false);
  assert.equal('travellerGender' in blockedPair.dataset, false);

  blockedStage.cleared = false;
  assert.equal(await penguin.playPair(blockedScope, 'greet', { gender: '' }), false);
  assert.equal(blockedStage.cleared, true);
  assert.equal('travellerGender' in blockedPair.dataset, false);

  const malePrefetch = await penguin.prefetch();
  const femalePrefetch = await penguin.prefetch({ gender: 'female' });
  const invalidPrefetch = await penguin.prefetch({ gender: '' });
  const isPair = (result) => String(result.value || '').includes('/pair-v1/');
  assert.equal(malePrefetch.some(isPair), true);
  assert.equal(femalePrefetch.some((result) => String(result.value || '').includes('/pair-v1/female/f2-v1/')), true);
  assert.equal(invalidPrefetch.some(isPair), false);

  const originalImage = global.Image;
  global.Image = FailingImage;
  blockedStage.cleared = false;
  blockedClasses.add('is-active');
  blockedAttributes['aria-hidden'] = 'false';
  try {
    assert.equal(await penguin.playPair(blockedScope, 'greet', { gender: 'male' }), false);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
  assert.equal(blockedStage.cleared, true);
  assert.equal(blockedClasses.has('is-active'), false);
  assert.equal(blockedAttributes['aria-hidden'], 'true');
  console.log('MONEY / RESOURCES Guardian v1: contract checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
