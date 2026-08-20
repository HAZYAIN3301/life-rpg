(function initTravellerLookV2(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravellerLookV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function travellerLookFactory() {
  'use strict';

  const VERSION = '2.0.0';
  const SETTINGS_SCHEMA_VERSION = 1;
  const DEFAULT_GENDER = 'male';
  const CHANNELS = Object.freeze(['skin', 'hair', 'eyes']);
  const GENDERS = Object.freeze(['male', 'female']);
  const IDENTITY_BY_GENDER = Object.freeze({
    male: 'male-v1',
    female: 'female-f2-v1',
  });
  const PALETTE_IDS = Object.freeze({
    skin: Object.freeze(['original', 'skin-porcelain', 'skin-warm', 'skin-bronze', 'skin-umber', 'skin-deep']),
    hair: Object.freeze(['original', 'hair-ink', 'hair-chestnut', 'hair-walnut', 'hair-auburn', 'hair-honey', 'hair-ash', 'hair-violet']),
    eyes: Object.freeze(['original', 'eyes-ink', 'eyes-ocean', 'eyes-jade', 'eyes-amber', 'eyes-violet']),
  });
  const DEFAULT_PALETTE = Object.freeze({ skin: 'original', hair: 'original', eyes: 'original' });
  const LEGACY_DEFAULT_IDS = Object.freeze(new Set(['warm-02', 'brown-02', 'umber-01']));

  function lookError(code, message) {
    const error = new Error(message);
    error.name = 'TravellerLookError';
    error.code = code;
    return error;
  }

  function gender(value) {
    return typeof value === 'string' && GENDERS.includes(value) ? value : null;
  }

  function paletteSource(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.avatarCorePalette && typeof value.avatarCorePalette === 'object') return value.avatarCorePalette;
    if (value.palette && typeof value.palette === 'object') return value.palette;
    return value;
  }

  function normalizePalette(value) {
    const source = paletteSource(value) || {};
    const normalized = {};
    for (const channel of CHANNELS) {
      const candidate = source[channel];
      normalized[channel] = typeof candidate === 'string'
        && !LEGACY_DEFAULT_IDS.has(candidate)
        && PALETTE_IDS[channel].includes(candidate)
        ? candidate
        : DEFAULT_PALETTE[channel];
    }
    return Object.freeze(normalized);
  }

  function normalize(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const requested = gender(source.avatarCoreGender || source.gender || source.morphology);
    const safeGender = requested || DEFAULT_GENDER;
    return Object.freeze({
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      gender: safeGender,
      identityId: IDENTITY_BY_GENDER[safeGender],
      palette: normalizePalette(source),
    });
  }

  function runtimeLook(value) {
    const normalized = normalize(value);
    return Object.freeze({
      morphology: normalized.gender,
      identityId: normalized.identityId,
      palette: normalized.palette,
    });
  }

  function settingsPatch(value) {
    const normalized = normalize(value);
    return Object.freeze({
      avatarCoreGender: normalized.gender,
      avatarCorePalette: Object.freeze({
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        ...normalized.palette,
      }),
    });
  }

  function samePalette(left, right) {
    return CHANNELS.every((channel) => left[channel] === right[channel]);
  }

  function same(left, right) {
    const a = normalize(left);
    const b = normalize(right);
    return a.gender === b.gender && samePalette(a.palette, b.palette);
  }

  function request(current, change) {
    const before = normalize(current);
    if (!change || typeof change !== 'object' || Array.isArray(change)) {
      throw lookError('invalid-change', 'Traveller appearance change must be an object');
    }
    const nextGender = change.gender === undefined ? before.gender : gender(change.gender);
    if (!nextGender) throw lookError('unknown-gender', 'Traveller gender is not authored');
    const nextPalette = { ...before.palette };
    if (change.palette !== undefined) {
      if (!change.palette || typeof change.palette !== 'object' || Array.isArray(change.palette)) {
        throw lookError('invalid-change', 'Traveller palette change must be an object');
      }
      for (const key of Object.keys(change.palette)) {
        if (!CHANNELS.includes(key)) throw lookError('unknown-channel', 'Traveller palette channel is not authored: ' + key);
        const id = change.palette[key];
        if (typeof id !== 'string' || !PALETTE_IDS[key].includes(id)) {
          throw lookError('unknown-palette', 'Traveller palette option is not authored: ' + String(id));
        }
        nextPalette[key] = id;
      }
    }
    const after = normalize({ gender: nextGender, palette: nextPalette });
    return Object.freeze({
      changed: !same(before, after),
      before,
      after,
      look: runtimeLook(after),
      patch: settingsPatch(after),
    });
  }

  function validateCompiledManifest(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw lookError('invalid-manifest', 'Compiled Traveller palette manifest is required');
    }
    for (const safeGender of GENDERS) {
      if (typeof manifest.identityFor !== 'function') {
        throw lookError('invalid-manifest', 'Compiled Traveller manifest has no identity resolver');
      }
      const identity = manifest.identityFor(safeGender, IDENTITY_BY_GENDER[safeGender]);
      if (!identity || identity.morphology !== safeGender || identity.id !== IDENTITY_BY_GENDER[safeGender]) {
        throw lookError('invalid-manifest', 'Compiled Traveller manifest identity set is incomplete');
      }
    }
    for (const channel of CHANNELS) {
      const options = manifest.palettes?.[channel];
      const actual = options && typeof options === 'object' ? Object.keys(options) : [];
      if (
        actual.length !== PALETTE_IDS[channel].length
        || PALETTE_IDS[channel].some((id) => !Object.prototype.hasOwnProperty.call(options, id))
        || manifest.defaultPalette?.[channel] !== 'original'
      ) {
        throw lookError('invalid-manifest', 'Compiled Traveller palette catalog differs from the approved option set');
      }
    }
    return true;
  }

  function catalog(manifest) {
    validateCompiledManifest(manifest);
    const result = {};
    for (const channel of CHANNELS) {
      result[channel] = Object.freeze(PALETTE_IDS[channel].map((id) => {
        const option = manifest.palettes[channel][id];
        return Object.freeze({
          id,
          channel,
          isDefault: id === 'original',
          hex: id === 'original' ? null : option.target?.hex || null,
        });
      }));
    }
    return Object.freeze(result);
  }

  function basePaths(manifest, value) {
    validateCompiledManifest(manifest);
    const normalized = normalize(value);
    const identity = manifest.identityFor(normalized.gender, normalized.identityId);
    return Object.freeze(identity.frames.map((frame) => frame.base.path));
  }

  return Object.freeze({
    VERSION,
    SETTINGS_SCHEMA_VERSION,
    DEFAULT_GENDER,
    CHANNELS,
    GENDERS,
    IDENTITY_BY_GENDER,
    PALETTE_IDS,
    DEFAULT_PALETTE,
    normalizePalette,
    normalize,
    runtimeLook,
    settingsPatch,
    same,
    request,
    validateCompiledManifest,
    catalog,
    basePaths,
  });
});
