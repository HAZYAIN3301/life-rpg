const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runtimeRoot = path.resolve(__dirname, '..', 'public', 'art', 'avatars', 'traveller-core-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'manifest.json'), 'utf8'));
const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'app.js'), 'utf8');

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

test('Traveller Core archive stays auditable while active V4 is male-only', () => {
  assert.deepEqual(manifest.genders, ['male', 'female']);
  assert.deepEqual(manifest.poses, ['idle', 'arms-up', 'seated', 'window-back']);
  assert.match(appSource, /const AVATAR_CORE_GENDERS = \['male'\];/);
  assert.match(appSource, /const AVATAR_CORE_POSES = \['idle', 'arms-up', 'window-back'\];/);
  assert.match(appSource, /const AVATAR_CORE_RENDER_POSES = \[\.\.\.AVATAR_CORE_POSES, 'seated'\];/);
  assert.match(appSource, /if \(state === 'tired'\) return 'seated';/);
  assert.match(appSource, /class="den-tired-seat"[\s\S]*bench-rest\.png/);
  assert.match(appSource, /options\.automatic && \(energyPct\(\) <= 30/);
  assert.match(appSource, /function denLifeCanAct\(shell\)[\s\S]*energyPct\(\) <= 30/);
  assert.match(appSource, /function pauseDenSceneForViewport\(shell\)/);
  assert.doesNotMatch(appSource, /female:\s*\{ label: 'Женский'/);
  assert.equal(manifest.animation, 'authored-full-pose-runtime-css-js');
  assert.equal(manifest.runtime.activeGender, 'male');
  assert.equal(manifest.runtime.femaleRuntime, false);
  assert.equal(manifest.runtime.motionPack, 'male/motion-v3/manifest.json');
  assert.equal(manifest.runtime.roomActionPack, 'male/room-actions-v4/manifest.json');
  assert.equal(manifest.runtime.roomActionLayout, 'workshop-v5');
  assert.equal(manifest.klingRequired, false);
});

test('the three selectable poses and seated energy pose share the 640x900 stage', () => {
  const active = manifest.assets.filter((asset) => asset.gender === 'male' && ['idle', 'arms-up', 'seated', 'window-back'].includes(asset.pose));
  assert.equal(active.length, 4);
  for (const asset of active) {
    const file = path.join(runtimeRoot, asset.file);
    assert.equal(fs.existsSync(file), true, `${asset.id} is missing`);
    assert.deepEqual(pngSize(file), [640, 900], `${asset.id} has the wrong canvas`);
    assert.equal(asset.result, 'PASS');
    assert.equal(asset.transparentCorners, true);
  }
});
