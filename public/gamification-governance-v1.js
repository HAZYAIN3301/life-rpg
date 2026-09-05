/* Satoru Gamification Governance v1 — AG-02 / AG-05 / AG-07 / AG-56.
 *
 * Зачем это существует. Аудит Actionable Gamification закрывает четыре дыры одним
 * предметом, потому что по отдельности они не чинятся:
 *
 *   AG-02 — слово «conversion» не различает «человеку стало лучше» и «продукту стало
 *           лучше». Без taxonomy аналитика начнёт награждать attention loops.
 *   AG-05 — motivational contract должен читаться человеком, а значит сначала должен
 *           существовать в машиночитаемом виде, который нельзя разойтись с runtime.
 *   AG-07 — у каждого поведенческого эксперимента обязаны быть pre-mortem, counter-
 *           metrics и выключатель, названные ДО раскатки, а не после жалобы.
 *   AG-56 — «use it for good» это не governance. Нужны benefit+harm таблица, пороги
 *           остановки и владелец, зафиксированные заранее.
 *
 * Чем этот модуль НЕ является. Он ничего не выключает, не штрафует, не трогает
 * экономику и не знает про начисления. Он считает и выносит суждение —
 * «продолжать / посмотреть / остановить / данных не хватает». Решение и рычаг
 * остаются у человека, потому что автоматический выключатель, встроенный в
 * счётчик, сам становится механикой, которую пришлось бы губернировать.
 *
 * Модуль намеренно без DOM, без сети, без часов: чистые детерминированные функции.
 * Один и тот же вход всегда даёт один и тот же выход, порядок наблюдений значения
 * не имеет, повторный вызов ничего не меняет.
 */
(function exposeGamificationGovernance(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GamificationGovernanceV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildGamificationGovernance() {
  'use strict';

  const VERSION = '1.0.0';

  // AG-02. Три класса, и они не взаимозаменяемы. North Star обязан быть
  // `user_outcome`: как только продуктовая или коммерческая метрика получает право
  // быть главной, «успех» начинает означать «человек дольше сидел в приложении».
  const METRIC_CLASSES = Object.freeze(['user_outcome', 'product_health', 'commercial']);

  // Роль отвечает на вопрос «зачем эта метрика в контракте», а не «что она меряет».
  const METRIC_ROLES = Object.freeze(['north_star', 'leading', 'counter', 'harm']);

  // Только доли и средние. Медианы и перцентили сюда не входят сознательно: они
  // требуют хранить сырой ряд, а этот модуль должен уметь работать на агрегатах,
  // в которых нет ничьих личных наблюдений.
  const METRIC_TYPES = Object.freeze(['proportion', 'mean']);

  const DIRECTIONS = Object.freeze(['up_is_good', 'down_is_good']);

  // AG-04. Фаза обязана быть названа, потому что одна и та же механика в Discovery
  // и в Endgame — это две разные механики с разной ценой.
  const PHASES = Object.freeze(['discovery', 'onboarding', 'scaffolding', 'endgame']);

  const STATUSES = Object.freeze(['insufficient_data', 'continue', 'review_required', 'stop_recommended']);

  // Значения, которые НИКОГДА не попадают в знаменатель. Это не оптимизация, а
  // главное правило честного измерения: «мы не знаем» — это не «не случилось».
  // Посчитать unknown за отрицательный исход значит систематически занижать вред.
  const UNKNOWN_TOKENS = Object.freeze(['unknown', 'n/a', 'na', '']);

  // ---------------------------------------------------------------- helpers --

  function text(value, max) {
    const s = String(value == null ? '' : value).trim();
    return max > 0 ? s.slice(0, max) : s;
  }
  function finiteOrNull(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function nonNegative(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }
  function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  }
  function list(value) {
    return Array.isArray(value) ? value : [];
  }
  function isIsoInstant(value) {
    const s = text(value, 40);
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(s)) return false;
    return Number.isFinite(Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s));
  }
  function instantMs(value) {
    const s = text(value, 40);
    return Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
  }
  function uniqueSorted(values) {
    return Object.freeze(Array.from(new Set(values)).sort());
  }
  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return Object.freeze(value);
  }

  // -------------------------------------------------------------- contracts --

  function normalizeMetric(raw, role) {
    const m = raw && typeof raw === 'object' ? raw : {};
    const declaredRole = METRIC_ROLES.indexOf(m.role) >= 0 ? m.role : null;
    const finalRole = METRIC_ROLES.indexOf(role) >= 0 ? role : (declaredRole || 'leading');
    return {
      id: text(m.id, 80),
      role: finalRole,
      label: text(m.label, 200),
      metricClass: METRIC_CLASSES.indexOf(m.metricClass) >= 0 ? m.metricClass : '',
      type: METRIC_TYPES.indexOf(m.type) >= 0 ? m.type : 'proportion',
      // Вред по умолчанию «чем меньше, тем лучше»: сожаления, ночные сессии и
      // обращения в поддержку не бывают хорошей новостью при росте.
      direction: DIRECTIONS.indexOf(m.direction) >= 0 ? m.direction : (finalRole === 'harm' ? 'down_is_good' : 'up_is_good'),
      // Базовая линия до раскатки. Без неё «улучшилось» невыразимо, поэтому
      // сравнение просто не делается — вместо выдуманного нуля.
      baseline: finiteOrNull(m.baseline),
      // Шум, который не считается изменением. По умолчанию 0: снижать
      // чувствительность к вреду должен человек осознанно, а не модуль молча.
      minEffect: nonNegative(m.minEffect, 0),
    };
  }

  function normalizeThresholds(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};
    for (const key of Object.keys(src).sort()) {
      const id = text(key, 80);
      if (!id) continue;
      const t = src[key] && typeof src[key] === 'object' ? src[key] : {};
      out[id] = { review: finiteOrNull(t.review), stop: finiteOrNull(t.stop) };
    }
    return out;
  }

  /**
   * Приводит вход к каноническому контракту. Не судит — только нормализует, чтобы
   * `validateFeatureContract` работал с одной формой, а не с пятью вариантами
   * написания одного и того же поля.
   */
  function defineFeatureContract(input) {
    const src = input && typeof input === 'object' ? input : {};
    const policy = src.denominatorPolicy && typeof src.denominatorPolicy === 'object' ? src.denominatorPolicy : {};
    const contract = {
      version: 1,
      id: text(src.id, 80),
      humanOutcome: text(src.humanOutcome, 400),
      motivationalBenefit: text(src.motivationalBenefit, 600),
      motivationalRisks: list(src.motivationalRisks).map((r) => text(r, 300)).filter(Boolean),
      northStar: normalizeMetric(src.northStar, 'north_star'),
      leadingMetrics: list(src.leadingMetrics).map((m) => normalizeMetric(m, 'leading')),
      counterMetrics: list(src.counterMetrics).map((m) => normalizeMetric(m, 'counter')),
      harmMetrics: list(src.harmMetrics).map((m) => normalizeMetric(m, 'harm')),
      denominatorPolicy: {
        basis: policy.basis === 'eligible' ? 'eligible' : 'exposed',
        // Три флага нормализуются в true всегда. Это не настройка: контракт, который
        // разрешает считать «неизвестно» за исход, перестаёт быть измерением.
        // Попытку выключить их ловит валидация и называет вслух.
        excludeUnknown: true,
        excludeNull: true,
        excludeConflicting: true,
        requestedExclusionOptOut: policy.excludeUnknown === false || policy.excludeNull === false || policy.excludeConflicting === false,
      },
      minimumSample: positiveInt(src.minimumSample, 0),
      thresholds: normalizeThresholds(src.thresholds),
      rollbackPlan: text(src.rollbackPlan, 600),
      owner: text(src.owner, 120),
      phase: PHASES.indexOf(src.phase) >= 0 ? src.phase : '',
      reviewAt: isIsoInstant(src.reviewAt) ? text(src.reviewAt, 40) : '',
    };
    return freezeDeep(contract);
  }

  function allMetrics(contract) {
    return [contract.northStar].concat(contract.leadingMetrics, contract.counterMetrics, contract.harmMetrics);
  }

  function metricErrors(metric, errors) {
    const where = `${metric.role}:${metric.id || '?'}`;
    if (!metric.id) errors.push(`metric_id_required:${metric.role}`);
    if (!metric.metricClass) errors.push(`metric_class_required:${where}`);
    if (METRIC_TYPES.indexOf(metric.type) < 0) errors.push(`metric_type_invalid:${where}`);
    if (DIRECTIONS.indexOf(metric.direction) < 0) errors.push(`metric_direction_invalid:${where}`);
  }

  /**
   * Возвращает `{ ok, errors }`, а не бросает: контракт чаще всего собирается в форме,
   * и человеку нужен весь список проблем сразу, а не первая из них.
   */
  function validateFeatureContract(contract) {
    const c = contract && contract.version === 1 && Object.isFrozen(contract) ? contract : defineFeatureContract(contract);
    const errors = [];

    if (!c.id) errors.push('id_required');
    if (!c.humanOutcome) errors.push('human_outcome_required');
    if (!c.motivationalBenefit) errors.push('motivational_benefit_required');
    // AG-07: pre-mortem обязателен. «Рисков не видим» — это не пустой список, это
    // незаполненное поле, и раскатывать на нём нельзя.
    if (!c.motivationalRisks.length) errors.push('motivational_risks_required');
    if (!c.rollbackPlan) errors.push('rollback_plan_required');
    if (!c.owner) errors.push('owner_required');
    if (!c.phase) errors.push('phase_required');
    if (!c.reviewAt) errors.push('review_at_required');
    if (!c.minimumSample) errors.push('minimum_sample_required');
    if (c.denominatorPolicy.requestedExclusionOptOut) errors.push('denominator_policy_must_exclude_unknown');

    metricErrors(c.northStar, errors);
    // AG-02. Главная метрика принадлежит человеку. Если North Star — product_health
    // или commercial, весь остальной контракт уже не имеет значения.
    if (c.northStar.metricClass && c.northStar.metricClass !== 'user_outcome') errors.push('north_star_must_be_user_outcome');

    if (!c.leadingMetrics.length) errors.push('leading_metrics_required');
    if (!c.counterMetrics.length) errors.push('counter_metrics_required');
    if (!c.harmMetrics.length) errors.push('harm_metrics_required');

    const seen = new Set();
    for (const metric of allMetrics(c)) {
      if (metric !== c.northStar) metricErrors(metric, errors);
      if (!metric.id) continue;
      if (seen.has(metric.id)) errors.push(`duplicate_metric_id:${metric.id}`);
      seen.add(metric.id);
    }

    // AG-07: у вреда обязан быть порог остановки, названный заранее. Порог, придуманный
    // после того, как цифру увидели, — это не порог.
    for (const metric of c.harmMetrics) {
      if (!metric.id) continue;
      const t = c.thresholds[metric.id];
      if (!t || t.stop == null) errors.push(`harm_stop_threshold_required:${metric.id}`);
    }
    for (const id of Object.keys(c.thresholds)) {
      if (!seen.has(id)) errors.push(`threshold_for_unknown_metric:${id}`);
    }

    return Object.freeze({ ok: errors.length === 0, errors: uniqueSorted(errors) });
  }

  // ------------------------------------------------------------ measurement --

  function classifyValue(metric, raw) {
    if (raw == null) return { known: false };
    if (typeof raw === 'boolean') return { known: true, amount: raw ? 1 : 0 };
    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (UNKNOWN_TOKENS.indexOf(s) >= 0) return { known: false };
      if (s === 'true' || s === 'yes') return { known: true, amount: 1 };
      if (s === 'false' || s === 'no') return { known: true, amount: 0 };
      const n = Number(s);
      if (!Number.isFinite(n)) return { known: false };
      if (metric.type === 'proportion' && n !== 0 && n !== 1) return { known: false };
      return { known: true, amount: n };
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return { known: false };
    if (metric.type === 'proportion' && n !== 0 && n !== 1) return { known: false };
    return { known: true, amount: n };
  }

  /**
   * Считает одну метрику по списку наблюдений.
   *
   * Наблюдение: `{ subjectId, metricId?, value }`. Наблюдение без `metricId` считается
   * относящимся к этой метрике — так удобно кормить одномерные выборки.
   *
   * Два наблюдения на один subjectId с разными известными значениями — конфликт.
   * Субъект целиком выбывает из знаменателя, а не «побеждает последний»: победа
   * последнего сделала бы результат зависимым от порядка массива, то есть от
   * случайности, а не от данных.
   */
  function calculateMetric(definition, observations) {
    const metric = definition && METRIC_ROLES.indexOf(definition.role) >= 0 && typeof definition.id === 'string'
      ? definition
      : normalizeMetric(definition, (definition && definition.role) || 'leading');

    const bySubject = new Map();
    let anonymous = 0;
    let observed = 0;
    let foreign = 0;
    let unknownRows = 0;

    for (const row of list(observations)) {
      const o = row && typeof row === 'object' ? row : {};
      const mid = text(o.metricId, 80);
      if (mid && metric.id && mid !== metric.id) { foreign += 1; continue; }
      observed += 1;
      const parsed = classifyValue(metric, o.value);
      if (!parsed.known) unknownRows += 1;
      // Субъект без id дедуплицировать не по чему — считаем его отдельным, но
      // помечаем факт, чтобы отчёт не выглядел строже, чем он есть.
      const key = text(o.subjectId, 120) || `__anon_${anonymous++}`;
      const prev = bySubject.get(key);
      if (!prev) {
        bySubject.set(key, { known: parsed.known, amount: parsed.known ? parsed.amount : 0, conflict: false });
        continue;
      }
      if (!parsed.known) continue;
      // Известное поверх неизвестного — это уточнение, а не конфликт: «не знаем»
      // не отменяет наблюдения.
      if (!prev.known) { prev.known = true; prev.amount = parsed.amount; continue; }
      if (prev.amount !== parsed.amount) prev.conflict = true;
    }

    let numerator = 0;
    let denominator = 0;
    let unknownSubjects = 0;
    let conflictingSubjects = 0;
    for (const entry of bySubject.values()) {
      if (entry.conflict) { conflictingSubjects += 1; continue; }
      if (!entry.known) { unknownSubjects += 1; continue; }
      denominator += 1;
      numerator += entry.amount;
    }

    const value = denominator > 0 ? numerator / denominator : null;
    const delta = value != null && metric.baseline != null ? value - metric.baseline : null;
    const good = metric.direction === 'up_is_good' ? 1 : -1;
    const improved = delta != null && delta * good > metric.minEffect;
    const worsened = delta != null && delta * good < -metric.minEffect;

    const reasonCodes = [];
    if (denominator === 0) reasonCodes.push('empty_denominator');
    if (unknownSubjects || unknownRows) reasonCodes.push('unknown_excluded_from_denominator');
    if (conflictingSubjects) reasonCodes.push('conflicting_observations_excluded');
    if (metric.baseline == null) reasonCodes.push('no_baseline');
    if (foreign) reasonCodes.push('foreign_observations_ignored');
    if (anonymous) reasonCodes.push('subjects_without_id');

    return freezeDeep({
      metricId: metric.id,
      role: metric.role,
      metricClass: metric.metricClass,
      type: metric.type,
      direction: metric.direction,
      numerator,
      denominator,
      // sampleSize === denominator намеренно: статистическое n — это те, про кого
      // известен исход, а не те, кого посмотрели. Общее число видно отдельно.
      sampleSize: denominator,
      observed,
      excludedUnknown: unknownSubjects,
      excludedConflicting: conflictingSubjects,
      excludedForeign: foreign,
      value,
      baseline: metric.baseline,
      delta,
      improved,
      worsened,
      reasonCodes: uniqueSorted(reasonCodes),
    });
  }

  // --------------------------------------------------------------- decision --

  function crossed(result, threshold) {
    if (threshold == null || result.value == null) return false;
    // На самой границе порог считается пройденным. Иначе «стоп при 5%» означал бы
    // «стоп при 5.000001%», и ровно 5% каждый раз проходило бы молча.
    return result.direction === 'down_is_good' ? result.value >= threshold : result.value <= threshold;
  }

  function governanceError(code, extra) {
    const error = new Error(code);
    error.code = code;
    if (extra) Object.assign(error, extra);
    return error;
  }

  /**
   * Выносит суждение по контракту и наблюдениям.
   *
   * `options.now` (ISO) необязателен и нужен только для проверки `reviewAt`. Часов
   * внутри нет сознательно: модуль, который сам смотрит на `Date.now()`, перестаёт
   * быть детерминированным, и его результат нельзя воспроизвести в отчёте.
   *
   * Порядок разбора (он же приоритет статусов):
   *   1. `stop_recommended` — вред перешёл порог остановки на достаточной выборке;
   *   2. `insufficient_data` — North Star или любой вред не набрал minimumSample;
   *   3. `review_required` — порог review, рост вреда при росте пользы, срок ревью;
   *   4. `continue`.
   *
   * Почему stop идёт ВЫШЕ insufficient_data: недобор выборки по одной метрике не
   * отменяет уже увиденный вред на достаточной выборке по другой. Обратный порядок
   * позволял бы прятать сработавший стоп за «мало данных» в соседней колонке.
   * Вред, перешедший порог на НЕдостаточной выборке, статус не меняет — но обязан
   * быть назван вслух и уезжает в reasonCodes.
   */
  function evaluateFeatureReview(contract, observations, options) {
    const normalized = contract && contract.version === 1 && Object.isFrozen(contract) ? contract : defineFeatureContract(contract);
    const check = validateFeatureContract(normalized);
    if (!check.ok) throw governanceError('invalid_contract', { errors: check.errors });

    const opts = options && typeof options === 'object' ? options : {};
    const rows = list(observations);
    const measure = (metric) => calculateMetric(metric, rows);

    const northStar = measure(normalized.northStar);
    const leading = normalized.leadingMetrics.map(measure);
    const counter = normalized.counterMetrics.map(measure);
    const harm = normalized.harmMetrics.map(measure);

    const reasonCodes = [];
    const min = normalized.minimumSample;

    let stop = false;
    let review = false;
    let insufficient = false;

    if (northStar.denominator < min) { insufficient = true; reasonCodes.push(`insufficient_sample:${northStar.metricId}`); }
    if (northStar.denominator === 0) reasonCodes.push(`empty_denominator:${northStar.metricId}`);

    for (const result of harm) {
      const t = normalized.thresholds[result.metricId] || { review: null, stop: null };
      const enough = result.denominator >= min;
      if (!enough) { insufficient = true; reasonCodes.push(`insufficient_sample:${result.metricId}`); }
      if (result.denominator === 0) reasonCodes.push(`empty_denominator:${result.metricId}`);
      if (crossed(result, t.stop)) {
        if (enough) { stop = true; reasonCodes.push(`harm_stop_threshold_crossed:${result.metricId}`); }
        else reasonCodes.push(`harm_stop_threshold_crossed_below_minimum_sample:${result.metricId}`);
      } else if (crossed(result, t.review)) {
        if (enough) { review = true; reasonCodes.push(`harm_review_threshold_crossed:${result.metricId}`); }
        else reasonCodes.push(`harm_review_threshold_crossed_below_minimum_sample:${result.metricId}`);
      }
    }

    for (const result of counter.concat(leading, [northStar])) {
      const t = normalized.thresholds[result.metricId];
      if (!t) continue;
      if (crossed(result, t.stop)) { stop = true; reasonCodes.push(`${result.role}_stop_threshold_crossed:${result.metricId}`); }
      else if (crossed(result, t.review)) { review = true; reasonCodes.push(`${result.role}_review_threshold_crossed:${result.metricId}`); }
    }

    // AG-56, главное правило книги в одну строку: механика умеет одновременно
    // поднять вовлечение и опустить самочувствие. Пока хоть одна метрика вреда
    // растёт, рост пользы не является поводом продолжать — он повод посмотреть.
    const benefitSide = [northStar].concat(leading);
    const benefitImproved = benefitSide.some((r) => r.improved);
    const harmWorsened = harm.some((r) => r.worsened);
    if (harmWorsened) reasonCodes.push('harm_metric_worsened');
    if (benefitImproved && harmWorsened) { review = true; reasonCodes.push('benefit_up_with_harm_up'); }

    if (opts.now && isIsoInstant(opts.now) && instantMs(opts.now) >= instantMs(normalized.reviewAt)) {
      review = true;
      reasonCodes.push('review_window_reached');
    }

    const status = stop ? 'stop_recommended'
      : insufficient ? 'insufficient_data'
        : review ? 'review_required'
          : 'continue';

    if (status === 'continue') reasonCodes.push('within_agreed_bounds');

    return freezeDeep({
      version: 1,
      status,
      reasonCodes: uniqueSorted(reasonCodes),
      contractId: normalized.id,
      owner: normalized.owner,
      phase: normalized.phase,
      reviewAt: normalized.reviewAt,
      humanOutcome: normalized.humanOutcome,
      rollbackPlan: normalized.rollbackPlan,
      minimumSample: min,
      evaluatedAt: opts.now && isIsoInstant(opts.now) ? text(opts.now, 40) : null,
      benefitImproved,
      harmWorsened,
      metrics: { northStar, leading, counter, harm },
    });
  }

  // ----------------------------------------------------------------- report --

  function fmt(value) {
    if (value == null) return '—';
    return String(Math.round(value * 10000) / 10000);
  }
  function metricLine(result) {
    const parts = [
      `  ${result.metricId} [${result.metricClass}/${result.role}]`,
      `значение ${fmt(result.value)} (${result.numerator}/${result.denominator}, n=${result.sampleSize})`,
      `база ${fmt(result.baseline)}`,
      `Δ ${fmt(result.delta)}${result.improved ? ' ↑лучше' : result.worsened ? ' ↓хуже' : ''}`,
    ];
    if (result.excludedUnknown || result.excludedConflicting) {
      parts.push(`вне знаменателя: unknown ${result.excludedUnknown}, конфликт ${result.excludedConflicting}`);
    }
    return parts.join(' · ');
  }

  /**
   * Человекочитаемая benefit+harm таблица под AG-56 и AG-05: без неё отчёт о
   * раскатке снова превращается в «тесты зелёные», где мотивационная цена не видна.
   * Строка детерминирована и годится в release report как есть.
   */
  function summarizeFeatureReview(result) {
    if (!result || result.version !== 1) return '';
    const lines = [
      `Контракт: ${result.contractId} · фаза ${result.phase} · владелец ${result.owner}`,
      `Человеческий исход: ${result.humanOutcome}`,
      `Статус: ${result.status}${result.reasonCodes.length ? ` (${result.reasonCodes.join(', ')})` : ''}`,
      `Минимальная выборка: ${result.minimumSample}`,
      'Польза:',
      metricLine(result.metrics.northStar),
    ];
    for (const r of result.metrics.leading) lines.push(metricLine(r));
    lines.push('Встречные:');
    for (const r of result.metrics.counter) lines.push(metricLine(r));
    lines.push('Вред:');
    for (const r of result.metrics.harm) lines.push(metricLine(r));
    lines.push(`Откат: ${result.rollbackPlan}`);
    lines.push(`Срок ревью: ${result.reviewAt}${result.evaluatedAt ? ` · оценено на ${result.evaluatedAt}` : ''}`);
    return lines.join('\n');
  }

  return {
    VERSION,
    METRIC_CLASSES,
    METRIC_ROLES,
    METRIC_TYPES,
    DIRECTIONS,
    PHASES,
    STATUSES,
    defineFeatureContract,
    validateFeatureContract,
    calculateMetric,
    evaluateFeatureReview,
    summarizeFeatureReview,
  };
});
