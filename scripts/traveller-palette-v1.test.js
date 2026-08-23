'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const palette = require('../public/traveller-palette-v1.js');
const inventory = require('../art-factory/traveller-appearance-v2-20260820/inventory.json');
const authoredCatalog = require('../art-factory/traveller-appearance-v2-20260820/palette-catalog.json');
const authoredGolden = require('../art-factory/traveller-appearance-v2-20260820/palette-golden-vectors.json');

const SHA_B = 'b'.repeat(64);
const CATALOG_SHA = '4101b8bef8c0cbea479e7023f28dd9c8669369716a4f8da58f05a555de662f22';
const GOLDEN_SHA = 'dcf2ffc3a20e6ad0efb3c2932996c0e3840cc3bba86412c4916b09e0d0bdb2fc';



function paletteContract() {
  return undefined;
}

const CAPABILITY_ORDER = [
  'core',
  'motion',
  'room',
  'body-toad',
  'recovery-slug',
  'resources-penguin',
  'shadow',
];
const FACTORY_ASSET = new Map(inventory.assets.map((item) => [item.id, item]));
const MALE_IDLE = FACTORY_ASSET.get('male-v1:core:idle').baseRoute;
const MALE_WALK_A = FACTORY_ASSET.get('male-v1:motion:walk-a').baseRoute;
const MALE_WALK_B = FACTORY_ASSET.get('male-v1:motion:walk-b').baseRoute;
const FEMALE_IDLE = FACTORY_ASSET.get('female-f2-v1:core:idle').baseRoute;
const FEMALE_IDLE_MASK = FACTORY_ASSET.get('female-f2-v1:core:idle').maskRoute;

function manifest() {
  const flatFrames = inventory.assets.map((item) => ({
    id: item.id,
    variant: item.variant,
    capability: item.capability,
    frame: item.frame,
    canvas: item.canvas.slice(),
    baseRoute: item.baseRoute,
    baseSha256: item.baseSha256,
    maskRoute: item.maskRoute,
    maskSha256: SHA_B,
  }));
  const result = {
    schema: 'satoru.traveller-semantic-mask-runtime/1',
    id: 'traveller-appearance-v2',
    status: 'runtime-approved',
    runtimeEligible: true,
    maskRevision: 'palette-masks-v1',
    paletteCatalog: JSON.parse(JSON.stringify(authoredCatalog)),
    paletteCatalogSha256: CATALOG_SHA,
    goldenVectors: JSON.parse(JSON.stringify(authoredGolden)),
    goldenVectorsSha256: GOLDEN_SHA,
    manualApproval: {
      revision: 'test-approved-v1',
      approvedBy: 'automated-test',
    },
    variants: inventory.variantOrder.map((variantId) => ({
      id: variantId,
      ...inventory.variants[variantId],
      capabilities: CAPABILITY_ORDER.map((capabilityId) => ({
        id: capabilityId,
        frames: flatFrames.filter((item) => (
          item.variant === variantId && item.capability === capabilityId
        )),
      })),
    })),
  };
  return result;
}

function manifestFrame(payload, id) {
  for (const variant of payload.variants) {
    for (const capability of variant.capabilities) {
      const frame = capability.frames.find((item) => item.id === id);
      if (frame) return frame;
    }
  }
  throw new Error('Missing test frame: ' + id);
}

function exactArrayBuffer(value) {
  const bytes = Buffer.from(value, 'utf8');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function digestArrayBuffer(hex) {
  const bytes = Buffer.from(hex, 'hex');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function expectedAssetSha(path) {
  const item = inventory.assets.find((assetItem) => (
    assetItem.baseRoute === path || assetItem.maskRoute === path
  ));
  if (!item) throw new Error('Unknown integrity test path: ' + path);
  return item.maskRoute === path ? SHA_B : item.baseSha256;
}

class PathBlob {
  constructor(parts) {
    this.path = Buffer.from(parts[0]).toString('utf8');
  }
}

const VERIFIED_FETCH = async (path) => ({
  ok: true,
  arrayBuffer: async () => exactArrayBuffer(path),
  headers: { get: () => 'image/png' },
});

const VERIFIED_CRYPTO = {
  subtle: {
    digest: async (algorithm, buffer) => {
      assert.equal(algorithm, 'SHA-256');
      return digestArrayBuffer(expectedAssetSha(Buffer.from(buffer).toString('utf8')));
    },
  },
};

function defaultLook(morphology = 'female') {
  return {
    morphology,
    identityId: morphology === 'female' ? 'female-f2-v1' : 'male-v1',
    palette: { skin: 'original', hair: 'original', eyes: 'original' },
  };
}

function tintedLook(morphology = 'female') {
  return {
    ...defaultLook(morphology),
    palette: { skin: 'skin-umber', hair: 'hair-violet', eyes: 'eyes-ocean' },
  };
}

test('manifest lookup is exact and never crosses morphology', () => {
  const compiled = palette.compileManifest(manifest());
  assert.equal(compiled.revision, 'palette-masks-v1');
  assert.equal(compiled.identities.male['male-v1'].frames.length, 46);
  assert.equal(compiled.identities.female['female-f2-v1'].frames.length, 46);
  assert.equal(compiled.defaultPalette.skin, 'original');
  assert.equal(compiled.frameFor('female', FEMALE_IDLE).identityId, 'female-f2-v1');
  assert.equal(compiled.frameFor('male', FEMALE_IDLE), null);
  assert.equal(compiled.frameFor('female', FEMALE_IDLE + '?v=1'), null);
  assert.throws(
    () => palette.resolveFrameDescriptor(compiled, defaultLook('female'), MALE_IDLE),
    (error) => error.code === 'frame-not-authored',
  );
  assert.throws(
    () => palette.normalizeLook({ morphology: 'female', identityId: 'male-v1' }, compiled),
    (error) => error.code === 'unknown-look',
  );
  assert.throws(
    () => palette.normalizeLook({}, compiled),
    (error) => error.code === 'unknown-look',
  );
});

test('manifest rejects an asset path shared by two identities', () => {
  const duplicate = manifest();
  manifestFrame(duplicate, 'male-v1:core:arms-up').baseRoute = manifestFrame(
    duplicate,
    'male-v1:core:idle',
  ).baseRoute;
  assert.throws(
    () => palette.compileManifest(duplicate),
    (error) => error.code === 'invalid-manifest' && /exactly one frame/.test(error.message),
  );
});

test('manifest accepts only canonical local /art PNG routes', () => {
  const invalidPaths = [
    'https://example.com/art/female/idle.png',
    '//example.com/art/female/idle.png',
    '/art/female/idle.png?v=1',
    '/art/female/idle.png#v1',
    '/art/female//idle.png',
    '/art/idle.png',
    '/art/female/../male/idle.png',
    '/art/female\\idle.png',
    '/art/female/idle\n.png',
    '/assets/female/idle.png',
    '/art/female/idle.webp',
    '/art/female/IDLE.PNG',
    '/art/.private/idle.png',
  ];
  for (const path of invalidPaths) {
    const invalid = manifest();
    manifestFrame(invalid, 'female-f2-v1:core:arms-up').baseRoute = path;
    assert.throws(
      () => palette.compileManifest(invalid),
      (error) => error.code === 'invalid-manifest' && /exact authored asset path/.test(error.message),
      path,
    );
  }
});

test('factory candidate and unapproved runtime manifests are rejected', () => {
  const candidate = manifest();
  candidate.schema = 'satoru.traveller-semantic-mask-runtime-candidate/1';
  candidate.status = 'factory-candidate-manual-runtime-review-required';
  candidate.runtimeEligible = false;
  assert.throws(
    () => palette.compileManifest(candidate),
    (error) => error.code === 'invalid-manifest' && /semantic-mask-runtime\/1/.test(error.message),
  );
  const unapproved = manifest();
  unapproved.runtimeEligible = false;
  assert.throws(
    () => palette.compileManifest(unapproved),
    (error) => error.code === 'manifest-not-approved',
  );
});

test('forged compiled sentinels cannot bypass manifest, catalog or compositor validation', () => {
  const forgedManifest = {
    __travellerPaletteV2Compiled: true,
    schema: 'satoru.traveller-semantic-mask-runtime-candidate/1',
    status: 'runtime-approved',
    runtimeEligible: true,
  };
  assert.throws(
    () => palette.compileManifest(forgedManifest),
    (error) => error.code === 'invalid-manifest',
  );

  const forgedCatalog = {
    __travellerPaletteCatalogV2Compiled: true,
    targetFor() { return { lab: [0, 0, 0] }; },
    algorithm: {},
    palettes: { skin: {}, hair: {}, eyes: {} },
    defaultPalette: { skin: 'original', hair: 'original', eyes: 'original' },
  };
  assert.throws(
    () => palette.compilePaletteCatalog(forgedCatalog),
    (error) => error.code === 'invalid-manifest',
  );
  assert.throws(
    () => palette.recolorPixels({
      base: new Uint8ClampedArray([0, 0, 0, 255]),
      mask: new Uint8ClampedArray([0, 0, 0]),
      width: 1,
      height: 1,
      palette: { skin: 'original', hair: 'original', eyes: 'original' },
      catalog: forgedCatalog,
    }),
    (error) => error.code === 'invalid-manifest',
  );
});

test('runtime manifest pins revision, identities, embedded digests and exact frame foundation', () => {
  const wrongRevision = manifest();
  wrongRevision.maskRevision = 'palette-masks-v2';
  assert.throws(
    () => palette.compileManifest(wrongRevision),
    (error) => error.code === 'invalid-manifest' && /maskRevision/.test(error.message),
  );

  const missingIdentityDigest = manifest();
  delete missingIdentityDigest.variants[1].identitySha256;
  assert.throws(
    () => palette.compileManifest(missingIdentityDigest),
    (error) => error.code === 'invalid-manifest' && /identitySha256/.test(error.message),
  );

  const wrongCatalogDigest = manifest();
  wrongCatalogDigest.paletteCatalogSha256 = '0'.repeat(64);
  assert.throws(
    () => palette.compileManifest(wrongCatalogDigest),
    (error) => error.code === 'invalid-manifest' && /SHA-256 bindings/.test(error.message),
  );

  const inventedFrame = manifest();
  const invented = manifestFrame(inventedFrame, 'male-v1:core:arms-up');
  invented.frame = 'invented';
  invented.id = 'male-v1:core:invented';
  invented.maskRoute = '/art/avatars/traveller-appearance-v2/palette-masks-v1/male-v1/core/invented.png';
  assert.throws(
    () => palette.compileManifest(inventedFrame),
    (error) => error.code === 'invalid-manifest' && /foundation/.test(error.message),
  );

  const changedCanvas = manifest();
  manifestFrame(changedCanvas, 'male-v1:core:arms-up').canvas = [1, 1];
  assert.throws(
    () => palette.compileManifest(changedCanvas),
    (error) => error.code === 'invalid-manifest' && /foundation/.test(error.message),
  );

  const injectedBase = manifest();
  const injected = manifestFrame(injectedBase, 'male-v1:core:arms-up');
  injected.baseRoute = '/art/injected/base.png';
  injected.baseSha256 = 'c'.repeat(64);
  assert.throws(
    () => palette.compileManifest(injectedBase),
    (error) => error.code === 'invalid-manifest' && /foundation/.test(error.message),
  );
});

test('manifest rejects duplicate identities, masks and non-canonical ids', () => {
  const duplicateIdentity = manifest();
  duplicateIdentity.variants[1].id = 'male-v1';
  duplicateIdentity.variants[1].gender = 'male';
  duplicateIdentity.variants[1].morphologyRevision = 'male-v1';
  assert.throws(
    () => palette.compileManifest(duplicateIdentity),
    (error) => error.code === 'invalid-manifest' && /identity id must be globally unique/.test(error.message),
  );

  const duplicateMask = manifest();
  manifestFrame(duplicateMask, 'male-v1:core:arms-up').maskRoute = manifestFrame(
    duplicateMask,
    'male-v1:core:idle',
  ).maskRoute;
  assert.throws(
    () => palette.compileManifest(duplicateMask),
    (error) => error.code === 'invalid-manifest' && /Mask path may belong/.test(error.message),
  );

  const crossTypeCollision = manifest();
  manifestFrame(crossTypeCollision, 'male-v1:core:arms-up').baseRoute = manifestFrame(
    crossTypeCollision,
    'male-v1:core:idle',
  ).maskRoute;
  assert.throws(
    () => palette.compileManifest(crossTypeCollision),
    (error) => error.code === 'invalid-manifest' && /Base path may belong/.test(error.message),
  );

  const invalidId = manifest();
  manifestFrame(invalidId, 'male-v1:core:idle').frame = 'idle_bad';
  manifestFrame(invalidId, 'male-v1:core:idle').id = 'male-v1:core:idle_bad';
  assert.throws(
    () => palette.compileManifest(invalidId),
    (error) => error.code === 'invalid-manifest' && /ownership is inconsistent/.test(error.message),
  );
});

test('manifest rejects duplicate frame ids inside one identity', () => {
  const duplicate = manifest();
  const copy = {
    ...manifestFrame(duplicate, 'male-v1:core:idle'),
    baseRoute: '/art/male/idle-copy.png',
    maskRoute: '/art/avatars/traveller-appearance-v2/palette-masks-v1/male-v1/core/idle-copy.png',
  };
  duplicate.variants[0].capabilities[0].frames[1] = copy;
  assert.throws(
    () => palette.compileManifest(duplicate),
    (error) => error.code === 'invalid-manifest' && /only once inside identity/.test(error.message),
  );
});

test('default palette bypasses rendering but still requires an authored exact frame', async () => {
  let renderCalls = 0;
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async () => {
      renderCalls += 1;
      return 'blob:unexpected';
    },
  });
  const handle = await runtime.resolve(FEMALE_IDLE, defaultLook('female'));
  assert.equal(handle.url, FEMALE_IDLE);
  assert.equal(handle.bypass, true);
  assert.equal(handle.lookKey, 'female|female-f2-v1|skin:original|hair:original|eyes:original');
  assert.equal(renderCalls, 0);
  assert.equal(runtime.stats().size, 0);
  await assert.rejects(
    runtime.resolve(MALE_IDLE, defaultLook('female')),
    (error) => error.code === 'frame-not-authored',
  );
});

test('packed RGB channels select skin, hair and eye ramps deterministically', () => {
  const compiled = palette.compileManifest(manifest(), paletteContract());
  const base = new Uint8ClampedArray([
    80, 90, 100, 17,
    180, 170, 160, 203,
    120, 100, 90, 255,
    35, 45, 55, 0,
  ]);
  const mask = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    0, 0, 0, 255,
  ]);
  const options = {
    basePixels: base,
    maskPixels: mask,
    width: 4,
    height: 1,
    palette: tintedLook().palette,
    defaultPalette: compiled.defaultPalette,
    ramps: compiled,
  };
  const first = palette.recolorPixels(options);
  const second = palette.recolorPixels(options);
  assert.deepEqual(first, second);
  assert.notDeepEqual(Array.from(first.slice(0, 3)), Array.from(base.slice(0, 3)));
  assert.notDeepEqual(Array.from(first.slice(4, 7)), Array.from(base.slice(4, 7)));
  assert.notDeepEqual(Array.from(first.slice(8, 11)), Array.from(base.slice(8, 11)));
  assert.deepEqual(Array.from(first.slice(12, 16)), Array.from(base.slice(12, 16)));
  assert.deepEqual(
    [first[3], first[7], first[11], first[15]],
    [base[3], base[7], base[11], base[15]],
  );
});

test('factory golden vectors are byte-exact with RGB masks and immutable alpha', () => {
  const catalog = palette.compilePaletteCatalog(authoredCatalog);
  for (const vector of authoredGolden.vectors) {
    const base = new Uint8ClampedArray(vector.sourceRgba.flat());
    const mask = new Uint8ClampedArray(vector.maskRgb.flat());
    const expected = new Uint8ClampedArray(vector.expectedRgba.flat());
    const output = palette.recolorPixels({
      base,
      mask,
      width: vector.width,
      height: vector.height,
      palette: { ...catalog.defaultPalette, ...vector.targetIds },
      defaultPalette: catalog.defaultPalette,
      catalog,
    });
    assert.deepEqual(output, expected, vector.id);
    assert.deepEqual(
      Array.from(output).filter((unused, index) => index % 4 === 3),
      Array.from(base).filter((unused, index) => index % 4 === 3),
      vector.id + ' alpha',
    );
  }
});

test('manifest compilation pins the embedded golden payload', () => {
  const invalid = manifest();
  invalid.goldenVectors.vectors[0].expectedRgba[0][0] ^= 1;
  assert.throws(
    () => palette.compileManifest(invalid),
    (error) => error.code === 'invalid-manifest' && /goldenVectors payload/.test(error.message),
  );
});

test('palette catalog rejects drift from authored algorithm and target colors', () => {
  const changedAlgorithm = JSON.parse(JSON.stringify(authoredCatalog));
  changedAlgorithm.algorithm.paperResidual.lightness = 0.91;
  assert.throws(
    () => palette.compilePaletteCatalog(changedAlgorithm),
    (error) => error.code === 'invalid-manifest' && /paletteCatalog payload/.test(error.message),
  );

  const changedTarget = JSON.parse(JSON.stringify(authoredCatalog));
  changedTarget.ramps.skin[0].oklab[0] += 0.001;
  assert.throws(
    () => palette.compilePaletteCatalog(changedTarget),
    (error) => error.code === 'invalid-manifest' && /paletteCatalog payload/.test(error.message),
  );

  const coordinatedTarget = JSON.parse(JSON.stringify(authoredCatalog));
  coordinatedTarget.ramps.skin[0].hex = coordinatedTarget.ramps.skin[1].hex;
  coordinatedTarget.ramps.skin[0].oklab = coordinatedTarget.ramps.skin[1].oklab.slice();
  assert.throws(
    () => palette.compilePaletteCatalog(coordinatedTarget),
    (error) => error.code === 'invalid-manifest' && /paletteCatalog payload/.test(error.message),
  );

  const selfConsistentGolden = JSON.parse(JSON.stringify(authoredGolden));
  selfConsistentGolden.vectors[0].sourceRgba[3][0] = 11;
  selfConsistentGolden.vectors[0].expectedRgba[3][0] = 11;
  const runtime = manifest();
  runtime.goldenVectors = selfConsistentGolden;
  assert.throws(
    () => palette.compileManifest(runtime),
    (error) => error.code === 'invalid-manifest' && /goldenVectors payload/.test(error.message),
  );
});

test('alpha is identical for every coverage value and texture lightness remains ordered', () => {
  const compiled = palette.compileManifest(manifest(), paletteContract());
  const base = new Uint8ClampedArray([
    55, 45, 40, 1,
    125, 110, 100, 99,
    210, 195, 180, 254,
  ]);
  const mask = new Uint8ClampedArray([
    64, 0, 0, 0,
    128, 0, 0, 127,
    255, 0, 0, 255,
  ]);
  const output = palette.recolorPixels({
    base,
    mask,
    width: 3,
    height: 1,
    palette: { skin: 'skin-bronze', hair: 'original', eyes: 'original' },
    defaultPalette: compiled.defaultPalette,
    ramps: compiled,
  });
  assert.deepEqual([output[3], output[7], output[11]], [1, 99, 254]);
  const lightness = [0, 4, 8].map((offset) => (
    palette.rgbToOklab(output[offset], output[offset + 1], output[offset + 2])[0]
  ));
  assert.ok(lightness[0] < lightness[1]);
  assert.ok(lightness[1] < lightness[2]);
});

test('default channel is byte-identical even when its packed mask is present', () => {
  const compiled = palette.compileManifest(manifest(), paletteContract());
  const base = new Uint8ClampedArray([33, 88, 144, 121]);
  const mask = new Uint8ClampedArray([255, 0, 0, 255]);
  const output = palette.recolorPixels({
    base,
    mask,
    width: 1,
    height: 1,
    palette: defaultLook().palette,
    defaultPalette: compiled.defaultPalette,
    ramps: compiled,
  });
  assert.deepEqual(output, base);
});

test('pixel compositor fails closed on canvas and palette mismatch', () => {
  const compiled = palette.compileManifest(manifest(), paletteContract());
  assert.throws(
    () => palette.recolorPixels({
      base: new Uint8ClampedArray(4),
      mask: new Uint8ClampedArray(2),
      width: 1,
      height: 1,
      palette: tintedLook().palette,
      defaultPalette: compiled.defaultPalette,
      ramps: compiled,
    }),
    (error) => error.code === 'canvas-mismatch',
  );
  assert.throws(
    () => palette.recolorPixels({
      base: new Uint8ClampedArray(4),
      mask: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      palette: { skin: 'missing', hair: 'original', eyes: 'original' },
      defaultPalette: compiled.defaultPalette,
      ramps: compiled,
    }),
    (error) => error.code === 'unknown-palette',
  );
});

test('pixel compositor rejects overlapping packed channels above 255', () => {
  const compiled = palette.compileManifest(manifest(), paletteContract());
  assert.throws(
    () => palette.recolorPixels({
      base: new Uint8ClampedArray([90, 80, 70, 255]),
      mask: new Uint8ClampedArray([200, 56, 0, 255]),
      width: 1,
      height: 1,
      palette: defaultLook().palette,
      defaultPalette: compiled.defaultPalette,
      ramps: compiled,
    }),
    (error) => error.code === 'invalid-mask' && error.details?.sum === 256,
  );
  assert.doesNotThrow(() => palette.recolorPixels({
    base: new Uint8ClampedArray([90, 80, 70, 255]),
    mask: new Uint8ClampedArray([128, 127, 0, 255]),
    width: 1,
    height: 1,
    palette: defaultLook().palette,
    defaultPalette: compiled.defaultPalette,
    ramps: compiled,
  }));
});

test('concurrent resolves share one render and release is idempotent', async () => {
  let renderCalls = 0;
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async () => {
      renderCalls += 1;
      await gate;
      return 'blob:shared';
    },
  });
  const firstPromise = runtime.resolve(FEMALE_IDLE, tintedLook());
  const secondPromise = runtime.resolve(FEMALE_IDLE, tintedLook());
  finish();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(renderCalls, 1);
  assert.equal(first.url, second.url);
  assert.equal(first.lookKey, 'female|female-f2-v1|skin:skin-umber|hair:hair-violet|eyes:eyes-ocean');
  assert.equal(second.lookKey, first.lookKey);
  assert.equal(runtime.stats().referenced, 2);
  first.release();
  first.release();
  second.release();
  assert.equal(runtime.stats().referenced, 0);
});

test('cache keys bind morphology and exact base/mask routes', async () => {
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async ({ descriptor }) => `blob:${descriptor.variant}`,
  });
  const male = await runtime.resolve(MALE_IDLE, tintedLook('male'));
  const female = await runtime.resolve(FEMALE_IDLE, tintedLook('female'));
  assert.notEqual(male.key, female.key);
  assert.ok(male.key.includes('|male|male-v1|'));
  assert.ok(female.key.includes('|female|female-f2-v1|'));
  assert.ok(male.key.includes(MALE_IDLE));
  assert.ok(female.key.includes(FEMALE_IDLE));
  assert.ok(male.key.includes(FACTORY_ASSET.get('male-v1:core:idle').maskRoute));
  assert.ok(female.key.includes(FEMALE_IDLE_MASK));
  assert.ok(male.key.includes(FACTORY_ASSET.get('male-v1:core:idle').baseSha256));
  assert.ok(male.key.includes(SHA_B));
  male.release();
  female.release();
});

test('bounded LRU revokes only unreferenced object URLs', async () => {
  const revoked = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    maxEntries: 2,
    renderFrame: async ({ descriptor }) => `blob:${descriptor.frame}`,
    revokeObjectURL: (url) => revoked.push(url),
  });
  const idle = await runtime.resolve(MALE_IDLE, tintedLook('male'));
  const walkA = await runtime.resolve(MALE_WALK_A, tintedLook('male'));
  idle.release();
  const walkB = await runtime.resolve(MALE_WALK_B, tintedLook('male'));
  assert.deepEqual(revoked, ['blob:idle']);
  assert.equal(runtime.stats().size, 2);
  assert.equal(runtime.stats().referenced, 2);
  walkA.release();
  walkB.release();
  runtime.clear();
  assert.deepEqual(new Set(revoked), new Set(['blob:idle', 'blob:walk-a', 'blob:walk-b']));
  assert.equal(runtime.stats().size, 0);
});

test('abort rejects without caching and revokes a renderer result produced after abort', async () => {
  const revoked = [];
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const controller = new AbortController();
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async () => {
      await gate;
      return 'blob:aborted';
    },
    revokeObjectURL: (url) => revoked.push(url),
  });
  const request = runtime.resolve(FEMALE_IDLE, tintedLook(), { signal: controller.signal });
  controller.abort();
  finish();
  await assert.rejects(request, (error) => palette.isAbortError(error));
  assert.deepEqual(revoked, ['blob:aborted']);
  assert.equal(runtime.stats().size, 0);
});

test('prefetch is fail-closed and warms only fully authored paths', async () => {
  const revoked = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    maxEntries: 2,
    renderFrame: async ({ descriptor }) => `blob:${descriptor.frame}`,
    revokeObjectURL: (url) => revoked.push(url),
  });
  const result = await runtime.prefetch([
    MALE_IDLE,
    MALE_WALK_A,
    MALE_WALK_B,
  ], tintedLook('male'));
  assert.deepEqual(
    { requested: result.requested, warmed: result.warmed, bypassed: result.bypassed },
    { requested: 3, warmed: 3, bypassed: 0 },
  );
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'url'), false);
  assert.equal(runtime.stats().size, 2);
  assert.equal(runtime.stats().referenced, 0);
  assert.deepEqual(revoked, ['blob:idle']);
  await assert.rejects(
    runtime.prefetch([FEMALE_IDLE], tintedLook('male')),
    (error) => error.code === 'frame-not-authored',
  );
});

test('prefetch releases fulfilled handles when a later render fails', async () => {
  const revoked = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async ({ descriptor }) => {
      if (descriptor.frame === 'walk-a') throw new Error('synthetic decode failure');
      return `blob:${descriptor.frame}`;
    },
    revokeObjectURL: (url) => revoked.push(url),
  });
  await assert.rejects(
    runtime.prefetch([MALE_IDLE, MALE_WALK_A], tintedLook('male')),
    (error) => error.code === 'render-failed',
  );
  assert.equal(runtime.stats().referenced, 0);
  runtime.clear();
  assert.deepEqual(revoked, ['blob:idle']);
});

test('prefetch releases fulfilled handles and revokes late URLs after abort', async () => {
  const revoked = [];
  const controller = new AbortController();
  let releaseWalk;
  let markIdleReady;
  const walkGate = new Promise((resolve) => { releaseWalk = resolve; });
  const idleReady = new Promise((resolve) => { markIdleReady = resolve; });
  const runtime = palette.createRuntime({
    manifest: manifest(),
    renderFrame: async ({ descriptor }) => {
      if (descriptor.frame === 'walk-a') {
        await walkGate;
        return 'blob:walk-after-abort';
      }
      markIdleReady();
      return 'blob:idle-before-abort';
    },
    revokeObjectURL: (url) => revoked.push(url),
  });
  const request = runtime.prefetch(
    [MALE_IDLE, MALE_WALK_A],
    tintedLook('male'),
    { signal: controller.signal },
  );
  await idleReady;
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  releaseWalk();
  await assert.rejects(request, (error) => palette.isAbortError(error));
  assert.equal(runtime.stats().referenced, 0);
  assert.ok(revoked.includes('blob:walk-after-abort'));
  runtime.clear();
  assert.ok(revoked.includes('blob:idle-before-abort'));
});

test('public clear cannot force-revoke a referenced handle', async () => {
  const revoked = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async () => 'blob:held',
    revokeObjectURL: (url) => revoked.push(url),
  });
  const handle = await runtime.resolve(FEMALE_IDLE, tintedLook());
  runtime.clear({ force: true });
  assert.deepEqual(revoked, []);
  assert.equal(runtime.stats().size, 1);
  handle.release();
  runtime.clear();
  assert.deepEqual(revoked, ['blob:held']);
});

test('browser renderer keeps integrity mandatory and fails closed when crypto is unavailable', async () => {
  let decodeCalls = 0;
  const runtime = palette.createRuntime({
    manifest: manifest(),
    verifyIntegrity: false,
    fetchImpl: VERIFIED_FETCH,
    BlobImpl: PathBlob,
    cryptoImpl: { subtle: {} },
    createImageBitmapImpl: async () => {
      decodeCalls += 1;
      throw new Error('decode must not run without integrity');
    },
    documentImpl: { createElement() { throw new Error('canvas must not run without integrity'); } },
    URLImpl: { createObjectURL() { throw new Error('URL must not run'); }, revokeObjectURL() {} },
  });
  await assert.rejects(
    runtime.resolve(FEMALE_IDLE, tintedLook()),
    (error) => error.code === 'integrity-unavailable',
  );
  assert.equal(decodeCalls, 0);
  assert.equal(runtime.stats().size, 0);
});

test('browser renderer rejects a mask SHA mismatch and closes its decoded peer', async () => {
  const bitmaps = [];
  const badMaskCrypto = {
    subtle: {
      digest: async (algorithm, buffer) => {
        assert.equal(algorithm, 'SHA-256');
        const path = Buffer.from(buffer).toString('utf8');
        if (path === FEMALE_IDLE_MASK) {
          await new Promise((resolve) => setImmediate(resolve));
          return digestArrayBuffer('0'.repeat(64));
        }
        return digestArrayBuffer(expectedAssetSha(path));
      },
    },
  };
  const canvas = FACTORY_ASSET.get('female-f2-v1:core:idle').canvas;
  const runtime = palette.createRuntime({
    manifest: manifest(),
    fetchImpl: VERIFIED_FETCH,
    BlobImpl: PathBlob,
    cryptoImpl: badMaskCrypto,
    createImageBitmapImpl: async (blob) => {
      const bitmap = {
        path: blob.path,
        width: canvas[0],
        height: canvas[1],
        closes: 0,
        close() { this.closes += 1; },
      };
      bitmaps.push(bitmap);
      return bitmap;
    },
    documentImpl: { createElement() { throw new Error('canvas must not run after mismatch'); } },
    URLImpl: { createObjectURL() { throw new Error('URL must not run'); }, revokeObjectURL() {} },
  });
  await assert.rejects(
    runtime.resolve(FEMALE_IDLE, tintedLook()),
    (error) => error.code === 'integrity-mismatch' && error.message.includes(FEMALE_IDLE_MASK),
  );
  assert.equal(bitmaps.length, 1);
  assert.equal(bitmaps[0].path, FEMALE_IDLE);
  assert.equal(bitmaps[0].closes, 1);
  assert.equal(runtime.stats().size, 0);
});

test('browser renderer rejects a base SHA mismatch and closes its decoded mask peer', async () => {
  const bitmaps = [];
  const badBaseCrypto = {
    subtle: {
      digest: async (algorithm, buffer) => {
        assert.equal(algorithm, 'SHA-256');
        const path = Buffer.from(buffer).toString('utf8');
        if (path === FEMALE_IDLE) {
          await new Promise((resolve) => setImmediate(resolve));
          return digestArrayBuffer('f'.repeat(64));
        }
        return digestArrayBuffer(expectedAssetSha(path));
      },
    },
  };
  const canvas = FACTORY_ASSET.get('female-f2-v1:core:idle').canvas;
  const runtime = palette.createRuntime({
    manifest: manifest(),
    fetchImpl: VERIFIED_FETCH,
    BlobImpl: PathBlob,
    cryptoImpl: badBaseCrypto,
    createImageBitmapImpl: async (blob) => {
      const bitmap = {
        path: blob.path,
        width: canvas[0],
        height: canvas[1],
        closes: 0,
        close() { this.closes += 1; },
      };
      bitmaps.push(bitmap);
      return bitmap;
    },
    documentImpl: { createElement() { throw new Error('canvas must not run after mismatch'); } },
    URLImpl: { createObjectURL() { throw new Error('URL must not run'); }, revokeObjectURL() {} },
  });
  await assert.rejects(
    runtime.resolve(FEMALE_IDLE, tintedLook()),
    (error) => error.code === 'integrity-mismatch' && error.message.includes(FEMALE_IDLE),
  );
  assert.equal(bitmaps.length, 1);
  assert.equal(bitmaps[0].path, FEMALE_IDLE_MASK);
  assert.equal(bitmaps[0].closes, 1);
  assert.equal(runtime.stats().size, 0);
});

test('paired browser decode closes a fulfilled bitmap when its peer rejects', async () => {
  const closed = [];
  const decodeOptions = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    fetchImpl: VERIFIED_FETCH,
    BlobImpl: PathBlob,
    cryptoImpl: VERIFIED_CRYPTO,
    createImageBitmapImpl: async (blob, options) => {
      decodeOptions.push({ path: blob.path, options });
      if (blob.path === FEMALE_IDLE_MASK) throw new Error('bad packed mask');
      return {
        width: FACTORY_ASSET.get('female-f2-v1:core:idle').canvas[0],
        height: FACTORY_ASSET.get('female-f2-v1:core:idle').canvas[1],
        close() { closed.push(blob.path); },
      };
    },
    documentImpl: { createElement() { throw new Error('decode should fail first'); } },
    URLImpl: { createObjectURL() { throw new Error('decode should fail first'); }, revokeObjectURL() {} },
  });
  await assert.rejects(
    runtime.resolve(FEMALE_IDLE, tintedLook()),
    (error) => error.code === 'asset-failed',
  );
  assert.deepEqual(closed, [FEMALE_IDLE]);
  assert.deepEqual(
    decodeOptions.find((call) => call.path === FEMALE_IDLE_MASK).options,
    { colorSpaceConversion: 'none', premultiplyAlpha: 'none' },
  );
});

test('post-decode abort closes every bitmap before rejecting', async () => {
  const controller = new AbortController();
  const bitmaps = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    fetchImpl: VERIFIED_FETCH,
    BlobImpl: PathBlob,
    cryptoImpl: VERIFIED_CRYPTO,
    createImageBitmapImpl: async (blob) => {
      const bitmap = {
        width: 2,
        height: 1,
        closes: 0,
        close() { this.closes += 1; },
      };
      bitmaps.push(bitmap);
      controller.abort();
      return bitmap;
    },
    documentImpl: { createElement() { throw new Error('abort should stop before canvas'); } },
    URLImpl: { createObjectURL() { throw new Error('abort should stop before URL'); }, revokeObjectURL() {} },
  });
  await assert.rejects(
    runtime.resolve(FEMALE_IDLE, tintedLook(), { signal: controller.signal }),
    (error) => palette.isAbortError(error),
  );
  assert.ok(bitmaps.length >= 1);
  assert.ok(bitmaps.every((bitmap) => bitmap.closes === 1));
  assert.equal(runtime.stats().size, 0);
});

test('dispose revokes cached URLs and future resolves fail closed', async () => {
  const revoked = [];
  const runtime = palette.createRuntime({
    manifest: manifest(),
    paletteContract: paletteContract(),
    renderFrame: async () => 'blob:dispose-me',
    revokeObjectURL: (url) => revoked.push(url),
  });
  await runtime.resolve(FEMALE_IDLE, tintedLook());
  runtime.dispose();
  assert.deepEqual(revoked, ['blob:dispose-me']);
  assert.equal(runtime.stats().disposed, true);
  await assert.rejects(
    runtime.resolve(FEMALE_IDLE, tintedLook()),
    (error) => error.code === 'disposed',
  );
});
