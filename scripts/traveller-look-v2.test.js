const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Look = require('../public/traveller-look-v2.js');

function fakeCompiledManifest(overrides = {}) {
  const identities = {
    male: {
      id: 'male-v1',
      morphology: 'male',
      frames: [{ base: { path: '/art/male-idle.png' } }, { base: { path: '/art/male-walk.png' } }],
    },
    female: {
      id: 'female-f2-v1',
      morphology: 'female',
      frames: [{ base: { path: '/art/female-idle.png' } }],
    },
  };
  const palettes = Object.fromEntries(Look.CHANNELS.map((channel) => [
    channel,
    Object.fromEntries(Look.PALETTE_IDS[channel].map((id) => [
      id,
      Object.freeze({
        id,
        isDefault: id === 'original',
        target: id === 'original' ? null : Object.freeze({ hex: '#' + (channel === 'skin' ? 'd89a70' : channel === 'hair' ? '4a2e22' : '285466') }),
      }),
    ])),
  ]));
  return {
    defaultPalette: { skin: 'original', hair: 'original', eyes: 'original' },
    palettes,
    identityFor(morphology, identityId) {
      const identity = identities[morphology];
      return identity?.id === identityId ? identity : null;
    },
    ...overrides,
  };
}

test('missing appearance data becomes the exact original male look', () => {
  assert.deepEqual(Look.normalize(), {
    schemaVersion: 1,
    gender: 'male',
    identityId: 'male-v1',
    palette: { skin: 'original', hair: 'original', eyes: 'original' },
  });
  assert.deepEqual(Look.runtimeLook(), {
    morphology: 'male',
    identityId: 'male-v1',
    palette: { skin: 'original', hair: 'original', eyes: 'original' },
  });
});

test('legacy placeholder palette ids migrate to original instead of inventing a colour match', () => {
  assert.deepEqual(Look.normalize({
    avatarCoreGender: 'female',
    avatarCorePalette: { skin: 'warm-02', hair: 'brown-02', eyes: 'umber-01' },
  }), {
    schemaVersion: 1,
    gender: 'female',
    identityId: 'female-f2-v1',
    palette: { skin: 'original', hair: 'original', eyes: 'original' },
  });
});

test('invalid saved values recover per channel without rejecting the valid choices', () => {
  assert.deepEqual(Look.normalize({
    avatarCoreGender: 'not-authored',
    avatarCorePalette: { skin: 'skin-deep', hair: 'not-authored', eyes: 'eyes-jade' },
  }), {
    schemaVersion: 1,
    gender: 'male',
    identityId: 'male-v1',
    palette: { skin: 'skin-deep', hair: 'original', eyes: 'eyes-jade' },
  });
});

test('settings patch remains separate from Avatar Forge and contains only account-owned fields', () => {
  assert.deepEqual(Look.settingsPatch({
    gender: 'female',
    palette: { skin: 'skin-bronze', hair: 'hair-auburn', eyes: 'eyes-amber' },
  }), {
    avatarCoreGender: 'female',
    avatarCorePalette: {
      schemaVersion: 1,
      skin: 'skin-bronze',
      hair: 'hair-auburn',
      eyes: 'eyes-amber',
    },
  });
  assert.equal(Object.hasOwn(Look.settingsPatch(), 'avatarAppearance'), false);
});

test('request changes only explicit authored channels and returns rollback-ready snapshots', () => {
  const result = Look.request({
    gender: 'male',
    palette: { skin: 'original', hair: 'hair-ink', eyes: 'original' },
  }, {
    gender: 'female',
    palette: { eyes: 'eyes-ocean' },
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.before.palette, { skin: 'original', hair: 'hair-ink', eyes: 'original' });
  assert.deepEqual(result.after, {
    schemaVersion: 1,
    gender: 'female',
    identityId: 'female-f2-v1',
    palette: { skin: 'original', hair: 'hair-ink', eyes: 'eyes-ocean' },
  });
  assert.deepEqual(result.look, {
    morphology: 'female',
    identityId: 'female-f2-v1',
    palette: result.after.palette,
  });
  assert.deepEqual(result.patch.avatarCorePalette, {
    schemaVersion: 1,
    skin: 'original',
    hair: 'hair-ink',
    eyes: 'eyes-ocean',
  });
});

test('request rejects unknown channels, palettes and genders instead of falling back', () => {
  assert.throws(() => Look.request({}, { gender: 'robot' }), (error) => error.code === 'unknown-gender');
  assert.throws(() => Look.request({}, { palette: { coat: 'teal' } }), (error) => error.code === 'unknown-channel');
  assert.throws(() => Look.request({}, { palette: { hair: 'violet' } }), (error) => error.code === 'unknown-palette');
  assert.throws(() => Look.request({}, { palette: null }), (error) => error.code === 'invalid-change');
});

test('same compares canonical identity and every semantic channel', () => {
  assert.equal(Look.same({}, { gender: 'male', palette: Look.DEFAULT_PALETTE }), true);
  assert.equal(Look.same({}, { gender: 'female', palette: Look.DEFAULT_PALETTE }), false);
  assert.equal(Look.same({}, { gender: 'male', palette: { ...Look.DEFAULT_PALETTE, eyes: 'eyes-jade' } }), false);
});

test('compiled manifest must expose the exact two identities and approved option ids', () => {
  const manifest = fakeCompiledManifest();
  assert.equal(Look.validateCompiledManifest(manifest), true);
  const missingIdentity = fakeCompiledManifest({ identityFor() { return null; } });
  assert.throws(() => Look.validateCompiledManifest(missingIdentity), (error) => error.code === 'invalid-manifest');
  const extra = fakeCompiledManifest();
  extra.palettes.hair.unapproved = { id: 'unapproved' };
  assert.throws(() => Look.validateCompiledManifest(extra), (error) => error.code === 'invalid-manifest');
  const wrongDefault = fakeCompiledManifest();
  wrongDefault.defaultPalette.skin = 'skin-warm';
  assert.throws(() => Look.validateCompiledManifest(wrongDefault), (error) => error.code === 'invalid-manifest');
});

test('catalog exposes exact swatches while original remains an identity option', () => {
  const catalog = Look.catalog(fakeCompiledManifest());
  assert.deepEqual(catalog.skin.map((option) => option.id), Look.PALETTE_IDS.skin);
  assert.deepEqual(catalog.hair.map((option) => option.id), Look.PALETTE_IDS.hair);
  assert.deepEqual(catalog.eyes.map((option) => option.id), Look.PALETTE_IDS.eyes);
  assert.deepEqual(catalog.skin[0], { id: 'original', channel: 'skin', isDefault: true, hex: null });
  assert.equal(catalog.eyes[1].hex, '#285466');
  assert.throws(() => catalog.skin.push({ id: 'fake' }));
});

test('preload base paths are exact and morphology-specific', () => {
  const manifest = fakeCompiledManifest();
  assert.deepEqual(Look.basePaths(manifest, { gender: 'male' }), [
    '/art/male-idle.png',
    '/art/male-walk.png',
  ]);
  assert.deepEqual(Look.basePaths(manifest, { gender: 'female' }), ['/art/female-idle.png']);
  assert.throws(() => Look.basePaths(manifest, { gender: 'male' }).push('/art/other.png'));
});

test('module is pure and owns no DOM, State, Store or network side effects', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/traveller-look-v2.js'), 'utf8');
  assert.doesNotMatch(source, /\b(?:document|window|State|Store|fetch|localStorage)\b/);
  assert.match(source, /module\.exports/);
  assert.match(source, /TravellerLookV2/);
  assert.throws(() => Look.PALETTE_IDS.hair.push('fake'));
  Look.DEFAULT_PALETTE.hair = 'fake';
  assert.equal(Look.DEFAULT_PALETTE.hair, 'original');
});
