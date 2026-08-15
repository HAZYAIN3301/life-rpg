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

assert.equal(penguin.VERSION, '1.1.0');
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

console.log('MONEY / RESOURCES Guardian v1: contract checks passed');
