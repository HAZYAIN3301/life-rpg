'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const appearance = require('../public/traveller-appearance-v1.js');

test('Traveller appearance separates known morphologies from complete selectable packs', () => {
  assert.deepEqual(appearance.KNOWN_GENDERS, ['male', 'female']);
  assert.equal(appearance.isSelectable('male'), true);
  assert.equal(appearance.isSelectable('female'), false);
  assert.deepEqual(appearance.selectableGenders(), ['male']);
  assert.deepEqual(appearance.selectionResult('female'), {
    ok: false,
    reason: 'incomplete-pack',
    gender: 'female',
  });
});

test('explicit female authoring paths never fall back to male', () => {
  assert.equal(
    appearance.assetPath('female', 'motion', 'walk-a.png'),
    '/art/avatars/traveller-core-v1/female/motion-v3/walk-a.png',
  );
  assert.equal(
    appearance.assetPath('female', 'room', 'bench-read-a.png'),
    '/art/avatars/traveller-core-v1/female/room-actions-v4/bench-read-a.png',
  );
  assert.equal(appearance.assetPath('unknown', 'core', 'idle.png'), null);
  assert.equal(appearance.assetPath('female', 'motion', '../male/walk-a.png'), null);
});

test('legacy or incomplete saved gender normalizes to the safe active pack', () => {
  assert.equal(appearance.normalize({ avatarCoreGender: 'male' }).gender, 'male');
  assert.equal(appearance.normalize({ avatarCoreGender: 'female' }).gender, 'male');
  const completeFemale = {
    male: appearance.PACK_STATUS.male,
    female: Object.fromEntries(appearance.CAPABILITY_KEYS.map((key) => [key, true])),
  };
  assert.equal(appearance.normalize({ gender: 'female' }, completeFemale).gender, 'female');
});

test('palette schema is deterministic and does not claim unproduced variants', () => {
  assert.deepEqual(appearance.normalize().palette, appearance.DEFAULT_PALETTE);
  assert.deepEqual(
    appearance.normalizePalette({ skin: 'not-produced', hair: 'brown-02', eyes: 'umber-01' }),
    appearance.DEFAULT_PALETTE,
  );
  assert.throws(() => appearance.PALETTE_OPTIONS.hair.push('violet'));
});

test('capability checks require every launch surface', () => {
  const partial = {
    male: appearance.PACK_STATUS.male,
    female: { ...appearance.PACK_STATUS.male, shadow: false },
  };
  assert.equal(appearance.isSelectable('female', partial), false);
  partial.female.shadow = true;
  assert.equal(appearance.isSelectable('female', partial), true);
});
