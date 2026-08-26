(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TravellerAppearanceV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.2.0';
  const SCHEMA_VERSION = 1;
  const DEFAULT_GENDER = 'male';
  const KNOWN_GENDERS = Object.freeze(['male', 'female']);
  const CAPABILITY_KEYS = Object.freeze([
    'core',
    'motion',
    'room',
    'bodyToad',
    'recoverySlug',
    'resourcesPenguin',
    'shadow',
  ]);
  const DEFAULT_PALETTE = Object.freeze({
    skin: 'warm-02',
    hair: 'brown-02',
    eyes: 'umber-01',
  });
  const PALETTE_OPTIONS = Object.freeze({
    skin: Object.freeze(['warm-02']),
    hair: Object.freeze(['brown-02']),
    eyes: Object.freeze(['umber-01']),
  });
  const CORE_ROOT = '/art/avatars/traveller-core-v1';
  const PACK_DIRS = Object.freeze({
    core: 'poses',
    motion: 'motion-v3',
    room: 'room-actions-v4',
  });
  const FEMALE_F2_REVISION = 'f2-v1';
  const FEMALE_F2_IDENTITY_SHA256 = '5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da';
  const CORE_ROOTS = Object.freeze({
    male: `${CORE_ROOT}/male`,
    female: `${CORE_ROOT}/female/${FEMALE_F2_REVISION}`,
  });

  function frozenAssets(root, names) {
    return Object.freeze(names.map((name) => `${root}/${name}`));
  }

  const FEMALE_F2_CAPABILITIES = Object.freeze({
    core: Object.freeze({
      ready: true,
      canvas: Object.freeze([640, 900]),
      assets: frozenAssets(`${CORE_ROOTS.female}/poses`, ['idle.png', 'arms-up.png', 'seated.png', 'window-back.png']),
    }),
    motion: Object.freeze({
      ready: true,
      canvas: Object.freeze([640, 900]),
      assets: frozenAssets(`${CORE_ROOTS.female}/motion-v3`, ['idle-blink.png', 'walk-a.png', 'walk-b.png']),
    }),
    room: Object.freeze({
      ready: true,
      canvas: Object.freeze([640, 900]),
      assets: frozenAssets(`${CORE_ROOTS.female}/room-actions-v4`, ['bench-rest.png', 'bench-read-a.png', 'bench-read-b.png', 'bench-portal-reach.png']),
    }),
    bodyToad: Object.freeze({
      ready: true,
      canvas: Object.freeze([1536, 1536]),
      assets: frozenAssets(`/art/pets/body-toad-v1/pair-v4/female/${FEMALE_F2_REVISION}`, [
        'greet-contact.png', 'train-low.png', 'train-high.png', 'whistle-a.png', 'whistle-b.png',
        'whistle-c.png', 'whistle-d.png', 'pushup-down.png', 'pushup-up.png', 'stretch-a.png',
        'stretch-b-v183.png', 'rest-contact.png', 'rest-pet.png',
      ]),
    }),
    recoverySlug: Object.freeze({
      ready: true,
      canvas: Object.freeze([1536, 1536]),
      assets: Object.freeze([
        ...frozenAssets(`/art/pets/recovery-slug-v1/pair-v2/female/${FEMALE_F2_REVISION}`, [
          'greet-contact.png', 'breathe-in.png', 'breathe-out.png', 'restore-contact.png', 'stretch-a.png',
        ]),
        `/art/pets/recovery-slug-v1/pair-v3/female/${FEMALE_F2_REVISION}/stretch-soft-b-v183.png`,
      ]),
    }),
    resourcesPenguin: Object.freeze({
      ready: true,
      canvas: Object.freeze([1536, 1536]),
      assets: frozenAssets(`/art/pets/resources-penguin-v1/pair-v1/female/${FEMALE_F2_REVISION}`, [
        'greet-contact.png', 'budget-point.png', 'budget-reserve.png', 'count-pass.png', 'count-place.png',
        'count-stack.png', 'reserve-offer.png', 'reserve-accept.png', 'focus-work.png', 'focus-check.png',
        'focus-nod.png', 'close-stamp.png',
      ]),
    }),
    shadow: Object.freeze({
      ready: true,
      canvas: Object.freeze([1254, 1254]),
      assets: frozenAssets(`/art/companions/shadow-den-v1/pair-v1/female/${FEMALE_F2_REVISION}`, [
        'attune-spark.png', 'attune-spirit.png', 'attune-guardian.png', 'attune-keeper.png',
      ]),
    }),
  });
  const FEMALE_F2_ASSET_MANIFEST = Object.freeze({
    schema: 'satoru.traveller-runtime-asset-expectation/1',
    id: 'female-f2-high-ponytail',
    morphology: 'female',
    revision: FEMALE_F2_REVISION,
    immutable: true,
    identitySha256: FEMALE_F2_IDENTITY_SHA256,
    runtimeManifest: `${CORE_ROOTS.female}/manifest.json`,
    capabilities: FEMALE_F2_CAPABILITIES,
  });
  const ASSET_MANIFESTS = Object.freeze({ female: FEMALE_F2_ASSET_MANIFEST });
  const PACK_STATUS = Object.freeze({
    male: Object.freeze(Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, true]))),
    female: Object.freeze(Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, FEMALE_F2_CAPABILITIES[key].ready === true]))),
  });

  function knownGender(value) {
    return typeof value === 'string' && KNOWN_GENDERS.includes(value) ? value : null;
  }

  function capabilityStatus(gender, status = PACK_STATUS) {
    const safeGender = knownGender(gender);
    if (!safeGender) return null;
    const source = status && status[safeGender];
    return Object.freeze(Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, source?.[key] === true])));
  }

  function isSelectable(gender, status = PACK_STATUS) {
    const capabilities = capabilityStatus(gender, status);
    return Boolean(capabilities && CAPABILITY_KEYS.every((key) => capabilities[key]));
  }

  function selectableGenders(status = PACK_STATUS) {
    return Object.freeze(KNOWN_GENDERS.filter((gender) => isSelectable(gender, status)));
  }

  function requestedGender(value) {
    if (typeof value === 'string') return knownGender(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return knownGender(value.gender || value.morphology || value.avatarCoreGender);
  }

  function assetManifest(gender) {
    const safeGender = knownGender(gender);
    return safeGender ? ASSET_MANIFESTS[safeGender] || null : null;
  }

  function expectedAssets(gender) {
    const manifest = assetManifest(gender);
    if (!manifest) return Object.freeze([]);
    return Object.freeze(CAPABILITY_KEYS.flatMap((key) => manifest.capabilities[key]?.assets || []));
  }

  function validateAssetManifest(manifest = FEMALE_F2_ASSET_MANIFEST) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      return Object.freeze({ ok: false, errors: Object.freeze(['manifest must be an object']), totalAssets: 0 });
    }
    if (manifest.schema !== 'satoru.traveller-runtime-asset-expectation/1') errors.push('schema');
    if (manifest.id !== 'female-f2-high-ponytail') errors.push('id');
    if (manifest.morphology !== 'female') errors.push('morphology');
    if (manifest.revision !== FEMALE_F2_REVISION || manifest.immutable !== true) errors.push('immutable-revision');
    if (manifest.identitySha256 !== FEMALE_F2_IDENTITY_SHA256) errors.push('identity-sha256');
    if (manifest.runtimeManifest !== `${CORE_ROOTS.female}/manifest.json`) errors.push('runtime-manifest-route');
    const assets = [];
    for (const key of CAPABILITY_KEYS) {
      const capability = manifest.capabilities?.[key];
      if (!capability || !Array.isArray(capability.assets) || capability.assets.length === 0) {
        errors.push(`capability:${key}`);
        continue;
      }
      const canonical = FEMALE_F2_CAPABILITIES[key];
      if (
        !Array.isArray(capability.canvas)
        || capability.canvas.length !== 2
        || capability.canvas.some((value, index) => value !== canonical.canvas[index])
      ) errors.push(`canvas:${key}`);
      if (
        capability.assets.length !== canonical.assets.length
        || capability.assets.some((path, index) => path !== canonical.assets[index])
      ) errors.push(`asset-list:${key}`);
      for (const path of capability.assets) {
        assets.push(path);
        if (
          typeof path !== 'string'
          || !path.startsWith('/art/')
          || !path.includes('/female/')
          || !path.includes(`/${FEMALE_F2_REVISION}/`)
          || path.includes('/male/')
          || !path.endsWith('.png')
        ) errors.push(`asset:${key}`);
      }
    }
    if (assets.length !== 46) errors.push('asset-count');
    if (new Set(assets).size !== assets.length) errors.push('duplicate-assets');
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), totalAssets: assets.length });
  }

  function validateRuntimeAssetManifest(payload, expected = FEMALE_F2_ASSET_MANIFEST) {
    const errors = [...validateAssetManifest(expected).errors];
    const assets = Array.isArray(payload?.assets) ? payload.assets : [];
    if (payload?.schema !== 'satoru.traveller-runtime-asset-manifest/1') errors.push('runtime-schema');
    if (payload?.id !== expected.id || payload?.revision !== expected.revision) errors.push('runtime-identity');
    if (payload?.identitySha256 !== expected.identitySha256) errors.push('runtime-identity-sha256');
    if (payload?.status !== 'runtime-approved' || payload?.runtimeEligible !== true) errors.push('runtime-status');
    const expectedPaths = CAPABILITY_KEYS.flatMap((key) => expected.capabilities?.[key]?.assets || []);
    const expectedCanvasByPath = new Map(CAPABILITY_KEYS.flatMap((key) => (
      (expected.capabilities?.[key]?.assets || []).map((path) => [path, expected.capabilities[key].canvas])
    )));
    const actualPaths = assets.map((asset) => asset?.path);
    if (
      actualPaths.length !== expectedPaths.length
      || actualPaths.some((path, index) => path !== expectedPaths[index])
    ) errors.push('runtime-assets');
    for (const asset of assets) {
      if (!asset || !/^[a-f0-9]{64}$/.test(String(asset.sha256 || ''))) errors.push('runtime-asset-sha256');
      const expectedCanvas = expectedCanvasByPath.get(asset?.path);
      if (
        !Array.isArray(asset?.canvas)
        || asset.canvas.length !== 2
        || !expectedCanvas
        || asset.canvas.some((value, index) => value !== expectedCanvas[index])
      ) {
        errors.push('runtime-asset-canvas');
      }
    }
    for (const key of CAPABILITY_KEYS) {
      if (payload?.capabilities?.[key] !== true) errors.push(`runtime-capability:${key}`);
    }
    return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), totalAssets: assets.length });
  }

  function normalizePalette(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.freeze(Object.fromEntries(Object.keys(DEFAULT_PALETTE).map((key) => {
      const candidate = source[key];
      return [key, PALETTE_OPTIONS[key].includes(candidate) ? candidate : DEFAULT_PALETTE[key]];
    })));
  }

  function normalize(value, status = PACK_STATUS) {
    const requested = requestedGender(value) || DEFAULT_GENDER;
    const gender = isSelectable(requested, status) ? requested : DEFAULT_GENDER;
    const paletteSource = value && typeof value === 'object' && !Array.isArray(value)
      ? (value.palette || value.colors)
      : null;
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      gender,
      palette: normalizePalette(paletteSource),
    });
  }

  function safeFile(value) {
    if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(value)) return null;
    return value;
  }

  function assetPath(gender, pack, file) {
    const safeGender = knownGender(gender);
    const directory = PACK_DIRS[pack];
    const safeName = safeFile(file);
    if (!safeGender || !directory || !safeName) return null;
    return `${CORE_ROOTS[safeGender]}/${directory}/${safeName}`;
  }

  function selectionResult(value, status = PACK_STATUS) {
    const gender = requestedGender(value);
    if (!gender) return Object.freeze({ ok: false, reason: 'unknown-gender', gender: null });
    if (!isSelectable(gender, status)) {
      return Object.freeze({ ok: false, reason: 'incomplete-pack', gender });
    }
    return Object.freeze({ ok: true, reason: null, gender });
  }

  return Object.freeze({
    VERSION,
    SCHEMA_VERSION,
    DEFAULT_GENDER,
    KNOWN_GENDERS,
    CAPABILITY_KEYS,
    PACK_STATUS,
    FEMALE_F2_REVISION,
    FEMALE_F2_IDENTITY_SHA256,
    CORE_ROOTS,
    ASSET_MANIFESTS,
    DEFAULT_PALETTE,
    PALETTE_OPTIONS,
    knownGender,
    capabilityStatus,
    isSelectable,
    selectableGenders,
    requestedGender,
    assetManifest,
    expectedAssets,
    validateAssetManifest,
    validateRuntimeAssetManifest,
    normalizePalette,
    normalize,
    assetPath,
    selectionResult,
  });
});
