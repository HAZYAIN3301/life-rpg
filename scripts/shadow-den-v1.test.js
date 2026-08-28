'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const shadow = require('../public/shadow-den-v1.js');

assert.equal(shadow.VERSION, '1.5.0');
assert.deepEqual(shadow.TRAVELLER_GENDERS, ['male', 'female']);
assert.deepEqual(shadow.AUTHORED_PAIR_GENDERS, ['male', 'female']);
assert.equal(shadow.normalizeTravellerGender(), 'male');
assert.equal(shadow.normalizeTravellerGender('female'), 'female');
assert.equal(shadow.normalizeTravellerGender('unknown'), null);
assert.equal(shadow.normalizeTravellerGender(''), null);
assert.equal(shadow.normalizeTravellerGender(null), null);
assert.equal(shadow.hasPairArt('male'), true);
assert.equal(shadow.hasPairArt('female'), true);
assert.equal(shadow.hasPairArt('unknown'), false);
assert.deepEqual(shadow.FORMS, ['spark', 'spirit', 'guardian', 'keeper']);
assert.deepEqual(Object.keys(shadow.SOLO), ['greet', 'listen', 'think', 'speak']);
assert.deepEqual(Object.keys(shadow.INTERACTIONS), ['attune', 'rest', 'silence']);
assert.equal(shadow.formForTier(-9), 'spark');
assert.equal(shadow.formForTier(99), 'keeper');
assert.match(shadow.pairSrc(0), /attune-spark\.png/);
assert.match(shadow.pairSrc(3), /attune-keeper\.png/);
assert.equal(shadow.pairSrc(0, 'female'), '/art/companions/shadow-den-v1/pair-v1/female/f2-v1/attune-spark.png?v=20260811-1');
assert.equal(shadow.pairSrc(0, ''), null);
assert.match(shadow.pairMarkup({ tier: 2, gender: 'female' }), /data-traveller-gender="female"/);
assert.equal(shadow.pairMarkup({ tier: 2, gender: '' }), '');
assert.equal(shadow.pairMarkup(null), '');

for (const form of shadow.FORMS) {
  const file = path.join(root, 'public/art/companions/shadow-den-v1/pair-v1', `attune-${form}.png`);
  assert.ok(fs.existsSync(file), `${form} pair frame is missing`);
  const png = fs.readFileSync(file);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
}

const app = read('public/app.js');
const css = read('public/styles.css');
const index = read('public/index.html');
const sw = read('public/sw.js');
for (const action of ['shadow-den-solo', 'shadow-den-pair', 'shadow-den-course']) assert.match(app, new RegExp(action));
for (const key of ['Взаимодействие с Тенью', 'Позвать Тень', 'Поговорить', 'Проверить курс']) {
  assert.match(app, new RegExp(key));
}
const denSection = app.slice(app.indexOf('den-shadow-actions'), app.indexOf("if (bodyGuardian) guardianSections.push"));
for (const hiddenUntilAuthored of ['Прислушаться', 'Подумать вместе', 'Свериться', 'Разделить тишину']) {
  assert.doesNotMatch(denSection, new RegExp(hiddenUntilAuthored));
}
assert.match(app, /onShadowBeat/);
assert.match(app, /onShadowPair/);
assert.match(app, /function revealDenSceneForInteraction\(scope\)/);
assert.match(app, /is-shadow-pair-at-meeting/);
assert.match(css, /\.shadow-den-pair-v1/);
assert.match(css, /is-shadow-pair-active/);
assert.match(css, /body:has\(\.focus-pill\.show\) \.den-shell/);
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*shadow-den-pair-v1/);
assert.match(index, /shadow-den-v1\.js\?v=20260819-traveller-f2-runtime-v167-1/);
assert.match(sw, /const CACHE = 'satoru-v191'/);
for (const form of shadow.FORMS) assert.match(sw, new RegExp(`shadow-den-v1/pair-v1/attune-${form}\\.png`));
assert.match(css, /\.shadow-den-pair-v1\.is-active \{ display: block; \}/);
assert.match(shadow.playPair.toString(), /installPairImage/);

const blockedClasses = new Set(['is-active']);
const inertClassList = {
  add(...names) { names.forEach((name) => blockedClasses.add(name)); },
  remove(...names) { names.forEach((name) => blockedClasses.delete(name)); },
};
const blockedAttributes = { 'aria-hidden': 'false' };
const blockedStage = { cleared: false, replaceChildren() { this.cleared = true; } };
const blockedPair = {
  dataset: { tier: '0' },
  isConnected: true,
  classList: inertClassList,
  setAttribute(name, value) { blockedAttributes[name] = String(value); },
  querySelector(selector) { return selector === '.shadow-den-pair-v1__stage' ? blockedStage : null; },
};
const blockedScope = {
  dataset: {},
  classList: inertClassList,
  querySelector(selector) { return selector === '[data-shadow-den-pair]' ? blockedPair : null; },
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
  assert.equal(await shadow.playPair(blockedScope, 'attune', { gender: 'female' }), false);
  assert.equal(blockedStage.cleared, false);
  assert.equal('travellerGender' in blockedPair.dataset, false);

  blockedStage.cleared = false;
  assert.equal(await shadow.playPair(blockedScope, 'attune', { gender: '' }), false);
  assert.equal(blockedStage.cleared, true);
  assert.equal('travellerGender' in blockedPair.dataset, false);

  const malePrefetch = await shadow.prefetch();
  const femalePrefetch = await shadow.prefetch({ gender: 'female' });
  const invalidPrefetch = await shadow.prefetch({ gender: '' });
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
    assert.equal(await shadow.playPair(blockedScope, 'attune', { gender: 'male' }), false);
  } finally {
    if (originalImage === undefined) delete global.Image;
    else global.Image = originalImage;
  }
  assert.equal(blockedStage.cleared, true);
  assert.equal(blockedClasses.has('is-active'), false);
  assert.equal(blockedAttributes['aria-hidden'], 'true');
  console.log('shadow-den-v1: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
