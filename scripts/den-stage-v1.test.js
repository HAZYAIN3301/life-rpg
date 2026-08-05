'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const stage = require('../public/den-stage-v1.js');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

assert.equal(stage.WORLD.width, 1536);
assert.equal(stage.WORLD.height, 864);
assert.equal(stage.APPROACH_MS, 2200);
assert.equal(stage.RETURN_MS, 2200);

const mixed = stage.layoutPets([
  { id: 'body', species: 'bodyToad' },
  { id: 'money', species: 'fortune' },
  { id: 'other', species: 'round' },
]);
assert.equal(mixed.length, 3);
assert.equal(new Set(mixed.map((entry) => entry.slot)).size, 3);
assert.equal(mixed.find((entry) => entry.id === 'body').slot, 'mid-east');
assert.equal(mixed.find((entry) => entry.id === 'money').slot, 'west');
for (let i = 0; i < mixed.length; i += 1) {
  for (let j = i + 1; j < mixed.length; j += 1) {
    assert.equal(stage.overlaps(mixed[i], mixed[j]), false, `${mixed[i].id} overlaps ${mixed[j].id}`);
  }
}

const reordered = stage.layoutPets([
  { id: 'money', species: 'fortune' },
  { id: 'body', species: 'bodyToad' },
]);
assert.equal(reordered[0].id, 'money');
assert.equal(reordered[0].slot, 'west');
assert.equal(reordered[1].id, 'body');
assert.equal(reordered[1].slot, 'mid-east');
assert.match(stage.styleVars(reordered[1]), /--den-stage-left:/);
assert.match(stage.styleVars(reordered[1]), /--den-stage-z:8/);

const overflow = stage.layoutPets([
  { id: 'a', species: 'round' },
  { id: 'b', species: 'round' },
  { id: 'c', species: 'round' },
  { id: 'd', species: 'round' },
]);
assert.equal(overflow.length, 3);

const app = read('public/app.js');
const css = read('public/styles.css');
const index = read('public/index.html');
const sw = read('public/sw.js');
assert.match(app, /DenStageV1\.layoutPets/);
assert.match(app, /DenStageV1\.approachBodyPair/);
assert.match(css, /\.den-pet\[data-den-slot\]/);
assert.match(css, /data-locomotion-position="window"\],[\s\S]*data-locomotion-position="bench"\]\s*\{ scale: \.78/);
assert.match(css, /is-body-pair-at-meeting/);
assert.match(css, /is-body-pair-approaching \.den-body-toad[\s\S]*translate: 0 0/);
assert.match(read('public/den-stage-v1.js'), /installWalkFrames\(avatar, 'right'\)/);
assert.match(read('public/den-stage-v1.js'), /installWalkFrames\(avatar, 'left'\)/);
assert.match(css, /\.body-pair-v2__frame[\s\S]*transform: scaleX\(-1\)/);
assert.match(css, /\.pet-card\.pet-card-body-toad \{ grid-column: auto/);
assert.match(index, /den-stage-v1\.js\?v=20260805-den-stage-v1-2/);
assert.match(sw, /satoru-v95/);
assert.match(sw, /'den-stage-v1\.js'/);

console.log('den-stage-v1: ok');
