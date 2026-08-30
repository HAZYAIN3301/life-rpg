'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const APP = read('public/app.js');
const CSS = read('public/styles.css');
const INDEX = read('public/index.html');
const SW = read('public/sw.js');
const REGISTRY = read('public/art/icons/icon-registry.js');

const groups = {
  achievements: 'allspheres_5 avatar_custom balanced balanced_90 capstone_first clean_30 clean_7 cofounder_10 collector_5 early_bird first_goal first_habit first_note first_quest first_reward focus_10h full_spectrum gear_full goals_10 gold_500 habit_100 legendary_drop level_10 level_20 level_30 level_5 marathon_day mission_set new_year night_owl path_chosen quests_100 quests_250 quests_50 reporter_3 skill_master skills_all3 skills_all5 sphere_lvl10 streak_100 streak_30 streak_7 tree_full wear_first weekend_warrior xp_1000 xp_25000 xp_5000'.split(' '),
  rewards: 'banya bath boardgames boba book breakfast cake chocolate clothes coffee concert course decor delivery drawing episode event gadget game hobby icecream meditation movie music pizza restaurant sleep small-purchase spa vacation walk weekend-trip wishlist'.split(' '),
  gear: 'a1 a2 a2b a3 a4 m1 m2 m2b m3 m4 w1 w2 w2b w3 w4'.split(' '),
};

const registryPrefix = { achievements: 'achievement', rewards: 'reward', gear: 'gear' };

test('economy icon v2 ships the complete semantic set', () => {
  assert.equal(groups.achievements.length, 48);
  assert.equal(groups.rewards.length, 33);
  assert.equal(groups.gear.length, 15);

  for (const [group, ids] of Object.entries(groups)) {
    const hashes = new Set();
    for (const id of ids) {
      const rel = `public/art/icons/content/${group}/${id}.svg`;
      const source = read(rel);
      assert.match(source, /viewBox="0 0 128 128"/i, rel);
      assert.match(source, new RegExp(`data-icon-family="${group === 'achievements' ? 'achievement' : group === 'rewards' ? 'reward' : 'gear gear-'}`), rel);
      assert.match(source, /data-icon-version="2"/, rel);
      assert.match(source, /<title id="title">[^<]+<\/title>/, rel);
      assert.doesNotMatch(source, /paper-shadow|stroke-dasharray|M64 10l12 8 15-1|M64 9l49 32|M24 24h80l9 12/i, `${rel} must not regress to the old generic plaque`);
      hashes.add(crypto.createHash('sha256').update(source).digest('hex'));

      const iconId = `${registryPrefix[group]}.${id}`;
      assert.match(REGISTRY, new RegExp(`"${iconId.replace('.', '\\.')}"\\s*:\\s*\\{`), iconId);
      assert.match(REGISTRY, new RegExp(`"publicPath": "/art/icons/content/${group}/${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.svg"`), rel);
      assert.match(SW, new RegExp(`(?:^|[ '])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |')`), `${id} is in the offline icon manifest`);
    }
    assert.equal(hashes.size, ids.length, `${group} icons must be visually distinct files`);
  }
  assert.match(SW, /SHELL\.push\(\.\.\.ECONOMY_ICON_SHELL\)/);
});

test('rewards and arsenal use the semantic SVG family instead of generic difficulty or legacy art', () => {
  assert.doesNotMatch(APP, /id: 'w1'[^\n]+inventoryArt/);
  assert.match(APP, /\{ k: 'weapon', label: 'Оружие', iconId: 'gear\.w1' \}/);
  assert.match(APP, /\{ k: 'armor', label: 'Броня', iconId: 'gear\.a2' \}/);
  assert.match(APP, /\{ k: 'amulet', label: 'Амулет', iconId: 'gear\.m1' \}/);
  assert.match(APP, /class="card rewards-disclosure arsenal-disclosure"><summary>\$\{satoruIconHTML\('gear\.w4'/);
  assert.match(APP, /satoruIconHTML\(`achievement\.\$\{a\.id\}`/);
  assert.match(APP, /rewardIconHTML\(r, 'reward-content-icon'\)/);
  assert.match(CSS, /\.achievement-content-icon \{ width: 72px; height: 72px;/);
  assert.match(CSS, /\.reward-content-icon \{ width: 80px; height: 80px;/);
  assert.match(CSS, /\.gear-content-icon \{ width: 82px; height: 82px;/);
  assert.match(CSS, /\.gear-ic \{ min-height: 84px;/);
});

test('economy icons remain pinned inside the v207 PWA shell', () => {
  assert.match(SW, /const CACHE = 'satoru-v207'/);
  assert.match(APP, /const PWA_CACHE_VERSION = 'satoru-v207'/);
  assert.match(INDEX, /styles\.css\?v=20260830-inspiration-persistence-v207-1/);
  assert.match(INDEX, /art\/icons\/icon-registry\.js\?v=20260830-economy-icons-v206-1/);
  assert.match(INDEX, /app\.js\?v=20260830-inspiration-persistence-v207-1/);
});
