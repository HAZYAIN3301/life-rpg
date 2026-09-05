'use strict';

/* Governance-контракт: AG-02 / AG-05 / AG-07 / AG-56.
 *
 * Здесь проверяется не «функция считает деление», а обещания, ради которых модуль
 * заведён: что unknown не превращается в исход, что маленькая выборка не выдаёт
 * себя за вывод, что рост пользы не перекрывает рост вреда и что модуль сам
 * ничего не выключает и не штрафует.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const G = require('../public/gamification-governance-v1.js');

const ROOT = path.resolve(__dirname, '..');

// Валидный контракт-образец. Каждый тест портит ровно одно поле, чтобы падение
// называло причину, а не «где-то в двадцати полях».
function contractInput(over) {
  return Object.assign({
    id: 'entry-10min',
    humanOutcome: 'Человек делает настоящий маленький шаг вместо откладывания',
    motivationalBenefit: 'Снижает барьер входа (Fogg ability), не добавляя давления',
    motivationalRisks: ['Может стать оптимальной валютной фермой', 'Может подменить полное завершение задачи'],
    northStar: { id: 'real_step_done', metricClass: 'user_outcome', type: 'proportion', direction: 'up_is_good', baseline: 0.40 },
    leadingMetrics: [{ id: 'entry_accepted', metricClass: 'product_health', type: 'proportion', direction: 'up_is_good', baseline: 0.20 }],
    counterMetrics: [{ id: 'entry_replaces_real_task', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good', baseline: 0.05 }],
    harmMetrics: [{ id: 'regret_after_session', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good', baseline: 0.05 }],
    denominatorPolicy: { basis: 'exposed' },
    minimumSample: 10,
    thresholds: { regret_after_session: { review: 0.08, stop: 0.15 } },
    rollbackPlan: 'Выключить session-scoped workMin=10 флагом, данные не мигрируют',
    owner: 'Альберт',
    phase: 'scaffolding',
    reviewAt: '2026-10-01',
  }, over || {});
}

// Наблюдения на N субъектов: первые `hits` — попадание, остальные — промах.
function rows(metricId, total, hits, offset) {
  const out = [];
  for (let i = 0; i < total; i += 1) {
    out.push({ subjectId: `u${(offset || 0) + i}`, metricId, value: i < hits });
  }
  return out;
}

// ------------------------------------------------------------------ contract --

test('defineFeatureContract нормализует форму и не судит', () => {
  const c = G.defineFeatureContract(contractInput());
  assert.strictEqual(c.version, 1);
  assert.strictEqual(c.phase, 'scaffolding');
  assert.strictEqual(c.northStar.role, 'north_star');
  assert.strictEqual(c.harmMetrics[0].role, 'harm');
  // Вред без явного направления получает «меньше — лучше».
  const implied = G.defineFeatureContract(contractInput({ harmMetrics: [{ id: 'h', metricClass: 'user_outcome' }] }));
  assert.strictEqual(implied.harmMetrics[0].direction, 'down_is_good');
  assert.strictEqual(implied.leadingMetrics[0].direction, 'up_is_good');
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.harmMetrics[0]), 'контракт заморожен целиком');
});

test('defineFeatureContract переживает мусор на входе', () => {
  for (const junk of [null, undefined, 0, 'строка', [], { northStar: 'нет' }]) {
    const c = G.defineFeatureContract(junk);
    assert.strictEqual(c.version, 1);
    assert.strictEqual(G.validateFeatureContract(c).ok, false);
  }
});

test('validateFeatureContract требует все обязательные поля контракта', () => {
  assert.strictEqual(G.validateFeatureContract(G.defineFeatureContract(contractInput())).ok, true);

  const required = [
    ['id', 'id_required'],
    ['humanOutcome', 'human_outcome_required'],
    ['motivationalBenefit', 'motivational_benefit_required'],
    ['motivationalRisks', 'motivational_risks_required'],
    ['rollbackPlan', 'rollback_plan_required'],
    ['owner', 'owner_required'],
    ['phase', 'phase_required'],
    ['reviewAt', 'review_at_required'],
    ['minimumSample', 'minimum_sample_required'],
    ['leadingMetrics', 'leading_metrics_required'],
    ['counterMetrics', 'counter_metrics_required'],
    ['harmMetrics', 'harm_metrics_required'],
  ];
  for (const [field, code] of required) {
    const broken = contractInput();
    broken[field] = Array.isArray(broken[field]) ? [] : '';
    const check = G.validateFeatureContract(G.defineFeatureContract(broken));
    assert.strictEqual(check.ok, false, `${field} обязано быть обязательным`);
    assert.ok(check.errors.includes(code), `${field} → ${code}, получено ${check.errors.join(',')}`);
  }
});

test('🔴 AG-02: North Star не может быть product_health или commercial', () => {
  for (const cls of ['product_health', 'commercial']) {
    const check = G.validateFeatureContract(G.defineFeatureContract(contractInput({
      northStar: { id: 'installs', metricClass: cls, type: 'proportion' },
    })));
    assert.strictEqual(check.ok, false);
    assert.ok(check.errors.includes('north_star_must_be_user_outcome'), `${cls} не должен становиться North Star`);
  }
  // user_outcome — единственный допустимый класс главной метрики.
  assert.strictEqual(G.validateFeatureContract(G.defineFeatureContract(contractInput())).ok, true);
});

test('🔴 AG-07: у каждой метрики вреда обязан быть заранее названный порог стоп', () => {
  const check = G.validateFeatureContract(G.defineFeatureContract(contractInput({ thresholds: {} })));
  assert.strictEqual(check.ok, false);
  assert.ok(check.errors.includes('harm_stop_threshold_required:regret_after_session'));

  const onlyReview = G.validateFeatureContract(G.defineFeatureContract(contractInput({
    thresholds: { regret_after_session: { review: 0.08 } },
  })));
  assert.strictEqual(onlyReview.ok, false, 'один review без stop — это не выключатель');
});

test('🔴 denominatorPolicy не может отключить исключение unknown', () => {
  for (const patch of [{ excludeUnknown: false }, { excludeNull: false }, { excludeConflicting: false }]) {
    const c = G.defineFeatureContract(contractInput({ denominatorPolicy: Object.assign({ basis: 'exposed' }, patch) }));
    assert.strictEqual(c.denominatorPolicy.excludeUnknown, true, 'флаг всё равно нормализуется в true');
    assert.strictEqual(c.denominatorPolicy.excludeNull, true);
    assert.strictEqual(c.denominatorPolicy.excludeConflicting, true);
    const check = G.validateFeatureContract(c);
    assert.strictEqual(check.ok, false, 'попытка не проходит молча');
    assert.ok(check.errors.includes('denominator_policy_must_exclude_unknown'));
  }
});

test('validateFeatureContract ловит дубли id и висячие пороги', () => {
  const dup = G.validateFeatureContract(G.defineFeatureContract(contractInput({
    counterMetrics: [{ id: 'regret_after_session', metricClass: 'user_outcome' }],
  })));
  assert.ok(dup.errors.includes('duplicate_metric_id:regret_after_session'));

  const orphan = G.validateFeatureContract(G.defineFeatureContract(contractInput({
    thresholds: { regret_after_session: { stop: 0.15 }, ghost_metric: { stop: 1 } },
  })));
  assert.ok(orphan.errors.includes('threshold_for_unknown_metric:ghost_metric'));
});

// --------------------------------------------------------------- calculate --

test('calculateMetric: нулевой знаменатель не превращается в ноль процентов', () => {
  const def = { id: 'x', role: 'harm', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good', baseline: 0.1, minEffect: 0 };
  const empty = G.calculateMetric(def, []);
  assert.strictEqual(empty.denominator, 0);
  assert.strictEqual(empty.numerator, 0);
  assert.strictEqual(empty.sampleSize, 0);
  assert.strictEqual(empty.value, null, 'ноль наблюдений — это не «0%»');
  assert.strictEqual(empty.delta, null, 'без значения нет и дельты');
  assert.strictEqual(empty.improved, false);
  assert.strictEqual(empty.worsened, false);
  assert.ok(empty.reasonCodes.includes('empty_denominator'));
});

test('🔴 unknown и null не попадают в знаменатель', () => {
  const def = { id: 'x', role: 'harm', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good' };
  const r = G.calculateMetric(def, [
    { subjectId: 'a', value: true },
    { subjectId: 'b', value: false },
    { subjectId: 'c', value: null },
    { subjectId: 'd', value: undefined },
    { subjectId: 'e', value: 'unknown' },
    { subjectId: 'f', value: 'n/a' },
    { subjectId: 'g', value: '' },
    { subjectId: 'h', value: NaN },
    { subjectId: 'i', value: {} },
  ]);
  assert.strictEqual(r.observed, 9, 'все девять строк увидены');
  assert.strictEqual(r.denominator, 2, 'в знаменателе только известные исходы');
  assert.strictEqual(r.numerator, 1);
  assert.strictEqual(r.excludedUnknown, 7);
  assert.strictEqual(r.value, 0.5, 'unknown не занижает и не завышает долю');
  assert.ok(r.reasonCodes.includes('unknown_excluded_from_denominator'));
});

test('unknown, пришедший раньше известного, не отменяет наблюдение', () => {
  const def = { id: 'x', role: 'leading', metricClass: 'user_outcome', type: 'proportion' };
  const late = G.calculateMetric(def, [{ subjectId: 'a', value: null }, { subjectId: 'a', value: true }]);
  const early = G.calculateMetric(def, [{ subjectId: 'a', value: true }, { subjectId: 'a', value: null }]);
  assert.strictEqual(late.denominator, 1);
  assert.strictEqual(late.numerator, 1);
  assert.deepStrictEqual(late, early, 'порядок уточнения не меняет результат');
});

test('🔴 конфликт по одному субъекту выбрасывает субъекта, а не «побеждает последний»', () => {
  const def = { id: 'x', role: 'harm', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good' };
  const forward = G.calculateMetric(def, [
    { subjectId: 'a', value: true }, { subjectId: 'a', value: false },
    { subjectId: 'b', value: true },
  ]);
  const backward = G.calculateMetric(def, [
    { subjectId: 'b', value: true },
    { subjectId: 'a', value: false }, { subjectId: 'a', value: true },
  ]);
  assert.strictEqual(forward.denominator, 1);
  assert.strictEqual(forward.excludedConflicting, 1);
  assert.strictEqual(forward.value, 1);
  assert.deepStrictEqual(forward, backward, 'порядок массива не решает исход субъекта');
  assert.ok(forward.reasonCodes.includes('conflicting_observations_excluded'));
});

test('calculateMetric: чужие метрики игнорируются, повтор субъекта не удваивает знаменатель', () => {
  const def = { id: 'mine', role: 'leading', metricClass: 'user_outcome', type: 'proportion' };
  const r = G.calculateMetric(def, [
    { subjectId: 'a', metricId: 'mine', value: true },
    { subjectId: 'a', metricId: 'mine', value: true },
    { subjectId: 'b', metricId: 'other', value: true },
    { subjectId: 'c', value: false },
  ]);
  assert.strictEqual(r.denominator, 2, 'a и c');
  assert.strictEqual(r.excludedForeign, 1);
  assert.ok(r.reasonCodes.includes('foreign_observations_ignored'));
});

test('calculateMetric type=mean считает среднее, proportion отвергает не-0/1', () => {
  const mean = G.calculateMetric({ id: 'm', role: 'harm', metricClass: 'user_outcome', type: 'mean', direction: 'down_is_good' },
    [{ subjectId: 'a', value: 10 }, { subjectId: 'b', value: 20 }, { subjectId: 'c', value: 'unknown' }]);
  assert.strictEqual(mean.numerator, 30);
  assert.strictEqual(mean.denominator, 2);
  assert.strictEqual(mean.value, 15);

  const prop = G.calculateMetric({ id: 'p', role: 'harm', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good' },
    [{ subjectId: 'a', value: 1 }, { subjectId: 'b', value: 7 }]);
  assert.strictEqual(prop.denominator, 1, '7 — не доля, а мусор для proportion');
  assert.strictEqual(prop.excludedUnknown, 1);
});

test('improved/worsened учитывают направление и minEffect', () => {
  const harm = { id: 'h', role: 'harm', metricClass: 'user_outcome', type: 'proportion', direction: 'down_is_good', baseline: 0.10, minEffect: 0 };
  assert.strictEqual(G.calculateMetric(harm, rows('h', 10, 3)).worsened, true, '30% против базы 10% — хуже');
  assert.strictEqual(G.calculateMetric(harm, rows('h', 10, 0)).improved, true, '0% против базы 10% — лучше');

  const noisy = Object.assign({}, harm, { minEffect: 0.25 });
  assert.strictEqual(G.calculateMetric(noisy, rows('h', 10, 3)).worsened, false, 'сдвиг внутри объявленного шума не считается');
  assert.strictEqual(G.calculateMetric(noisy, rows('h', 10, 5)).worsened, true);
});

// ---------------------------------------------------------------- evaluate --

test('evaluateFeatureReview отказывается работать по невалидному контракту', () => {
  assert.throws(
    () => G.evaluateFeatureReview(contractInput({ owner: '' }), []),
    (e) => e.code === 'invalid_contract' && Array.isArray(e.errors) && e.errors.includes('owner_required'),
  );
});

test('insufficient_data: пустых и маленьких данных не хватает на вывод', () => {
  const c = G.defineFeatureContract(contractInput());
  const empty = G.evaluateFeatureReview(c, []);
  assert.strictEqual(empty.status, 'insufficient_data');
  assert.ok(empty.reasonCodes.includes('empty_denominator:real_step_done'));
  assert.ok(empty.reasonCodes.includes('insufficient_sample:regret_after_session'));

  // 9 субъектов при minimumSample 10 — всё ещё не вывод.
  const thin = G.evaluateFeatureReview(c, [].concat(
    rows('real_step_done', 9, 8), rows('entry_accepted', 9, 5),
    rows('entry_replaces_real_task', 9, 0), rows('regret_after_session', 9, 0),
  ));
  assert.strictEqual(thin.status, 'insufficient_data');
  assert.ok(thin.reasonCodes.includes('insufficient_sample:real_step_done'));
});

test('continue выдаётся только когда выборка набрана и вред в границах', () => {
  const c = G.defineFeatureContract(contractInput());
  const good = G.evaluateFeatureReview(c, [].concat(
    rows('real_step_done', 20, 12),           // 0.60 против базы 0.40 — лучше
    rows('entry_accepted', 20, 8),            // 0.40 против базы 0.20 — лучше
    rows('entry_replaces_real_task', 20, 1),  // 0.05 — как база
    rows('regret_after_session', 20, 1),      // 0.05 — как база, ниже review 0.08
  ));
  assert.strictEqual(good.status, 'continue');
  assert.ok(good.reasonCodes.includes('within_agreed_bounds'));
  assert.strictEqual(good.harmWorsened, false);
  assert.strictEqual(good.benefitImproved, true);
});

test('🔴 AG-56: рост пользы при росте вреда не может дать continue', () => {
  const c = G.defineFeatureContract(contractInput());
  const r = G.evaluateFeatureReview(c, [].concat(
    rows('real_step_done', 100, 80),           // 0.80 — сильно лучше базы 0.40
    rows('entry_accepted', 100, 70),           // 0.70 — сильно лучше базы 0.20
    rows('entry_replaces_real_task', 100, 5),  // 0.05 — как база
    rows('regret_after_session', 100, 6),      // 0.06 — ХУЖЕ базы 0.05, но ниже review 0.08
  ));
  assert.strictEqual(r.benefitImproved, true);
  assert.strictEqual(r.harmWorsened, true);
  assert.strictEqual(r.status, 'review_required', 'отличный engagement не перекрывает растущий вред');
  assert.ok(r.reasonCodes.includes('benefit_up_with_harm_up'));
  assert.ok(r.reasonCodes.includes('harm_metric_worsened'));
  assert.strictEqual(r.reasonCodes.includes('within_agreed_bounds'), false);
});

test('review_required по порогу review, stop_recommended по порогу stop', () => {
  const c = G.defineFeatureContract(contractInput());
  const base = [].concat(rows('real_step_done', 100, 40), rows('entry_accepted', 100, 20), rows('entry_replaces_real_task', 100, 5));

  const review = G.evaluateFeatureReview(c, base.concat(rows('regret_after_session', 100, 9)));  // 0.09 ≥ review 0.08
  assert.strictEqual(review.status, 'review_required');
  assert.ok(review.reasonCodes.includes('harm_review_threshold_crossed:regret_after_session'));

  const stop = G.evaluateFeatureReview(c, base.concat(rows('regret_after_session', 100, 20)));   // 0.20 ≥ stop 0.15
  assert.strictEqual(stop.status, 'stop_recommended');
  assert.ok(stop.reasonCodes.includes('harm_stop_threshold_crossed:regret_after_session'));
});

test('🔴 порог засчитывается ровно на границе, а не на волосок за ней', () => {
  const c = G.defineFeatureContract(contractInput());
  const base = [].concat(rows('real_step_done', 100, 40), rows('entry_accepted', 100, 20), rows('entry_replaces_real_task', 100, 5));

  const exactStop = G.evaluateFeatureReview(c, base.concat(rows('regret_after_session', 100, 15)));   // ровно 0.15
  assert.strictEqual(exactStop.status, 'stop_recommended', 'ровно порог — это уже порог');

  const exactReview = G.evaluateFeatureReview(c, base.concat(rows('regret_after_session', 100, 8)));  // ровно 0.08
  assert.strictEqual(exactReview.status, 'review_required');

  const justUnder = G.evaluateFeatureReview(c, base.concat(rows('regret_after_session', 100, 7)));    // 0.07
  assert.strictEqual(justUnder.status, 'continue');
});

test('порог «чем больше, тем лучше» срабатывает на падении вниз', () => {
  const c = G.defineFeatureContract(contractInput({
    thresholds: { regret_after_session: { stop: 0.15 }, real_step_done: { review: 0.30, stop: 0.20 } },
  }));
  const base = [].concat(rows('entry_accepted', 100, 20), rows('entry_replaces_real_task', 100, 5), rows('regret_after_session', 100, 1));

  const dipped = G.evaluateFeatureReview(c, base.concat(rows('real_step_done', 100, 30)));  // 0.30 ≤ review 0.30
  assert.strictEqual(dipped.status, 'review_required');
  assert.ok(dipped.reasonCodes.includes('north_star_review_threshold_crossed:real_step_done'));

  const collapsed = G.evaluateFeatureReview(c, base.concat(rows('real_step_done', 100, 15)));  // 0.15 ≤ stop 0.20
  assert.strictEqual(collapsed.status, 'stop_recommended');
});

test('🔴 сработавший стоп не прячется за «мало данных» соседней метрики', () => {
  const c = G.defineFeatureContract(contractInput());
  // Вред набрал выборку и перешёл стоп; North Star не набрал вовсе.
  const r = G.evaluateFeatureReview(c, [].concat(
    rows('entry_accepted', 100, 50), rows('entry_replaces_real_task', 100, 5),
    rows('regret_after_session', 100, 30),
  ));
  assert.strictEqual(r.status, 'stop_recommended', 'стоп важнее недобора по другой колонке');
  assert.ok(r.reasonCodes.includes('insufficient_sample:real_step_done'), 'недобор всё равно назван');
});

test('🔴 вред на недостаточной выборке не даёт стоп, но и не молчит', () => {
  const c = G.defineFeatureContract(contractInput({ minimumSample: 50 }));
  const r = G.evaluateFeatureReview(c, [].concat(
    rows('real_step_done', 60, 30), rows('entry_accepted', 60, 20), rows('entry_replaces_real_task', 60, 2),
    rows('regret_after_session', 8, 4),  // 0.50 — далеко за стопом, но n=8 при minimumSample 50
  ));
  assert.strictEqual(r.status, 'insufficient_data');
  assert.ok(r.reasonCodes.includes('harm_stop_threshold_crossed_below_minimum_sample:regret_after_session'));
  assert.strictEqual(r.reasonCodes.includes('harm_stop_threshold_crossed:regret_after_session'), false);
});

test('reviewAt: наступивший срок ревью снимает continue', () => {
  const c = G.defineFeatureContract(contractInput());
  const obs = [].concat(rows('real_step_done', 20, 12), rows('entry_accepted', 20, 8),
    rows('entry_replaces_real_task', 20, 1), rows('regret_after_session', 20, 1));

  assert.strictEqual(G.evaluateFeatureReview(c, obs, { now: '2026-09-30' }).status, 'continue');
  const due = G.evaluateFeatureReview(c, obs, { now: '2026-10-01T00:00:00Z' });
  assert.strictEqual(due.status, 'review_required');
  assert.ok(due.reasonCodes.includes('review_window_reached'));
  assert.strictEqual(due.evaluatedAt, '2026-10-01T00:00:00Z');
  // Без options часов нет, и результат остаётся детерминированным.
  assert.strictEqual(G.evaluateFeatureReview(c, obs).evaluatedAt, null);
});

// ------------------------------------------------------------- determinism --

test('🔴 повторный вызов и перестановка наблюдений дают тот же результат', () => {
  const c = G.defineFeatureContract(contractInput());
  const obs = [].concat(
    rows('real_step_done', 40, 25), rows('entry_accepted', 40, 15),
    rows('entry_replaces_real_task', 40, 3), rows('regret_after_session', 40, 4),
  );
  const first = G.evaluateFeatureReview(c, obs);
  const second = G.evaluateFeatureReview(c, obs);
  assert.deepStrictEqual(first, second, 'повторный вызов ничего не меняет');

  // Обратный порядок и «перетасовка» через шаг — тот же вывод.
  const reversed = obs.slice().reverse();
  const interleaved = [];
  for (let i = 0; i < obs.length; i += 1) interleaved.push(obs[(i * 7) % obs.length]);
  assert.deepStrictEqual(G.evaluateFeatureReview(c, reversed), first);
  assert.deepStrictEqual(G.evaluateFeatureReview(c, interleaved), first);

  assert.strictEqual(G.summarizeFeatureReview(first), G.summarizeFeatureReview(second));
});

test('🔴 модуль не мутирует вход', () => {
  const input = contractInput();
  const before = JSON.stringify(input);
  const obs = rows('regret_after_session', 5, 1);
  const obsBefore = JSON.stringify(obs);
  G.evaluateFeatureReview(input, obs);
  G.calculateMetric({ id: 'regret_after_session', role: 'harm', metricClass: 'user_outcome' }, obs);
  assert.strictEqual(JSON.stringify(input), before);
  assert.strictEqual(JSON.stringify(obs), obsBefore);
});

// ---------------------------------------------------- ничего не выключает --

test('🔴 модуль ничего не выключает и не штрафует', () => {
  const c = G.defineFeatureContract(contractInput());
  const stopped = G.evaluateFeatureReview(c, [].concat(
    rows('real_step_done', 100, 40), rows('entry_accepted', 100, 20),
    rows('entry_replaces_real_task', 100, 5), rows('regret_after_session', 100, 40),
  ));
  assert.strictEqual(stopped.status, 'stop_recommended', 'модуль РЕКОМЕНДУЕТ, а не выключает');

  // В экспортах нет ни одного рычага исполнения.
  assert.deepStrictEqual(Object.keys(G).sort(), [
    'DIRECTIONS', 'METRIC_CLASSES', 'METRIC_ROLES', 'METRIC_TYPES', 'PHASES', 'STATUSES', 'VERSION',
    'calculateMetric', 'defineFeatureContract', 'evaluateFeatureReview', 'summarizeFeatureReview', 'validateFeatureContract',
  ]);

  // В результате нет ни выплат, ни штрафов, ни флагов исполнения.
  const dump = JSON.stringify(stopped).toLowerCase();
  for (const forbidden of ['xp', 'gold', 'streak', 'lootluck', 'penalt', 'disable', 'kill', 'enforce', 'apply']) {
    assert.strictEqual(dump.includes(forbidden), false, `в результате не должно быть «${forbidden}»`);
  }

  // И самого рычага в исходнике модуля тоже нет: экономику он не импортирует.
  const src = fs.readFileSync(path.join(ROOT, 'public', 'gamification-governance-v1.js'), 'utf8');
  for (const forbidden of ['lootLuck', 'addXp', 'addGold', 'localStorage', 'fetch(', 'document.']) {
    assert.strictEqual(src.includes(forbidden), false, `модуль не должен трогать «${forbidden}»`);
  }
});

test('summarizeFeatureReview даёт benefit+harm таблицу с владельцем', () => {
  const c = G.defineFeatureContract(contractInput());
  const r = G.evaluateFeatureReview(c, [].concat(
    rows('real_step_done', 30, 20), rows('entry_accepted', 30, 12),
    rows('entry_replaces_real_task', 30, 1), rows('regret_after_session', 30, 5),
  ));
  const text = G.summarizeFeatureReview(r);
  assert.ok(text.includes('Альберт'), 'владелец назван');
  assert.ok(text.includes('scaffolding'), 'фаза названа');
  assert.ok(text.includes('Польза:') && text.includes('Вред:'), 'обе половины таблицы на месте');
  assert.ok(text.includes('regret_after_session'), 'метрика вреда видна поимённо');
  assert.ok(text.includes(r.rollbackPlan), 'план отката печатается в отчёте');
  assert.ok(text.includes('n='), 'размер выборки виден');
  assert.strictEqual(G.summarizeFeatureReview(null), '');
  assert.strictEqual(G.summarizeFeatureReview({ version: 2 }), '');
});

test('summarizeFeatureReview честно печатает пустой знаменатель', () => {
  const c = G.defineFeatureContract(contractInput());
  const text = G.summarizeFeatureReview(G.evaluateFeatureReview(c, []));
  assert.ok(text.includes('значение — (0/0, n=0)'), 'нет данных печатается как «—», не как ноль');
});
