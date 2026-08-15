'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = fs.existsSync(path.join(__dirname, 'public', 'traveller-motion-v3.js'))
  ? __dirname
  : path.resolve(__dirname, '..');
const motion = require(path.join(projectRoot, 'public', 'traveller-motion-v3.js'));

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

assert.equal(motion.VERSION, '3.2.0');
assert.equal(motion.WALK_MS, 2200);
assert.equal(typeof motion.walkTo, 'function');
assert.equal(typeof motion.announceLeg, 'function');
assert.equal(motion.frameSrc('blink'), '/art/avatars/traveller-core-v1/male/motion-v3/idle-blink.png');
assert.equal(motion.frameSrc('walkA'), '/art/avatars/traveller-core-v1/male/motion-v3/walk-a.png');
assert.equal(motion.frameSrc('walkB'), '/art/avatars/traveller-core-v1/male/motion-v3/walk-b.png');
assert.match(motion.blinkMarkup(), /avatar-core-blink-layer/);

const motionRoot = path.join(projectRoot, 'public', 'art', 'avatars', 'traveller-core-v1', 'male', 'motion-v3');
const manifest = JSON.parse(fs.readFileSync(path.join(motionRoot, 'manifest.json'), 'utf8'));
assert.equal(manifest.avatar, 'male-traveller-core-v2');
assert.equal(manifest.femaleRuntime, false);
assert.equal(manifest.floorY, 860);
assert.equal(manifest.passed, true);
for (const file of [manifest.assets.blink, ...manifest.assets.walk]) {
  assert.deepEqual(pngSize(path.join(motionRoot, file)), [640, 900]);
}

const index = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf8');
assert.ok(index.indexOf('traveller-motion-v3.js') < index.indexOf('app.js?v='));
const app = fs.readFileSync(path.join(projectRoot, 'public', 'app.js'), 'utf8');
assert.match(app, /runDenAvatarWindowVisit/);
assert.match(app, /cancelDenAvatarLocomotion\(true\)/);
const styles = fs.readFileSync(path.join(projectRoot, 'public', 'styles.css'), 'utf8');
assert.match(styles, /avatarCoreBlink/);
assert.match(styles, /avatarCoreWalkA/);
assert.match(styles, /data-locomotion-position="window"/);

console.log('Traveller locomotion v3: runtime contract checks passed');
