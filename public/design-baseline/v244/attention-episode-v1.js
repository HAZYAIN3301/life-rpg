/* Satoru Attention Episode v1 — журнал заходов и честная арифметика (§11, §10 «Минимальная
 * обратная связь уже в R1», §17).
 *
 * Эпизод — отдельный объект, а НЕ отметка в анти-привычке. Причина конкретная: при
 * сплющивании в «анти-привычка сорвана» теряется всё, ради чего эпизод и заводится —
 * намерение на входе, сколько раз продлевал, что именно предъявил на выходе и от чего
 * уходил. Анти-привычки могут ЧИТАТЬ эпизоды, но не владеют ими.
 *
 * Вторая задача модуля — закрыть лазейку «я по работе». Объявление цели не принимается
 * за доказанный факт: считаем записанные исходы и показываем человеку его же цифру
 * («поиск вдохновения: 4 из 5 заходов закончились вне плана»). Правила честности из §10:
 *   — молчание (`unknown`) НЕ входит в знаменатель: неотмеченный заход это не провал;
 *   — знаменатель показывается всегда, иначе «80%» врёт при пяти наблюдениях;
 *   — порог в пять записанных заходов за окно: раньше это шум, а не закономерность;
 *   — никакого ML и никакого автоматического ужесточения — модуль только СЧИТАЕТ.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ меняет политику. §8: политики никогда не меняются автоматически по статистике.
 *    Здесь нет ни одной функции, которая пишет в политику, — предложение формирует UI,
 *    решает человек;
 *  — НЕ наказывает и не считает XP/золото/серии;
 *  — НЕ превращает `unknown` в `escaped` (§17). Ни при каких условиях;
 *  — НЕ измеряет то, чего не знает: `returnLatency` считается только при известных
 *    обеих отметках времени, иначе честно `null` и UI пишет «не измерено»;
 *  — НЕ хранит, ЧТО человек смотрел: ни ссылок, ни запросов, ни истории (§14).
 *
 * Чистый модуль: только данные на входе. Все операции иммутабельны.
 */
(function exposeAttentionEpisode(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AttentionEpisodeV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAttentionEpisode() {
  'use strict';

  const VERSION = '1.0.0';

  const OUTCOMES = Object.freeze(['done', 'rested', 'escaped', 'unknown']);
  const SOURCES = Object.freeze(['manual', 'shortcut', 'ios', 'android']);

  // Порог и окно обратной связи (§10). Пять — не статистика, но уже и не случайность;
  // меньше пяти показывать нельзя, иначе один неудачный вечер выглядит как приговор.
  const MIN_RECORDED = 5;
  const WINDOW_DAYS = 14;

  const MAX_NOTE = 280;

  const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
  const ms = (s) => (isIso(s) ? Date.parse(s) : NaN);
  const clampInt = (v, lo, hi) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
  };

  function cleanEpisode(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 40) : null;
    const policyId = typeof raw.sourcePolicyId === 'string' && raw.sourcePolicyId.trim()
      ? raw.sourcePolicyId.trim().slice(0, 40) : null;
    const purpose = typeof raw.declaredPurpose === 'string' && raw.declaredPurpose.trim()
      ? raw.declaredPurpose.trim().slice(0, 24) : null;
    if (!id || !policyId || !purpose || !isIso(raw.startedAt)) return null;

    const out = {
      id,
      sourcePolicyId: policyId,
      declaredPurpose: purpose,
      startedAt: raw.startedAt,
      outcome: OUTCOMES.includes(raw.outcome) ? raw.outcome : 'unknown',
      extensionCount: clampInt(raw.extensionCount, 0, 10) ?? 0,
      emergencyUsed: raw.emergencyUsed === true,
      source: SOURCES.includes(raw.source) ? raw.source : 'manual',
    };
    if (isIso(raw.endedAt)) out.endedAt = raw.endedAt;
    // Платформа может не знать длительность (iOS Украина, §2) — тогда честный null,
    // а не догадка. Считать по timestamps можно только если оба известны.
    const planned = clampInt(raw.plannedMinutes, 0, 1440);
    if (planned !== null) out.plannedMinutes = planned;
    if (raw.actualMinutes === null) out.actualMinutes = null;
    else {
      const actual = clampInt(raw.actualMinutes, 0, 1440);
      if (actual !== null) out.actualMinutes = actual;
      else if (out.endedAt) {
        const d = ms(out.endedAt) - ms(out.startedAt);
        out.actualMinutes = Number.isNaN(d) ? null : Math.max(0, Math.round(d / 60000));
      } else out.actualMinutes = null;
    }
    if (typeof raw.timezone === 'string' && raw.timezone.trim()) out.timezone = raw.timezone.trim().slice(0, 40);
    if (typeof raw.expectedOutcome === 'string' && raw.expectedOutcome.trim()) out.expectedOutcome = raw.expectedOutcome.trim().slice(0, 120);
    if (typeof raw.topic === 'string' && raw.topic.trim()) out.topic = raw.topic.trim().slice(0, 80);
    if (typeof raw.avoidedThingId === 'string' && raw.avoidedThingId.trim()) out.avoidedThingId = raw.avoidedThingId.trim().slice(0, 40);
    if (typeof raw.returnActionId === 'string' && raw.returnActionId.trim()) out.returnActionId = raw.returnActionId.trim().slice(0, 40);
    if (isIso(raw.returnedAt)) out.returnedAt = raw.returnedAt;
    if (typeof raw.note === 'string' && raw.note.trim()) out.note = raw.note.trim().slice(0, MAX_NOTE);
    return out;
  }

  function emptyState() { return { version: 1, episodes: [] }; }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
    const seen = new Set();
    const episodes = [];
    for (const e of Array.isArray(raw.episodes) ? raw.episodes : []) {
      const c = cleanEpisode(e);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      episodes.push(c);
    }
    return { version: 1, episodes };
  }

  function byId(state, id) { return normalize(state).episodes.find((e) => e.id === String(id)) || null; }

  /**
   * Записать эпизод. Идемпотентно по `id` (§17: «retry не теряет эпизод и не создаёт
   * дубль») — повторная доставка с того же устройства или после офлайна перезаписывает
   * запись, а не плодит вторую.
   */
  function record(state, draft) {
    const s = normalize(state);
    const ep = cleanEpisode(draft);
    if (!ep) return { ok: false, error: 'invalid' };
    const at = s.episodes.findIndex((e) => e.id === ep.id);
    const episodes = at < 0 ? s.episodes.concat([ep]) : s.episodes.map((e, i) => (i === at ? ep : e));
    return { ok: true, state: { ...s, episodes } };
  }

  /** Человек имеет право исправить свою запись о себе (§11). */
  function amend(state, id, patch) {
    const s = normalize(state);
    const cur = byId(s, id);
    if (!cur) return { ok: false, error: 'not_found' };
    const ep = cleanEpisode({ ...cur, ...(patch && typeof patch === 'object' ? patch : {}), id: cur.id });
    if (!ep) return { ok: false, error: 'invalid' };
    return { ok: true, state: { ...s, episodes: s.episodes.map((e) => (e.id === ep.id ? ep : e)) } };
  }

  function remove(state, id) {
    const s = normalize(state);
    return { ...s, episodes: s.episodes.filter((e) => e.id !== String(id)) };
  }

  /** Задержка возврата — только при обеих известных отметках, иначе `null`. */
  function returnLatencyMin(episode) {
    if (!episode || !episode.endedAt || !episode.returnedAt) return null;
    const d = ms(episode.returnedAt) - ms(episode.endedAt);
    return Number.isNaN(d) || d < 0 ? null : Math.round(d / 60000);
  }

  function inWindow(episode, nowIso, days) {
    const from = ms(nowIso) - days * 86400000;
    const at = ms(episode.startedAt);
    return !Number.isNaN(at) && !Number.isNaN(from) && at >= from && at <= ms(nowIso);
  }

  function forPurpose(state, policyId, purpose, nowIso, days = WINDOW_DAYS) {
    return normalize(state).episodes.filter((e) => e.sourcePolicyId === String(policyId)
      && e.declaredPurpose === String(purpose) && inWindow(e, nowIso, days));
  }

  /**
   * Честная арифметика по одной цели.
   *
   * Возвращает и числитель, и знаменатель, и признак «данных ещё мало» — чтобы UI
   * физически не мог показать голый процент. `unknown` не входит в знаменатель:
   * неотмеченный заход не свидетельствует ни за, ни против.
   *
   * `enough:false` — не повод молчать вечно, а повод показать «пока мало данных»,
   * если UI считает нужным. Но предлагать сменить правило по трём наблюдениям нельзя.
   */
  function calibration(state, policyId, purpose, nowIso, days = WINDOW_DAYS) {
    const all = forPurpose(state, policyId, purpose, nowIso, days);
    const recorded = all.filter((e) => e.outcome !== 'unknown');
    const offPlan = recorded.filter((e) => e.outcome === 'escaped');
    return {
      purpose: String(purpose),
      windowDays: days,
      total: all.length,
      silent: all.length - recorded.length,
      recorded: recorded.length,          // знаменатель — всегда наружу
      offPlan: offPlan.length,            // числитель
      enough: recorded.length >= MIN_RECORDED,
      minRecorded: MIN_RECORDED,
      // Доля отдаётся ТОЛЬКО когда данных достаточно: иначе UI соблазнится показать
      // «100%» на одном наблюдении, и это будет правдой арифметически и ложью по сути.
      ratio: recorded.length >= MIN_RECORDED ? offPlan.length / recorded.length : null,
    };
  }

  /**
   * Цели, по которым набралось достаточно данных, чтобы честно предложить человеку
   * поменять правило. Модуль НЕ меняет ничего — только называет факт и оставляет
   * решение (§8). Сортировка по доле: сначала то, что расходится с планом чаще.
   */
  function suggestions(state, policyId, nowIso, days = WINDOW_DAYS) {
    const s = normalize(state);
    const purposes = [...new Set(s.episodes
      .filter((e) => e.sourcePolicyId === String(policyId))
      .map((e) => e.declaredPurpose))];
    return purposes
      .map((p) => calibration(s, policyId, p, nowIso, days))
      .filter((c) => c.enough && c.offPlan > 0)
      .sort((a, b) => b.ratio - a.ratio);
  }

  /**
   * Медиана длительности эпизодов с исходом `escaped` — метрика догфуда Альберта
   * (§17: цель не ноль срывов, а сокращение примерно с 24 часов до ≤3). Ноль срывов
   * как критерий воспроизводит ловушку «больше никогда», поэтому меряем длительность,
   * а не факт. Эпизоды без известной длительности в расчёт не идут.
   */
  function escapeLengthMedianMin(state, nowIso, days = WINDOW_DAYS) {
    const lens = normalize(state).episodes
      .filter((e) => e.outcome === 'escaped' && inWindow(e, nowIso, days))
      .map((e) => e.actualMinutes)
      .filter((m) => typeof m === 'number' && Number.isFinite(m))
      .sort((a, b) => a - b);
    if (!lens.length) return null;
    const mid = Math.floor(lens.length / 2);
    return lens.length % 2 ? lens[mid] : Math.round((lens[mid - 1] + lens[mid]) / 2);
  }

  return Object.freeze({
    VERSION, OUTCOMES, SOURCES, MIN_RECORDED, WINDOW_DAYS,
    emptyState, normalize, byId,
    record, amend, remove,
    returnLatencyMin, forPurpose, calibration, suggestions, escapeLengthMedianMin,
  });
});
