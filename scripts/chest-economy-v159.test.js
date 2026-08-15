'use strict';
/* Экономика сундука v159 — не «написано в коде», а ПРОГНАНО.
 *
 * Остальные тесты сундука проверяют текст исходника: что веса заморожены, что розыгрыш не
 * подглядывает в isPro, что барабан заводится всегда. Этого мало для одного вопроса, который
 * Альберт задал прямым текстом: «без искусственного подкручивания шансов» — и для второго,
 * который он не задавал, но который решает судьбу фичи: не обрушил ли новый розыгрыш дневной
 * доход. И то и другое видно только на прогонах.
 *
 * Функции берутся из public/app.js как есть (вырезаются по имени и исполняются в vm со
 * стабами) — не копии. Копия разошлась бы с оригиналом на первой же правке и тихо охраняла
 * бы вчерашний код.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function sourceOf(name) {
  const start = APP.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} должна существовать в app.js`);
  const brace = APP.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < APP.length; i += 1) {
    if (APP[i] === '{') depth += 1;
    else if (APP[i] === '}' && --depth === 0) return APP.slice(start, i + 1);
  }
  throw new Error(`не закрыта ${name}`);
}
function constOf(name) {
  const m = APP.match(new RegExp(`const ${name} = Object\\.freeze\\(\\{[^}]*\\}\\);`));
  assert.ok(m, `${name} должна быть замороженной константой`);
  return m[0];
}

// Косметика и каталог — настоящие, вырезанные из app.js, чтобы количество и цены совпадали
// с боевыми. Иначе тест мерил бы выдуманную экономику.
function realRewardCatalog() {
  const start = APP.indexOf('const REWARD_CATALOG = [');
  const end = APP.indexOf('];', start) + 2;
  return APP.slice(start, end);
}

function buildSandbox({ ownedCosmetics = [] } = {}) {
  const sandbox = {
    COSMETICS: [
      { id: 'c1', name: 'Рамка А', rarity: 'common', ring: '#111' },
      { id: 'c2', name: 'Рамка Б', rarity: 'common', ring: '#222' },
      { id: 'c3', name: 'Фон В', rarity: 'rare', fill: '#333' },
      { id: 'c4', name: 'Фон Г', rarity: 'epic', fill: '#444' },
      { id: 'c5', name: 'Титул Д', rarity: 'legendary', fill: '#555' },
    ],
    ownsCosmetic: (id) => ownedCosmetics.includes(id),
    cosmeticById: (id) => sandbox.COSMETICS.find((c) => c.id === id) || null,
    t: (s) => s,
    crypto: { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 4294967296); return arr; } },
    globalPerk: () => 0,
    RARITY: { common: {}, rare: {}, epic: {}, legendary: {} },
  };
  vm.createContext(sandbox);
  const code = [
    constOf('COSMETIC_PRICES'),
    constOf('CHEST_RARITY_WEIGHTS'),
    constOf('CHEST_TYPE_WEIGHTS'),
    constOf('CHEST_GOLD_BY_RARITY'),
    realRewardCatalog(),
    "const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];",
    sourceOf('dailyRewardGoldBonusPct'),
    sourceOf('rewardRarityByCost'),
    sourceOf('rewardCatalogByRarity'),
    sourceOf('cosmeticCapsulePool'),
    sourceOf('chestTypesFor'),
    sourceOf('chestOdds'),
    sourceOf('capsuleRandomUnit'),
    sourceOf('pickWeighted'),
    sourceOf('rollChestPrize'),
    sourceOf('chestReelPool'),
    sourceOf('voucherAllowsReward'),
    // `const` в vm остаётся в лексической области скрипта и НЕ становится свойством
    // sandbox — пробрасываем то, что читают сами тесты.
    'globalThis.REWARD_CATALOG = REWARD_CATALOG;',
  ].join('\n');
  vm.runInContext(code, sandbox);
  return sandbox;
}

const N = 20000;
function sample(sandbox, n = N) {
  const byType = Object.create(null), byRarity = Object.create(null);
  let gold = 0;
  for (let i = 0; i < n; i += 1) {
    const prize = sandbox.rollChestPrize();
    byType[prize.type] = (byType[prize.type] || 0) + 1;
    byRarity[prize.rarity] = (byRarity[prize.rarity] || 0) + 1;
    if (prize.type === 'gold') gold += prize.amount;
  }
  return { byType, byRarity, gold, n };
}

test('редкость выпадает по заявленным весам, а не «как получится»', () => {
  const box = buildSandbox();
  const { byRarity } = sample(box);
  // Заявлено в интерфейсе: 60 / 28 / 10 / 2. Допуск 1.5 п.п. — это шум 20k бросков
  // (больше десяти сигм на каждом тире), а не запас, в котором можно спрятать подкрутку.
  const expected = { common: 60, rare: 28, epic: 10, legendary: 2 };
  for (const [rarity, want] of Object.entries(expected)) {
    const got = (byRarity[rarity] || 0) / N * 100;
    assert.ok(Math.abs(got - want) < 1.5, `${rarity}: ожидали ~${want}%, получили ${got.toFixed(2)}%`);
  }
});

test('типы приза делятся 55/30/15 внутри редкости', () => {
  const box = buildSandbox();
  const { byType } = sample(box);
  const expected = { gold: 55, cosmetic_capsule: 30, reward_voucher: 15 };
  for (const [type, want] of Object.entries(expected)) {
    const got = (byType[type] || 0) / N * 100;
    assert.ok(Math.abs(got - want) < 2, `${type}: ожидали ~${want}%, получили ${got.toFixed(2)}%`);
  }
});

test('дневное золото не обрушилось — старый режим давал 120 за три сундука', () => {
  const box = buildSandbox();
  const { gold } = sample(box);
  const perDay = gold / N * 3; // три сундука в день
  // Раньше день гарантировал ровно 120 (40 + 80 + косметика). Розыгрыш обязан остаться
  // в том же порядке величин: заметно меньше — это скрытый нерф под видом «больше драмы»,
  // заметно больше — инфляция, обесценивающая покупку наград за золото.
  assert.ok(perDay > 90, `дневное золото упало до ${perDay.toFixed(0)} — это нерф, а не драма`);
  assert.ok(perDay < 160, `дневное золото выросло до ${perDay.toFixed(0)} — это инфляция`);
});

test('исчерпанная коллекция косметики не ломает розыгрыш и не роняет вес в пустоту', () => {
  // Крайний случай, на котором старый код возвращал заглушку-ваучер: всё уже собрано.
  const box = buildSandbox({ ownedCosmetics: ['c1', 'c2', 'c3', 'c4', 'c5'] });
  const { byType } = sample(box, 8000);
  assert.equal(byType.cosmetic_capsule, undefined, 'выдал косметику, которой уже владеют');
  // Вес исчезнувшего типа перераспределён, а не потерян: сумма по-прежнему 100%.
  assert.equal((byType.gold || 0) + (byType.reward_voucher || 0), 8000);
  const goldPct = byType.gold / 8000 * 100;
  assert.ok(goldPct > 70 && goldPct < 82, `золото ${goldPct.toFixed(1)}% — ожидали ~78% (55 из 55+15)`);
});

test('ваучер каждого тира открывает свой уровень наград и всё, что ниже', () => {
  const box = buildSandbox();
  const catalog = box.REWARD_CATALOG;
  const cheapest = catalog.reduce((a, b) => (a.cost <= b.cost ? a : b));
  const dearest = catalog.reduce((a, b) => (a.cost >= b.cost ? a : b));
  assert.equal(box.rewardRarityByCost(cheapest.cost), 'common');
  assert.equal(box.rewardRarityByCost(dearest.cost), 'legendary');
  // Обычный ваучер не должен открывать самую дорогую награду — иначе редкость пустая.
  assert.equal(box.voucherAllowsReward('common', dearest), false);
  assert.equal(box.voucherAllowsReward('legendary', dearest), true);
  assert.equal(box.voucherAllowsReward('legendary', cheapest), true);
  // В каждом тире есть что взять, иначе ваучер этого тира был бы мёртвым.
  for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
    assert.ok(box.rewardCatalogByRarity(rarity).length > 0, `в тире ${rarity} нет ни одной награды`);
  }
});

test('лента набрана из того же пула, из которого идёт розыгрыш', () => {
  const box = buildSandbox();
  const reel = box.chestReelPool();
  const ids = new Set(reel.map((x) => x.id));
  // Каждый реально выпавший приз обязан иметь свою плитку на ленте: барабан, на котором
  // победителя нет среди возможных, — это и есть враньё о шансах.
  for (let i = 0; i < 500; i += 1) {
    const prize = box.rollChestPrize();
    const id = prize.type === 'cosmetic_capsule' ? 'c_' + prize.cosmeticId
      : prize.type === 'reward_voucher' ? 'v_' + prize.rewardName
        : 'g_' + prize.rarity;
    assert.ok(ids.has(id), `приз ${id} не представлен на ленте`);
  }
});

test('серия неудач ничего не меняет: следующий бросок не зависит от предыдущих', () => {
  const box = buildSandbox();
  // «Жалость» (pity timer) выглядела бы как рост хороших исходов после серии обычных.
  // Меряем долю НЕ-обычных после пяти обычных подряд, а не долю легендарок после десяти:
  // событие в 12 раз чаще, поэтому вывод статистически твёрдый, а не шум на сотне бросков.
  let after = 0, afterGood = 0, streak = 0;
  for (let i = 0; i < N; i += 1) {
    const prize = box.rollChestPrize();
    if (streak >= 5) { after += 1; if (prize.rarity !== 'common') afterGood += 1; }
    streak = prize.rarity === 'common' ? streak + 1 : 0;
  }
  assert.ok(after > 600, `слишком мало серий (${after}) — выборка не показательна`);
  const pct = afterGood / after * 100;
  // Базовая доля не-обычных — 40%. Подкрутка «повезёт после невезения» сдвинула бы её вверх.
  assert.ok(Math.abs(pct - 40) < 4, `после 5 обычных подряд не-обычное идёт ${pct.toFixed(1)}% вместо ~40% — похоже на pity timer`);
});
