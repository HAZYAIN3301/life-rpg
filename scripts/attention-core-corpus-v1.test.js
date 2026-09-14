'use strict';
/* Корпус соответствия ядра внимания (APPLE-PRE-PAYMENT-PLAN-2026-09.md §B4).
 *
 * `fixtures/attention-core-v1.json` — языконезависимый набор случаев вход→ответ.
 * Здесь он проверяется против JS-модулей. Нативный порт будет гонять тот же файл,
 * и расхождение станет падением, а не тихим дрейфом двух реализаций.
 *
 * Корпус фиксирует НЫНЕШНЕЕ поведение. Он не является независимой спецификацией
 * и не доказывает, что JS прав. Его работа — не дать второй реализации разойтись
 * с первой незаметно, особенно там, где цена ошибки — застрявший shield.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PolicyV1 = require('../public/attention-policy-v1.js');
const SessionV1 = require('../public/attention-session-v1.js');
const EpisodeV1 = require('../public/attention-episode-v1.js');

const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'attention-core-v1.json'), 'utf8'));
const MODULES = { policy: PolicyV1, session: SessionV1, episode: EpisodeV1 };

function stateFor(name, module) {
  const raw = CORPUS.states[name];
  assert.ok(raw, `корпус ссылается на несуществующее состояние ${name}`);
  return MODULES[module].normalize(JSON.parse(JSON.stringify(raw)));
}

// Ответ сверяется по перечисленным ключам, а не целиком: корпус описывает то,
// что обязано совпасть между реализациями, и не притворяется снимком всего.
function assertSubset(actual, expected, id) {
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    assert.deepEqual(actual, expected, id);
    return;
  }
  assert.ok(actual && typeof actual === 'object', `${id}: ожидался объект, получено ${JSON.stringify(actual)}`);
  for (const key of Object.keys(expected)) {
    assert.deepEqual(actual[key], expected[key], `${id}: поле ${key}`);
  }
}

function run(entry) {
  const { module: mod, fn } = entry;
  const args = JSON.parse(JSON.stringify(entry.args || []));

  if (entry.policyFromState) {
    const [stateName, policyId] = entry.policyFromState;
    const policy = PolicyV1.policyById(stateFor(stateName, 'policy'), policyId);
    assert.ok(policy, `${entry.id}: политика ${policyId} не найдена`);
    return PolicyV1[fn](policy, ...args);
  }

  if (entry.sessionFromState) {
    const [stateName, sessionId] = entry.sessionFromState;
    const session = SessionV1.byId(stateFor(stateName, 'session'), sessionId);
    assert.ok(session, `${entry.id}: сессия ${sessionId} не найдена`);
    return SessionV1[fn](session, ...args);
  }

  // Словарь — свойство модуля, а не состояния, поэтому отвечает до его загрузки.
  if (fn === 'outcomeVocabulary') return EpisodeV1.OUTCOMES.slice();

  const state = stateFor(entry.state, mod);

  if (entry.episodeId) {
    const episode = EpisodeV1.byId(state, entry.episodeId);
    assert.ok(episode, `${entry.id}: эпизод ${entry.episodeId} не найден`);
    if (fn === 'sourceOf') return episode.source;
    return EpisodeV1[fn](episode, ...args);
  }

  // Составные случаи, где смысл именно в последовательности вызовов.
  if (fn === 'suggestionPurposes') {
    return EpisodeV1.suggestions(state, ...args).map((item) => item.purpose);
  }
  if (fn === 'escapeCount') {
    // Знаменатель медианы: сколько срывов вообще попало в окно.
    const [nowIso, days] = args;
    return state.episodes.filter((e) => e.outcome === 'escaped'
      && EpisodeV1.forPurpose(state, e.sourcePolicyId, e.declaredPurpose, nowIso, days).some((x) => x.id === e.id)).length;
  }
  if (fn === 'recordTwiceCount') {
    // Повтор доставки того же эпизода обновляет запись на месте.
    const existing = state.episodes[0];
    const again = EpisodeV1.record(state, { ...existing, outcome: 'done' });
    assert.equal(again.ok, true, `${entry.id}: повтор должен приниматься`);
    return again.state.episodes.length;
  }
  if (fn === 'closeTwice') {
    const first = SessionV1.close(state, args[0], args[1], args[2]);
    assert.equal(first.ok, true, `${entry.id}: первое закрытие должно проходить`);
    return SessionV1.close(first.state, args[0], args[1], args[2]);
  }
  if (fn === 'closeThenEpisode') {
    const closed = SessionV1.close(state, args[0], args[1], args[2]);
    assert.equal(closed.ok, true, `${entry.id}: закрытие должно проходить`);
    return SessionV1.toEpisode(closed.session);
  }

  const target = MODULES[mod];
  assert.equal(typeof target[fn], 'function', `${entry.id}: нет функции ${mod}.${fn}`);
  return target[fn](state, ...args);
}

test('корпус описывает сам себя и не содержит дублей', () => {
  assert.equal(CORPUS.version, 1);
  assert.ok(Array.isArray(CORPUS.cases) && CORPUS.cases.length >= 45, 'корпус слишком мал, чтобы что-то гарантировать');
  const ids = CORPUS.cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'идентификаторы случаев должны быть уникальны');
  for (const entry of CORPUS.cases) {
    assert.ok(entry.why && entry.why.length > 20, `${entry.id}: случай без объяснения бесполезен при портировании`);
    assert.ok(['policy', 'session', 'episode'].includes(entry.module), `${entry.id}: неизвестный модуль`);
  }
});

for (const entry of CORPUS.cases) {
  test(`корпус: ${entry.id}`, () => {
    const actual = run(entry);
    if (Object.prototype.hasOwnProperty.call(entry, 'expectSessionField')) {
      assert.equal(actual.ok, true, `${entry.id}: ожидался успешный результат`);
      assertSubset(actual.session, entry.expectSessionField, entry.id);
      return;
    }
    assertSubset(actual, entry.expect, entry.id);
  });
}
