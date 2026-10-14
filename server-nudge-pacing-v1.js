'use strict';
/* Частота напоминаний Тени (ночная ветка 14.10, ждёт решения владельца).
 *
 * До этого у ушедшего человека не было ни потолка, ни затухания: утро + питомец + вечер
 * могли приходить каждый день сколько угодно — до трёх пушей в день месяцами. Тень «не
 * страдала в отсутствие человека» (SHADOW-CHARACTER-V260), и пуши не должны это изображать.
 *
 * Правило:
 *  — не больше одного напоминания в день (утро, вечер, питомец и тихий вопрос — общий лимит);
 *  — затухание по дням без визита: < 3 — каждый день; 3–6 — раз в 2 дня; 7–29 — раз в неделю;
 *    30+ — тишина, пока человек сам не вернётся;
 *  — слот дня по выбору человека: утро (по умолчанию) или вечер; 'both' — старое поведение
 *    для тех, кто сам захотел два касания (всё равно с затуханием).
 * Ход секретаря и настроенный человеком вечерний контур сюда не входят: их человек создал сам.
 *
 * Чистый модуль: ничего не читает и не пишет.
 */

const SLOTS = Object.freeze(['morning', 'evening', 'both']);
const DEFAULT_SLOT = 'morning';

function normalizeSlot(value) {
  return SLOTS.includes(value) ? value : DEFAULT_SLOT;
}

function dayNumber(isoDate) {
  const t = Date.parse(String(isoDate || '') + 'T00:00:00Z');
  return Number.isFinite(t) ? Math.round(t / 86400000) : null;
}

/** Минимальный промежуток (в днях) между напоминаниями при таком отсутствии; null — молчать. */
function gapFor(awayDays) {
  const away = Math.max(0, Number(awayDays) || 0);
  if (away >= 30) return null;
  if (away >= 7) return 7;
  if (away >= 3) return 2;
  return 1;
}

/**
 * Можно ли сегодня отправить напоминание этого вида.
 * @param {object} o
 * @param {number} o.away — дней с последнего визита
 * @param {string} o.today — YYYY-MM-DD по времени человека
 * @param {string|null} o.lastSent — дата последнего доставленного напоминания
 * @param {object} o.log — дневной журнал {m, e, p, q}
 * @param {'m'|'e'|'p'|'q'} o.kind
 * @param {string} [o.slot] — 'morning' | 'evening' | 'both'
 */
function decide(o) {
  const log = o.log || {};
  const slot = normalizeSlot(o.slot);
  const sentToday = !!(log.m || log.e || log.p || log.q);
  if (slot === 'both') {
    // Два касания — только утро и вечер; питомец и тихий вопрос третьим пушем не приходят.
    const repeat = (o.kind === 'm' && log.m) || (o.kind === 'e' && log.e);
    const extra = (o.kind === 'p' || o.kind === 'q') && sentToday;
    const afterExtra = (o.kind === 'm' || o.kind === 'e') && (log.p || log.q);
    if (repeat || extra || afterExtra) return { ok: false, reason: 'daily_cap' };
  } else if (sentToday) return { ok: false, reason: 'daily_cap' };
  if (slot === 'morning' && o.kind === 'e') return { ok: false, reason: 'slot' };
  if (slot === 'evening' && o.kind === 'm') return { ok: false, reason: 'slot' };
  const gap = gapFor(o.away);
  if (gap === null) return { ok: false, reason: 'quiet_until_return' };
  const today = dayNumber(o.today), last = dayNumber(o.lastSent);
  if (today !== null && last !== null && today - last < gap && !(slot === 'both' && today === last)) return { ok: false, reason: 'decay' };
  return { ok: true, reason: null };
}

module.exports = { SLOTS, DEFAULT_SLOT, normalizeSlot, gapFor, decide };
