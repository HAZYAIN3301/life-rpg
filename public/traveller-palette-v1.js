(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TravellerPaletteV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const VERSION = '1.1.0';
  const MANIFEST_SCHEMA = 'satoru.traveller-semantic-mask-runtime/1';
  const PALETTE_CATALOG_SCHEMA = 'satoru.traveller-semantic-palette-catalog/1';
  const GOLDEN_VECTORS_SCHEMA = 'satoru.traveller-semantic-palette-golden-vectors/1';
  const MASK_ENCODING = 'rgb-packed-v1';
  const ID_TOKEN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const CHANNELS = Object.freeze(['skin', 'hair', 'eyes']);
  const COMPILED_CATALOGS = new WeakSet();
  const COMPILED_MANIFESTS = new WeakSet();
  const DEFAULT_PALETTE = Object.freeze({
    skin: 'original',
    hair: 'original',
    eyes: 'original',
  });
  const EXPECTED_RUNTIME_ID = 'traveller-appearance-v2';
  const EXPECTED_PALETTE_ID = 'traveller-palette-catalog-v1';
  const EXPECTED_ALGORITHM_ID = 'oklab-paper-preserving-v1';
  const EXPECTED_BYTE_ROUNDING = 'floor(value * 255 + 0.5)';
  const EXPECTED_MASK_REVISION = 'palette-masks-v1';
  const EXPECTED_CATALOG_SHA256 = '4101b8bef8c0cbea479e7023f28dd9c8669369716a4f8da58f05a555de662f22';
  const EXPECTED_GOLDEN_SHA256 = 'dcf2ffc3a20e6ad0efb3c2932996c0e3840cc3bba86412c4916b09e0d0bdb2fc';
  const EXPECTED_CATALOG_PAYLOAD_SHA256 = 'dc1ce311afec1be1ac70d104741d5c87eb8b2fdca177244853ecc07a5defacad';
  const EXPECTED_GOLDEN_PAYLOAD_SHA256 = '4025da3e91e23fa4a2cf430b9c99dcfa87c3e2b3de34942060896215c2f84a4e';
  const EXPECTED_FEMALE_IDENTITY_SHA256 = '5d811618fc851eec48eb910c7efc98eec46e23a94919b376d3c64f5ae24d62da';
  const EXPECTED_FOUNDATION_SHA256 = '7c7f2b1fae0dbd3d20b4ffbf916facfeeb6b3126b7316cbb8a7f9fea5a6b6a32';
  const EXPECTED_VARIANTS = Object.freeze({
    'male-v1': Object.freeze({ gender: 'male', morphologyRevision: 'male-v1' }),
    'female-f2-v1': Object.freeze({ gender: 'female', morphologyRevision: 'f2-v1' }),
  });
  const EXPECTED_CAPABILITIES = Object.freeze({
    core: 4,
    motion: 3,
    room: 4,
    'body-toad': 13,
    'recovery-slug': 6,
    'resources-penguin': 12,
    shadow: 4,
  });
  const EXPECTED_PALETTE_IDS = Object.freeze({
    skin: Object.freeze([
      'skin-porcelain',
      'skin-warm',
      'skin-bronze',
      'skin-umber',
      'skin-deep',
    ]),
    hair: Object.freeze([
      'hair-ink',
      'hair-chestnut',
      'hair-walnut',
      'hair-auburn',
      'hair-honey',
      'hair-ash',
      'hair-violet',
    ]),
    eyes: Object.freeze([
      'eyes-ink',
      'eyes-ocean',
      'eyes-jade',
      'eyes-amber',
      'eyes-violet',
    ]),
  });
  const EXPECTED_GOLDEN_IDS = Object.freeze([
    'slot-targets-and-alpha',
    'paper-lightness-residual',
    'packed-weighted-blend',
  ]);

  class TravellerPaletteError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = 'TravellerPaletteError';
      this.code = code;
      if (details !== undefined) this.details = details;
    }
  }

  function paletteError(code, message, details) {
    return new TravellerPaletteError(code, message, details);
  }

  function abortError() {
    const error = new Error('Traveller palette operation was aborted');
    error.name = 'AbortError';
    error.code = 'ABORT_ERR';
    return error;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError();
  }

  function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
  }

  function clamp01(value) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  }

  function clampByte(value) {
    return Math.min(255, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
  }

  function immutableCanvas(value, label) {
    if (
      !Array.isArray(value)
      || value.length !== 2
      || !value.every((part) => Number.isInteger(part) && part > 0)
    ) {
      throw paletteError('invalid-manifest', `${label} must be a positive [width, height] canvas`);
    }
    return Object.freeze([value[0], value[1]]);
  }

  function validAssetPath(value) {
    return typeof value === 'string'
      && /^\/art\/(?:[a-z0-9][a-z0-9._-]*\/)+[a-z0-9][a-z0-9._-]*\.png$/.test(value)
      && !value.split('/').some((segment) => segment === '.' || segment === '..');
  }

  function validSha256(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
  }

  function sha256Ascii(value) {
    if (typeof value !== 'string' || /[^\u0000-\u007f]/.test(value)) {
      throw paletteError('invalid-manifest', 'Pinned foundation payload must be canonical ASCII JSON');
    }
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const bytes = Array.from(value, (character) => character.charCodeAt(0));
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const words = new Uint32Array(64);
    const rotateRight = (number, amount) => (number >>> amount) | (number << (32 - amount));
    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
      for (let index = 0; index < 16; index += 1) {
        const offset = chunk + index * 4;
        words[index] = (
          (bytes[offset] << 24)
          | (bytes[offset + 1] << 16)
          | (bytes[offset + 2] << 8)
          | bytes[offset + 3]
        ) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const first = words[index - 15];
        const second = words[index - 2];
        const sigma0 = rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3);
        const sigma1 = rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }
      let a = hash[0];
      let b = hash[1];
      let c = hash[2];
      let d = hash[3];
      let e = hash[4];
      let f = hash[5];
      let g = hash[6];
      let h = hash[7];
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temporary1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temporary2 = (sum0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temporary1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temporary1 + temporary2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  function freezeAsset(value, label, fallbackCanvas) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw paletteError('invalid-manifest', `${label} must be an asset object`);
    }
    if (!validAssetPath(value.path)) {
      throw paletteError('invalid-manifest', `${label}.path must be an exact authored asset path`);
    }
    if (!validSha256(value.sha256)) {
      throw paletteError('invalid-manifest', `${label}.sha256 must be a 64 character hex digest`);
    }
    const canvas = immutableCanvas(value.canvas || fallbackCanvas, `${label}.canvas`);
    return Object.freeze({
      path: value.path,
      sha256: value.sha256.toLowerCase(),
      canvas,
    });
  }

  function parseHexColor(value, label) {
    if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
      const values = value.map((part) => clampByte(part));
      return Object.freeze(values);
    }
    if (typeof value !== 'string') {
      throw paletteError('invalid-manifest', `${label} must be #RRGGBB or [r,g,b]`);
    }
    const match = value.trim().match(/^#([a-f0-9]{6})$/i);
    if (!match) throw paletteError('invalid-manifest', `${label} must use #RRGGBB`);
    const hex = match[1];
    return Object.freeze([
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]);
  }

  function srgbChannelToLinear(byte) {
    const value = clampByte(byte) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  }

  function linearChannelToSrgb(value) {
    const safe = clamp01(value);
    const encoded = safe <= 0.0031308
      ? safe * 12.92
      : 1.055 * (safe ** (1 / 2.4)) - 0.055;
    return clampByte(encoded * 255);
  }

  function rgbToOklab(red, green, blue) {
    const r = srgbChannelToLinear(red);
    const g = srgbChannelToLinear(green);
    const b = srgbChannelToLinear(blue);
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);
    return Object.freeze([
      0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
      1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
      0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
    ]);
  }

  function oklabToRgb(lightness, axisA, axisB) {
    const lRoot = lightness + 0.3963377774 * axisA + 0.2158037573 * axisB;
    const mRoot = lightness - 0.1055613458 * axisA - 0.0638541728 * axisB;
    const sRoot = lightness - 0.0894841775 * axisA - 1.291485548 * axisB;
    const l = lRoot ** 3;
    const m = mRoot ** 3;
    const s = sRoot ** 3;
    return Object.freeze([
      linearChannelToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      linearChannelToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      linearChannelToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ]);
  }


  function paletteKey(palette) {
    return CHANNELS.map((channel) => `${channel}:${palette[channel]}`).join('|');
  }


  function ensurePixels(value, expectedLength, label) {
    if (!(value instanceof Uint8ClampedArray) && !(value instanceof Uint8Array)) {
      throw paletteError('invalid-pixels', `${label} must be Uint8Array or Uint8ClampedArray`);
    }
    if (value.length !== expectedLength) {
      throw paletteError('canvas-mismatch', `${label} length does not match the declared canvas`);
    }
  }


  /*
   * Runtime v2 consumes the final promotion artifact exactly as emitted by
   * art-factory/traveller-appearance-v2-20260820/promote_runtime_manifest.py.
   */
  const CANONICAL_ALGORITHM = (function buildCanonicalAlgorithm() {
    function freezeDeep(value) {
      if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
      Object.values(value).forEach(freezeDeep);
      return Object.freeze(value);
    }
    return freezeDeep({
      id: EXPECTED_ALGORITHM_ID,
      srgbTransfer: {
        decodeThreshold: 0.04045,
        decodeDivisor: 12.92,
        decodeOffset: 0.055,
        decodeScale: 1.055,
        decodeExponent: 2.4,
        encodeThreshold: 0.0031308,
        encodeMultiplier: 12.92,
        encodeOffset: 0.055,
        encodeScale: 1.055,
        encodeExponent: 0.4166666666666667,
      },
      linearSrgbToLms: [
        [0.4122214708, 0.5363325363, 0.0514459929],
        [0.2119034982, 0.6806995451, 0.1073969566],
        [0.0883024619, 0.2817188376, 0.6299787005],
      ],
      lmsRootToOklab: [
        [0.2104542553, 0.7936177850, -0.0040720468],
        [1.9779984951, -2.4285922050, 0.4505937099],
        [0.0259040371, 0.7827717662, -0.8086757660],
      ],
      oklabToLmsRoot: [
        [1.0, 0.3963377774, 0.2158037573],
        [1.0, -0.1055613458, -0.0638541728],
        [1.0, -0.0894841775, -1.2914855480],
      ],
      lmsToLinearSrgb: [
        [4.0767416621, -3.3077115913, 0.2309699292],
        [-1.2684380046, 2.6097574011, -0.3413193965],
        [-0.0041960863, -0.7034186147, 1.7076147010],
      ],
      paperResidual: { lightness: 0.92, chromaA: 0.35, chromaB: 0.35 },
      linearClip: [0.0, 1.0],
      byteRounding: EXPECTED_BYTE_ROUNDING,
    });
  })();

  function sameContract(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((item, index) => sameContract(item, right[index]));
    }
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => (
        key === rightKeys[index] && sameContract(left[key], right[key])
      ));
  }

  function nonEmptyText(value) {
    return typeof value === 'string'
      && value.trim().length > 0
      && value.length <= 160
      && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function parseFlatRows(rows, rowWidth, count, label) {
    if (!Array.isArray(rows) || rows.length !== count) {
      throw paletteError('invalid-manifest', label + ' must contain exactly ' + count + ' rows');
    }
    const flat = new Uint8ClampedArray(count * rowWidth);
    rows.forEach((row, rowIndex) => {
      if (
        !Array.isArray(row)
        || row.length !== rowWidth
        || row.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
      ) {
        throw paletteError('invalid-manifest', label + '[' + rowIndex + '] must be byte data');
      }
      flat.set(row, rowIndex * rowWidth);
    });
    return flat;
  }

  function compilePaletteCatalogV2(catalog) {
    if (catalog && typeof catalog === 'object' && COMPILED_CATALOGS.has(catalog)) return catalog;
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
      throw paletteError('invalid-manifest', 'Embedded paletteCatalog must be an object');
    }
    if (sha256Ascii(JSON.stringify(catalog)) !== EXPECTED_CATALOG_PAYLOAD_SHA256) {
      throw paletteError('invalid-manifest', 'Embedded paletteCatalog payload differs from approved v1');
    }
    if (
      catalog.schema !== PALETTE_CATALOG_SCHEMA
      || catalog.id !== EXPECTED_PALETTE_ID
      || catalog.status !== 'authored-factory-contract'
      || catalog.colourSpace !== 'OKLab'
      || catalog.inputEncoding !== 'unmanaged-sRGB-8'
    ) {
      throw paletteError('invalid-manifest', 'Embedded paletteCatalog identity is not the approved v1 contract');
    }
    if (
      catalog.identityOption?.id !== 'original'
      || catalog.identityOption?.mode !== 'identity'
      || !nonEmptyText(catalog.identityOption?.contract)
    ) {
      throw paletteError('invalid-manifest', 'paletteCatalog.identityOption must be original/identity');
    }
    if (!sameContract(catalog.algorithm, CANONICAL_ALGORITHM)) {
      throw paletteError('invalid-manifest', 'paletteCatalog.algorithm differs from the approved compositor');
    }
    if (!catalog.ramps || typeof catalog.ramps !== 'object' || Array.isArray(catalog.ramps)) {
      throw paletteError('invalid-manifest', 'paletteCatalog.ramps must be a semantic-slot map');
    }

    const defaults = {};
    const palettes = {};
    const targetLookup = new Map();
    const globallyUniqueIds = new Set(['original']);
    for (const channel of CHANNELS) {
      defaults[channel] = 'original';
      const entries = catalog.ramps[channel];
      if (
        !Array.isArray(entries)
        || entries.length !== EXPECTED_PALETTE_IDS[channel].length
        || entries.some((entry, index) => entry?.id !== EXPECTED_PALETTE_IDS[channel][index])
      ) {
        throw paletteError('invalid-manifest', 'paletteCatalog.ramps.' + channel + ' is not the exact v1 target set');
      }
      const options = {
        original: Object.freeze({ id: 'original', isDefault: true, target: null }),
      };
      entries.forEach((entry, index) => {
        const label = 'paletteCatalog.ramps.' + channel + '[' + index + ']';
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          throw paletteError('invalid-manifest', label + ' must be an authored target');
        }
        if (!ID_TOKEN.test(entry.id || '') || !entry.id.startsWith(channel + '-')) {
          throw paletteError('invalid-manifest', label + '.id must belong to ' + channel);
        }
        if (globallyUniqueIds.has(entry.id)) {
          throw paletteError('invalid-manifest', 'Palette target id must be globally unique: ' + entry.id);
        }
        globallyUniqueIds.add(entry.id);
        const rgb = parseHexColor(entry.hex, label + '.hex');
        if (
          !Array.isArray(entry.oklab)
          || entry.oklab.length !== 3
          || entry.oklab.some((part) => !Number.isFinite(part))
        ) {
          throw paletteError('invalid-manifest', label + '.oklab must be a finite triplet');
        }
        const computedLab = rgbToOklab(rgb[0], rgb[1], rgb[2]);
        if (computedLab.some((part, component) => Math.abs(part - entry.oklab[component]) > 2e-9)) {
          throw paletteError('invalid-manifest', label + '.oklab does not match its authored hex');
        }
        const target = Object.freeze({
          id: entry.id,
          channel,
          hex: entry.hex.toLowerCase(),
          rgb,
          lab: computedLab,
        });
        options[entry.id] = Object.freeze({ id: entry.id, isDefault: false, target });
        targetLookup.set(channel + ':' + entry.id, target);
      });
      palettes[channel] = Object.freeze(options);
    }
    const diagnosticKeys = Object.keys(catalog.diagnosticTargets || {}).sort();
    if (
      diagnosticKeys.length !== CHANNELS.length
      || diagnosticKeys.some((key, index) => key !== CHANNELS.slice().sort()[index])
      || CHANNELS.some((channel) => !targetLookup.has(channel + ':' + catalog.diagnosticTargets[channel]))
    ) {
      throw paletteError('invalid-manifest', 'paletteCatalog.diagnosticTargets must select one target per slot');
    }
    const compiled = Object.freeze({
      schema: PALETTE_CATALOG_SCHEMA,
      id: catalog.id,
      algorithm: CANONICAL_ALGORITHM,
      defaultPalette: Object.freeze(defaults),
      palettes: Object.freeze(palettes),
      diagnosticTargets: Object.freeze({ ...catalog.diagnosticTargets }),
      targetFor(channel, id) {
        return targetLookup.get(channel + ':' + id) || null;
      },
    });
    COMPILED_CATALOGS.add(compiled);
    return compiled;
  }

  function srgbFloatToLinear(value, algorithm) {
    const transfer = algorithm.srgbTransfer;
    return value <= transfer.decodeThreshold
      ? value / transfer.decodeDivisor
      : ((value + transfer.decodeOffset) / transfer.decodeScale) ** transfer.decodeExponent;
  }

  function linearFloatToSrgb(value, algorithm) {
    const low = algorithm.linearClip[0];
    const high = algorithm.linearClip[1];
    const clipped = Math.min(high, Math.max(low, value));
    const transfer = algorithm.srgbTransfer;
    return clipped <= transfer.encodeThreshold
      ? clipped * transfer.encodeMultiplier
      : transfer.encodeScale * (clipped ** transfer.encodeExponent) - transfer.encodeOffset;
  }

  function matrixVector(matrix, vector) {
    return [
      matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
      matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
      matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
    ];
  }

  function sourceLabAt(base, offset, algorithm) {
    const linear = [
      srgbFloatToLinear(base[offset] / 255, algorithm),
      srgbFloatToLinear(base[offset + 1] / 255, algorithm),
      srgbFloatToLinear(base[offset + 2] / 255, algorithm),
    ];
    const lms = matrixVector(algorithm.linearSrgbToLms, linear);
    return matrixVector(algorithm.lmsRootToOklab, [
      Math.cbrt(lms[0]),
      Math.cbrt(lms[1]),
      Math.cbrt(lms[2]),
    ]);
  }

  function labToSrgbFloat(lab, algorithm) {
    const roots = matrixVector(algorithm.oklabToLmsRoot, lab);
    const linear = matrixVector(algorithm.lmsToLinearSrgb, [
      roots[0] ** 3,
      roots[1] ** 3,
      roots[2] ** 3,
    ]);
    return [
      linearFloatToSrgb(linear[0], algorithm),
      linearFloatToSrgb(linear[1], algorithm),
      linearFloatToSrgb(linear[2], algorithm),
    ];
  }

  function compositorCatalog(value) {
    if (
      value
      && typeof value === 'object'
      && (COMPILED_CATALOGS.has(value) || COMPILED_MANIFESTS.has(value))
    ) return value;
    return compilePaletteCatalogV2(value);
  }

  function recolorPixelsV2(options) {
    const width = options?.width;
    const height = options?.height;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      throw paletteError('canvas-mismatch', 'Pixel compositor requires a positive width and height');
    }
    const pixelCount = width * height;
    const base = options.basePixels || options.base;
    const mask = options.maskPixels || options.mask;
    ensurePixels(base, pixelCount * 4, 'basePixels');
    if (!(mask instanceof Uint8ClampedArray) && !(mask instanceof Uint8Array)) {
      throw paletteError('invalid-pixels', 'maskPixels must be Uint8Array or Uint8ClampedArray');
    }
    const maskStride = mask.length === pixelCount * 3 ? 3 : mask.length === pixelCount * 4 ? 4 : 0;
    if (!maskStride) {
      throw paletteError('canvas-mismatch', 'maskPixels length does not match RGB or RGBA canvas data');
    }
    const catalog = compositorCatalog(options.catalog || options.ramps);
    const palette = options.palette;
    if (!palette || typeof palette !== 'object' || Array.isArray(palette)) {
      throw paletteError('unknown-palette', 'Pixel compositor palette is required');
    }
    const defaults = options.defaultPalette || catalog.defaultPalette;
    const activeTargets = CHANNELS.map((channel) => {
      const id = palette[channel];
      if (typeof id !== 'string' || !catalog.palettes[channel]?.[id]) {
        throw paletteError('unknown-palette', 'Palette ' + channel + ':' + String(id) + ' is not authored');
      }
      return id === defaults[channel] ? null : catalog.targetFor(channel, id);
    });
    if (activeTargets.some((target, index) => (
      palette[CHANNELS[index]] !== defaults[CHANNELS[index]] && !target
    ))) {
      throw paletteError('unknown-palette', 'Palette target belongs to a different semantic slot');
    }

    const algorithm = catalog.algorithm;
    const slotTotals = [0, 0, 0];
    const anchorSums = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const maskOffset = pixel * maskStride;
      const packedSum = mask[maskOffset] + mask[maskOffset + 1] + mask[maskOffset + 2];
      if (packedSum > 255) {
        throw paletteError(
          'invalid-mask',
          'Packed semantic mask channels exceed 255 at pixel ' + pixel,
          Object.freeze({ pixel, sum: packedSum }),
        );
      }
      if (!activeTargets.some(Boolean)) continue;
      const lab = sourceLabAt(base, pixel * 4, algorithm);
      for (let channelIndex = 0; channelIndex < CHANNELS.length; channelIndex += 1) {
        if (!activeTargets[channelIndex]) continue;
        const weight = mask[maskOffset + channelIndex] / 255;
        if (weight <= 0) continue;
        slotTotals[channelIndex] += weight;
        anchorSums[channelIndex][0] += lab[0] * weight;
        anchorSums[channelIndex][1] += lab[1] * weight;
        anchorSums[channelIndex][2] += lab[2] * weight;
      }
    }
    const anchors = slotTotals.map((total, index) => (
      total > 0
        ? [
          anchorSums[index][0] / total,
          anchorSums[index][1] / total,
          anchorSums[index][2] / total,
        ]
        : null
    ));
    const output = new Uint8ClampedArray(base);
    const residual = algorithm.paperResidual;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const baseOffset = pixel * 4;
      const maskOffset = pixel * maskStride;
      let totalWeight = 0;
      const contribution = [0, 0, 0];
      let sourceLab = null;
      for (let channelIndex = 0; channelIndex < CHANNELS.length; channelIndex += 1) {
        const target = activeTargets[channelIndex];
        const weight = target ? mask[maskOffset + channelIndex] / 255 : 0;
        if (weight <= 0 || !anchors[channelIndex]) continue;
        if (!sourceLab) sourceLab = sourceLabAt(base, baseOffset, algorithm);
        const anchor = anchors[channelIndex];
        const mappedLab = [
          target.lab[0] + (sourceLab[0] - anchor[0]) * residual.lightness,
          target.lab[1] + (sourceLab[1] - anchor[1]) * residual.chromaA,
          target.lab[2] + (sourceLab[2] - anchor[2]) * residual.chromaB,
        ];
        const mapped = labToSrgbFloat(mappedLab, algorithm);
        contribution[0] += mapped[0] * weight;
        contribution[1] += mapped[1] * weight;
        contribution[2] += mapped[2] * weight;
        totalWeight += weight;
      }
      if (totalWeight > 1 + 1e-9) {
        throw paletteError(
          'invalid-mask',
          'Selected semantic mask channels exceed unit coverage at pixel ' + pixel,
          Object.freeze({ pixel, weight: totalWeight }),
        );
      }
      if (totalWeight > 0) {
        for (let component = 0; component < 3; component += 1) {
          const source = base[baseOffset + component] / 255;
          const mixed = source * (1 - totalWeight) + contribution[component];
          output[baseOffset + component] = Math.min(
            255,
            Math.max(0, Math.floor(mixed * 255 + 0.5)),
          );
        }
      }
      output[baseOffset + 3] = base[baseOffset + 3];
    }
    return output;
  }

  function compileGoldenVectorsV2(value, catalog) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw paletteError('invalid-manifest', 'Embedded goldenVectors must be an object');
    }
    if (sha256Ascii(JSON.stringify(value)) !== EXPECTED_GOLDEN_PAYLOAD_SHA256) {
      throw paletteError('invalid-manifest', 'Embedded goldenVectors payload differs from approved v1');
    }
    if (
      value.schema !== GOLDEN_VECTORS_SCHEMA
      || value.algorithm !== EXPECTED_ALGORITHM_ID
      || value.byteRounding !== EXPECTED_BYTE_ROUNDING
      || !Array.isArray(value.vectors)
      || value.vectors.length !== EXPECTED_GOLDEN_IDS.length
      || value.vectors.some((vector, index) => vector?.id !== EXPECTED_GOLDEN_IDS[index])
    ) {
      throw paletteError('invalid-manifest', 'Embedded goldenVectors contract is not approved v1');
    }
    const ids = new Set();
    const compiledVectors = value.vectors.map((vector, index) => {
      const label = 'goldenVectors.vectors[' + index + ']';
      if (!vector || typeof vector !== 'object' || !ID_TOKEN.test(vector.id || '') || ids.has(vector.id)) {
        throw paletteError('invalid-manifest', label + '.id must be unique and canonical');
      }
      ids.add(vector.id);
      if (
        !Number.isInteger(vector.width)
        || vector.width <= 0
        || !Number.isInteger(vector.height)
        || vector.height <= 0
        || vector.width * vector.height > 4096
      ) {
        throw paletteError('invalid-manifest', label + ' has an invalid canvas');
      }
      const count = vector.width * vector.height;
      const base = parseFlatRows(vector.sourceRgba, 4, count, label + '.sourceRgba');
      const mask = parseFlatRows(vector.maskRgb, 3, count, label + '.maskRgb');
      const expected = parseFlatRows(vector.expectedRgba, 4, count, label + '.expectedRgba');
      const targetIds = vector.targetIds;
      if (!targetIds || typeof targetIds !== 'object' || Array.isArray(targetIds)) {
        throw paletteError('invalid-manifest', label + '.targetIds must be a slot map');
      }
      for (const channel of Object.keys(targetIds)) {
        if (!CHANNELS.includes(channel) || !catalog.targetFor(channel, targetIds[channel])) {
          throw paletteError('invalid-manifest', label + ' contains an unauthorised palette target');
        }
      }
      const selected = { ...catalog.defaultPalette, ...targetIds };
      const actual = recolorPixelsV2({
        base,
        mask,
        width: vector.width,
        height: vector.height,
        palette: selected,
        defaultPalette: catalog.defaultPalette,
        catalog,
      });
      const mismatch = actual.findIndex((byte, byteIndex) => byte !== expected[byteIndex]);
      if (mismatch !== -1) {
        throw paletteError(
          'golden-parity',
          'Embedded golden vector failed byte parity: ' + vector.id,
          Object.freeze({ vector: vector.id, byte: mismatch, expected: expected[mismatch], actual: actual[mismatch] }),
        );
      }
      return Object.freeze({
        id: vector.id,
        width: vector.width,
        height: vector.height,
        targetIds: Object.freeze({ ...targetIds }),
      });
    });
    return Object.freeze({
      schema: GOLDEN_VECTORS_SCHEMA,
      algorithm: value.algorithm,
      byteRounding: value.byteRounding,
      vectors: Object.freeze(compiledVectors),
    });
  }

  function runtimeFoundationPayload(manifest) {
    return {
      maskRevision: manifest.maskRevision,
      variants: manifest.variants.map((variant) => ({
        id: variant.id,
        gender: variant.gender,
        morphologyRevision: variant.morphologyRevision,
        identitySha256: variant.identitySha256 || null,
        capabilities: variant.capabilities.map((capability) => ({
          id: capability.id,
          frames: capability.frames.map((frame) => ({
            id: frame.id,
            variant: frame.variant,
            capability: frame.capability,
            frame: frame.frame,
            canvas: [frame.canvas[0], frame.canvas[1]],
            baseRoute: frame.baseRoute,
            baseSha256: frame.baseSha256,
            maskRoute: frame.maskRoute,
          })),
        })),
      })),
    };
  }

  function compileManifestV2(manifest) {
    if (manifest && typeof manifest === 'object' && COMPILED_MANIFESTS.has(manifest)) return manifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw paletteError('invalid-manifest', 'Runtime semantic-mask manifest must be an object');
    }
    if (manifest.schema !== MANIFEST_SCHEMA) {
      throw paletteError('invalid-manifest', 'Runtime manifest schema must be ' + MANIFEST_SCHEMA);
    }
    if (manifest.status !== 'runtime-approved' || manifest.runtimeEligible !== true) {
      throw paletteError(
        'manifest-not-approved',
        'Runtime semantic-mask manifest must be explicitly runtime-approved and eligible',
      );
    }
    if (manifest.id !== EXPECTED_RUNTIME_ID || manifest.maskRevision !== EXPECTED_MASK_REVISION) {
      throw paletteError('invalid-manifest', 'Runtime manifest identity or maskRevision is invalid');
    }
    if (
      manifest.paletteCatalogSha256 !== EXPECTED_CATALOG_SHA256
      || manifest.goldenVectorsSha256 !== EXPECTED_GOLDEN_SHA256
    ) {
      throw paletteError('invalid-manifest', 'Embedded contract SHA-256 bindings do not match approved v1');
    }
    if (
      !manifest.manualApproval
      || !nonEmptyText(manifest.manualApproval.revision)
      || !nonEmptyText(manifest.manualApproval.approvedBy)
    ) {
      throw paletteError('manifest-not-approved', 'Runtime manifest requires a named manual approval revision');
    }
    const catalog = compilePaletteCatalogV2(manifest.paletteCatalog);
    const goldenVectors = compileGoldenVectorsV2(manifest.goldenVectors, catalog);
    if (!Array.isArray(manifest.variants) || manifest.variants.length !== 2) {
      throw paletteError('invalid-manifest', 'Runtime manifest must contain the exact two v1 variants');
    }

    const identityIds = new Set();
    const globallyAuthoredIds = new Set();
    const globallyAuthoredBasePaths = new Set();
    const globallyAuthoredMaskPaths = new Set();
    const identitiesByMorphology = new Map();
    const frameLookup = new Map();
    const frozenIdentities = {};
    let totalFrames = 0;
    for (let variantIndex = 0; variantIndex < manifest.variants.length; variantIndex += 1) {
      const variant = manifest.variants[variantIndex];
      const label = 'variants[' + variantIndex + ']';
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
        throw paletteError('invalid-manifest', label + ' must be an object');
      }
      const expectedVariant = EXPECTED_VARIANTS[variant.id];
      if (
        !ID_TOKEN.test(variant.id || '')
        || !expectedVariant
        || variant.gender !== expectedVariant.gender
        || variant.morphologyRevision !== expectedVariant.morphologyRevision
      ) {
        throw paletteError('invalid-manifest', label + ' is not an approved v1 identity');
      }
      if (identityIds.has(variant.id)) {
        throw paletteError('invalid-manifest', 'Runtime identity id must be globally unique: ' + variant.id);
      }
      identityIds.add(variant.id);
      if (
        (variant.id === 'female-f2-v1' && variant.identitySha256 !== EXPECTED_FEMALE_IDENTITY_SHA256)
        || (variant.id === 'male-v1' && variant.identitySha256 !== undefined && variant.identitySha256 !== null)
      ) {
        throw paletteError('invalid-manifest', label + '.identitySha256 does not match approved identity');
      }
      if (!Array.isArray(variant.capabilities) || variant.capabilities.length !== 7) {
        throw paletteError('invalid-manifest', label + ' must contain the exact capability set');
      }
      const capabilityIds = new Set();
      const descriptors = [];
      const frameIds = new Set();
      for (let capabilityIndex = 0; capabilityIndex < variant.capabilities.length; capabilityIndex += 1) {
        const capability = variant.capabilities[capabilityIndex];
        const capabilityLabel = label + '.capabilities[' + capabilityIndex + ']';
        if (
          !capability
          || typeof capability !== 'object'
          || !Object.prototype.hasOwnProperty.call(EXPECTED_CAPABILITIES, capability.id)
          || capabilityIds.has(capability.id)
        ) {
          throw paletteError('invalid-manifest', capabilityLabel + '.id is unknown or duplicated');
        }
        capabilityIds.add(capability.id);
        if (
          !Array.isArray(capability.frames)
          || capability.frames.length !== EXPECTED_CAPABILITIES[capability.id]
        ) {
          throw paletteError(
            'invalid-manifest',
            capabilityLabel + ' must contain exactly ' + EXPECTED_CAPABILITIES[capability.id] + ' frames',
          );
        }
        for (let frameIndex = 0; frameIndex < capability.frames.length; frameIndex += 1) {
          const frame = capability.frames[frameIndex];
          const frameLabel = capabilityLabel + '.frames[' + frameIndex + ']';
          if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
            throw paletteError('invalid-manifest', frameLabel + ' must be an object');
          }
          if (
            frame.variant !== variant.id
            || frame.capability !== capability.id
            || !ID_TOKEN.test(frame.frame || '')
          ) {
            throw paletteError('invalid-manifest', frameLabel + ' ownership is inconsistent');
          }
          const exactId = variant.id + ':' + capability.id + ':' + frame.frame;
          if (frame.id !== exactId) {
            throw paletteError('invalid-manifest', frameLabel + '.id must equal ' + exactId);
          }
          if (frameIds.has(frame.id) || globallyAuthoredIds.has(frame.id)) {
            throw paletteError(
              'invalid-manifest',
              'Frame id may occur only once inside identity ' + variant.id + ': ' + frame.id,
            );
          }
          frameIds.add(frame.id);
          globallyAuthoredIds.add(frame.id);
          const canvas = immutableCanvas(frame.canvas, frameLabel + '.canvas');
          const base = freezeAsset(
            { path: frame.baseRoute, sha256: frame.baseSha256, canvas },
            frameLabel + '.base',
            canvas,
          );
          const mask = freezeAsset(
            { path: frame.maskRoute, sha256: frame.maskSha256, canvas },
            frameLabel + '.mask',
            canvas,
          );
          const expectedMaskPrefix = '/art/avatars/traveller-appearance-v2/'
            + manifest.maskRevision + '/' + variant.id + '/' + capability.id + '/';
          if (!mask.path.startsWith(expectedMaskPrefix)) {
            throw paletteError('invalid-manifest', frameLabel + '.maskRoute is outside its promoted scope');
          }
          if (
            globallyAuthoredBasePaths.has(base.path)
            || globallyAuthoredMaskPaths.has(base.path)
          ) {
            throw paletteError('invalid-manifest', 'Base path may belong to exactly one frame: ' + base.path);
          }
          if (
            globallyAuthoredMaskPaths.has(mask.path)
            || globallyAuthoredBasePaths.has(mask.path)
          ) {
            throw paletteError('invalid-manifest', 'Mask path may belong to exactly one frame: ' + mask.path);
          }
          globallyAuthoredBasePaths.add(base.path);
          globallyAuthoredMaskPaths.add(mask.path);
          const descriptor = Object.freeze({
            id: frame.id,
            variant: variant.id,
            capability: capability.id,
            frame: frame.frame,
            morphology: variant.gender,
            morphologyRevision: variant.morphologyRevision,
            identityId: variant.id,
            canvas,
            base,
            mask: Object.freeze({ ...mask, encoding: MASK_ENCODING }),
          });
          descriptors.push(descriptor);
          frameLookup.set(variant.id + '\u0000' + base.path, descriptor);
          totalFrames += 1;
        }
      }
      if (
        Object.keys(EXPECTED_CAPABILITIES).some((id) => !capabilityIds.has(id))
      ) {
        throw paletteError('invalid-manifest', label + ' omits a required capability');
      }
      const identity = Object.freeze({
        id: variant.id,
        variant: variant.id,
        morphology: variant.gender,
        morphologyRevision: variant.morphologyRevision,
        identitySha256: variant.identitySha256 || null,
        frames: Object.freeze(descriptors),
      });
      if (!identitiesByMorphology.has(variant.gender)) {
        identitiesByMorphology.set(variant.gender, new Map());
      }
      identitiesByMorphology.get(variant.gender).set(identity.id, identity);
      frozenIdentities[variant.gender] = Object.freeze({ [identity.id]: identity });
    }
    if (
      totalFrames !== 92
      || Object.keys(EXPECTED_VARIANTS).some((id) => !identityIds.has(id))
    ) {
      throw paletteError('invalid-manifest', 'Runtime manifest is not the exact 92-frame v1 inventory');
    }
    const foundationSha256 = sha256Ascii(JSON.stringify(runtimeFoundationPayload(manifest)));
    if (foundationSha256 !== EXPECTED_FOUNDATION_SHA256) {
      throw paletteError(
        'invalid-manifest',
        'Runtime manifest foundation does not match the approved 92-frame inventory',
        Object.freeze({ expected: EXPECTED_FOUNDATION_SHA256, actual: foundationSha256 }),
      );
    }

    function findIdentity(morphology, identityId) {
      const byId = identitiesByMorphology.get(morphology);
      if (!byId) return null;
      if (identityId) return byId.get(identityId) || null;
      return byId.size === 1 ? byId.values().next().value : null;
    }
    const compiled = Object.freeze({
      schema: MANIFEST_SCHEMA,
      id: manifest.id,
      revision: manifest.maskRevision,
      maskRevision: manifest.maskRevision,
      paletteRevision: catalog.id + ':' + catalog.algorithm.id + ':' + manifest.paletteCatalogSha256.toLowerCase(),
      goldenRevision: manifest.goldenVectorsSha256.toLowerCase(),
      foundationRevision: foundationSha256,
      defaultPalette: catalog.defaultPalette,
      palettes: catalog.palettes,
      algorithm: catalog.algorithm,
      catalog,
      goldenVectors,
      identities: Object.freeze(frozenIdentities),
      identityFor(morphology, identityId) {
        return findIdentity(morphology, identityId);
      },
      frameFor(morphology, exactBasePath, identityId) {
        const identity = findIdentity(morphology, identityId);
        return identity ? frameLookup.get(identity.id + '\u0000' + exactBasePath) || null : null;
      },
      targetFor(channel, id) {
        return catalog.targetFor(channel, id);
      },
    });
    COMPILED_MANIFESTS.add(compiled);
    return compiled;
  }

  function normalizeLookV2(value, manifest) {
    const compiled = compileManifestV2(manifest);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw paletteError('unknown-look', 'Traveller look must explicitly select a morphology');
    }
    const morphology = value.morphology || value.gender;
    if (typeof morphology !== 'string') {
      throw paletteError('unknown-look', 'Traveller look morphology is required');
    }
    const requestedIdentity = value.identityId || value.identity;
    const identity = compiled.identityFor(morphology, requestedIdentity);
    if (!identity) {
      throw paletteError(
        'unknown-look',
        'No unambiguous runtime identity is authored for morphology ' + morphology,
      );
    }
    const sourcePalette = value.palette && typeof value.palette === 'object' && !Array.isArray(value.palette)
      ? value.palette
      : {};
    const selected = {};
    for (const channel of CHANNELS) {
      const id = sourcePalette[channel] === undefined
        ? compiled.defaultPalette[channel]
        : sourcePalette[channel];
      if (typeof id !== 'string' || !compiled.palettes[channel][id]) {
        throw paletteError('unknown-palette', 'Palette ' + channel + ':' + String(id) + ' is not authored');
      }
      selected[channel] = id;
    }
    return Object.freeze({
      morphology,
      identityId: identity.id,
      palette: Object.freeze(selected),
    });
  }

  function lookKeyV2(value, manifest) {
    const look = normalizeLookV2(value, manifest);
    return look.morphology + '|' + look.identityId + '|' + paletteKey(look.palette);
  }

  function isDefaultPaletteV2(value, manifest) {
    const compiled = compileManifestV2(manifest);
    return CHANNELS.every((channel) => value?.[channel] === compiled.defaultPalette[channel]);
  }

  function resolveFrameDescriptorV2(manifest, value, exactBasePath) {
    const compiled = compileManifestV2(manifest);
    const look = normalizeLookV2(value, compiled);
    if (!validAssetPath(exactBasePath)) {
      throw paletteError('frame-not-authored', 'An exact base asset path is required');
    }
    const descriptor = compiled.frameFor(look.morphology, exactBasePath, look.identityId);
    if (!descriptor || descriptor.identityId !== look.identityId) {
      throw paletteError(
        'frame-not-authored',
        'Frame is not authored for ' + look.morphology + '/' + look.identityId + ': ' + exactBasePath,
      );
    }
    return Object.freeze({ descriptor, look, manifest: compiled });
  }

  async function sha256Hex(buffer, cryptoImpl) {
    const subtle = cryptoImpl?.subtle;
    if (!subtle || typeof subtle.digest !== 'function') {
      throw paletteError('integrity-unavailable', 'SHA-256 verification is unavailable in this runtime');
    }
    let digest;
    try {
      digest = await subtle.digest('SHA-256', buffer);
    } catch (error) {
      throw paletteError('integrity-unavailable', 'SHA-256 verification failed in this runtime', { cause: error });
    }
    const bytes = new Uint8Array(digest);
    if (bytes.length !== 32) {
      throw paletteError('integrity-unavailable', 'SHA-256 verification returned an invalid digest');
    }
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function fetchAsset(asset, environment, signal, bitmapOptions) {
    throwIfAborted(signal);
    let response;
    try {
      response = await environment.fetchImpl(asset.path, { signal, cache: 'force-cache' });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw abortError();
      throw paletteError('asset-failed', `Could not fetch ${asset.path}`, { cause: error });
    }
    if (!response?.ok) {
      throw paletteError('asset-failed', `Could not fetch ${asset.path}: HTTP ${response?.status || 0}`);
    }
    let blob;
    if (environment.verifyIntegrity) {
      if (typeof response.arrayBuffer !== 'function' || typeof environment.BlobImpl !== 'function') {
        throw paletteError('integrity-unavailable', 'Verified PNG loading is unavailable in this runtime');
      }
      let buffer;
      try {
        buffer = await response.arrayBuffer();
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw abortError();
        throw paletteError('asset-failed', 'Could not read ' + asset.path + ' for integrity verification', { cause: error });
      }
      throwIfAborted(signal);
      const digest = await sha256Hex(buffer, environment.cryptoImpl);
      throwIfAborted(signal);
      if (digest !== asset.sha256) {
        throw paletteError('integrity-mismatch', `SHA-256 mismatch for ${asset.path}`);
      }
      try {
        blob = new environment.BlobImpl([buffer], {
          type: response.headers?.get?.('content-type') || 'image/png',
        });
      } catch (error) {
        throw paletteError('asset-failed', 'Could not construct verified PNG ' + asset.path, { cause: error });
      }
    } else {
      blob = await response.blob();
    }
    throwIfAborted(signal);
    let bitmap;
    try {
      bitmap = bitmapOptions
        ? await environment.createImageBitmapImpl(blob, bitmapOptions)
        : await environment.createImageBitmapImpl(blob);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      throw paletteError('asset-failed', `Could not decode ${asset.path}`, { cause: error });
    }
    if (signal?.aborted) {
      bitmap.close?.();
      throw abortError();
    }
    if (bitmap.width !== asset.canvas[0] || bitmap.height !== asset.canvas[1]) {
      bitmap.close?.();
      throw paletteError('canvas-mismatch', `Decoded canvas does not match manifest for ${asset.path}`);
    }
    return bitmap;
  }

  function canvasPixels(documentImpl, bitmap, width, height, label) {
    const canvas = documentImpl.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw paletteError('canvas-unavailable', `2D canvas is unavailable for ${label}`);
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0);
    let imageData;
    try {
      imageData = context.getImageData(0, 0, width, height);
    } catch (error) {
      throw paletteError('canvas-unavailable', `Could not read ${label} pixels`, { cause: error });
    }
    return Object.freeze({ canvas, context, imageData });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(paletteError('canvas-unavailable', 'Canvas PNG encoding failed'));
      }, 'image/png');
    });
  }

  async function renderBrowserFrame(context) {
    const { descriptor, look, manifest, signal, environment } = context;
    if (
      typeof environment.fetchImpl !== 'function'
      || typeof environment.createImageBitmapImpl !== 'function'
      || !environment.documentImpl?.createElement
      || !environment.URLImpl?.createObjectURL
    ) {
      throw paletteError('runtime-unavailable', 'Browser image compositor is unavailable');
    }
    const [width, height] = descriptor.canvas;
    let baseBitmap;
    let maskBitmap;
    const DecodeAbortController = environment.AbortControllerImpl;
    if (typeof DecodeAbortController !== 'function') {
      throw paletteError('runtime-unavailable', 'AbortController is unavailable for paired image decode');
    }
    const decodeController = new DecodeAbortController();
    const forwardAbort = () => decodeController.abort();
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener?.('abort', forwardAbort, { once: true });
    let primaryError = null;
    const guarded = (promise) => promise.catch((error) => {
      if (!primaryError) primaryError = error;
      decodeController.abort();
      throw error;
    });
    try {
      const decoded = await Promise.allSettled([
        guarded(fetchAsset(descriptor.base, environment, decodeController.signal)),
        guarded(fetchAsset(
          descriptor.mask,
          environment,
          decodeController.signal,
          Object.freeze({ colorSpaceConversion: 'none', premultiplyAlpha: 'none' }),
        )),
      ]);
      baseBitmap = decoded[0].status === 'fulfilled' ? decoded[0].value : null;
      maskBitmap = decoded[1].status === 'fulfilled' ? decoded[1].value : null;
      if (decoded.some((result) => result.status === 'rejected')) {
        throw primaryError || decoded.find((result) => result.status === 'rejected').reason;
      }
      throwIfAborted(signal);
      const base = canvasPixels(environment.documentImpl, baseBitmap, width, height, 'base');
      const mask = canvasPixels(environment.documentImpl, maskBitmap, width, height, 'mask');
      const pixels = recolorPixelsV2({
        basePixels: base.imageData.data,
        maskPixels: mask.imageData.data,
        width,
        height,
        palette: look.palette,
        defaultPalette: manifest.defaultPalette,
        catalog: manifest,
      });
      const outputCanvas = environment.documentImpl.createElement('canvas');
      outputCanvas.width = width;
      outputCanvas.height = height;
      const outputContext = outputCanvas.getContext('2d');
      if (!outputContext) throw paletteError('canvas-unavailable', 'Output 2D canvas is unavailable');
      const outputImage = outputContext.createImageData(width, height);
      outputImage.data.set(pixels);
      outputContext.putImageData(outputImage, 0, 0);
      const blob = await canvasToBlob(outputCanvas);
      throwIfAborted(signal);
      const url = environment.URLImpl.createObjectURL(blob);
      if (signal?.aborted) {
        environment.revokeObjectURL(url);
        throw abortError();
      }
      return url;
    } finally {
      signal?.removeEventListener?.('abort', forwardAbort);
      baseBitmap?.close?.();
      maskBitmap?.close?.();
    }
  }

  function createRuntime(options = {}) {
    const manifest = compileManifestV2(options.manifest);
    const maxEntries = options.maxEntries === undefined ? 12 : options.maxEntries;
    if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 256) {
      throw paletteError('invalid-options', 'maxEntries must be an integer from 1 to 256');
    }
    const customRenderer = typeof options.renderFrame === 'function';
    const renderer = customRenderer ? options.renderFrame : renderBrowserFrame;
    const URLImpl = options.URLImpl || root?.URL;
    const environment = Object.freeze({
      fetchImpl: options.fetchImpl || root?.fetch?.bind(root),
      createImageBitmapImpl: options.createImageBitmapImpl || root?.createImageBitmap?.bind(root),
      documentImpl: options.documentImpl || root?.document,
      URLImpl,
      BlobImpl: options.BlobImpl || root?.Blob,
      cryptoImpl: options.cryptoImpl || root?.crypto,
      AbortControllerImpl: options.AbortControllerImpl || root?.AbortController,
      verifyIntegrity: !customRenderer || options.verifyIntegrity === true,
      revokeObjectURL: options.revokeObjectURL
        || URLImpl?.revokeObjectURL?.bind(URLImpl)
        || function noop() {},
    });
    if (typeof renderer !== 'function') throw paletteError('invalid-options', 'renderFrame must be a function');
    const cache = new Map();
    const pending = new Map();
    const reservations = new Map();
    let disposed = false;

    function cacheKey(descriptor, look) {
      return [
        manifest.revision,
        manifest.paletteRevision,
        descriptor.morphology,
        descriptor.identityId,
        descriptor.id,
        descriptor.base.path,
        descriptor.mask.path,
        descriptor.base.sha256,
        descriptor.mask.sha256,
        paletteKey(look.palette),
      ].join('|');
    }

    function touch(key, entry) {
      cache.delete(key);
      cache.set(key, entry);
    }

    function revokeEntry(key, entry) {
      if (cache.get(key) === entry) cache.delete(key);
      if (!entry.revoked) {
        entry.revoked = true;
        environment.revokeObjectURL(entry.url);
      }
    }

    function trim() {
      while (cache.size > maxEntries) {
        const candidate = Array.from(cache.entries()).find((pair) => (
          pair[1].refs === 0 && !reservations.has(pair[0])
        ));
        if (!candidate) break;
        revokeEntry(candidate[0], candidate[1]);
      }
    }

    function reserve(key) {
      reservations.set(key, (reservations.get(key) || 0) + 1);
    }

    function unreserve(key) {
      const count = reservations.get(key) || 0;
      if (count <= 1) reservations.delete(key);
      else reservations.set(key, count - 1);
    }

    async function renderEntry(key, descriptor, look, signal) {
      throwIfAborted(signal);
      let rendered;
      try {
        rendered = await renderer(Object.freeze({
          descriptor,
          look,
          manifest,
          signal,
          environment,
          recolorPixels: recolorPixelsV2,
        }));
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw abortError();
        if (error instanceof TravellerPaletteError) throw error;
        throw paletteError('render-failed', `Palette rendering failed for ${descriptor.base.path}`, { cause: error });
      }
      const url = typeof rendered === 'string' ? rendered : rendered?.url;
      if (typeof url !== 'string' || url.length === 0) {
        throw paletteError('render-failed', 'Palette renderer did not return an object URL');
      }
      if (signal?.aborted || disposed) {
        environment.revokeObjectURL(url);
        if (signal?.aborted) throw abortError();
        throw paletteError('disposed', 'Traveller palette runtime is disposed');
      }
      const existing = cache.get(key);
      if (existing) {
        environment.revokeObjectURL(url);
        touch(key, existing);
        return existing;
      }
      const entry = { url, refs: 0, revoked: false };
      cache.set(key, entry);
      return entry;
    }

    function materialize(key, descriptor, look, signal) {
      const cached = cache.get(key);
      if (cached && !cached.revoked) {
        touch(key, cached);
        return Promise.resolve(cached);
      }
      if (!signal && pending.has(key)) return pending.get(key);
      const promise = renderEntry(key, descriptor, look, signal);
      if (!signal) {
        pending.set(key, promise);
        promise.finally(() => {
          if (pending.get(key) === promise) pending.delete(key);
        }).catch(() => {});
      }
      return promise;
    }

    async function resolve(exactBasePath, value, resolveOptions = {}) {
      if (disposed) throw paletteError('disposed', 'Traveller palette runtime is disposed');
      const signal = resolveOptions.signal;
      throwIfAborted(signal);
      const authored = resolveFrameDescriptorV2(manifest, value, exactBasePath);
      const { descriptor, look } = authored;
      const key = cacheKey(descriptor, look);
      if (isDefaultPaletteV2(look.palette, manifest)) {
        return Object.freeze({
          url: descriptor.base.path,
          bypass: true,
          key,
          morphology: look.morphology,
          identityId: look.identityId,
          basePath: descriptor.base.path,
          release() {},
        });
      }
      reserve(key);
      let entry;
      try {
        entry = await materialize(key, descriptor, look, signal);
        throwIfAborted(signal);
        if (disposed || entry.revoked) throw paletteError('disposed', 'Traveller palette runtime is disposed');
        entry.refs += 1;
        touch(key, entry);
      } finally {
        unreserve(key);
      }
      trim();
      let released = false;
      return Object.freeze({
        url: entry.url,
        bypass: false,
        key,
        morphology: look.morphology,
        identityId: look.identityId,
        basePath: descriptor.base.path,
        release() {
          if (released) return;
          released = true;
          entry.refs = Math.max(0, entry.refs - 1);
          trim();
        },
      });
    }

    async function prefetch(exactBasePaths, value, prefetchOptions = {}) {
      if (!Array.isArray(exactBasePaths)) {
        throw paletteError('invalid-options', 'prefetch requires an array of exact base paths');
      }
      const settled = await Promise.allSettled(
        exactBasePaths.map((path) => resolve(path, value, prefetchOptions)),
      );
      const handles = settled
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      for (const handle of handles) handle.release();
      trim();
      const failure = settled.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
      return Object.freeze({
        requested: exactBasePaths.length,
        warmed: handles.filter((handle) => !handle.bypass).length,
        bypassed: handles.filter((handle) => handle.bypass).length,
        keys: Object.freeze(handles.map((handle) => handle.key)),
      });
    }

    function clear() {
      for (const [key, entry] of Array.from(cache.entries())) {
        if (entry.refs === 0 && !reservations.has(key)) revokeEntry(key, entry);
      }
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      for (const [key, entry] of Array.from(cache.entries())) revokeEntry(key, entry);
      pending.clear();
      reservations.clear();
    }

    function stats() {
      return Object.freeze({
        disposed,
        size: cache.size,
        pending: pending.size,
        reservations: Array.from(reservations.values()).reduce((sum, count) => sum + count, 0),
        referenced: Array.from(cache.values()).reduce((sum, entry) => sum + entry.refs, 0),
        keys: Object.freeze(Array.from(cache.keys())),
      });
    }

    return Object.freeze({
      manifest,
      resolve,
      prefetch,
      clear,
      dispose,
      stats,
    });
  }

  return Object.freeze({
    VERSION,
    MANIFEST_SCHEMA,
    PALETTE_CATALOG_SCHEMA,
    GOLDEN_VECTORS_SCHEMA,
    MASK_ENCODING,
    CHANNELS,
    DEFAULT_PALETTE,
    TravellerPaletteError,
    abortError,
    isAbortError,
    rgbToOklab,
    oklabToRgb,
    compilePaletteCatalog: compilePaletteCatalogV2,
    compileManifest: compileManifestV2,
    normalizeLook: normalizeLookV2,
    paletteKey,
    lookKey: lookKeyV2,
    isDefaultPalette: isDefaultPaletteV2,
    resolveFrameDescriptor: resolveFrameDescriptorV2,
    recolorPixels: recolorPixelsV2,
    createRuntime,
  });
});
