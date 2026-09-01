'use strict';

/* Rest Profile: отдых как навык с дешёвым входом, а не как меню.
 *
 * Проверяется главное продуктовое утверждение разбора 01.09: при нулевом ресурсе
 * выигрывает не любимый рецепт, а самый дешёвый на вход. Если модуль начнёт
 * сортировать по популярности, он вернёт человека ровно в тот круг, из которого
 * его вытаскивают: игра популярна именно потому, что дешева.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const R = require('../public/rest-profile-v1.js');

const recipe = (over) => Object.assign({
  id: 'r1', title: 'Прогулка', mode: 'offline', defaultMinutes: 30,
  setup: '', steps: ['выйти'], worked: 0, tried: 0,
}, over || {});
const profileOf = (...rs) => ({ version: 1, recipes: rs });

test('рецепт без id или названия не сохраняется', () => {
  assert.strictEqual(R.sanitizeRecipe(null), null);
  assert.strictEqual(R.sanitizeRecipe({ id: 'x' }), null);
  assert.strictEqual(R.sanitizeRecipe({ title: 'Прогулка' }), null);
  assert.ok(R.sanitizeRecipe(recipe()));
});

test('🔴 подготовка заранее — главный вклад в дешевизну входа', () => {
  // Это единственная причина существования модуля: ресурсный человек делает
  // подготовку за истощённого, и вход перестаёт быть дороже игры.
  const bare = R.entryEase(recipe({ setup: '' }));
  const prepared = R.entryEase(recipe({ setup: 'кроссовки у двери, маршрут выбран' }));
  assert.ok(prepared > bare, 'подготовленный рецепт дешевле');
  assert.ok(prepared - bare >= 0.35, 'вклад подготовки весомый, а не косметический');
});

test('короткое окно и один шаг тоже удешевляют вход', () => {
  const long = R.entryEase(recipe({ defaultMinutes: 90, steps: ['a', 'b', 'c'] }));
  const short = R.entryEase(recipe({ defaultMinutes: 15, steps: ['a'] }));
  assert.ok(short > long);
  assert.ok(R.entryEase(recipe()) <= 1 && R.entryEase(recipe()) >= 0);
  assert.strictEqual(R.entryEase(null), 0);
});

test('🔴 при истощении выигрывает дешёвый вход, а не популярный рецепт', () => {
  // Сортировка по «сколько раз сработало» вернула бы человека к игре.
  const popular = recipe({ id: 'game', title: 'Игра', mode: 'device', defaultMinutes: 60, setup: '', steps: ['включить', 'выбрать', 'начать'], worked: 40, tried: 40 });
  const prepared = recipe({ id: 'walk', title: 'Прогулка', mode: 'offline', defaultMinutes: 15, setup: 'кроссовки у двери', steps: ['выйти'], worked: 1, tried: 3 });
  const pick = R.pickForLowResource(profileOf(popular, prepared));
  assert.strictEqual(pick.id, 'walk', 'подготовленный побеждает популярный');
});

test('🔴 отдаётся ОДИН рецепт, а не список', () => {
  const pick = R.pickForLowResource(profileOf(recipe({ id: 'a' }), recipe({ id: 'b' }), recipe({ id: 'c' })));
  assert.ok(pick && !Array.isArray(pick), 'стоимость выбора — часть проблемы, а не решения');
  assert.strictEqual(typeof pick.id, 'string');
});

test('выдача детерминирована — совет не меняется между рендерами', () => {
  const p = profileOf(recipe({ id: 'b' }), recipe({ id: 'a' }));
  assert.strictEqual(R.pickForLowResource(p).id, R.pickForLowResource(p).id);
});

test('уже занятое не предлагается снова, экран можно исключить', () => {
  const p = profileOf(
    recipe({ id: 'game', mode: 'device', setup: 'запущено', defaultMinutes: 15 }),
    recipe({ id: 'walk', mode: 'offline', setup: 'кроссовки', defaultMinutes: 15 }),
  );
  assert.strictEqual(R.pickForLowResource(p, { avoidId: 'game' }).id, 'walk');
  assert.strictEqual(R.pickForLowResource(p, { preferOffline: true }).id, 'walk');
});

test('🔴 цифровой отдых не объявляется плохим', () => {
  // Значение имеет конечность и то, что было после, а не носитель.
  assert.ok(R.MODES.includes('device'));
  const onlyDevice = profileOf(recipe({ id: 'film', mode: 'device', setup: 'серия выбрана', defaultMinutes: 45 }));
  assert.strictEqual(R.pickForLowResource(onlyDevice).id, 'film', 'единственный экранный рецепт всё равно предлагается');
  assert.strictEqual(R.pickForLowResource(onlyDevice, { preferOffline: true }).id, 'film', 'предпочтение — не запрет');
});

test('🔴 пустой профиль не выдумывает отдых', () => {
  assert.strictEqual(R.pickForLowResource(R.emptyProfile()), null);
  assert.strictEqual(R.pickForLowResource(null), null);
});

test('рецепты с дорогим входом видны отдельно', () => {
  const p = profileOf(recipe({ id: 'a', setup: 'готово' }), recipe({ id: 'b', setup: '' }));
  assert.deepStrictEqual(R.needSetup(p).map((r) => r.id), ['b']);
});

test('список ограничен — иначе это снова каталог', () => {
  let p = R.emptyProfile();
  for (let i = 0; i < R.MAX_RECIPES; i += 1) p = R.add(p, recipe({ id: 'r' + i }));
  assert.strictEqual(R.live(p).length, R.MAX_RECIPES);
  assert.strictEqual(R.add(p, recipe({ id: 'over' })), null, 'сверх лимита не добавляется');
  assert.strictEqual(R.add(p, recipe({ id: 'r0' })), null, 'дубль id не добавляется');
});

test('🔴 четыре исхода независимы: «закончил вовремя» ≠ «восстановился»', () => {
  const o = R.sanitizeOutcome({ recipeId: 'r1', ended: 'at_boundary', pleasant: 'yes', effect: 'worse', regret: 'some' });
  assert.strictEqual(o.ended, 'at_boundary');
  assert.strictEqual(o.effect, 'worse', 'вовремя закончил и всё равно стало хуже — законная комбинация');
  assert.strictEqual(o.regret, 'some');
  assert.deepStrictEqual([...R.OUTCOME_FIELDS].sort(), ['effect', 'ended', 'pleasant', 'regret']);
});

test('неизвестный ответ остаётся unknown, а не худшим вариантом', () => {
  const o = R.sanitizeOutcome({ recipeId: 'r1' });
  assert.strictEqual(o.ended, 'unknown');
  assert.strictEqual(o.effect, 'unknown');
  assert.strictEqual(R.sanitizeOutcome({ recipeId: 'r1', effect: 'придумал' }).effect, 'unknown');
});

test('🔴 сводка показывает знаменатель и исключает unknown', () => {
  const outs = [
    { recipeId: 'r1', ended: 'at_boundary', effect: 'better' },
    { recipeId: 'r1', ended: 'overran', effect: 'unknown' },
    { recipeId: 'r1', ended: 'unknown', effect: 'worse' },
    { recipeId: 'other', ended: 'at_boundary', effect: 'better' },
  ];
  const s = R.summarize(outs, 'r1');
  assert.strictEqual(s.recorded, 3, 'чужой рецепт не считается');
  assert.strictEqual(s.endedAtBoundary, 1);
  assert.strictEqual(s.endedKnown, 2, 'unknown вне знаменателя');
  assert.strictEqual(s.effectBetter, 1);
  assert.strictEqual(s.effectKnown, 2);
});

test('🔴 повреждённый профиль не читается как пустой', () => {
  assert.strictEqual(R.sanitizeProfile(null), null);
  assert.strictEqual(R.sanitizeProfile({ version: 2, recipes: [] }), null);
  assert.strictEqual(R.sanitizeProfile({ version: 1, recipes: [{ id: 'x' }] }), null);
  assert.strictEqual(R.sanitizeProfile(profileOf(recipe({ id: 'a' }), recipe({ id: 'a' }))), null, 'дубль id — файл не доверенный');
  assert.ok(R.sanitizeProfile(R.emptyProfile()));
});

test('🔴 модуль ничего не начисляет и не отнимает', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/rest-profile-v1.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  // По границам слова, а не подстрокой: «xp» живёт внутри exposeRestProfile,
  // и наивная проверка ловила имя функции вместо экономики.
  for (const bad of ['xp', 'gold', 'streak', 'penalty', 'reward', 'earn', 'earned']) {
    const re = new RegExp('\\b' + bad + '\\b', 'i');
    assert.strictEqual(re.test(code), false, `экономика в отдыхе: «${bad}»`);
  }
  for (const bad of ['State.', 'document.', 'fetch(', 'window.', 'Date.now()']) {
    assert.strictEqual(src.includes(bad), false, `модуль вышел за свою роль: «${bad}»`);
  }
});
