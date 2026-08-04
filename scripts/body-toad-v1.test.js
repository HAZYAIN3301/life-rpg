'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = fs.existsSync(path.join(__dirname, 'public', 'body-toad-v1.js'))
  ? __dirname
  : path.resolve(__dirname, '..');
const toad = require(path.join(projectRoot, 'public', 'body-toad-v1.js'));

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

assert.equal(toad.VERSION, '2.1.0');
assert.deepEqual(toad.STATES, ['calm', 'thriving', 'strained', 'restoring']);
assert.equal(toad.normalizeState('thriving'), 'thriving');
assert.equal(toad.normalizeState('unknown'), 'calm');
assert.equal(toad.stateFromPetState('hungry'), 'strained');
assert.equal(toad.stateFromPetState('growing'), 'calm');
assert.equal(toad.stateFromPetState('full'), 'thriving');
assert.equal(toad.stateFromPetState('overfed'), 'restoring');
assert.equal(toad.frameSrc('calm', true), '/art/pets/body-toad-v1/states/calm.png');
assert.equal(toad.frameSrc('strained', true), '/art/pets/body-toad-v1/states/strained.png');
assert.equal(toad.pairFrameSrc('greet-contact'), '/art/pets/body-toad-v1/pair-v2/greet-contact.png');
assert.equal(toad.pairFrameSrc('rest-pet'), '/art/pets/body-toad-v1/pair-v2/rest-pet.png');
assert.equal(toad.pairFrameSrc('unknown'), '/art/pets/body-toad-v1/pair-v2/rest-contact.png');

const html = toad.markup({ state: 'thriving', className: 'qa"class', label: 'Жаба <босс>' });
assert.match(html, /data-body-toad/);
assert.match(html, /data-state="thriving"/);
assert.match(html, /qa&quot;class/);
assert.match(html, /Жаба &lt;босс&gt;/);

assert.deepEqual(Object.keys(toad.INTERACTIONS), ['greet', 'train', 'rest']);
for (const interaction of Object.values(toad.INTERACTIONS)) {
  assert.ok(interaction.duration >= 1000 && interaction.duration <= 3000);
  assert.ok(toad.STATES.includes(interaction.state));
  assert.ok(interaction.pairFrames.length >= 1);
}

const pairRoot = path.join(projectRoot, 'public', 'art', 'pets', 'body-toad-v1', 'pair-v2');
const manifest = JSON.parse(fs.readFileSync(path.join(pairRoot, 'manifest.json'), 'utf8'));
assert.equal(manifest.avatar, 'male-traveller-core-v2');
assert.equal(manifest.femaleRuntime, false);
assert.equal(manifest.groundY, 1470);
assert.deepEqual(manifest.interactions.rest, ['rest-contact.png', 'rest-pet.png']);
for (const file of Object.values(manifest.interactions).flat()) {
  assert.deepEqual(pngSize(path.join(pairRoot, file)), [1536, 1536]);
}

console.log('BODY Guardian v2 pair: contract checks passed');
