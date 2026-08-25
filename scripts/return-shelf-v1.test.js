'use strict';
/* Полка возвращения (DISCIPLINE-ESCAPE-PLAN §13).
 *
 * Главный риск фичи — что она сама станет тем, от чего спасает. Приложение против
 * доомскролла, отрастившее собственную бесконечную ленту, — провал дороже, чем
 * отсутствие фичи. Поэтому 🔴-тесты здесь сторожат не работу, а ОТСУТСТВИЕ ленты:
 * конечность пачки, детерминированный порядок, невозможность заработать на просмотре.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/return-shelf-v1.js');

const TODAY = '2026-08-25';
const energy = (over = {}) => Object.assign({
  id: 'e1', kind: 'energy', title: 'Эдит про горы', why: 'поднимает перед тренировкой',
  addedOn: '2026-08-20',
}, over);
const practical = (over = {}) => Object.assign({
  id: 'p1', kind: 'practical', title: 'Гайд по монтажу', why: 'переходы для роликов',
  expect: 'научиться склейке под бит', addedOn: '2026-08-20',
}, over);

function shelf(drafts) {
  let st = S.emptyState();
  for (const d of drafts) {
    const r = S.add(st, d);
    assert.equal(r.ok, true, `не добавился: ${JSON.stringify(d).slice(0, 80)}`);
    st = r.state;
  }
  return st;
}

test('нормализация переживает мусор вместо состояния', () => {
  for (const junk of [null, undefined, 5, 'нет', [], { items: 'x' }]) {
    assert.deepEqual(S.normalize(junk).items, []);
  }
});

test('🔴 материал без «что я отсюда беру» не сохраняется', () => {
  // Иначе Полка превращается в свалку вкладок «когда-нибудь посмотрю».
  assert.equal(S.add(S.emptyState(), energy({ why: '' })).ok, false);
  const noWhy = energy(); delete noWhy.why;
  assert.equal(S.add(S.emptyState(), noWhy).ok, false);
});

test('🔴 практический материал обязан нести ожидаемый вывод', () => {
  // §13: без этого «саморазвитие» без практики — потребление под уважительным предлогом.
  const noExpect = practical(); delete noExpect.expect;
  assert.equal(S.add(S.emptyState(), noExpect).ok, false);
  assert.equal(S.add(S.emptyState(), practical()).ok, true);
  // Энергетическому вывод не нужен: его работа — сменить состояние за минуту.
  assert.equal(S.add(S.emptyState(), energy()).ok, true);
});

test('🔴 пачка конечна: default 3, максимум 5', () => {
  const many = shelf(Array.from({ length: 12 }, (_, i) => energy({ id: 'e' + i })));
  assert.equal(S.batch(many, TODAY).length, 3, 'по умолчанию ровно три');
  assert.equal(S.batch(many, TODAY, { size: 5 }).length, 5);
  assert.equal(S.batch(many, TODAY, { size: 99 }).length, S.BATCH_MAX, 'потолок нельзя перепрыгнуть');
  // Ноль — бессмысленный ввод. Важно не конкретное число, а что он НЕ означает
  // «выдать всё»: именно это превратило бы Полку в ленту.
  const zero = S.batch(many, TODAY, { size: 0 }).length;
  assert.ok(zero >= 1 && zero <= S.BATCH_MAX, `ноль дал ${zero} — вне разумных границ`);
});

test('🔴 порядок детерминирован — никакой случайной выдачи «ещё одного»', () => {
  // Случайность здесь — механика игрового автомата. Человек должен предсказывать,
  // что увидит, иначе Полка начинает работать как лента.
  const st = shelf(Array.from({ length: 8 }, (_, i) => energy({ id: 'e' + i })));
  const first = S.batch(st, TODAY).map((i) => i.id);
  for (let n = 0; n < 5; n += 1) {
    assert.deepEqual(S.batch(st, TODAY).map((i) => i.id), first, 'та же полка обязана дать ту же пачку');
  }
});

test('невиденное показывается раньше виденного', () => {
  let st = shelf([energy({ id: 'a' }), energy({ id: 'b' }), energy({ id: 'c' })]);
  st = S.complete(st, 'a', 'quest', undefined, TODAY).state;
  const ids = S.batch(st, TODAY).map((i) => i.id);
  assert.equal(ids[ids.length - 1], 'a', 'уже виденное уходит в конец');
});

test('🔴 в API нет ничего, что начисляет за просмотр', () => {
  // Иначе смотреть вдохновение станет выгоднее, чем делать дело.
  // Проверяем по СЛОВАМ, а не по подстроке: 'expired' содержит 'xp', и наивный
  // поиск объявил бы честное имя нарушением. Первая версия теста на этом упала.
  const words = Object.keys(S)
    .flatMap((k) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/));
  for (const bad of ['xp', 'gold', 'золото', 'reward', 'award', 'points', 'streak']) {
    assert.equal(words.includes(bad), false, `в API Полки появилось «${bad}»`);
  }
  // И ни один материал не обзавёлся полем начисления при сохранении.
  const st = shelf([energy({ xp: 10, gold: 5, likes: 100, views: 9000 })]);
  const item = S.normalize(st).items[0];
  for (const leak of ['xp', 'gold', 'likes', 'views']) {
    assert.equal(leak in item, false, `в материал просочилось «${leak}»`);
  }
});

test('🔴 нет рекомендаций и ранжирования по популярности', () => {
  const words = Object.keys(S)
    .flatMap((k) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/));
  for (const bad of ['recommend', 'suggest', 'similar', 'trending', 'popular', 'foryou', 'rank', 'shuffle', 'random']) {
    assert.equal(words.includes(bad), false, `в API Полки появилось «${bad}» — это уже лента`);
  }
});

test('материал завершается действием, иначе не завершается вовсе', () => {
  // §13: просмотренное архивируется или получает следующее действие.
  const st = shelf([energy()]);
  assert.equal(S.complete(st, 'e1', 'ничего', undefined, TODAY).error, 'action_required');
  assert.equal(S.complete(st, 'нет', 'quest', undefined, TODAY).error, 'not_found');
  for (const a of S.NEXT_ACTIONS) {
    assert.equal(S.complete(shelf([energy()]), 'e1', a, undefined, TODAY).ok, true, `действие ${a} должно приниматься`);
  }
});

test('🔴 «отложить» ничего не стоит и не считается провалом', () => {
  // То же право, что возврат заказа на доске: отложить без последствий.
  const st = shelf([energy()]);
  const r = S.complete(st, 'e1', 'postpone', undefined, TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.item.archivedOn, undefined, 'отложенное остаётся на Полке');
  assert.equal(S.liveItems(r.state, TODAY).length, 1);
  // В метрике он честно попадает в знаменатель и не попадает в числитель — и всё.
  const rate = S.actionRate(r.state);
  assert.equal(rate.seen, 1);
  assert.equal(rate.moved, 0);
});

test('практический одноразовый, энергетический живёт дальше', () => {
  // Гайд, который «посмотрю ещё раз», обычно не смотрят, а держат как незакрытый долг.
  const p = S.complete(shelf([practical()]), 'p1', 'quest', undefined, TODAY);
  assert.equal(p.item.archivedOn, TODAY, 'практический уходит в архив после действия');
  assert.equal(S.liveItems(p.state, TODAY).length, 0);

  const e = S.complete(shelf([energy()]), 'e1', 'focus', undefined, TODAY);
  assert.equal(e.item.archivedOn, undefined, 'эдит на то и эдит, чтобы работать много раз');
  assert.equal(S.liveItems(e.state, TODAY).length, 1);

  // Отложенный практический не архивируется: решение ещё не принято.
  const post = S.complete(shelf([practical()]), 'p1', 'postpone', undefined, TODAY);
  assert.equal(post.item.archivedOn, undefined);
});

test('метрика — переход к делу, и знаменатель виден', () => {
  let st = shelf([energy({ id: 'a' }), energy({ id: 'b' }), energy({ id: 'c' })]);
  assert.equal(S.actionRate(st).ratio, null, 'без просмотров доли нет, а не ноль');
  st = S.complete(st, 'a', 'quest', undefined, TODAY).state;
  st = S.complete(st, 'b', 'focus', undefined, TODAY).state;
  st = S.complete(st, 'c', 'postpone', undefined, TODAY).state;
  const r = S.actionRate(st);
  assert.equal(r.seen, 3);
  assert.equal(r.moved, 2);
  assert.ok(Math.abs(r.ratio - 2 / 3) < 1e-9);
});

test('срок жизни убирает материал из выдачи, но не из истории', () => {
  const st = shelf([energy({ id: 'old', expiresOn: '2026-08-24' }), energy({ id: 'fresh', expiresOn: '2026-09-30' })]);
  assert.deepEqual(S.batch(st, TODAY).map((i) => i.id), ['fresh']);
  assert.deepEqual(S.expired(st, TODAY).map((i) => i.id), ['old']);
  assert.equal(S.normalize(st).items.length, 2, 'истёкшее остаётся в состоянии до явной уборки');
});

test('архивация убирает с Полки и переживает нормализацию', () => {
  let st = shelf([energy()]);
  st = S.archive(st, 'e1', TODAY);
  assert.equal(S.liveItems(st, TODAY).length, 0);
  assert.equal(S.normalize(st).items[0].archivedOn, TODAY);
});

test('🔴 небезопасная ссылка не сохраняется', () => {
  // Поле уходит в разметку — javascript:/data: здесь это XSS, а не гибкость.
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd', 'ftp://x', 'не ссылка']) {
    const st = shelf([energy({ id: 'u', url: bad })]);
    assert.equal(S.normalize(st).items[0].url, undefined, `небезопасная ссылка сохранилась: ${bad}`);
  }
  const okSt = shelf([energy({ id: 'ok', url: 'https://youtube.com/watch?v=x' })]);
  assert.equal(S.normalize(okSt).items[0].url, 'https://youtube.com/watch?v=x');
});

test('Полка не склад: есть потолок', () => {
  const full = shelf(Array.from({ length: S.MAX_ITEMS }, (_, i) => energy({ id: 'x' + i })));
  assert.equal(S.add(full, energy({ id: 'ещё' })).error, 'full');
  // Архивация освобождает место — это и есть уборка.
  const freed = S.archive(full, 'x0', TODAY);
  assert.equal(S.add(freed, energy({ id: 'ещё' })).ok, true);
});

test('замкнутый контур: остаток мест под сессию поиска референсов', () => {
  // §13: «найти N референсов» кладёт материалы прямо сюда и закрывается по достижении N.
  const st = shelf(Array.from({ length: S.MAX_ITEMS - 2 }, (_, i) => energy({ id: 'x' + i })));
  assert.equal(S.captureRoom(st, 3, TODAY), 2, 'нельзя обещать больше мест, чем есть');
  assert.equal(S.captureRoom(S.emptyState(), 3, TODAY), 3);
  assert.equal(S.captureRoom(st, 0, TODAY), 0);
  assert.equal(S.captureRoom(st, 'нет', TODAY), 0);
});

test('фильтр по типу: перед делом нужен эдит, а не лекция', () => {
  const st = shelf([energy({ id: 'e' }), practical({ id: 'p' })]);
  assert.deepEqual(S.batch(st, TODAY, { kind: 'energy' }).map((i) => i.id), ['e']);
  assert.deepEqual(S.batch(st, TODAY, { kind: 'practical' }).map((i) => i.id), ['p']);
  assert.equal(S.batch(st, TODAY, { kind: 'нет такого' }).length, 2, 'негодный фильтр не режет выдачу');
});

test('операции иммутабельны', () => {
  const st = shelf([energy(), practical()]);
  const before = JSON.stringify(st);
  S.add(st, energy({ id: 'new' }));
  S.archive(st, 'e1', TODAY);
  S.complete(st, 'e1', 'quest', undefined, TODAY);
  S.remove(st, 'e1');
  assert.equal(JSON.stringify(st), before, 'модуль мутировал переданное состояние');
});

test('чистый модуль: ни DOM, ни State, ни сети', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public/return-shelf-v1.js'), 'utf8');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  for (const bad of ['document', 'localStorage', 'fetch(', 'State.', 'Math.random']) {
    assert.equal(body.includes(bad), false, `модуль потянулся к «${bad}»`);
  }
});
