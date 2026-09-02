'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const publicFile = (route) => path.join(PUBLIC, route.replace(/^\//, ''));
const appearance = require('../public/traveller-appearance-v1.js');
const motion = require('../public/traveller-motion-v3.js');
const bodyToad = require('../public/body-toad-v1.js');
const recoverySlug = require('../public/recovery-slug-v1.js');
const resourcesPenguin = require('../public/resources-penguin-v1.js');
const shadowDen = require('../public/shadow-den-v1.js');
const app = read('public/app.js');
const styles = read('public/styles.css');
const html = read('public/index.html');
const sw = read('public/sw.js');

function roomController() {
  const context = {
    clearTimeout,
    console,
    document: { querySelector: () => null },
    Image: class {},
    localStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    setTimeout,
  };
  context.window = context;
  vm.runInNewContext(read('public/traveller-room-v4.js'), context, { filename: 'traveller-room-v4.js' });
  return context.TravellerRoomV4;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pngInfo(file) {
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length >= 26, `${file} must contain a PNG header`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} must be PNG`);
  return {
    canvas: [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
    colorType: bytes[25],
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

test('F2 expectation pins one approved identity and 46 immutable, non-male routes', () => {
  const manifest = appearance.assetManifest('female');
  assert.ok(manifest);
  assert.equal(manifest.id, 'female-f2-high-ponytail');
  assert.equal(manifest.identitySha256, '5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da');
  assert.equal(manifest.revision, 'f2-v1');
  assert.equal(manifest.immutable, true);
  assert.equal(manifest.runtimeManifest, '/art/avatars/traveller-core-v1/female/f2-v1/manifest.json');
  assert.deepEqual(appearance.validateAssetManifest(manifest), { ok: true, errors: [], totalAssets: 46 });

  const assets = appearance.expectedAssets('female');
  assert.equal(assets.length, 46);
  assert.equal(new Set(assets).size, 46);
  assets.forEach((route) => {
    assert.match(route, /^\/art\/.+\/female\/f2-v1\/.+\.png$/);
    assert.doesNotMatch(route, /\/male\//);
    assert.doesNotMatch(route, /^\/art\/avatars\/traveller-core-v1\/female\/(?:poses|motion-v3|room-actions-v4)\//);
  });
  const identityDrift = clone(manifest);
  identityDrift.identitySha256 = 'b'.repeat(64);
  assert.equal(appearance.validateAssetManifest(identityDrift).ok, false);
  const pathDrift = clone(manifest);
  pathDrift.capabilities.core.assets[0] = pathDrift.capabilities.core.assets[0].replace('/f2-v1/', '/f3-v1/');
  assert.equal(appearance.validateAssetManifest(pathDrift).ok, false);
  const canvasDrift = clone(manifest);
  canvasDrift.capabilities.shadow.canvas = [1536, 1536];
  assert.equal(appearance.validateAssetManifest(canvasDrift).ok, false);
});

test('runtime manifest validator rejects identity drift, male paths and incomplete approval', () => {
  const expected = appearance.assetManifest('female');
  const capabilityForPath = (route) => appearance.CAPABILITY_KEYS.find((key) => expected.capabilities[key].assets.includes(route));
  const valid = {
    schema: 'satoru.traveller-runtime-asset-manifest/1',
    id: expected.id,
    revision: expected.revision,
    identitySha256: expected.identitySha256,
    status: 'runtime-approved',
    runtimeEligible: true,
    capabilities: Object.fromEntries(appearance.CAPABILITY_KEYS.map((key) => [key, true])),
    assets: appearance.expectedAssets('female').map((route) => ({
      path: route,
      sha256: 'a'.repeat(64),
      canvas: [...expected.capabilities[capabilityForPath(route)].canvas],
    })),
  };
  assert.deepEqual(appearance.validateRuntimeAssetManifest(valid), { ok: true, errors: [], totalAssets: 46 });

  const maleDrift = clone(valid);
  maleDrift.assets[0].path = maleDrift.assets[0].path.replace('/female/f2-v1/', '/male/');
  assert.equal(appearance.validateRuntimeAssetManifest(maleDrift).ok, false);
  const identityDrift = clone(valid);
  identityDrift.identitySha256 = 'b'.repeat(64);
  assert.equal(appearance.validateRuntimeAssetManifest(identityDrift).ok, false);
  const notApproved = clone(valid);
  notApproved.runtimeEligible = false;
  notApproved.capabilities.shadow = false;
  assert.equal(appearance.validateRuntimeAssetManifest(notApproved).ok, false);
  const wrongCanvas = clone(valid);
  wrongCanvas.assets[0].canvas = [1536, 1536];
  assert.equal(appearance.validateRuntimeAssetManifest(wrongCanvas).ok, false);
});

test('filesystem promotion is complete and every runtime manifest entry matches its immutable PNG', () => {
  const expected = appearance.assetManifest('female');
  const assets = appearance.expectedAssets('female');
  const present = assets.filter((route) => fs.existsSync(publicFile(route)));
  assert.equal(present.length, 46, `complete F2 promotion requires 46/46 assets, got ${present.length}`);

  const runtimeFile = publicFile(expected.runtimeManifest);
  assert.equal(fs.existsSync(runtimeFile), true, `F2 assets require ${expected.runtimeManifest}`);
  const payload = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  const runtimeValidation = appearance.validateRuntimeAssetManifest(payload, expected);
  assert.deepEqual(runtimeValidation, { ok: true, errors: [], totalAssets: 46 });
  assert.deepEqual(payload.assets.map((asset) => asset.path), assets, 'manifest order must match TravellerAppearance');
  for (const asset of payload.assets) {
    const capability = appearance.CAPABILITY_KEYS.find((key) => expected.capabilities[key].assets.includes(asset.path));
    assert.ok(capability, `${asset.path} must belong to a declared capability`);
    const info = pngInfo(publicFile(asset.path));
    assert.deepEqual(info.canvas, expected.capabilities[capability].canvas, `${asset.path} canvas drift`);
    assert.deepEqual(asset.canvas, info.canvas, `${asset.path} manifest canvas drift`);
    assert.equal(info.colorType, 6, `${asset.path} must be RGBA PNG`);
    assert.equal(asset.sha256, info.sha256, `${asset.path} SHA drift`);
  }
  assert.equal(appearance.isSelectable('female'), true);
});

test('every explicit female resolver stays on F2 and no contact controller may request male art', () => {
  const room = roomController();
  const femaleRoutes = [
    appearance.assetPath('female', 'core', 'idle.png'),
    motion.frameSrc('walkA', 'female'),
    room.frameSrc('bench-rest.png', 'female'),
    bodyToad.pairFrameSrc('greet-contact', 'female'),
    recoverySlug.pairFrameSrc('greet-contact', 'female'),
    resourcesPenguin.pairSrc('greet-contact', 'female'),
    shadowDen.pairSrc(0, 'female'),
  ];
  femaleRoutes.forEach((route) => {
    assert.match(route, /\/female\/f2-v1\//);
    assert.doesNotMatch(route, /\/male\//);
  });
  for (const controller of [bodyToad, recoverySlug, resourcesPenguin, shadowDen]) {
    assert.equal(controller.hasPairArt('female'), true, 'female contact playback must use the complete authored F2 pack');
  }
  assert.doesNotMatch(app, /\/art\/avatars\/traveller-core-v1\/male\//);
  assert.match(app, /\.hasPairArt\(gender\)/);
});

test('gender selector is localized, accessible and visible for both complete packs', () => {
  assert.deepEqual(appearance.selectableGenders(), ['male', 'female']);
  assert.match(app, /function avatarCoreGenderSelectorHTML\(gender = avatarCoreGender\(\)\)/);
  assert.match(app, /if \(AVATAR_CORE_GENDERS\.length < 2\) return '';/);
  assert.match(app, /\$\{avatarCoreGenderSelectorHTML\(gender\)\}/);
  assert.match(app, /<button type="button" class="avatar-core-gender-button/);
  assert.match(app, /data-action="avatar-core-gender"[\s\S]*aria-pressed=/);
  assert.match(app, /data-avatar-core-gender-status aria-live="polite"/);
  assert.match(app, /picker\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(styles, /\.avatar-core-gender-button \{ min-block-size: var\(--touch-min\); \}/);
  assert.match(styles, /\.avatar-core-gender-button:focus-visible/);
  for (const source of ['Облик', 'Мужской', 'Женский', 'Не удалось загрузить аватар']) {
    assert.match(app, new RegExp(`'${source}': \\{ en: '[^']+', de: '[^']+', uk: '[^']+', es: '[^']+' \\}`), `${source} needs RU/EN/DE/UK/ES copy`);
  }
});

test('v183 shell retains the complete immutable F2 runtime and pins changed shell files', () => {
  const originalRevision = '20260819-traveller-f2-runtime-v167-1';
  const feedbackRevision = '20260826-appearance-feedback-v183-1';
  for (const file of ['body-toad-v1.js', 'recovery-slug-v1.js', 'traveller-appearance-v1.js']) {
    assert.match(html, new RegExp(`${file.replaceAll('.', '\\.')}\\?v=${feedbackRevision}`));
  }
  for (const file of ['shadow-den-v1.js', 'resources-penguin-v1.js', 'traveller-motion-v3.js', 'traveller-room-v4.js']) {
    assert.match(html, new RegExp(`${file.replaceAll('.', '\\.')}\\?v=${originalRevision}`));
  }
  assert.match(html, /styles\.css\?v=20260902-goal-step-day-v215-1/);
  assert.match(html, /app\.js\?v=20260902-goal-step-day-v215-1/);
  assert.match(sw, /const CACHE = 'satoru-v217';/);
  const shellRoutes = [appearance.assetManifest('female').runtimeManifest, ...appearance.expectedAssets('female')]
    .map((route) => route.replace(/^\//, ''));
  for (const route of shellRoutes) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((sw.match(new RegExp(`'${escaped}'`, 'g')) || []).length, 1, `${route} must appear once in SHELL`);
  }
});
