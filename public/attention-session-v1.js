/* Satoru Attention Session v1 — живое окно внимания (DISCIPLINE-ESCAPE-PLAN §10).
 *
 * Один заход: человек назвал цель, получил границу, вышел (или его унесло). Модуль
 * держит ровно ЭТО и ничего больше — история и статистика живут в `attention-episode-v1`.
 *
 * Почему сессия отдельно от политики: политику человек меняет когда угодно, а уже
 * начатое окно менять задним числом нельзя. Поэтому при старте режим, лимит и правила
 * продления **снимаются снимком** в саму сессию. Иначе смена политики посреди захода
 * либо задним числом ужесточила бы уже идущее окно, либо (хуже) открыла бы выход из
 * control, который человек себе закрыл в ресурсном состоянии.
 *
 * Гейт §17 против гонок: «продление и emergency budget нельзя удвоить refresh/retry/
 * multi-device race». Отсюда `seq` во всех мутирующих операциях — вызывающий передаёт,
 * сколько продлений он уже видел, и повтор того же запроса отклоняется как `stale`,
 * а не применяется второй раз. Это дешевле блокировок и переживает офлайн-ретраи.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ наказывает. Ни XP, ни золота, ни серии, ни «долга». Унесло в ленту — это
 *    строка данных, а не проступок (§6). Подключить штраф физически некуда;
 *  — НЕ блокирует приложение сам: `control` он только фиксирует, исполняет платформа;
 *  — НЕ решает, что человек «на самом деле» делал. Исход называет человек, а молчание
 *    остаётся `unknown` и никогда не превращается в `escaped` (§17);
 *  — НЕ требует унизительных доказательств для аварийного выхода (§10);
 *  — НЕ пишет, что именно смотрели: ни ссылок, ни запросов (§14).
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 * Все операции иммутабельны.
 */
(function exposeAttentionSession(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AttentionSessionV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAttentionSession() {
  'use strict';

  const VERSION = '1.0.0';
  const MINUTE = 60000;

  // Исходы (§11). `unknown` — полноправный исход, а не отсутствие данных: человек мог
  // просто не вернуться к экрану, и это не повод объявлять срыв.
  const OUTCOMES = Object.freeze({
    done:     'done',      // сделал заявленное
    rested:   'rested',    // осознанно отдыхал
    escaped:  'escaped',   // унесло в ленту — называет сам человек
    unknown:  'unknown',   // не отмечено
  });

  const MAX_REASON = 200;
  const MAX_TOPIC = 80;

  const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));
  const ms = (s) => (isIso(s) ? Date.parse(s) : NaN);
  const clampInt = (v, lo, hi) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
  };

  function cleanExtension(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!isIso(raw.at)) return null;
    const minutes = clampInt(raw.minutes, 1, 60);
    if (minutes === null) return null;
    return { at: raw.at, minutes };
  }

  function cleanSession(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 40) : null;
    const policyId = typeof raw.policyId === 'string' && raw.policyId.trim() ? raw.policyId.trim().slice(0, 40) : null;
    const purpose = typeof raw.purpose === 'string' && raw.purpose.trim() ? raw.purpose.trim().slice(0, 24) : null;
    if (!id || !policyId || !purpose || !isIso(raw.startedAt)) return null;
    const planned = clampInt(raw.plannedMinutes, 1, 240);
    if (planned === null) return null;

    const out = {
      id, policyId, purpose,
      startedAt: raw.startedAt,
      plannedMinutes: planned,
      // Снимок правил на момент старта — см. шапку.
      mode: raw.mode === 'trust' || raw.mode === 'control' ? raw.mode : 'adaptive',
      extensionsAllowed: clampInt(raw.extensionsAllowed, 0, 3) ?? 0,
      extensionMinutes: clampInt(raw.extensionMinutes, 1, 60) ?? 5,
      extensions: [],
    };
    for (const e of Array.isArray(raw.extensions) ? raw.extensions : []) {
      const c = cleanExtension(e);
      if (c && out.extensions.length < out.extensionsAllowed) out.extensions.push(c);
    }
    if (typeof raw.expectedOutcome === 'string' && raw.expectedOutcome.trim()) {
      out.expectedOutcome = raw.expectedOutcome.trim().slice(0, 120);
    }
    if (typeof raw.topic === 'string' && raw.topic.trim()) out.topic = raw.topic.trim().slice(0, MAX_TOPIC);
    if (raw.emergency && typeof raw.emergency === 'object' && isIso(raw.emergency.at)) {
      const reason = typeof raw.emergency.reason === 'string' ? raw.emergency.reason.trim().slice(0, MAX_REASON) : '';
      out.emergency = reason ? { at: raw.emergency.at, reason } : { at: raw.emergency.at };
    }
    if (isIso(raw.endedAt)) out.endedAt = raw.endedAt;
    if (Object.prototype.hasOwnProperty.call(OUTCOMES, raw.outcome)) out.outcome = raw.outcome;
    // Закрытая сессия обязана иметь оба поля: одно без другого — битая запись.
    if (out.endedAt && !out.outcome) out.outcome = OUTCOMES.unknown;
    if (out.outcome && !out.endedAt) delete out.outcome;
    return out;
  }

  function emptyState() { return { version: 1, sessions: [] }; }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
    const seen = new Set();
    const sessions = [];
    for (const s of Array.isArray(raw.sessions) ? raw.sessions : []) {
      const c = cleanSession(s);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      sessions.push(c);
    }
    return { version: 1, sessions };
  }

  function byId(state, id) { return normalize(state).sessions.find((s) => s.id === String(id)) || null; }

  /** Открытая сессия — не более одной. Два окна одновременно это уже не граница. */
  function active(state) { return normalize(state).sessions.find((s) => !s.endedAt) || null; }

  function grantedMinutes(session) {
    if (!session) return 0;
    return session.plannedMinutes + session.extensions.reduce((sum, e) => sum + e.minutes, 0);
  }

  function deadlineAt(session) {
    if (!session) return null;
    const start = ms(session.startedAt);
    if (Number.isNaN(start)) return null;
    return new Date(start + grantedMinutes(session) * MINUTE).toISOString();
  }

  function remainingMs(session, now) {
    const end = deadlineAt(session);
    if (!end || !isIso(now)) return null;
    return ms(end) - ms(now);
  }

  function isOver(session, now) {
    const left = remainingMs(session, now);
    return left === null ? false : left <= 0;
  }

  function canExtend(session) {
    if (!session || session.endedAt) return false;
    return session.extensions.length < session.extensionsAllowed;
  }

  /**
   * Открыть окно. Вызывающий обязан сначала спросить `AttentionPolicyV1.canOpen` —
   * модуль сессий не дублирует продуктовые правила политики, он про механику окна.
   */
  function start(state, draft, now) {
    const s = normalize(state);
    if (active(s)) return { ok: false, error: 'already_open' };
    const session = cleanSession({ ...draft, startedAt: isIso(now) ? now : draft.startedAt });
    if (!session) return { ok: false, error: 'invalid' };
    if (s.sessions.some((x) => x.id === session.id)) return { ok: false, error: 'duplicate' };
    return { ok: true, state: { ...s, sessions: s.sessions.concat([session]) }, session };
  }

  /**
   * Продлить один раз. `seq` — сколько продлений вызывающий уже видел; несовпадение
   * означает повтор или гонку и отклоняется, а не применяется вторично (§17).
   */
  function extend(state, id, opts, now) {
    const s = normalize(state);
    const session = byId(s, id);
    if (!session || session.endedAt) return { ok: false, error: 'not_open' };
    if (!canExtend(session)) return { ok: false, error: 'no_extensions_left' };
    if (!isIso(now)) return { ok: false, error: 'invalid' };
    const seq = opts && Object.prototype.hasOwnProperty.call(opts, 'seq') ? Math.floor(Number(opts.seq)) : null;
    if (seq === null || seq !== session.extensions.length) return { ok: false, error: 'stale' };
    const minutes = clampInt(opts.minutes, 1, 60) ?? session.extensionMinutes;
    const next = { ...session, extensions: session.extensions.concat([{ at: now, minutes }]) };
    return { ok: true, state: { ...s, sessions: s.sessions.map((x) => (x.id === next.id ? next : x)) }, session: next };
  }

  /**
   * Аварийный выход из control.
   *
   * Бюджет считается ПО ПОЛИТИКЕ за окно, а не по сессии: иначе «один пропуск» стал бы
   * одним на каждый заход, то есть кнопкой «продолжить» (§10). Задержку в 90 секунд
   * модуль не отсчитывает — это дело UI; здесь только проверка, что она подтверждена,
   * чтобы обойти её нельзя было прямым вызовом.
   */
  function emergencyUsedSince(state, policyId, sinceIso) {
    const s = normalize(state);
    const from = ms(sinceIso);
    return s.sessions.filter((x) => x.policyId === String(policyId) && x.emergency
      && (Number.isNaN(from) || ms(x.emergency.at) >= from)).length;
  }

  function useEmergency(state, id, opts, now, emergencyRule) {
    const s = normalize(state);
    const session = byId(s, id);
    if (!session || session.endedAt) return { ok: false, error: 'not_open' };
    if (session.emergency) return { ok: false, error: 'already_used' };
    if (!isIso(now)) return { ok: false, error: 'invalid' };
    if (!emergencyRule || emergencyRule.passes <= 0) return { ok: false, error: 'not_allowed' };
    // Задержка обязана быть выждана на стороне UI и подтверждена явно.
    if ((emergencyRule.delaySeconds || 0) > 0 && !(opts && opts.delayConfirmed === true)) {
      return { ok: false, error: 'delay_required' };
    }
    const since = new Date(ms(now) - (emergencyRule.perDays || 7) * 86400000).toISOString();
    if (emergencyUsedSince(s, session.policyId, since) >= emergencyRule.passes) {
      return { ok: false, error: 'budget_spent' };
    }
    const reason = opts && typeof opts.reason === 'string' ? opts.reason.trim().slice(0, MAX_REASON) : '';
    const next = { ...session, emergency: reason ? { at: now, reason } : { at: now } };
    return { ok: true, state: { ...s, sessions: s.sessions.map((x) => (x.id === next.id ? next : x)) }, session: next };
  }

  /** Закрыть окно. Исход называет человек; неназванный остаётся `unknown`. */
  function close(state, id, outcome, now) {
    const s = normalize(state);
    const session = byId(s, id);
    if (!session) return { ok: false, error: 'not_found' };
    if (session.endedAt) return { ok: false, error: 'already_closed' };
    if (!isIso(now)) return { ok: false, error: 'invalid' };
    const res = Object.prototype.hasOwnProperty.call(OUTCOMES, outcome) ? outcome : OUTCOMES.unknown;
    const next = { ...session, endedAt: now, outcome: res };
    return { ok: true, state: { ...s, sessions: s.sessions.map((x) => (x.id === next.id ? next : x)) }, session: next };
  }

  /**
   * Что предложить на границе. Модуль отдаёт возможности, не текст: `escaped` здесь
   * НЕ выставляется автоматически — «меня унесло» человек выбирает сам (§17).
   */
  function boundaryOptions(session, now) {
    if (!session || session.endedAt) return null;
    return {
      over: isOver(session, now),
      remainingMs: remainingMs(session, now),
      canExtend: canExtend(session),
      extensionsLeft: Math.max(0, session.extensionsAllowed - session.extensions.length),
      hardStop: session.mode === 'control',
      seq: session.extensions.length,
    };
  }

  /** Готовая запись для журнала эпизодов — единственный мост к `attention-episode-v1`. */
  function toEpisode(session) {
    if (!session || !session.endedAt) return null;
    const started = ms(session.startedAt), ended = ms(session.endedAt);
    const actual = Number.isNaN(started) || Number.isNaN(ended) ? null : Math.max(0, Math.round((ended - started) / MINUTE));
    const ep = {
      id: session.id,
      sourcePolicyId: session.policyId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      declaredPurpose: session.purpose,
      plannedMinutes: grantedMinutes(session),
      actualMinutes: actual,
      outcome: session.outcome || OUTCOMES.unknown,
      extensionCount: session.extensions.length,
      emergencyUsed: !!session.emergency,
    };
    if (session.expectedOutcome) ep.expectedOutcome = session.expectedOutcome;
    if (session.topic) ep.topic = session.topic;
    return ep;
  }

  return Object.freeze({
    VERSION, OUTCOMES,
    emptyState, normalize, byId, active,
    start, extend, useEmergency, close,
    grantedMinutes, deadlineAt, remainingMs, isOver, canExtend,
    emergencyUsedSince, boundaryOptions, toEpisode,
  });
});
