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

assert.equal(toad.VERSION, '3.4.0');
assert.equal(toad.frameSrc('calm', true), '/art/pets/body-toad-v1/states/calm.png');
assert.equal(toad.frameSrc('strained', true), '/art/pets/body-toad-v1/states/strained.png');
assert.equal(toad.motionFrameSrc('air'), '/art/pets/body-toad-v1/motion-v4/hop-air.png?v=20260806-3');
assert.equal(toad.pairFrameSrc('greet-contact'), '/art/pets/body-toad-v1/pair-v4/greet-contact.png?v=20260806-3');
assert.equal(toad.pairFrameSrc('unknown'), '/art/pets/body-toad-v1/pair-v4/rest-contact.png?v=20260806-3');
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

console.log('BODY Guardian life v4: contract checks passed');
