'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stage = require('../public/den-stage-v1.js');

assert.equal(stage.VERSION, '1.7.0');
assert.equal(stage.PROFILES.bodyToad.width, 19.2);
assert.equal(stage.PROFILES.bodyToad.footprint, 15.7);
const mixed = stage.layoutPets([
  { id: 'body', species: 'bodyToad' },
  { id: 'recovery', species: 'recoverySlug' },
  { id: 'money', species: 'resourcesPenguin' },
]);
assert.equal(mixed.length, 3);
assert.equal(mixed.find((entry) => entry.id === 'body').slot, 'west');
assert.equal(mixed.find((entry) => entry.id === 'money').slot, 'east');
assert.equal(mixed.find((entry) => entry.id === 'recovery').slot, 'mid-east');
assert.equal(new Set(mixed.map((entry) => entry.slot)).size, 3);
for (let i = 0; i < mixed.length; i += 1) {
  for (let j = i + 1; j < mixed.length; j += 1) assert.equal(stage.overlaps(mixed[i], mixed[j]), false);
}

const stageSource = read('public/den-stage-v1.js');
const css = read('public/styles.css');
assert.match(stageSource, /installHopFrames\(toad, 'meeting'\)/);
assert.match(stageSource, /installHopFrames\(toad, 'home'\)/);
assert.match(stageSource, /installGlideFrames\(slug, 'meeting'\)/);
assert.match(stageSource, /installGlideFrames\(slug, 'home'\)/);
assert.match(stageSource, /installWaddleFrames\(penguin, 'meeting'\)/);
assert.match(stageSource, /installWaddleFrames\(penguin, 'home'\)/);
assert.match(css, /is-body-pair-approaching \.den-avatar-core[\s\S]*translate: 24% 1%/);
assert.match(css, /bodyToadMeetingArc/);
assert.match(css, /bodyToadMeetingReturnArc/);
assert.match(css, /data-toad-direction="left"/);
assert.match(read('public/index.html'), /20260807-den-stage-v1-7/);
const swCache = read('public/sw.js').match(/const CACHE = 'satoru-v(\d+)'/);
assert.ok(swCache, 'service-worker cache version must be declared');
assert.ok(Number(swCache[1]) >= 105, 'den stage requires cache v105 or newer');

console.log('den-stage-v1.7: ok');
