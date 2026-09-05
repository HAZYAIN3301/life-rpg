'use strict';

/* Движок первой настоящей ценности: AG-09 / AG-11 / AG-12 / AG-32.
 *
 * Главное, что здесь проверяется, — отказы. Что тап по питомцу, открытие экрана,
 * начисление и сундук НЕ засчитываются; что улика без полей не улика; что перезагрузка
 * и повторная доставка события не создают второй «первый раз»; и что превышение
 * десяти минут ничего не отнимает.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const F = require('../public/first-value-v1.js');

const ROOT = path.resolve(__dirname, '..');
const T0 = '2026-09-01T09:00:00.000Z';

const ev = (id, type, extra) => Object.assign({ id, type, at: T0 }, extra || {});

const EVIDENCE = {
  entityType: 'quest',
  entityId: 'q-42',
  outcomeType: 'quest_completed',
  occurredAt: '2026-09-01T09:06:00.000Z',
};

// Дорога до первой ценности целиком, шаг за шагом.
function walkToFirstValue(over) {
  let s = F.createJourney({ userId: 'u1', startedAt: T0 });
  s = F.transitionJourney(s, ev('e1', 'route_chosen', { route: 'do_now' }));
  s = F.transitionJourney(s, ev('e2', 'action_ready', { entityType: 'quest', entityId: 'q-42' }));
  s = F.transitionJourney(s, ev('e3', 'action_started', { entityType: 'quest', entityId: 'q-42' }));
  s = F.transitionJourney(s, ev('e4', 'outcome_recorded', Object.assign({}, EVIDENCE, over || {})));
  return s;
}

// Симуляция перезагрузки: состояние уезжает на диск и возвращается как обычный JSON.
const reload = (s) => JSON.parse(JSON.stringify(s));

// ------------------------------------------------------------------- create --

test('createJourney даёт путь до какой-либо настройки', () => {
  const s = F.createJourney({ userId: 'u1', startedAt: T0, profile: { hasPlan: true, locale: 'ru' } });
  assert.strictEqual(s.status, 'new');
  assert.strictEqual(s.route, '');
  assert.strictEqual(s.firstValueAt, '');
  assert.strictEqual(s.evidence, null);
  assert.strictEqual(s.primaryAction, null);
  // AG-09: путь существует раньше, чем человек выбрал сферы, аватар и программу.
  assert.deepStrictEqual(Object.keys(s.profile).sort(), ['hasPlan', 'locale', 'needsRecovery', 'returning']);
});

test('createJourney переживает мусор на входе', () => {
  for (const junk of [null, undefined, 0, 'строка', []]) {
    const s = F.createJourney(junk);
    assert.strictEqual(s.status, 'new');
    assert.strictEqual(s.version, 1);
  }
});

test('deriveJourneyView подсказывает маршрут по профилю, но не решает за человека', () => {
  const view = (profile) => F.deriveJourneyView(F.createJourney({ userId: 'u', startedAt: T0, profile }));
  assert.strictEqual(view({ needsRecovery: true, hasPlan: true }).suggestedRoute, 'recover');
  assert.strictEqual(view({ hasPlan: true }).suggestedRoute, 'clarify');
  assert.strictEqual(view({}).suggestedRoute, 'do_now');
  assert.strictEqual(view({}).route, '', 'подсказка не назначает маршрут');
});

// ------------------------------------------------------- meaningful outcome --

test('🔴 AG-12: тап по питомцу, экран, опыт и сундук не являются первой ценностью', () => {
  for (const type of F.NON_VALUE_EVENTS) {
    assert.strictEqual(F.isMeaningfulOutcome({ type }), false, `${type} не первая ценность`);
    // Даже с полной уликой на борту — отказ остаётся отказом.
    assert.strictEqual(F.isMeaningfulOutcome(Object.assign({ type }, EVIDENCE)), false, `${type} не спасает улика`);
  }
  assert.deepStrictEqual(F.NON_VALUE_EVENTS.slice().sort(), ['chest_opened', 'pet_tapped', 'screen_opened', 'xp_received']);
});

test('isMeaningfulOutcome требует полную улику', () => {
  assert.strictEqual(F.isMeaningfulOutcome(Object.assign({ type: 'outcome_recorded' }, EVIDENCE)), true);
  assert.strictEqual(F.isMeaningfulOutcome({ type: 'outcome_recorded', evidence: EVIDENCE }), true, 'улика вложенным полем тоже читается');
  assert.strictEqual(F.isMeaningfulOutcome(EVIDENCE), true, 'голая улика без типа события');

  for (const field of ['entityType', 'entityId', 'outcomeType', 'occurredAt']) {
    const broken = Object.assign({ type: 'outcome_recorded' }, EVIDENCE);
    delete broken[field];
    assert.strictEqual(F.isMeaningfulOutcome(broken), false, `без ${field} улики нет`);
    const empty = Object.assign({ type: 'outcome_recorded' }, EVIDENCE, { [field]: '  ' });
    assert.strictEqual(F.isMeaningfulOutcome(empty), false, `пробелы вместо ${field} — не улика`);
  }
  assert.strictEqual(F.isMeaningfulOutcome(Object.assign({}, EVIDENCE, { occurredAt: 'вчера' })), false, 'время должно быть разбираемым');
  for (const junk of [null, undefined, 0, 'строка', []]) assert.strictEqual(F.isMeaningfulOutcome(junk), false);
});

test('🔴 список разрешённых исходов закрыт', () => {
  assert.deepStrictEqual(F.OUTCOME_TYPES.slice().sort(),
    ['next_action_committed', 'quest_completed', 'real_plan_created', 'recovery_boundary_started']);
  for (const bad of ['pet_tapped', 'screen_opened', 'xp_received', 'chest_opened', 'level_up', 'streak_kept', 'profile_saved']) {
    assert.strictEqual(F.isMeaningfulOutcome(Object.assign({}, EVIDENCE, { outcomeType: bad })), false, `${bad} не исход`);
  }
});

// -------------------------------------------------------------- state machine --

test('путь проходит все состояния по порядку', () => {
  let s = F.createJourney({ userId: 'u1', startedAt: T0 });
  assert.strictEqual(s.status, 'new');
  s = F.transitionJourney(s, ev('e1', 'route_chosen', { route: 'do_now' }));
  assert.strictEqual(s.status, 'intent_known');
  s = F.transitionJourney(s, ev('e2', 'action_ready', { entityType: 'quest', entityId: 'q-42' }));
  assert.strictEqual(s.status, 'action_ready');
  s = F.transitionJourney(s, ev('e3', 'action_started', { entityType: 'quest', entityId: 'q-42' }));
  assert.strictEqual(s.status, 'action_started');
  s = F.transitionJourney(s, ev('e4', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(s.status, 'first_value_reached');
  s = F.transitionJourney(s, ev('e5', 'journey_completed'));
  assert.strictEqual(s.status, 'completed');
  assert.deepStrictEqual(F.STATES.slice(0, 6),
    ['new', 'intent_known', 'action_ready', 'action_started', 'first_value_reached', 'completed']);
});

test('все три маршрута ведут к своему настоящему исходу', () => {
  const cases = [
    ['do_now', 'quest_completed', 'quest', 'q-1'],
    ['clarify', 'next_action_committed', 'task', 't-1'],
    ['clarify', 'real_plan_created', 'plan', 'p-1'],
    ['recover', 'recovery_boundary_started', 'recovery', 'r-1'],
  ];
  for (const [route, outcomeType, entityType, entityId] of cases) {
    let s = F.createJourney({ userId: 'u', startedAt: T0 });
    s = F.transitionJourney(s, ev('a', 'route_chosen', { route }));
    s = F.transitionJourney(s, ev('b', 'action_ready', { entityType, entityId }));
    s = F.transitionJourney(s, ev('c', 'action_started', { entityType, entityId }));
    s = F.transitionJourney(s, ev('d', 'outcome_recorded', { entityType, entityId, outcomeType, occurredAt: T0 }));
    assert.strictEqual(s.status, 'first_value_reached', `${route}/${outcomeType}`);
    assert.strictEqual(F.getFirstValueEvidence(s).routeAligned, true, `${route} ждёт ${outcomeType}`);
  }
  assert.deepStrictEqual(F.ROUTES.slice().sort(), ['clarify', 'do_now', 'recover']);
});

test('исход не своего маршрута засчитывается, но помечается', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'clarify' }));
  s = F.transitionJourney(s, ev('b', 'action_ready', { entityType: 'quest', entityId: 'q-9' }));
  s = F.transitionJourney(s, ev('c', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(s.status, 'first_value_reached', 'зашёл уточнить, а взял и сделал — это тоже победа');
  assert.strictEqual(F.getFirstValueEvidence(s).routeAligned, false, 'но отчёт видит разницу');
});

test('улика принимается и без промежуточных шагов, но не из пустого пути', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  const fromNew = F.transitionJourney(s, ev('x', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(fromNew.status, 'new', 'без выбранного маршрута пути ещё нет');
  assert.strictEqual(fromNew.lastEvent.reason, 'not_allowed_from_state');

  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  const skipped = F.transitionJourney(s, ev('b', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(skipped.status, 'first_value_reached', 'сделал офлайн и отчитался — это не повод отказать');
  assert.ok(skipped.primaryAction, 'главное действие достроено из улики');
});

test('🔴 outcome_recorded без полной улики не двигает путь', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  s = F.transitionJourney(s, ev('b', 'action_started', { entityType: 'quest', entityId: 'q-1' }));

  const rejected = F.transitionJourney(s, ev('c', 'outcome_recorded', { outcomeType: 'quest_completed' }));
  assert.strictEqual(rejected.status, 'action_started', 'статус не двинулся');
  assert.strictEqual(rejected.firstValueAt, '');
  assert.strictEqual(rejected.lastEvent.applied, false);
  assert.strictEqual(rejected.lastEvent.reason, 'not_first_value', 'отказ назван вслух, а не проглочен');
});

test('🔴 события-не-ценности отвергаются самим движком', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  s = F.transitionJourney(s, ev('b', 'action_started', { entityType: 'quest', entityId: 'q-1' }));
  for (const [i, type] of F.NON_VALUE_EVENTS.entries()) {
    const after = F.transitionJourney(s, ev(`n${i}`, type, EVIDENCE));
    assert.strictEqual(after.status, 'action_started', `${type} не двигает путь`);
    assert.strictEqual(after.firstValueAt, '');
    assert.strictEqual(after.lastEvent.reason, 'not_first_value');
  }
});

test('неизвестные события и мусор отвергаются с названной причиной', () => {
  const s = walkToFirstValue();
  assert.strictEqual(F.transitionJourney(s, ev('z', 'придумал_событие')).lastEvent.reason, 'unknown_event_type');
  assert.strictEqual(F.transitionJourney(s, { id: 'z2' }).lastEvent.reason, 'no_event_type');
  assert.strictEqual(F.transitionJourney(s, { type: 'route_chosen' }).lastEvent.reason, 'no_event_id');
  for (const junk of [null, undefined, 0, 'строка', []]) {
    const after = F.transitionJourney(s, junk);
    assert.strictEqual(after.status, s.status, 'мусорное событие ничего не ломает');
  }
});

test('route_chosen требует один из трёх маршрутов', () => {
  const s = F.createJourney({ userId: 'u', startedAt: T0 });
  const bad = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'посмотреть' }));
  assert.strictEqual(bad.status, 'new');
  assert.strictEqual(bad.lastEvent.reason, 'unknown_route');
});

// -------------------------------------------------- primary vs otherSupport --

test('🔴 главное действие ровно одно, остальное уходит в поддержку', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  s = F.transitionJourney(s, ev('b', 'action_ready', { entityType: 'quest', entityId: 'q-1' }));
  s = F.transitionJourney(s, ev('c', 'action_ready', { entityType: 'quest', entityId: 'q-2' }));
  s = F.transitionJourney(s, ev('d', 'action_ready', { entityType: 'task', entityId: 't-9' }));

  assert.strictEqual(s.primaryAction.entityId, 'q-1', 'первое остаётся главным');
  assert.deepStrictEqual(s.otherSupport.map((r) => r.entityId), ['q-2', 't-9']);

  const view = F.deriveJourneyView(s);
  assert.strictEqual(Array.isArray(view.primaryAction), false, 'главное действие никогда не массив');
  assert.strictEqual(view.primaryAction.entityId, 'q-1');
  assert.strictEqual(view.otherSupport.length, 2);

  // Повтор того же самого не плодит дубли в поддержке.
  const again = F.transitionJourney(s, ev('e', 'action_ready', { entityType: 'quest', entityId: 'q-2' }));
  assert.deepStrictEqual(again.otherSupport.map((r) => r.entityId), ['q-2', 't-9']);
});

test('action_ready без полной ссылки отвергается', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  const bad = F.transitionJourney(s, ev('b', 'action_ready', { entityType: 'quest' }));
  assert.strictEqual(bad.status, 'intent_known');
  assert.strictEqual(bad.lastEvent.reason, 'incomplete_reference');
});

// -------------------------------------------------- idempotence and reload --

test('🔴 повторная доставка события ничего не меняет', () => {
  const s = walkToFirstValue();
  const again = F.transitionJourney(s, ev('e4', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(again.lastEvent.reason, 'duplicate_event');
  assert.strictEqual(again.lastEvent.applied, false);
  assert.strictEqual(again.history.length, s.history.length, 'вторая запись в историю не появилась');
  assert.strictEqual(again.firstValueAt, s.firstValueAt);

  // Пятикратный retry одного и того же события — тот же самый путь.
  let repeated = s;
  for (let i = 0; i < 5; i += 1) repeated = F.transitionJourney(repeated, ev('e4', 'outcome_recorded', EVIDENCE));
  assert.deepStrictEqual(repeated.history, s.history);
  assert.strictEqual(repeated.status, s.status);
});

test('🔴 перезагрузка безопасна: состояние переживает JSON round-trip', () => {
  const s = walkToFirstValue();
  const restored = reload(s);
  assert.deepStrictEqual(F.deriveJourneyView(restored), F.deriveJourneyView(s));
  assert.deepStrictEqual(F.getFirstValueEvidence(restored), F.getFirstValueEvidence(s));

  // И после перезагрузки дубль всё ещё узнаётся.
  const dup = F.transitionJourney(restored, ev('e4', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(dup.lastEvent.reason, 'duplicate_event');

  // Продолжение с перечитанного состояния идентично продолжению с живого.
  assert.deepStrictEqual(
    F.transitionJourney(restored, ev('e5', 'journey_completed')),
    F.transitionJourney(s, ev('e5', 'journey_completed')),
  );
});

test('🔴 firstValueAt пишется один раз и не переписывается', () => {
  const s = walkToFirstValue();
  const first = s.firstValueAt;
  assert.ok(first, 'момент записан');

  const second = F.transitionJourney(s, {
    id: 'e9', type: 'outcome_recorded', at: '2026-09-01T11:00:00.000Z',
    entityType: 'task', entityId: 't-77', outcomeType: 'next_action_committed', occurredAt: '2026-09-01T11:00:00.000Z',
  });
  assert.strictEqual(second.firstValueAt, first, 'второй настоящий результат не переписывает первый');
  assert.strictEqual(second.evidence.entityId, 'q-42', 'улика первого раза сохранена');
  assert.strictEqual(second.lastEvent.reason, 'first_value_already_recorded');

  // И после завершения путь остаётся при своей улике.
  const done = F.transitionJourney(second, ev('e10', 'journey_completed'));
  assert.strictEqual(done.firstValueAt, first);
});

test('повреждённое состояние не выдаёт себя за успех', () => {
  const broken = reload(walkToFirstValue());
  broken.evidence = { entityType: 'quest' };            // улика испорчена
  const view = F.deriveJourneyView(broken);
  assert.strictEqual(view.firstValueReached, false, 'статус без улики не считается достигнутым');
  assert.strictEqual(view.evidence, null);
  assert.strictEqual(F.getFirstValueEvidence(broken), null);
});

// ------------------------------------------------------------------ deferred --

test('deferred — законный исход, и возврат приводит туда же', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'recover' }));
  s = F.transitionJourney(s, ev('b', 'action_ready', { entityType: 'recovery', entityId: 'r-1' }));
  const off = F.transitionJourney(s, ev('c', 'deferred', { reason: 'нет сил сегодня' }));
  assert.strictEqual(off.status, 'deferred');
  assert.strictEqual(off.deferredReason, 'нет сил сегодня');
  assert.strictEqual(F.deriveJourneyView(off).deferred, true);

  const back = F.transitionJourney(off, ev('d', 'resumed'));
  assert.strictEqual(back.status, 'action_ready', 'вернулись туда, где остановились');
  assert.strictEqual(back.deferredReason, '');
  assert.strictEqual(back.primaryAction.entityId, 'r-1', 'ничего не потеряно');
});

test('отложенный путь можно закончить настоящим результатом прямо из deferred', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  s = F.transitionJourney(s, ev('b', 'deferred', { reason: 'позже' }));
  const done = F.transitionJourney(s, ev('c', 'outcome_recorded', EVIDENCE));
  assert.strictEqual(done.status, 'first_value_reached');
  assert.strictEqual(done.deferredAt, '', 'отложенность снята');
});

test('journey_completed без первой ценности отвергается', () => {
  let s = F.createJourney({ userId: 'u', startedAt: T0 });
  s = F.transitionJourney(s, ev('a', 'route_chosen', { route: 'do_now' }));
  const bad = F.transitionJourney(s, ev('b', 'journey_completed'));
  assert.strictEqual(bad.status, 'intent_known');
  assert.strictEqual(bad.lastEvent.reason, 'not_allowed_from_state');
});

// --------------------------------------------------------- ten minutes / AG-32 --

test('🔴 превышение десяти минут ничего не наказывает', () => {
  const s = walkToFirstValue();
  const inTime = F.deriveJourneyView(s, { now: '2026-09-01T09:07:00.000Z' });
  const late = F.deriveJourneyView(s, { now: '2026-09-01T09:47:00.000Z' });

  assert.strictEqual(inTime.overTarget, false);
  assert.strictEqual(late.overTarget, true);
  assert.strictEqual(late.targetMs, 10 * 60 * 1000);

  // Всё, кроме измерения времени, совпадает: статус, улика, действия, приём событий.
  for (const field of ['status', 'route', 'firstValueReached', 'firstValueAt', 'targetMs']) {
    assert.deepStrictEqual(late[field], inTime[field], `${field} не должен зависеть от опоздания`);
  }
  assert.deepStrictEqual(late.evidence, inTime.evidence, 'улика не отнимается за опоздание');
  assert.deepStrictEqual(late.primaryAction, inTime.primaryAction);
  assert.deepStrictEqual(late.acceptsEvents, inTime.acceptsEvents);
  assert.strictEqual(late.elapsedMs, 47 * 60 * 1000);
});

test('без options часов нет и вид остаётся воспроизводимым', () => {
  const view = F.deriveJourneyView(walkToFirstValue());
  assert.strictEqual(view.elapsedMs, null);
  assert.strictEqual(view.overTarget, null);
  assert.deepStrictEqual(F.deriveJourneyView(walkToFirstValue()), view, 'повторный вызов даёт то же самое');
});

// ------------------------------------------------------------ purity/economy --

test('🔴 движок не мутирует вход', () => {
  const s = walkToFirstValue();
  const before = JSON.stringify(s);
  const event = ev('e5', 'journey_completed');
  const eventBefore = JSON.stringify(event);
  const next = F.transitionJourney(s, event);
  assert.strictEqual(JSON.stringify(s), before, 'прежнее состояние не тронуто');
  assert.strictEqual(JSON.stringify(event), eventBefore, 'событие не тронуто');
  assert.notStrictEqual(next, s, 'вернулось новое состояние');

  F.deriveJourneyView(s, { now: T0 });
  F.getFirstValueEvidence(s);
  assert.strictEqual(JSON.stringify(s), before, 'чтение ничего не меняет');
});

test('🔴 движок не начисляет опыт, золото, серии и предметы', () => {
  const s = walkToFirstValue();
  const done = F.transitionJourney(s, ev('e5', 'journey_completed'));
  const dump = (JSON.stringify(done) + JSON.stringify(F.deriveJourneyView(done, { now: T0 }))).toLowerCase();
  for (const forbidden of ['xp', 'gold', 'streak', 'lootluck', 'reward', 'item', 'chest', 'level', 'penalt', 'coin']) {
    assert.strictEqual(dump.includes(forbidden), false, `в состоянии не должно быть «${forbidden}»`);
  }

  assert.deepStrictEqual(Object.keys(F).sort(), [
    'EVENT_TYPES', 'NON_VALUE_EVENTS', 'OUTCOME_TYPES', 'ROUTES', 'ROUTE_OUTCOMES', 'STATES', 'TARGET_MS', 'VERSION',
    'createJourney', 'deriveJourneyView', 'getFirstValueEvidence', 'isMeaningfulOutcome', 'transitionJourney',
  ]);

  const src = fs.readFileSync(path.join(ROOT, 'public', 'first-value-v1.js'), 'utf8');
  for (const forbidden of ['addXp', 'addGold', 'lootLuck', 'localStorage', 'fetch(', 'document.', 'Date.now(']) {
    assert.strictEqual(src.includes(forbidden), false, `модуль не должен трогать «${forbidden}»`);
  }
});

test('история хранит применённые переходы и не растёт от отказов', () => {
  let s = walkToFirstValue();
  const applied = s.history.length;
  assert.strictEqual(applied, 4, 'четыре применённых шага');
  s = F.transitionJourney(s, ev('r1', 'pet_tapped'));
  s = F.transitionJourney(s, ev('r2', 'outcome_recorded', { outcomeType: 'quest_completed' }));
  assert.strictEqual(s.history.length, applied, 'отказы в историю не пишутся');
  assert.strictEqual(s.seenEventIds.includes('r1'), true, 'но сами события помечены как виденные');
});
