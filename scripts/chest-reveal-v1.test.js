'use strict';
/* Честная лента открытия сундука (решение Альберта 12.08 «драма во благо»).
 *
 * Тесты делятся на две части. Первая — что лента работает. Вторая, и она здесь
 * главная, — что вернуть вместе с драмой манипуляцию трудно: near-miss,
 * растягивание под редкость и перекруты проверяются отдельно и явно. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = require('../public/chest-reveal-v1.js');
const raw = fs.readFileSync(path.join(path.resolve(__dirname, '..'), 'public/chest-reveal-v1.js'), 'utf8');
// Проверки поверхности смотрят на КОД, а не на прозу: в комментариях модуля
// запрещённые слова стоят намеренно — там объясняется, почему их нет в коде.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
// Пул с реалистичным перекосом: обычных много, легендарных мало.
const POOL = [];
for (let i = 0; i < 30; i++) POOL.push({ id: 'c' + i, rarity: 'common' });
for (let i = 0; i < 14; i++) POOL.push({ id: 'r' + i, rarity: 'rare' });
for (let i = 0; i < 5; i++) POOL.push({ id: 'e' + i, rarity: 'epic' });
for (let i = 0; i < 1; i++) POOL.push({ id: 'l' + i, rarity: 'legendary' });

test('лента останавливается на реально выпавшем предмете', () => {
  const result = POOL.find((x) => x.rarity === 'epic');
  const reel = R.buildReel({ pool: POOL, result, seed: 'open-1' });
  assert.equal(reel.strip[reel.winnerIndex], result, 'на месте победителя должен стоять ТОТ САМЫЙ объект');
  assert.equal(reel.strip[reel.winnerIndex].id, result.id);
});

test('за победителем остаётся хвост — лента останавливается, а не обрывается', () => {
  const reel = R.buildReel({ pool: POOL, result: POOL[0], seed: 's' });
  assert.equal(reel.strip.length - 1 - reel.winnerIndex, R.TAIL_AFTER_WINNER);
  assert.ok(reel.winnerIndex > 0);
});

test('лента набрана только из реального пула — ничего не выдумано', () => {
  const ids = new Set(POOL.map((x) => x.id));
  const reel = R.buildReel({ pool: POOL, result: POOL[3], seed: 'x' });
  for (const item of reel.strip) assert.ok(ids.has(item.id), `в ленте посторонний предмет: ${item.id}`);
});

test('🔴 near-miss: соседи победителя не подкручены к большей редкости', () => {
  // Это главный тест файла. Подделать «почти легендарку» — значит показать
  // проигрыш, которого не было: исход определён до первого кадра.
  const result = POOL.find((x) => x.rarity === 'common');
  let nearSum = 0, nearN = 0, restSum = 0, restN = 0;
  for (let seed = 0; seed < 4000; seed++) {
    const reel = R.buildReel({ pool: POOL, result, seed });
    const w = reel.winnerIndex;
    reel.strip.forEach((item, i) => {
      if (i === w) return;
      const rank = RARITY_RANK[item.rarity];
      if (i === w - 1 || i === w + 1) { nearSum += rank; nearN++; }
      else { restSum += rank; restN++; }
    });
  }
  const near = nearSum / nearN, rest = restSum / restN;
  // Соседи — тот же жребий, что и вся лента. Допуск на статистический шум мал:
  // near-miss дал бы разницу в разы, а не в сотые.
  assert.ok(Math.abs(near - rest) < 0.06, `соседи победителя отличаются от ленты: ${near.toFixed(3)} против ${rest.toFixed(3)}`);
});

test('🔴 параметра для подкрутки соседей не существует', () => {
  // Тест на поверхность: если кто-то заведёт такую ручку, это сломается и
  // заставит перечитать, почему её нет.
  for (const bad of ['neighbourBias', 'neighborBias', 'nearMiss', 'teaseRarity', 'tension']) {
    assert.ok(!src.includes(bad), `появилась ручка подкрутки: «${bad}»`);
  }
  assert.deepEqual(
    Object.keys(R.buildReel({ pool: POOL, result: POOL[0], seed: 1 })).sort(),
    ['durationMs', 'skippable', 'strip', 'winnerIndex'],
  );
});

test('🔴 длительность не зависит от редкости', () => {
  // «Легендарку крутим дольше» — плата вниманием за уже случившийся исход.
  const durations = new Set();
  for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
    const result = POOL.find((x) => x.rarity === rarity);
    durations.add(R.buildReel({ pool: POOL, result, seed: 'd' }).durationMs);
  }
  assert.equal(durations.size, 1, 'длительность различается по редкости');
  // И в исходнике нет ветвления кривой по редкости.
  const ease = src.slice(src.indexOf('function easing('), src.indexOf('return {\n    VERSION'));
  for (const bad of ['rarity', 'legendary', 'epic']) assert.ok(!ease.includes(bad), `кривая зависит от редкости: «${bad}»`);
});

test('🔴 перекрут невозможен: та же лента при повторном рендере', () => {
  const result = POOL[7];
  const a = R.buildReel({ pool: POOL, result, seed: 'open-42' });
  const b = R.buildReel({ pool: POOL, result, seed: 'open-42' });
  assert.deepEqual(a.strip.map((x) => x.id), b.strip.map((x) => x.id));
  // Разные открытия дают разные ленты — иначе церемония выглядела бы записью.
  const c = R.buildReel({ pool: POOL, result, seed: 'open-43' });
  assert.notDeepEqual(a.strip.map((x) => x.id), c.strip.map((x) => x.id));
});

test('церемония ограничена сверху и всегда пропускаема', () => {
  assert.equal(R.buildReel({ pool: POOL, result: POOL[0], seed: 1, durationMs: 99999 }).durationMs, R.MAX_DURATION_MS);
  assert.equal(R.buildReel({ pool: POOL, result: POOL[0], seed: 1, durationMs: 1 }).durationMs, R.MIN_DURATION_MS);
  assert.equal(R.buildReel({ pool: POOL, result: POOL[0], seed: 1 }).skippable, true);
  assert.ok(R.MAX_DURATION_MS <= 2000, 'потолок церемонии не должен расти');
});

test('модуль не вычисляет исход — только показывает', () => {
  // Иначе им можно было бы «доиграть» результат.
  for (const bad of ['Math.random', 'odds', 'weights', 'roll', 'chance']) {
    assert.ok(!src.includes(bad), `модуль решает исход: «${bad}»`);
  }
  assert.equal(R.buildReel({ pool: POOL, result: null, seed: 1 }), null);
  assert.equal(R.buildReel({ pool: POOL, seed: 1 }), null);
});

test('терпимость к мусору на входе', () => {
  const r = POOL[0];
  assert.equal(R.buildReel(null), null);
  assert.equal(R.buildReel({ pool: null, result: r }).strip.length > 0, true, 'пустой пул не должен ронять ленту');
  assert.equal(R.buildReel({ pool: [null, undefined], result: r }).strip.every(Boolean), true);
  const short = R.buildReel({ pool: POOL, result: r, length: 2 });
  assert.ok(short.strip.length >= 8, 'слишком короткая лента подтягивается до минимума');
  assert.ok(short.winnerIndex >= 0 && short.winnerIndex < short.strip.length);
});

test('лента следует за исходом, а не за часами', () => {
  // Без явного seed берётся id выигрыша: два рендера одного открытия совпадут.
  const result = POOL[9];
  assert.deepEqual(
    R.buildReel({ pool: POOL, result }).strip.map((x) => x.id),
    R.buildReel({ pool: POOL, result }).strip.map((x) => x.id),
  );
  assert.ok(!src.includes('Date.now'), 'лента не должна зависеть от времени');
});
