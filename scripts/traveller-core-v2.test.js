const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runtimeRoot = path.resolve(__dirname, '..', 'public', 'art', 'avatars', 'traveller-core-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'manifest.json'), 'utf8'));
const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'app.js'), 'utf8');
const appearance = require('../public/traveller-appearance-v1.js');

function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(1, 4)], [80, 78, 71]);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

test('Traveller Core keeps female known but gated until its complete runtime pack passes QA', () => {
  assert.deepEqual(manifest.genders, ['male', 'female']);
  assert.deepEqual(manifest.poses, ['idle', 'arms-up', 'seated', 'window-back']);
  assert.deepEqual(appearance.KNOWN_GENDERS, ['male', 'female']);
  assert.deepEqual(appearance.selectableGenders(), ['male']);
  assert.equal(appearance.isSelectable('female'), false);
  assert.match(appSource, /const AVATAR_CORE_KNOWN_GENDERS = window\.TravellerAppearanceV1[\s\S]*KNOWN_GENDERS/);
  assert.match(appSource, /const AVATAR_CORE_GENDERS = window\.TravellerAppearanceV1[\s\S]*selectableGenders\(\)/);
  assert.match(appSource, /const AVATAR_CORE_POSES = \['idle', 'arms-up', 'window-back'\];/);
  assert.match(appSource, /const AVATAR_CORE_RENDER_POSES = \[\.\.\.AVATAR_CORE_POSES, 'seated'\];/);
  assert.match(appSource, /if \(state === 'tired'\) return 'seated';/);
  assert.match(appSource, /TravellerRoomV4\.frameSrc\('bench-rest\.png', travellerGender\)[\s\S]*class="den-tired-seat"/);
  // v161: автопаузу анимаций держит нагрузка дня, а не удалённая шкала энергии.
  assert.match(appSource, /options\.automatic && \(dayLoadTired\(\)/);
  assert.match(appSource, /function denLifeCanAct\(shell\)[\s\S]*dayLoadTired\(\)/);
  assert.match(appSource, /function pauseDenSceneForViewport\(shell\)/);
  assert.match(appSource, /female:\s*\{ label: 'Женский'/);
  assert.match(appSource, /if \(!AVATAR_CORE_GENDERS\.includes\(gender\)\) throw new Error\('incomplete Traveller pack'\)/);
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
