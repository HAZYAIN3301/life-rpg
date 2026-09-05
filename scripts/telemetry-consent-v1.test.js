'use strict';

/* Согласие на телеметрию: AG-51 / AG-53 / AG-54.
 *
 * Позиция по умолчанию — opt-out: цели сбора включены сразу, человек может выключить
 * любую. Поэтому проверяется не «ничего не собирается без спроса», а то, что от
 * разделения целей реально осталось: цели раздельны, выключаются независимо, имеют
 * разные сроки хранения; отзыв действует и не воскресает; свободный текст не проходит;
 * а эксперимент над человеком — не сбор, и требует и согласия, и объявленных границ.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const C = require('../public/telemetry-consent-v1.js');

const ROOT = path.resolve(__dirname, '..');
const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-02T10:00:00.000Z';

const decide = (consent, purposes, at) => C.applyConsentDecision(consent, {
  at: at || T0, source: 'settings', purposes,
});
// Человек, который зашёл в настройки и что-то выключил.
const revoke = (consent, ids, at) => decide(consent, Object.fromEntries(ids.map((id) => [id, false])), at);

// ------------------------------------------------------------- taxonomy --

test('🔴 AG-54: необходима ровно одна цель, и вовлечение в неё не входит', () => {
  const purposes = C.defineTelemetryPurposes();
  const essential = purposes.filter((p) => p.essential);
  assert.strictEqual(essential.length, 1, 'две «необходимые» цели — это уже не разделение');
  assert.strictEqual(essential[0].id, 'service_operation');
  assert.ok(essential[0].whyNotOptional, 'у цели без выбора обязано быть объяснение');

  const engagement = purposes.find((p) => p.id === 'engagement_optimization');
  assert.strictEqual(engagement.essential, false, 'оптимизация вовлечения не бывает необходимой');
  assert.deepStrictEqual(C.ESSENTIAL_PURPOSES.slice(), ['service_operation']);

  // Включённость по умолчанию и необходимость — разные вещи. Вовлечение собирается
  // сразу, но выключается человеком; служебное — нет.
  assert.strictEqual(engagement.defaultOn, true);
  assert.strictEqual(engagement.essential, false);

  assert.strictEqual(Object.isFrozen(C.PURPOSES), true);
  assert.strictEqual(Object.isFrozen(C.PURPOSES[0]), true);
  assert.deepStrictEqual(C.PURPOSE_IDS.slice().sort(), [
    'engagement_optimization', 'experimentation', 'personalization',
    'product_improvement', 'safety', 'service_operation',
  ]);
});

test('🔴 умолчание: сбор включён, эксперименты — нет', () => {
  for (const input of [null, undefined, {}, 'мусор', [], 42]) {
    const c = C.normalizeConsent(input);
    assert.strictEqual(c.purposes.service_operation, true);
    assert.strictEqual(c.purposes.product_improvement, true);
    assert.strictEqual(c.purposes.engagement_optimization, true);
    assert.strictEqual(c.purposes.personalization, true);
    assert.strictEqual(c.purposes.safety, true);
    // Эксперимент — не сбор, а изменение того, что видит конкретный человек.
    // Другой поступок — другое умолчание (AG-51).
    assert.strictEqual(c.purposes.experimentation, false, 'опыты на людях по умолчанию не идут');
    assert.strictEqual(c.decidedAt, '', 'умолчание — это не решение человека');
    assert.strictEqual(c.source, 'default');
  }
  assert.deepStrictEqual(C.DEFAULT_ON_PURPOSES.slice().sort(), [
    'engagement_optimization', 'personalization', 'product_improvement', 'safety', 'service_operation',
  ]);
});

test('🔴 AG-53: польза и вовлечение — разные цели и выключаются независимо', () => {
  assert.ok(C.NEVER_IMPLIED.product_improvement.includes('engagement_optimization'));
  assert.ok(C.NEVER_IMPLIED.safety.includes('engagement_optimization'));
  assert.deepStrictEqual(C.NEVER_IMPLIED.service_operation.slice().sort(), [
    'engagement_optimization', 'experimentation', 'personalization', 'product_improvement', 'safety',
  ]);

  // Главное, что осталось от разделения при opt-out: одну цель можно выключить,
  // не выключив другую. Без этого «две цели» были бы просто двумя словами.
  const off = revoke(null, ['engagement_optimization']).consent;
  assert.strictEqual(off.purposes.engagement_optimization, false);
  assert.strictEqual(off.purposes.product_improvement, true, 'польза не выключилась заодно');

  const useful = C.evaluateEventPermission(off, { name: 'quest:completed', purpose: 'product_improvement' });
  const sticky = C.evaluateEventPermission(off, { name: 'quest:completed', purpose: 'engagement_optimization' });
  assert.strictEqual(useful.allowed, true);
  assert.strictEqual(sticky.allowed, false, 'то же событие под выключенной целью не проходит');
  assert.strictEqual(sticky.reason, 'consent_missing');
});

test('у каждой цели свой срок хранения, и он виден в вердикте', () => {
  const v = C.evaluateEventPermission(null, { name: 'x', purpose: 'personalization' });
  assert.strictEqual(v.retentionDays, 365);
  const e = C.evaluateEventPermission(null, { name: 'x', purpose: 'service_operation' });
  assert.strictEqual(e.retentionDays, 30, 'необходимое хранится меньше всего');
  assert.strictEqual(e.essential, true);
});

// -------------------------------------------------------------- consent --

test('🔴 отзыв записывается и переживает порчу файла', () => {
  const off = revoke(null, ['personalization']);
  assert.strictEqual(off.ok, true);
  assert.deepStrictEqual(off.changed, ['personalization']);
  assert.strictEqual(off.consent.purposes.personalization, false);
  assert.strictEqual(off.consent.history.length, 1);

  // Поле с целями испортилось — но отзыв записан в истории и не воскресает.
  // При opt-out это единственное, что мешает «починке умолчанием» вернуть сбор.
  const damaged = C.normalizeConsent({
    purposes: { personalization: 'да', engagement_optimization: 1 },
    history: off.consent.history,
  });
  assert.strictEqual(damaged.purposes.personalization, false, 'отзыв не забыт');
  assert.strictEqual(damaged.purposes.engagement_optimization, true, 'нетронутая цель — по умолчанию');

  // Без истории нечитаемое поле честно возвращается к умолчанию.
  const noHistory = C.normalizeConsent({ purposes: { personalization: 'да' } });
  assert.strictEqual(noHistory.purposes.personalization, true);
});

test('согласие можно вернуть, и обе стороны решения записаны', () => {
  const off = revoke(null, ['safety', 'product_improvement']);
  assert.deepStrictEqual(off.changed.slice().sort(), ['product_improvement', 'safety']);
  assert.strictEqual(off.consent.decidedAt, T0);

  const back = decide(off.consent, { safety: true }, T1);
  assert.strictEqual(back.consent.purposes.safety, true);
  assert.strictEqual(back.consent.purposes.product_improvement, false, 'соседнее решение не тронуто');
  assert.strictEqual(back.consent.history.length, 3);
  assert.deepStrictEqual(back.consent.history[2], { at: T1, purpose: 'safety', granted: true, source: 'settings' });

  const again = decide(back.consent, { safety: true }, T1);
  assert.strictEqual(again.reason, 'unchanged');
  assert.deepStrictEqual(again.changed, []);
});

test('🔴 необходимое не предлагается как выбор', () => {
  for (const value of [true, false]) {
    const r = C.applyConsentDecision(null, { at: T0, source: 'settings', purposes: { service_operation: value } });
    assert.strictEqual(r.ok, false, `попытка выставить ${value} должна быть названа вслух`);
    assert.strictEqual(r.reason, 'essential_not_a_choice:service_operation');
    assert.strictEqual(r.consent.purposes.service_operation, true);
  }
  // И из файла его тоже не выключить.
  assert.strictEqual(C.normalizeConsent({ purposes: { service_operation: false } }).purposes.service_operation, true);
});

test('решение требует времени и источника', () => {
  assert.strictEqual(C.applyConsentDecision(null, { source: 'settings', purposes: { safety: false } }).reason, 'invalid_decision_time');
  assert.strictEqual(C.applyConsentDecision(null, { at: T0, purposes: { safety: false } }).reason, 'invalid_decision_source');
  assert.strictEqual(C.applyConsentDecision(null, { at: T0, source: 'выдумал', purposes: { safety: false } }).reason, 'invalid_decision_source');
  assert.strictEqual(C.applyConsentDecision(null, { at: T0, source: 'settings', purposes: {} }).reason, 'invalid_decision');
  assert.strictEqual(C.applyConsentDecision(null, { at: T0, source: 'settings' }).reason, 'invalid_decision');
  assert.strictEqual(C.applyConsentDecision(null, { at: T0, source: 'settings', purposes: { нет_такой: true } }).reason, 'unknown_purpose:нет_такой');
  assert.strictEqual(C.applyConsentDecision(null, { at: T0, source: 'settings', purposes: { safety: 'да' } }).reason, 'invalid_value:safety');
});

test('🔴 решения не мутируют вход', () => {
  const base = revoke(null, ['safety']).consent;
  const before = JSON.stringify(base);
  const decision = { at: T1, source: 'settings', purposes: { safety: true } };
  const decisionBefore = JSON.stringify(decision);
  const next = C.applyConsentDecision(base, decision);
  assert.strictEqual(JSON.stringify(base), before);
  assert.strictEqual(JSON.stringify(decision), decisionBefore);
  assert.notStrictEqual(next.consent, base);
  assert.strictEqual(Object.isFrozen(base), false, 'отказ и успех не замораживают чужой объект');
});

// --------------------------------------------------------------- events --

test('🔴 событие без названной цели не записывается', () => {
  const v = C.evaluateEventPermission(null, { name: 'view:today' });
  assert.strictEqual(v.allowed, false);
  assert.strictEqual(v.reason, 'purpose_required', 'безымянная цель — это не «наверное служебное»');

  assert.strictEqual(C.evaluateEventPermission(null, { name: 'x', purpose: 'придумал' }).reason, 'unknown_purpose');
  assert.strictEqual(C.evaluateEventPermission(null, { purpose: 'safety' }).reason, 'invalid_event_name');
  assert.strictEqual(C.evaluateEventPermission(null, { name: '!!!', purpose: 'safety' }).reason, 'invalid_event_name');
});

test('🔴 одно событие не может служить двум целям', () => {
  const v = C.evaluateEventPermission(null, {
    name: 'quest:completed', purpose: 'product_improvement',
    purposes: ['product_improvement', 'engagement_optimization'],
  });
  assert.strictEqual(v.allowed, false);
  assert.strictEqual(v.reason, 'single_purpose_required');
});

test('🔴 свободный текст в телеметрию не попадает', () => {
  const ok = C.evaluateEventPermission(null, {
    name: 'quest:completed', purpose: 'product_improvement', props: { minutes: 12, wasFirst: true },
  });
  assert.strictEqual(ok.allowed, true);
  assert.deepStrictEqual(ok.event.props, { minutes: 12, wasFirst: true });

  const leaked = C.evaluateEventPermission(null, {
    name: 'quest:completed', purpose: 'product_improvement', props: { title: 'Позвонить маме про анализы' },
  });
  assert.strictEqual(leaked.allowed, false);
  assert.strictEqual(leaked.reason, 'free_text_not_allowed', 'строк нет вообще, а не «почищенные строки»');
  assert.strictEqual(JSON.stringify(leaked).includes('маме'), false, 'и сам текст в вердикт не попадает');

  for (const [props, reason] of [
    [{ a: null }, 'invalid_prop_value'],
    [{ a: NaN }, 'invalid_prop_value'],
    [{ a: {} }, 'invalid_prop_value'],
    [{ 'плохое имя': 1 }, 'invalid_prop_name'],
    ['строка', 'invalid_props'],
    [Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 1])), 'too_many_props'],
  ]) {
    const r = C.evaluateEventPermission(null, { name: 'x', purpose: 'product_improvement', props });
    assert.strictEqual(r.reason, reason, `${JSON.stringify(props)} → ${reason}`);
  }
});

test('🔴 выключенная цель перестаёт принимать события, включённые продолжают', () => {
  const off = revoke(null, ['personalization', 'engagement_optimization']).consent;
  for (const purpose of C.PURPOSE_IDS) {
    const v = C.evaluateEventPermission(off, { name: 'x', purpose });
    const expected = purpose !== 'personalization' && purpose !== 'engagement_optimization' && purpose !== 'experimentation';
    assert.strictEqual(v.allowed, expected, `${purpose}: ожидалось ${expected}`);
    if (!expected) assert.strictEqual(v.reason, 'consent_missing');
  }
  // Служебное не выключается и работает всегда.
  assert.strictEqual(C.evaluateEventPermission(off, { name: 'save:failed', purpose: 'service_operation' }).allowed, true);
});

test('filterEventBatch делит пачку и называет причины', () => {
  const off = revoke(null, ['engagement_optimization']).consent;
  const batch = C.filterEventBatch(off, [
    { name: 'a', purpose: 'product_improvement' },
    { name: 'b', purpose: 'engagement_optimization' },
    { name: 'c', purpose: 'service_operation' },
    { name: 'd' },
    { name: 'e', purpose: 'product_improvement', props: { title: 'личное' } },
  ]);
  assert.deepStrictEqual(batch.accepted.map((e) => e.name), ['a', 'c']);
  assert.deepStrictEqual(batch.rejected, [
    { name: 'b', purpose: 'engagement_optimization', reason: 'consent_missing' },
    { name: 'd', purpose: '', reason: 'purpose_required' },
    { name: 'e', purpose: 'product_improvement', reason: 'free_text_not_allowed' },
  ]);
  assert.strictEqual(JSON.stringify(batch).includes('личное'), false);
});

// ---------------------------------------------------------- experiments --

test('🔴 AG-51: эксперимент требует и согласия, и объявленных границ', () => {
  const full = {
    experimentId: 'entry-10min-a-b',
    contractId: 'entry-10min',
    owner: 'Альберт',
    reviewAt: '2026-10-01',
    purpose: 'experimentation',
  };

  // Умолчание — «нет»: опыты на людях не начинаются сами.
  const noConsent = C.evaluateExperimentEligibility(null, full);
  assert.strictEqual(noConsent.eligible, false);
  assert.strictEqual(noConsent.reason, 'experiment_consent_missing');

  const consent = decide(null, { experimentation: true }).consent;
  assert.strictEqual(C.evaluateExperimentEligibility(consent, full).eligible, true);

  // Согласие есть — но границы обязаны быть названы заранее.
  for (const [field, reason] of [
    ['contractId', 'no_governance_contract'],
    ['owner', 'no_owner'],
    ['reviewAt', 'no_review_date'],
    ['experimentId', 'invalid_experiment'],
  ]) {
    const broken = Object.assign({}, full); broken[field] = '';
    const r = C.evaluateExperimentEligibility(consent, broken);
    assert.strictEqual(r.eligible, false, `без ${field} эксперимент невозможен`);
    assert.strictEqual(r.reason, reason);
  }
});

test('🔴 выключенная цель закрывает и эксперимент по этой цели', () => {
  const consent = decide(null, { experimentation: true }).consent;
  const engagementTest = {
    experimentId: 'streak-pressure', contractId: 'streak-pressure', owner: 'Альберт',
    reviewAt: '2026-10-01', purpose: 'engagement_optimization',
  };
  assert.strictEqual(C.evaluateExperimentEligibility(consent, engagementTest).eligible, true);

  // Человек выключил вовлечение — значит и опыт ради вовлечения на нём не ставят,
  // даже при общем согласии на эксперименты.
  const off = revoke(consent, ['engagement_optimization'], T1).consent;
  const r = C.evaluateExperimentEligibility(off, engagementTest);
  assert.strictEqual(r.eligible, false);
  assert.strictEqual(r.reason, 'purpose_consent_missing');
});

test('contractId связывает эксперимент с контрактом governance', () => {
  // Договор между двумя фундаментами: contractId — это id из
  // gamification-governance-v1, где живут pre-mortem, вред и пороги остановки.
  const governance = require('../public/gamification-governance-v1.js');
  const contract = governance.defineFeatureContract({
    id: 'entry-10min',
    humanOutcome: 'Человек делает настоящий шаг',
    motivationalBenefit: 'Снижает барьер входа',
    motivationalRisks: ['Может стать фермой валюты'],
    northStar: { id: 'real_step_done', metricClass: 'user_outcome', baseline: 0.4 },
    leadingMetrics: [{ id: 'entry_accepted', metricClass: 'product_health', baseline: 0.2 }],
    counterMetrics: [{ id: 'replaces_real_task', metricClass: 'user_outcome', direction: 'down_is_good', baseline: 0.05 }],
    harmMetrics: [{ id: 'regret', metricClass: 'user_outcome', baseline: 0.05 }],
    minimumSample: 10,
    thresholds: { regret: { review: 0.08, stop: 0.15 } },
    rollbackPlan: 'Выключить флагом',
    owner: 'Альберт',
    phase: 'scaffolding',
    reviewAt: '2026-10-01',
  });
  assert.strictEqual(governance.validateFeatureContract(contract).ok, true);

  const consent = decide(null, { experimentation: true }).consent;
  const r = C.evaluateExperimentEligibility(consent, {
    experimentId: 'entry-10min-a-b', contractId: contract.id,
    owner: contract.owner, reviewAt: contract.reviewAt, purpose: 'experimentation',
  });
  assert.strictEqual(r.eligible, true, 'валидный контракт даёт эксперименту границы');
});

// --------------------------------------------------------- explanation --

test('🔴 человек видит разницу между «я включил» и «включено за меня»', () => {
  const fresh = C.describeConsentForHuman(null);
  for (const p of C.PURPOSES) assert.ok(fresh.includes(p.label), `${p.label} назван`);
  assert.ok(fresh.includes('всегда включено'), 'необходимое честно помечено');
  assert.ok(fresh.includes('Почему без выбора:'), 'и объяснено');
  // Без этой строки opt-out и был бы тем самым нечитаемым соглашением.
  assert.ok(fresh.includes('включено по умолчанию — можно выключить'));
  assert.ok(fresh.includes('Вы ещё ничего не меняли'));
  assert.ok(fresh.includes('хранится 30 дн.'), 'срок хранения виден');
  assert.ok(fresh.includes('никогда не означает согласия на оптимизацию вовлечения'), 'AG-53 сказан вслух');

  const touched = C.describeConsentForHuman(decide(null, { experimentation: true }).consent);
  assert.ok(touched.includes('включено вами'), 'своё решение отличимо от умолчания');
  assert.ok(touched.includes(T0), 'когда человек это решил');
  assert.ok(C.describeConsentForHuman(revoke(null, ['safety']).consent).includes('выключено вами'));

  assert.strictEqual(C.describeConsentForHuman(null), fresh, 'описание детерминировано');
});

// ------------------------------------------------------------- purity --

test('🔴 модуль ничего не собирает и не хранит сам', () => {
  assert.deepStrictEqual(Object.keys(C).sort(), [
    'DEFAULT_ON_PURPOSES', 'ESSENTIAL_PURPOSES', 'MAX_PROPS', 'NEVER_IMPLIED',
    'PURPOSES', 'PURPOSE_IDS', 'SOURCES', 'VERSION',
    'applyConsentDecision', 'defineTelemetryPurposes', 'describeConsentForHuman',
    'evaluateEventPermission', 'evaluateExperimentEligibility', 'filterEventBatch', 'normalizeConsent',
  ]);
  const src = fs.readFileSync(path.join(ROOT, 'public', 'telemetry-consent-v1.js'), 'utf8');
  for (const forbidden of ['fetch(', 'localStorage', 'document.', 'Date.now(', 'require(', 'navigator']) {
    assert.strictEqual(src.includes(forbidden), false, `модуль не должен трогать «${forbidden}»`);
  }
});
