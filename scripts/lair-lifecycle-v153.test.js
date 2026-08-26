'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('public/app.js');
const index = read('public/index.html');
const sw = read('public/sw.js');
const stage = require('../public/den-stage-v1.js');
const toad = require('../public/body-toad-v1.js');
const slug = require('../public/recovery-slug-v1.js');
const penguin = require('../public/resources-penguin-v1.js');

assert.equal(stage.VERSION, '1.12.0');
assert.equal(toad.VERSION, '3.6.0');
assert.equal(slug.VERSION, '2.6.0');
assert.equal(penguin.VERSION, '1.3.0');
assert.equal(typeof toad.cancelPair, 'function');
assert.equal(typeof slug.cancelPair, 'function');
assert.equal(typeof penguin.cancelPair, 'function');

assert.match(app, /function beginDenSceneAction\(shell, owner\)/);
assert.match(app, /function denSceneActionCurrent\(token\)/);
assert.match(app, /function abortDenSceneAction\(shell, reason = 'cancelled'\)/);
assert.match(app, /function runDenSceneAction\(shell, owner, work, options = \{\}\)/);
assert.match(app, /function denSceneBusy\(shell\)/);
assert.match(app, /DEN_SCENE_TRANSITION_CLASSES/);
assert.match(app, /window\.BodyToadV1\.cancelPair\(shell, false\)/);
assert.match(app, /window\.RecoverySlugV1\.cancelPair\(shell, false\)/);
assert.match(app, /window\.ResourcesPenguinV1\.cancelPair\(shell\)/);
assert.match(app, /window\.ShadowDenV1\.cancelPair\(shell\)/);
assert.match(app, /abortDenSceneAction\(shell, 'offscreen'\)/);
assert.match(app, /await Promise\.allSettled\(resets\)/);
assert.match(app, /if \(!token\.cancelled && _denSceneActions\.get\(shell\) === token\) releaseDenSceneAction\(token\)/);
assert.match(app, /rect\.top >= 72 && rect\.bottom <= viewportHeight - 72/);
assert.match(app, /runDenSceneAction\(scope, `body:\$\{mode\}`/);
assert.match(app, /runDenSceneAction\(scope, `recovery:\$\{mode\}`/);
assert.match(app, /runDenSceneAction\(scope, `resources:\$\{mode\}`/);
assert.match(app, /runDenSceneAction\(scope, `shadow-pair:\$\{mode\}`/);
assert.match(app, /runDenSceneAction\(shell, `room:\$\{actionId\}`/);
assert.match(app, /if \(denSceneBusy\(scope\)\) return;/);
assert.match(app, /denSceneBusy\(shell\)\) return false/);

assert.match(index, /den-stage-v1\.js\?v=20260815-den-life-v158-1/);
assert.match(index, /body-toad-v1\.js\?v=20260819-traveller-f2-runtime-v167-1/);
assert.match(index, /recovery-slug-v1\.js\?v=20260819-traveller-f2-runtime-v167-1/);
assert.match(index, /resources-penguin-v1\.js\?v=20260819-traveller-f2-runtime-v167-1/);
assert.match(sw, /const CACHE = 'satoru-v181';/);

function classList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach((item) => values.add(item)),
    remove: (...items) => items.forEach((item) => values.delete(item)),
    contains: (item) => values.has(item),
  };
}

function fakeScope() {
  return {
    isConnected: true,
    classList: classList(),
    querySelector: () => null,
  };
}

async function assertApproachDoesNotStartPairAfterAbort(name, approach) {
  const scope = fakeScope();
  let current = true;
  let started = false;
  const run = approach(scope, async () => { started = true; return true; }, {
    approachMs: 1,
    returnMs: 1,
    duration: 1,
    isCurrent: () => current,
  });
  await new Promise((resolve) => setTimeout(resolve, 8));
  current = false;
  assert.equal(await run, false, `${name} must resolve false after its owner aborts`);
  assert.equal(started, false, `${name} must never start its pair after an owner abort`);
}

(async () => {
  const previousFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    await assertApproachDoesNotStartPairAfterAbort('Body', stage.approachBodyPair);
    await assertApproachDoesNotStartPairAfterAbort('Recovery', stage.approachRecoveryPair);
    await assertApproachDoesNotStartPairAfterAbort('Resources', stage.approachResourcesPair);
    await assertApproachDoesNotStartPairAfterAbort('Shadow', stage.approachShadowPair);
    console.log('Lair lifecycle v153: cancellation routes passed');
  } finally {
    globalThis.requestAnimationFrame = previousFrame;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

console.log('Lair lifecycle v153: contract checks passed');
