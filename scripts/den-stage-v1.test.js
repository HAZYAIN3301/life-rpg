'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stage = require('../public/den-stage-v1.js');

assert.equal(stage.VERSION, '1.3.0');
assert.equal(stage.PROFILES.bodyToad.width, 19.2);
assert.equal(stage.PROFILES.bodyToad.footprint, 15.7);
const mixed = stage.layoutPets([
  { id: 'body', species: 'bodyToad' },
  { id: 'money', species: 'fortune' },
  { id: 'other', species: 'round' },
]);
assert.equal(mixed.length, 3);
assert.equal(new Set(mixed.map((entry) => entry.slot)).size, 3);
for (let i = 0; i < mixed.length; i += 1) {
  for (let j = i + 1; j < mixed.length; j += 1) assert.equal(stage.overlaps(mixed[i], mixed[j]), false);
}

const stageSource = read('public/den-stage-v1.js');
const css = read('public/styles.css');
assert.match(stageSource, /installHopFrames\(toad, 'meeting'\)/);
assert.match(stageSource, /installHopFrames\(toad, 'home'\)/);
assert.match(css, /is-body-pair-approaching \.den-avatar-core[\s\S]*translate: 24% 1%/);
assert.match(css, /is-body-pair-approaching \.den-body-toad[\s\S]*translate: -44% 0/);
assert.match(read('public/index.html'), /20260806-den-stage-v1-3-1/);
assert.match(read('public/sw.js'), /satoru-v98/);

console.log('den-stage-v1.3: ok');
