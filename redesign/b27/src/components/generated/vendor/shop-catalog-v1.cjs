/* One catalogue for browser presentation and server price checks. Existing prices/art unchanged. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShopCatalogV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
const FRAMES = [
  { id: 'fr_bronze',   name: 'Бронза',    rarity: 'common',    ring: '#a9744a' },
  { id: 'fr_leaf',     name: 'Листва',    rarity: 'common',    ring: '#5fbf7a' },
  { id: 'fr_silver',   name: 'Серебро',   rarity: 'rare',      ring: '#c7cee6' },
  { id: 'fr_azure',    name: 'Лазурь',    rarity: 'rare',      ring: '#4f9ff7' },
  { id: 'fr_gold',     name: 'Золото',    rarity: 'epic',      ring: '#e0a23e' },
  { id: 'fr_amethyst', name: 'Аметист',   rarity: 'epic',      ring: '#b06ff0' },
  { id: 'fr_flame',    name: 'Пламя',     rarity: 'epic',      ring: '#e0526a' },
  { id: 'fr_eclipse',  name: 'Затмение',  rarity: 'legendary', ring: '#7c6cff', glow: true },
  { id: 'fr_phoenix',  name: 'Феникс',    rarity: 'legendary', ring: '#ff8a3d', glow: true },
];
const BACKGROUNDS = [
  { id: 'bg_slate',  name: 'Сланец',     rarity: 'common',    fill: '#2a3150' },
  { id: 'bg_moss',   name: 'Мох',        rarity: 'common',    fill: '#23402f' },
  { id: 'bg_ocean',  name: 'Океан',      rarity: 'rare',      fill: '#163a4a' },
  { id: 'bg_wine',   name: 'Вино',       rarity: 'rare',      fill: '#3a1630' },
  { id: 'bg_nebula', name: 'Туманность', rarity: 'epic',      fill: '#2c1a4a' },
  { id: 'bg_ember',  name: 'Тлен',       rarity: 'epic',      fill: '#4a2018' },
  { id: 'bg_aurora', name: 'Аврора',     rarity: 'legendary', fill: '#0f3a3a' },
  { id: 'bg_void',   name: 'Бездна',     rarity: 'legendary', fill: '#160f2e' },
];
const GEAR = [
  { id: 'w1', slot: 'weapon', name: 'Тренировочный клинок', icon: '🗡', rarity: 'common', xpPct: 3, cost: 120, lvl: 1 },
  { id: 'w2', slot: 'weapon', name: 'Клинок Фокуса', icon: '⚔️', rarity: 'rare', xpPct: 6, cost: 450, lvl: 5 },
  { id: 'w3', slot: 'weapon', name: 'Катана Бесконечности', icon: '🗡️', rarity: 'epic', xpPct: 11, cost: 1400, lvl: 12 },
  { id: 'a1', slot: 'armor', name: 'Лёгкая броня', icon: '🦺', rarity: 'common', hardXpPct: 5, cost: 120, lvl: 2 },
  { id: 'a2', slot: 'armor', name: 'Эгида Стойкости', icon: '🛡', rarity: 'rare', hardXpPct: 10, cost: 450, lvl: 6 },
  { id: 'a3', slot: 'armor', name: 'Латы Несокрушимости', icon: '🛡️', rarity: 'epic', hardXpPct: 18, cost: 1400, lvl: 14 },
  { id: 'm1', slot: 'amulet', name: 'Медный амулет', icon: '🔸', rarity: 'common', goldPct: 6, cost: 100, lvl: 1 },
  { id: 'm2', slot: 'amulet', name: 'Амулет Знаний', icon: '📿', rarity: 'rare', goldPct: 12, cost: 380, lvl: 5 },
  { id: 'm3', slot: 'amulet', name: 'Реликвия Шести Глаз', icon: '🔮', rarity: 'epic', goldPct: 20, cost: 1100, lvl: 13 },
  // расширение арсенала: альтернативные билды (голд-оружие, XP-броня) + легендарки позднего этапа
  { id: 'w2b', slot: 'weapon', name: 'Кинжал Наживы', icon: '🔪', rarity: 'rare', goldPct: 10, cost: 420, lvl: 4 },
  { id: 'a2b', slot: 'armor', name: 'Мантия Потока', icon: '🥋', rarity: 'rare', xpPct: 5, cost: 420, lvl: 4 },
  { id: 'm2b', slot: 'amulet', name: 'Кулон Испытаний', icon: '🧿', rarity: 'rare', hardXpPct: 8, cost: 400, lvl: 6 },
  { id: 'w4', slot: 'weapon', name: 'Клинок Рассветной Клятвы', icon: '⚡', rarity: 'legendary', xpPct: 15, goldPct: 6, cost: 3200, lvl: 18 },
  { id: 'a4', slot: 'armor', name: 'Доспех Несгибаемого', icon: '🐉', rarity: 'legendary', hardXpPct: 24, xpPct: 5, cost: 3200, lvl: 19 },
  { id: 'm4', slot: 'amulet', name: 'Сердце Десятиборца', icon: '💠', rarity: 'legendary', goldPct: 24, xpPct: 6, cost: 3000, lvl: 20 },
];
const DEN_THEMES = [
  { id: 'workshop', name: 'Тихая мастерская', tag: 'тёплый старт', access: 'starter', level: 0, cost: 0,
    wall: '#29283b', wall2: '#343047', floor: '#3b3549', trim: '#b47a52', glow: '#ffd28a', sky: '#8bb9d5' },
  { id: 'moon-tower', name: 'Лунная башня', tag: 'ночная обсерватория', access: 'level', level: 5, cost: 420,
    wall: '#20243b', wall2: '#30395c', floor: '#29334e', trim: '#8795c7', glow: '#d8dcff', sky: '#19254c' },
  { id: 'voxel-hearth', name: 'Кубический очаг', tag: 'бумажный voxel-home', access: 'pro', level: 0, cost: 0,
    wall: '#2e3b36', wall2: '#435342', floor: '#574336', trim: '#8caf72', glow: '#ffca6b', sky: '#76acd0' },
  { id: 'spirit-house', name: 'Дом духов', tag: 'тихий аниме-санктуарий', access: 'pro', level: 0, cost: 0,
    wall: '#342739', wall2: '#4a3446', floor: '#46353d', trim: '#c0766e', glow: '#ffd5a3', sky: '#a17fa0' },
];
const DEN_ITEMS = [
  { id: 'wall-map', slot: 'wall', name: 'Карта странника', access: 'starter', level: 0, cost: 0, motion: 'drift' },
  { id: 'wall-moon', slot: 'wall', name: 'Лунный рыбак', access: 'level', level: 4, cost: 180, motion: 'glint' },
  { id: 'wall-eyes', slot: 'wall', name: 'Шестиглазая печать', access: 'pro', level: 0, cost: 0, motion: 'watch' },
  { id: 'seat-cushion', slot: 'seat', name: 'Подушка привала', access: 'starter', level: 0, cost: 0, motion: 'breathe' },
  { id: 'seat-forest', slot: 'seat', name: 'Лесное кресло', access: 'level', level: 5, cost: 260, motion: 'breathe' },
  { id: 'seat-cloud', slot: 'seat', name: 'Облачное кресло', access: 'pro', level: 0, cost: 0, motion: 'float' },
  { id: 'surface-crate', slot: 'surface', name: 'Складной стол', access: 'starter', level: 0, cost: 0, motion: 'still' },
  { id: 'surface-alchemy', slot: 'surface', name: 'Алхимический стол', access: 'level', level: 6, cost: 340, motion: 'bubble' },
  { id: 'surface-ramen', slot: 'surface', name: 'Рамэн-стол', access: 'pro', level: 0, cost: 0, motion: 'steam' },
  { id: 'comfort-bonsai', slot: 'comfort', name: 'Бонсай пути', access: 'starter', level: 0, cost: 0, motion: 'leaf' },
  { id: 'comfort-cat-tower', slot: 'comfort', name: 'Башня манэки', access: 'level', level: 3, cost: 160, motion: 'breathe' },
  { id: 'comfort-voxel', slot: 'comfort', name: 'Кубический очаг', access: 'pro', level: 0, cost: 0, motion: 'fire' },
  { id: 'light-lantern', slot: 'light', name: 'Фонарь странника', access: 'starter', level: 0, cost: 0, motion: 'lantern' },
  { id: 'light-six', slot: 'light', name: 'Лампа шести огней', access: 'level', level: 7, cost: 480, motion: 'glint' },
  { id: 'light-soot', slot: 'light', name: 'Духи-копотушки', access: 'pro', level: 0, cost: 0, motion: 'soot' },
  { id: 'keepsake-blades', slot: 'keepsake', name: 'Стойка клинков', access: 'starter', level: 0, cost: 0, motion: 'glint' },
  { id: 'keepsake-cape', slot: 'keepsake', name: 'Плащ надежды', access: 'level', level: 5, cost: 300, motion: 'cape' },
  { id: 'keepsake-campfire', slot: 'keepsake', name: 'Костёр племени', access: 'pro', level: 0, cost: 0, motion: 'fire' },
  { id: 'floor-traveller', slot: 'floor', name: 'Ковёр путника', access: 'starter', level: 0, cost: 0, motion: 'still' },
  { id: 'floor-yin', slot: 'floor', name: 'Ковёр равновесия', access: 'level', level: 4, cost: 220, motion: 'drift' },
  { id: 'floor-pixel', slot: 'floor', name: 'Кубическая поляна', access: 'pro', level: 0, cost: 0, motion: 'glint' },
];
  const COSMETIC_PRICES = Object.freeze({ common: 200, rare: 450, epic: 900, legendary: 1800 });
  const COSMETICS = FRAMES.concat(BACKGROUNDS);
  for (const rows of [FRAMES, BACKGROUNDS, GEAR, DEN_THEMES, DEN_ITEMS, COSMETICS]) {
    rows.forEach(Object.freeze); Object.freeze(rows);
  }
  function item(kind, id, rewards = []) {
    const rows = kind === 'gear' ? GEAR : kind === 'cosmetic' ? COSMETICS
      : kind === 'den' ? DEN_THEMES.concat(DEN_ITEMS) : kind === 'reward' ? rewards : [];
    const value = rows.find(row => row.id === id);
    return value ? { ...value, cost: kind === 'cosmetic' ? COSMETIC_PRICES[value.rarity] : value.cost } : null;
  }
  return Object.freeze({ FRAMES, BACKGROUNDS, GEAR, DEN_THEMES, DEN_ITEMS, COSMETIC_PRICES, item });
});
