(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TravellerAppearanceV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0.0';
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
  const PACK_STATUS = Object.freeze({
    male: Object.freeze(Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, true]))),
    female: Object.freeze(Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, false]))),
  });
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
    return `${CORE_ROOT}/${safeGender}/${directory}/${safeName}`;
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
    DEFAULT_PALETTE,
    PALETTE_OPTIONS,
    knownGender,
    capabilityStatus,
    isSelectable,
    selectableGenders,
    requestedGender,
    normalizePalette,
    normalize,
    assetPath,
    selectionResult,
  });
});
