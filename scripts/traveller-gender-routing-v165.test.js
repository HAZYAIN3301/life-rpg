'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const app = read('public/app.js');
const html = read('public/index.html');
const sw = read('public/sw.js');
const appearance = require('../public/traveller-appearance-v1.js');
const motion = require('../public/traveller-motion-v3.js');
const bodyToad = require('../public/body-toad-v1.js');
const recoverySlug = require('../public/recovery-slug-v1.js');
const resourcesPenguin = require('../public/resources-penguin-v1.js');
const shadowDen = require('../public/shadow-den-v1.js');

function roomController() {
  const context = {
    clearTimeout,
    console,
    document: { querySelector: () => null },
    Image: class {},
    localStorage: {
      getItem: () => null,
      removeItem() {},
      setItem() {},
    },
    setTimeout,
  };
  context.window = context;
  vm.runInNewContext(read('public/traveller-room-v4.js'), context, { filename: 'traveller-room-v4.js' });
  return context.TravellerRoomV4;
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} has no closing brace`);
}

test('female morphology is selectable only because every authored capability is complete', () => {
  assert.deepEqual(appearance.KNOWN_GENDERS, ['male', 'female']);
  assert.deepEqual(appearance.selectableGenders(), ['male', 'female']);
  assert.deepEqual(appearance.selectionResult('female'), {
    ok: true,
    reason: null,
    gender: 'female',
  });
  assert.match(app, /AVATAR_CORE_KNOWN_GENDERS[\s\S]*TravellerAppearanceV1\.KNOWN_GENDERS/);
  assert.match(app, /AVATAR_CORE_GENDERS[\s\S]*TravellerAppearanceV1\.selectableGenders\(\)/);
  assert.match(app, /if \(!AVATAR_CORE_GENDERS\.includes\(gender\)\) throw new Error\('incomplete Traveller pack'\)/);
});

test('an explicit female route never borrows an active male frame', () => {
  const room = roomController();
  const femalePaths = [
    appearance.assetPath('female', 'core', 'idle.png'),
    motion.frameSrc('walkA', 'female'),
    room.frameSrc('bench-rest.png', 'female'),
    bodyToad.pairFrameSrc('greet-contact', 'female'),
    recoverySlug.pairFrameSrc('greet-contact', 'female'),
    resourcesPenguin.pairSrc('greet-contact', 'female'),
    shadowDen.pairSrc(0, 'female'),
  ];
  femalePaths.forEach((value) => {
    assert.equal(typeof value, 'string');
    assert.match(value, /\/female\//);
    assert.doesNotMatch(value, /\/male\//);
  });
  assert.equal(motion.frameSrc('walkA', 'unknown'), null);
  assert.equal(room.frameSrc('bench-rest.png', 'unknown'), null);
  for (const guardian of [bodyToad, recoverySlug, resourcesPenguin, shadowDen]) {
    assert.equal(guardian.hasPairArt('female'), true, 'every female contact controller must use its authored F2 pack');
  }
  assert.doesNotMatch(app, /\/art\/avatars\/traveller-core-v1\/male\//);
});

test('every Traveller motion, room and contact-scene entry receives the selected gender', () => {
  assert.match(app, /TravellerMotionV3\.frameSrc\(key, gender\)/);
  assert.match(app, /TravellerMotionV3\.frameSrc\(key, safeGender\)/);
  assert.match(app, /TravellerMotionV3\.blinkMarkup\(safeGender\)/);
  assert.match(app, /const walkOptions = \{ preload: preloadAvatarImage, gender \};/);
  assert.equal((app.match(/TravellerMotionV3\.walkTo\(host, /g) || []).length, 3);
  assert.match(app, /TravellerMotionV3\.playWindowVisit\(host, \{\s*gender: avatarCoreGender\(\),/);

  assert.match(app, /TravellerRoomV4\.actionsFor\(avatarCoreGender\(\)\)/);
  assert.match(app, /TravellerRoomV4\.actionsFor\(safeGender\)/);
  assert.match(app, /TravellerRoomV4\.frameSrc\('bench-rest\.png', travellerGender\)/);
  assert.match(app, /TravellerRoomV4\.frameSrc\('bench-portal-reach\.png', travellerGender\)/);
  assert.match(app, /start\(shell, actionId, \{\s*gender: avatarCoreGender\(\),/);
  assert.match(app, /TravellerRoomV4\.play\(shell, 'bench-rest', \{ gender \}\)/);
  assert.match(app, /TravellerRoomV4\.preload\('bench-read', \{ gender \}\)/);
  assert.match(app, /TravellerRoomV4\.markup\(\{ gender: travellerGender,/);
  assert.match(app, /TravellerRoomV4\.restore\([^\n]+\{ gender: avatarCoreGender\(\),/);

  for (const controller of ['BodyToadV1', 'RecoverySlugV1', 'ResourcesPenguinV1', 'ShadowDenV1']) {
    assert.match(app, new RegExp(`window\\.${controller}\\.pairMarkup\\(\\{ gender: travellerGender,`));
    assert.match(app, new RegExp(`window\\.${controller}\\.hasPairArt\\(gender\\)`));
    assert.match(app, new RegExp(`window\\.${controller}\\.playPair\\(scope, mode, \\{ gender,`));
  }
  assert.match(app, /return playShadowSoloScene\(scope, fallback, \{ automatic, duration \}\);/);
});

test('gender changes are durable and roll back before any visual commit when persistence fails', () => {
  const source = functionSource(app, 'setAvatarCoreGender');
  const gate = source.indexOf('if (!AVATAR_CORE_GENDERS.includes(gender))');
  const queueCapture = source.indexOf('const previousQueue = _avatarCoreGenderChangeQueue;');
  const queueReplace = source.indexOf('_avatarCoreGenderChangeQueue = new Promise');
  const queueAwait = source.indexOf('await previousQueue.catch(() => {});');
  const sameGenderReturn = source.indexOf('if (avatarCoreGender() === safeGender) return safeGender;');
  const previous = source.indexOf('const previous = avatarCoreGender();');
  const mutation = source.indexOf('State.settings.avatarCoreGender = safeGender;');
  const save = source.indexOf("const saved = await Store.saveNow('settings', State.settings);");
  const rollback = source.indexOf('State.settings.avatarCoreGender = previous;');
  const visualCommit = source.indexOf("document.querySelectorAll('.avatar-core-stack')");
  const swaps = source.indexOf("const swaps = [...document.querySelectorAll('.avatar-core-stack')]");
  const swapsSettled = source.indexOf('await Promise.allSettled(swaps);');
  const buttonCommit = source.indexOf("document.querySelectorAll('[data-action=\"avatar-core-gender\"]')");
  const queueRelease = source.indexOf('finally {\n    releaseQueue();');
  for (const [label, value] of Object.entries({
    gate,
    queueCapture,
    queueReplace,
    queueAwait,
    sameGenderReturn,
    previous,
    mutation,
    save,
    rollback,
    visualCommit,
    swaps,
    swapsSettled,
    buttonCommit,
    queueRelease,
  })) {
    assert.notEqual(value, -1, `${label} contract is missing`);
  }
  assert.match(app, /let _avatarCoreGenderChangeQueue = Promise\.resolve\(\);/);
  assert.ok(gate < mutation, 'incomplete packs are rejected before state mutation');
  assert.ok(queueCapture < queueReplace && queueReplace < queueAwait, 'gender changes must serialize through the shared queue');
  assert.ok(queueAwait < sameGenderReturn, 'same-gender no-op is evaluated only after earlier changes settle');
  assert.ok(previous < mutation && mutation < save, 'previous state is captured before saveNow');
  assert.ok(save < rollback && rollback < visualCommit, 'failed persistence rolls back before changing visible stacks');
  assert.ok(swaps < swapsSettled && swapsSettled < buttonCommit, 'all stack swaps settle before controls announce the new gender');
  assert.ok(queueRelease > buttonCommit, 'the serialized queue is released in the final cleanup phase');
  assert.match(source, /if \(!saved\) \{[\s\S]*State\.settings\.avatarCoreGender = previous;[\s\S]*throw new Error\('Traveller gender save failed'\)/);
  assert.match(source, /await Promise\.allSettled\(swaps\)/);
  assert.doesNotMatch(source, /Store\.save\('settings'/);
  assert.match(app, /const blinkImage = stack\.querySelector\('\.avatar-core-blink-layer img'\);/);
  assert.match(app, /const blinkSrc = window\.TravellerMotionV3 && window\.TravellerMotionV3\.frameSrc\('blink', safeGender\);/);
  assert.match(app, /if \(blinkImage && blinkSrc\) blinkImage\.src = blinkSrc;/);
});

test('v167 app shell loads the resolver before consumers and pins every changed runtime', () => {
  const revision = '20260819-traveller-f2-runtime-v167-1';
  const pinned = [
    'shadow-den-v1.js',
    'body-toad-v1.js',
    'recovery-slug-v1.js',
    'resources-penguin-v1.js',
    'traveller-appearance-v1.js',
    'traveller-motion-v3.js',
    'traveller-room-v4.js',
    'app.js',
  ];
  pinned.forEach((file) => assert.match(html, new RegExp(`${file.replaceAll('.', '\\.')}\\?v=${revision}`), `${file} must use the v167 pin`));
  const appearanceIndex = html.indexOf('traveller-appearance-v1.js');
  const motionIndex = html.indexOf('traveller-motion-v3.js');
  const roomIndex = html.indexOf('traveller-room-v4.js');
  const appIndex = html.indexOf('app.js?v=');
  assert.ok(appearanceIndex >= 0 && appearanceIndex < motionIndex && motionIndex < roomIndex && roomIndex < appIndex);
  for (const file of ['shadow-den-v1.js', 'body-toad-v1.js', 'recovery-slug-v1.js', 'resources-penguin-v1.js']) {
    assert.ok(html.indexOf(file) < appIndex, `${file} must load before app.js`);
  }
  assert.match(sw, /const CACHE = 'satoru-v168';/);
  assert.match(sw, /'traveller-appearance-v1\.js', 'traveller-motion-v3\.js', 'traveller-room-v4\.js'/);
});
