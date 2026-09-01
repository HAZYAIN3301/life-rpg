/* Satoru Secretary Experiment v1 — честный тридцатидневный dogfood (контракт §9).
 *
 * Это личный эксперимент владельца, а не публичный челлендж и не ещё одна система,
 * за которой надо следить. Он проверяет ровно одно: помогает ли утренний разговор
 * вернуться быстрее и с меньшим сожалением — при сопоставимых эпизодах.
 *
 * ⚠️ Главный риск этого модуля — не арифметика, а самообман. Тридцать дней замеров
 * очень легко превратить в прибор, который всегда показывает «работает»: достаточно
 * посчитать молчание успехом, спрятать размер выборки или сравнить пять хороших дней
 * с четырнадцатью какими попало. Поэтому здесь:
 *
 *  — `unknown` НИКОГДА не входит в знаменатель, но всегда виден рядом с числом.
 *    Метрика «80% границ удержано» из четырёх ответов за тридцать дней — это ложь,
 *    и единственная защита от неё — показывать `known` всегда;
 *  — задержка возврата считается только там, где известны ОБА времени. Иначе статус
 *    `not_measured`, а не ноль и не среднее по остальным;
 *  — `offered` = `null` до тех пор, пока показы не считает сервер. Один рендер
 *    клиента не является показом, и выдумывать это число нельзя — иначе доля
 *    принятых предложений станет функцией от того, сколько раз открыли вкладку;
 *  — пропуск дня не рвёт серию, не создаёт задолженности и не требует компенсации.
 *    Здесь вообще нет серии: она превратила бы замер в ещё одну обязанность.
 *
 * ⚠️ Чего модуль не хранит: ни XP, ни золота, ни редкости, ни огня, ни награды за
 * заполнение. Награда за честный ответ немедленно портит честность ответа.
 *
 * ⚠️ Приватность: `note` — до 280 символов, приватна и остаётся у владельца. URL,
 * названия роликов и то, что человек смотрел, в состояние эксперимента не попадают
 * (§10). Доменные объекты не копируются: цель, ритм и заметки живут у своих
 * владельцев, сюда приходят только id, а эпизоды — проекцией на время расчёта.
 *
 * Чистый модуль: только данные на входе, время приходит параметром.
 */
(function exposeSecretaryExperiment(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryExperimentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryExperiment() {
  'use strict';

  const VERSION = '1.0.0';

  const PROTOCOL = 'morning-recovery-v1';
  const DURATION_DAYS = 30;          // обе границы включены: день 1 .. день 30
  const BASELINE_WINDOW_DAYS = 14;
  const MAX_NOTE = 280;
  const MAX_EXPERIMENTS = 24;
  // Ниже этого числа известных ответов вывод не делается вовсе — «пока калибруемся».
  // Пять — не научный порог, а граница, за которой человек перестаёт принимать шум
  // за сигнал про самого себя.
  const MIN_KNOWN = 5;
  const REVIEW_DAYS = Object.freeze([7, 14, 21, 30]);

  const STATUSES = Object.freeze(['draft', 'active', 'completed', 'stopped']);

  // Закрытые словари ответов. `unknown` — законный и частый исход: человек закрыл
  // лист, не ответив, и это НЕ отрицательный результат.
  const BOUNDARY = Object.freeze(['yes', 'no', 'unknown']);
  const ENJOYMENT = Object.freeze(['yes', 'no', 'unknown']);
  const AFTER_EFFECT = Object.freeze(['better', 'same', 'worse', 'unknown']);
  const REGRET = Object.freeze(['none', 'some', 'unknown']);
  const OFFER_OUTCOME = Object.freeze(['accepted', 'dismissed', 'unknown']);

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Календарная проверка дня, а не только формы строки. Дефект №2 контракта:
   * `31.02` проходит регулярное выражение и потом роняет арифметику дат.
   */
  function isDay(s) {
    if (typeof s !== 'string' || !ISO_DAY.test(s)) return false;
    const t = Date.parse(s + 'T00:00:00Z');
    if (isNaN(t)) return false;
    return new Date(t).toISOString().slice(0, 10) === s;
  }
  function isIso(s) { return typeof s === 'string' && !isNaN(Date.parse(s)); }
  function dayShift(day, delta) {
    if (!isDay(day)) return null;
    return new Date(Date.parse(day + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0, 10);
  }
  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return null;
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
  }
  function posInt(v) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function pick(list, v, fallback) { return list.indexOf(v) >= 0 ? v : fallback; }
  function id40(v) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null; }

  // Без `\b`: в JS граница слова определена только для ASCII и на кириллице молча
  // не срабатывает — в проекте на этом уже дважды ловили баг. Здесь она не нужна:
  // токен со ссылкой вычищается целиком, и переусердствовать тут безопаснее,
  // чем недоглядеть.
  const URLISH = /(https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|ru|de|io|tv|me)\S*)/gi;

  /**
   * Заметка человека. Обрезается по длине и вычищается от ссылок: содержимое
   * просмотренного в состояние эксперимента не попадает (§10). Это правило
   * продуктовое — модуль лишь делает случайное нарушение невозможным.
   */
  function cleanNote(v) {
    if (typeof v !== 'string') return '';
    return v.replace(URLISH, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
  }

  function cleanProfile(raw) {
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const hhmm = (v) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
    return {
      sleepTarget: hhmm(p.sleepTarget),
      wakeTarget: hhmm(p.wakeTarget),
      lateReturnSleepTarget: hhmm(p.lateReturnSleepTarget),
      coreMax: posInt(p.coreMax) === null ? 1 : Math.min(3, posInt(p.coreMax)),
      supportMax: posInt(p.supportMax) === null ? 2 : Math.min(5, posInt(p.supportMax)),
      restMenuRevision: posInt(p.restMenuRevision) === null ? 0 : posInt(p.restMenuRevision),
    };
  }

  function cleanRefs(raw) {
    const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    // Только ссылки. Удалённый объект оставляет null, а не оживает копией здесь.
    return { goalId: id40(r.goalId), rhythmId: id40(r.rhythmId), notesCollectionId: id40(r.notesCollectionId) };
  }

  function cleanCheckIn(raw) {
    const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      seq: posInt(c.seq) === null ? 1 : posInt(c.seq),
      sourceOfferId: id40(c.sourceOfferId),
      recoveryPlanId: id40(c.recoveryPlanId),
      offerOutcome: pick(OFFER_OUTCOME, c.offerOutcome, 'unknown'),
      boundaryHeld: pick(BOUNDARY, c.boundaryHeld, 'unknown'),
      enjoyment: pick(ENJOYMENT, c.enjoyment, 'unknown'),
      afterEffect: pick(AFTER_EFFECT, c.afterEffect, 'unknown'),
      regret: pick(REGRET, c.regret, 'unknown'),
      note: cleanNote(c.note),
    };
  }

  function cleanExperiment(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = id40(raw.id);
    const startedOn = isDay(raw.startedOn) ? raw.startedOn : null;
    if (!id || !startedOn) return null;
    const endsOn = isDay(raw.endsOn) ? raw.endsOn : dayShift(startedOn, DURATION_DAYS - 1);
    const checkIns = {};
    const rawCheckIns = raw.checkIns && typeof raw.checkIns === 'object' && !Array.isArray(raw.checkIns) ? raw.checkIns : {};
    for (const day of Object.keys(rawCheckIns)) {
      if (!isDay(day)) continue;
      const n = daysBetween(startedOn, day);
      if (n === null || n < 0 || n >= DURATION_DAYS) continue;   // окно 1..30 включительно
      checkIns[day] = cleanCheckIn(rawCheckIns[day]);
    }
    return {
      version: 1,
      id,
      status: pick(STATUSES, raw.status, 'draft'),
      protocolVersion: typeof raw.protocolVersion === 'string' && raw.protocolVersion ? raw.protocolVersion.slice(0, 40) : PROTOCOL,
      startedOn,
      endsOn,
      baselineWindowDays: posInt(raw.baselineWindowDays) === null ? BASELINE_WINDOW_DAYS : posInt(raw.baselineWindowDays),
      profileSnapshot: cleanProfile(raw.profileSnapshot),
      refs: cleanRefs(raw.refs),
      checkIns,
      seq: posInt(raw.seq) === null ? 0 : posInt(raw.seq),
      closedAt: isIso(raw.closedAt) ? raw.closedAt : null,
    };
  }

  function emptyState() { return { version: 1, revision: 0, experiments: [] }; }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
    const seen = new Set();
    const experiments = [];
    for (const e of Array.isArray(raw.experiments) ? raw.experiments : []) {
      const c = cleanExperiment(e);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      experiments.push(c);
    }
    const revision = posInt(raw.revision) === null ? 0 : posInt(raw.revision);
    return { version: 1, revision, experiments: experiments.slice(0, MAX_EXPERIMENTS) };
  }

  /**
   * Строгая проверка сохранённого файла. В отличие от `normalize`, возвращает `null`
   * на мусоре вместо пустого состояния.
   *
   * ⚠️ Разница принципиальная и уже стоила проекту данных в других местах: пустое
   * состояние читается как «эксперимента не было» и разрешает записать поверх
   * настоящих тридцати дней. Повреждённый файл обязан быть ошибкой, а не тишиной.
   */
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (Object.prototype.hasOwnProperty.call(raw, 'experiments') && !Array.isArray(raw.experiments)) return null;
    if (Object.prototype.hasOwnProperty.call(raw, 'revision') && posInt(raw.revision) === null) return null;
    // Записи, которые не пережили разбор, — тоже повод отказаться, а не потерять их.
    const kept = normalize(raw);
    const rawCount = Array.isArray(raw.experiments) ? raw.experiments.length : 0;
    if (rawCount && kept.experiments.length !== Math.min(rawCount, MAX_EXPERIMENTS)) return null;
    return kept;
  }

  function get(state, experimentId) {
    const s = normalize(state);
    const key = id40(experimentId);
    return key ? s.experiments.find((e) => e.id === key) || null : null;
  }

  function activeOf(state) {
    return normalize(state).experiments.find((e) => e.status === 'active') || null;
  }

  function replace(state, next) {
    const s = normalize(state);
    return { version: 1, revision: s.revision, experiments: s.experiments.map((e) => (e.id === next.id ? next : e)) };
  }

  /** Отметить, что файл изменился. Ревизия защищает store целиком, `seq` — запись. */
  function bumpRevision(state) {
    const s = normalize(state);
    return Object.assign({}, s, { revision: s.revision + 1 });
  }

  /**
   * Единая проверка порядка операций для всех изменений.
   *
   * Смысл не в защите от гонок ради гонок: два устройства и один retry — обычная
   * жизнь этого приложения, и запись «стало хуже» не должна затираться пришедшим
   * позже эхом старого запроса. Повтор того же намерения проходит спокойно
   * (`applied: false`, а не ошибка), устаревший — отклоняется вслух.
   */
  function seqGate(exp, seq) {
    const n = posInt(seq);
    if (n === null) return { ok: false, error: 'bad_seq' };
    if (n < exp.seq) return { ok: false, error: 'stale_seq' };
    return { ok: true, seq: n, repeat: n === exp.seq };
  }

  /**
   * Черновик эксперимента. Отдельный шаг, потому что человек должен увидеть срок,
   * приватность и список измеряемого ДО старта, а не обнаружить их на третий день.
   */
  function create(config) {
    const c = config && typeof config === 'object' ? config : {};
    const startedOn = isDay(c.startedOn) ? c.startedOn : null;
    if (!startedOn) return { ok: false, error: 'bad_start' };
    if (!id40(c.id)) return { ok: false, error: 'bad_id' };
    const exp = cleanExperiment({
      id: c.id,
      status: pick(STATUSES, c.status, 'draft'),
      protocolVersion: PROTOCOL,
      startedOn,
      endsOn: dayShift(startedOn, DURATION_DAYS - 1),
      baselineWindowDays: c.baselineWindowDays,
      profileSnapshot: c.profileSnapshot,
      refs: c.refs,
      checkIns: {},
      seq: 1,
    });
    return { ok: true, experiment: exp };
  }

  function open(state, config) {
    const s = normalize(state);
    const made = create(config);
    if (!made.ok) return made;
    if (s.experiments.some((e) => e.id === made.experiment.id)) return { ok: false, error: 'duplicate' };
    if (s.experiments.length >= MAX_EXPERIMENTS) return { ok: false, error: 'limit' };
    return { ok: true, state: { version: 1, revision: s.revision, experiments: s.experiments.concat([made.experiment]) }, experiment: made.experiment };
  }

  /** Номер дня эксперимента: 1..30, либо null вне окна. */
  function dayNumber(exp, day) {
    if (!exp || !isDay(day)) return null;
    const n = daysBetween(exp.startedOn, day);
    if (n === null || n < 0 || n >= DURATION_DAYS) return null;
    return n + 1;
  }

  function recordCheckIn(state, experimentId, day, checkIn, seq) {
    const exp = get(state, experimentId);
    if (!exp) return { ok: false, error: 'not_found' };
    if (exp.status !== 'active') return { ok: false, error: 'not_active' };
    const n = dayNumber(exp, day);
    if (n === null) return { ok: false, error: 'out_of_window' };
    const gate = seqGate(exp, seq);
    if (!gate.ok) return gate;

    const next = cleanCheckIn(Object.assign({}, checkIn, { seq: n }));
    const prev = exp.checkIns[day] || null;
    if (gate.repeat && prev && JSON.stringify(prev) === JSON.stringify(next)) {
      // Тот же ответ тем же порядковым номером — обычный retry, а не конфликт.
      return { ok: true, state: normalize(state), applied: false, reason: 'repeat' };
    }
    if (gate.repeat) return { ok: false, error: 'stale_seq' };

    const updated = Object.assign({}, exp, {
      seq: gate.seq,
      checkIns: Object.assign({}, exp.checkIns, { [day]: next }),
    });
    return { ok: true, state: replace(state, updated), applied: true, checkIn: next };
  }

  function close(state, experimentId, now, seq, status) {
    const exp = get(state, experimentId);
    if (!exp) return { ok: false, error: 'not_found' };
    if (!isIso(now)) return { ok: false, error: 'bad_now' };
    const gate = seqGate(exp, seq);
    if (!gate.ok) return gate;
    if (exp.status === status) return { ok: true, state: normalize(state), applied: false, reason: 'repeat' };
    if (exp.status !== 'active' && exp.status !== 'draft') return { ok: false, error: 'already_closed' };
    const updated = Object.assign({}, exp, { status, seq: gate.seq, closedAt: now });
    return { ok: true, state: replace(state, updated), applied: true };
  }

  function complete(state, experimentId, now, seq) { return close(state, experimentId, now, seq, 'completed'); }

  /**
   * Остановка. Без штрафа, без подтверждения «провала» и без удаления данных:
   * возможность выйти — условие того, что человек вообще начнёт. Эксперимент,
   * который нельзя прекратить, — это не эксперимент, а обязательство.
   */
  function stop(state, experimentId, now, seq) { return close(state, experimentId, now, seq, 'stopped'); }

  function activate(state, experimentId, seq) {
    const exp = get(state, experimentId);
    if (!exp) return { ok: false, error: 'not_found' };
    if (exp.status === 'active') return { ok: true, state: normalize(state), applied: false, reason: 'repeat' };
    if (exp.status !== 'draft') return { ok: false, error: 'already_closed' };
    const gate = seqGate(exp, seq);
    if (!gate.ok) return gate;
    return { ok: true, state: replace(state, Object.assign({}, exp, { status: 'active', seq: gate.seq })), applied: true };
  }

  /** Веха обзора, если сегодня ровно она. Иначе null — обзор не навязывается чаще. */
  function reviewDue(state, experimentId, today) {
    const exp = get(state, experimentId);
    if (!exp || exp.status !== 'active') return null;
    const n = dayNumber(exp, today);
    return n !== null && REVIEW_DAYS.indexOf(n) >= 0 ? n : null;
  }

  function median(list) {
    if (!list.length) return null;
    const s = list.slice().sort((a, b) => a - b);
    const mid = s.length >> 1;
    const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    return Math.round(v * 10) / 10;
  }

  /**
   * Задержки возврата из проекции эпизодов внимания.
   *
   * Определение ровно одно: сколько прошло от КОНЦА эпизода (`endedAt`) до момента,
   * когда человек вернулся к тому, что делал (`returnedAt`). Не длина самого
   * эпизода — вопрос эксперимента не «сколько залипал», а «насколько быстро
   * возвращался». Смешивать два определения в одной медиане нельзя: получилось бы
   * число, которое улучшается от того, что эпизоды стали короче, и выдавалось бы за
   * улучшение возврата.
   *
   * Считается ТОЛЬКО там, где известны оба времени. Эпизод без `returnedAt` — это не
   * «вернулся мгновенно» и не «не вернулся», это отсутствие замера.
   */
  function latencies(episodes) {
    const out = [];
    for (const e of Array.isArray(episodes) ? episodes : []) {
      if (!e || typeof e !== 'object') continue;
      if (!isIso(e.endedAt) || !isIso(e.returnedAt)) continue;
      const min = (Date.parse(e.returnedAt) - Date.parse(e.endedAt)) / 60000;
      if (!Number.isFinite(min) || min < 0) continue;
      out.push(min);
    }
    return out;
  }

  function tally(values, keys) {
    const out = {};
    for (const k of keys) out[k] = 0;
    let known = 0;
    for (const v of values) {
      if (v === 'unknown' || !Object.prototype.hasOwnProperty.call(out, v)) continue;
      out[v] += 1;
      known += 1;
    }
    out.known = known;
    return out;
  }

  /**
   * Сводка эксперимента.
   *
   * @param projections — то, что принадлежит другим владельцам и сюда не копируется:
   *   { today, episodes: [{endedAt, returnedAt}], baselineEpisodes: [...] }
   *
   * ⚠️ `offers.offered` намеренно `null`. Пока показы не считает сервер, это число
   * неизвестно, а подставить сюда количество рендеров клиента значило бы сделать
   * «долю принятых» функцией от того, сколько раз открыли вкладку. Считаются только
   * явные решения — `decided`.
   */
  function metrics(state, experimentId, projections) {
    const exp = get(state, experimentId);
    if (!exp) return null;
    const p = projections && typeof projections === 'object' ? projections : {};
    const today = isDay(p.today) ? p.today : null;

    const elapsed = today ? Math.max(0, Math.min(DURATION_DAYS, (daysBetween(exp.startedOn, today) || 0) + 1)) : 0;
    const days = Object.keys(exp.checkIns).sort();
    const rows = days.map((d) => exp.checkIns[d]);

    // Известным считается день, где человек ответил хоть на что-то по существу.
    // Открытый и закрытый молча лист остаётся неизвестным, а не отрицательным.
    const knownRows = rows.filter((c) => c.boundaryHeld !== 'unknown' || c.afterEffect !== 'unknown' || c.regret !== 'unknown');
    const eligibleDays = elapsed;
    const knownDays = knownRows.length;

    const mine = latencies(p.episodes);
    const base = latencies(p.baselineEpisodes);
    const status = mine.length === 0 ? 'not_measured' : (base.length === 0 ? 'no_baseline' : 'measured');

    const outcomes = rows.map((c) => c.offerOutcome);
    const accepted = outcomes.filter((v) => v === 'accepted').length;
    const dismissed = outcomes.filter((v) => v === 'dismissed').length;

    return {
      id: exp.id,
      status: exp.status,
      protocolVersion: exp.protocolVersion,
      startedOn: exp.startedOn,
      endsOn: exp.endsOn,
      elapsedDays: elapsed,
      eligibleDays,
      knownDays,
      unknownDays: Math.max(0, eligibleDays - knownDays),
      // Ниже порога вывод не делается вовсе: «пока калибруемся» честнее, чем
      // «работает» на трёх ответах.
      calibrating: knownDays < MIN_KNOWN,
      offers: { offered: null, accepted, dismissed, decided: accepted + dismissed },
      returnLatency: {
        n: mine.length,
        medianMin: median(mine),
        baselineN: base.length,
        baselineMedianMin: median(base),
        status,
      },
      boundaryHeld: tally(rows.map((c) => c.boundaryHeld), ['yes', 'no']),
      afterEffect: tally(rows.map((c) => c.afterEffect), ['better', 'same', 'worse']),
      regret: tally(rows.map((c) => c.regret), ['none', 'some']),
    };
  }

  return Object.freeze({
    VERSION, PROTOCOL, DURATION_DAYS, BASELINE_WINDOW_DAYS, MAX_NOTE, MAX_EXPERIMENTS,
    MIN_KNOWN, REVIEW_DAYS, STATUSES, BOUNDARY, ENJOYMENT, AFTER_EFFECT, REGRET, OFFER_OUTCOME,
    emptyState, normalize, sanitizeState, bumpRevision, create, open, activate, get, activeOf,
    dayNumber, recordCheckIn, complete, stop, reviewDue, metrics,
  });
});
