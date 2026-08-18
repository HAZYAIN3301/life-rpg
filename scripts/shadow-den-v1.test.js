'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const shadow = require('../public/shadow-den-v1.js');

assert.equal(shadow.VERSION, '1.3.0');
assert.deepEqual(shadow.FORMS, ['spark', 'spirit', 'guardian', 'keeper']);
assert.deepEqual(Object.keys(shadow.SOLO), ['greet', 'listen', 'think', 'speak']);
assert.deepEqual(Object.keys(shadow.INTERACTIONS), ['attune', 'rest', 'silence']);
assert.equal(shadow.formForTier(-9), 'spark');
assert.equal(shadow.formForTier(99), 'keeper');
assert.match(shadow.pairSrc(0), /attune-spark\.png/);
assert.match(shadow.pairSrc(3), /attune-keeper\.png/);

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
assert.match(index, /shadow-den-v1\.js\?v=20260815-shadow-pet-v160-1/);
assert.match(sw, /const CACHE = 'satoru-v163'/);
for (const form of shadow.FORMS) assert.match(sw, new RegExp(`shadow-den-v1/pair-v1/attune-${form}\\.png`));
assert.match(css, /\.shadow-den-pair-v1\.is-active \{ display: block; \}/);
assert.match(shadow.playPair.toString(), /installPairImage/);

console.log('shadow-den-v1: ok');
