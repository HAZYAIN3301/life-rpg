'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const Sound = require('../public/sound-engine-v1.js');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Sound OS exposes only known semantic events', () => {
  assert.equal(Sound.VERSION, '1.0.0');
  assert.equal(Sound.normalizeEvent('click'), 'select');
  assert.equal(Sound.normalizeEvent('chest_tick'), 'reward_tick');
  assert.equal(Sound.normalizeEvent('destroy_profile'), '');
  assert.deepEqual(Sound.MODES, ['off', 'essential', 'full']);
});

test('sound modes separate tactile feedback from earned moments', () => {
  assert.equal(Sound.isAllowed('navigate', 'off'), false);
  assert.equal(Sound.isAllowed('complete', 'off'), false);
  assert.equal(Sound.isAllowed('navigate', 'essential'), false);
  assert.equal(Sound.isAllowed('reward_tick', 'essential'), false);
  assert.equal(Sound.isAllowed('complete', 'essential'), true);
  assert.equal(Sound.isAllowed('loot', 'essential'), true);
  assert.equal(Sound.isAllowed('navigate', 'full'), true);
  assert.equal(Sound.isAllowed('reward_tick', 'full'), true);
});

test('rarity is bounded and deterministic for the sound voice', () => {
  assert.equal(Sound.rarityIndex('common'), 0);
  assert.equal(Sound.rarityIndex('rare'), 1);
  assert.equal(Sound.rarityIndex('epic'), 2);
  assert.equal(Sound.rarityIndex('legendary'), 3);
  assert.equal(Sound.rarityIndex('garbage'), 0);
});

test('engine degrades safely when Web Audio is unavailable', () => {
  const engine = Sound.create({ mode: 'full', AudioContext: null });
  assert.equal(engine.play('navigate'), false);
  assert.equal(engine.setMode('essential'), 'essential');
  assert.equal(engine.getMode(), 'essential');
  assert.equal(engine.play('navigate'), false);
  assert.equal(engine.diagnostics().context, 'idle');
});

test('app wires Sound OS and an honest decelerating reward reel', () => {
  const src = read('public/app.js');
  assert.match(src, /window\.SatoruSoundV1/);
  assert.match(src, /function scheduleChestReelSounds/);
  assert.match(src, /reward_tick/);
  assert.match(src, /sfx\('navigate'\)/);
  assert.match(src, /set-sound-mode/);
  assert.match(src, /\['off', 'Выкл'\], \['essential', 'Только важное'\], \['full', 'Полный'\]/);
  assert.doesNotMatch(src, /function sfxTone/);
  assert.match(src, /loot-reel-object/);
  assert.match(src, /<span class="sr-only">\$\{esc\(item/);
  assert.match(src, /Результат уже сохранён\. Можно посмотреть церемонию/);
  assert.match(src, /winnerIndex \* tileStep \+ tileWidth \/ 2/);
  assert.doesNotMatch(src, /winnerIndex \* tileW - \(reel\.clientWidth \/ 2\)/);
});

test('generated reward art is the visible object layer, not text pretending to be art', () => {
  const css = read('public/styles.css');
  assert.match(css, /reward-atlas-v1\.png/);
  assert.match(css, /\.reward-object-art\.is-chest/);
  assert.match(css, /\.reward-object-art\.is-gold/);
  assert.match(css, /\.reward-object-art\.is-cosmetic/);
  assert.match(css, /\.reward-object-art\.is-voucher/);
  assert.match(css, /prefers-reduced-motion: reduce/);

  const png = fs.readFileSync(path.join(root, 'public/art/rewards/reward-atlas-v1.png'));
  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length > 100_000, 'reward atlas is unexpectedly small');
});

test('shell loads the engine before app and caches the complete vertical slice', () => {
  const index = read('public/index.html');
  const sw = read('public/sw.js');
  assert.ok(index.indexOf('sound-engine-v1.js') < index.indexOf('app.js?v='));
  assert.match(index, /sound-engine-v1\.js\?v=20260829-browser-companion-discovery-v202-1/);
  assert.match(sw, /const CACHE = 'satoru-v235'/);
  assert.match(sw, /'sound-engine-v1\.js'/);
  assert.match(sw, /'art\/rewards\/reward-atlas-v1\.png'/);
});

test('secondary reward configuration is progressive disclosure', () => {
  const src = read('public/app.js');
  assert.match(src, /reward-create-details/);
  assert.match(src, /rewards-disclosure/);
  assert.ok(src.indexOf("${lootboxCard()}") < src.indexOf("${personalStore}"));
});
