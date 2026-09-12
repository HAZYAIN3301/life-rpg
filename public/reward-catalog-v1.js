/* The existing personal reward catalogue, shared by presentation and chest grants.
 * Names, order, prices, emoji and icon IDs are the v259 catalogue without changes. */
(function(root, factory) {
  const api = typeof module === 'object' && module.exports
    ? factory(require('./shop-catalog-v1')) : factory(root.ShopCatalogV1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RewardCatalogV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Shop) {
  'use strict';
  const REWARD_CATALOG = [
    { icon: '☕', name: 'Кофе в любимой кофейне', cost: 60, iconId: 'reward.coffee' },
    { icon: '🍫', name: 'Шоколадка / сладость', cost: 50, iconId: 'reward.chocolate' },
    { icon: '🍦', name: 'Мороженое', cost: 45, iconId: 'reward.icecream' },
    { icon: '🍕', name: 'Пицца / любимая еда', cost: 250, iconId: 'reward.pizza' },
    { icon: '🍣', name: 'Заказать доставку', cost: 350, iconId: 'reward.delivery' },
    { icon: '🧋', name: 'Пузырьковый чай / смузи', cost: 80, iconId: 'reward.boba' },
    { icon: '🍰', name: 'Кусок торта в кафе', cost: 110, iconId: 'reward.cake' },
    { icon: '🥐', name: 'Завтрак в любимом месте', cost: 120, iconId: 'reward.breakfast' },
    { icon: '🎮', name: '1 час игр без вины', cost: 120, iconId: 'reward.game' },
    { icon: '📺', name: 'Серия сериала', cost: 80, iconId: 'reward.episode' },
    { icon: '🎬', name: 'Вечер кино с попкорном', cost: 200, iconId: 'reward.movie' },
    { icon: '🎲', name: 'Настолки с друзьями', cost: 180, iconId: 'reward.boardgames' },
    { icon: '🎯', name: 'Любимое хобби 2 часа без отвлечений', cost: 160, iconId: 'reward.hobby' },
    { icon: '🎨', name: 'Порисовать / порукоделить без цели', cost: 100, iconId: 'reward.drawing' },
    { icon: '🛁', name: 'Долгая ванна со свечами и пеной', cost: 100, iconId: 'reward.bath' },
    { icon: '😴', name: 'Поспать без будильника', cost: 150, iconId: 'reward.sleep' },
    { icon: '🎧', name: 'Час музыки/подкаста лёжа', cost: 90, iconId: 'reward.music' },
    { icon: '💆', name: 'Массаж / спа', cost: 600, iconId: 'reward.spa' },
    { icon: '🌳', name: 'Прогулка без телефона', cost: 40, iconId: 'reward.walk' },
    { icon: '🧘', name: 'Долгая медитация / баня', cost: 130, iconId: 'reward.meditation' },
    { icon: '🛀', name: 'Банный день с нуля', cost: 200, iconId: 'reward.banya' },
    { icon: '📚', name: 'Новая книга', cost: 300, iconId: 'reward.book' },
    { icon: '🛍', name: 'Маленькая покупка до 10€/1000₽', cost: 400, iconId: 'reward.small-purchase' },
    { icon: '👟', name: 'Одежда / кроссовки мечты', cost: 1200, iconId: 'reward.clothes' },
    { icon: '🎧', name: 'Новые наушники / гаджет', cost: 1500, iconId: 'reward.gadget' },
    { icon: '🖼', name: 'Постер / декор для комнаты', cost: 500, iconId: 'reward.decor' },
    { icon: '✈️', name: 'Поездка на выходные', cost: 2000, iconId: 'reward.weekend-trip' },
    { icon: '🎡', name: 'Экскурсия / необычное событие', cost: 800, iconId: 'reward.event' },
    { icon: '🎵', name: 'Концерт / фестиваль', cost: 700, iconId: 'reward.concert' },
    { icon: '🍽', name: 'Ужин в ресторане', cost: 450, iconId: 'reward.restaurant' },
    { icon: '💻', name: 'Курс / обучение', cost: 1000, iconId: 'reward.course' },
    { icon: '🎁', name: 'Большая хотелка (копилка)', cost: 5000, iconId: 'reward.wishlist' },
    { icon: '🏖', name: 'Отпуск мечты', cost: 8000, iconId: 'reward.vacation' },
  ];
  REWARD_CATALOG.forEach(Object.freeze);
  Object.freeze(REWARD_CATALOG);
  const RARITY_ORDER = Object.freeze(['common', 'rare', 'epic', 'legendary']);
  function rewardRarityByCost(cost) {
    const gold = Number(cost) || 0;
    if (gold >= Shop.COSMETIC_PRICES.legendary) return 'legendary';
    if (gold >= Shop.COSMETIC_PRICES.epic) return 'epic';
    if (gold >= Shop.COSMETIC_PRICES.rare) return 'rare';
    return 'common';
  }
  function byRarity(rarity) { return REWARD_CATALOG.filter(item => rewardRarityByCost(item.cost) === rarity); }
  return Object.freeze({ REWARD_CATALOG, RARITY_ORDER, rewardRarityByCost, byRarity });
});
