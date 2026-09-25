/* Satoru Sphere Load v1 — «больше обычного для тебя» только при настоящей базе (R04A).
 *
 * Что было. `sphereLoads()` в app.js делил опыт за предыдущие 28 дней на 28 всегда —
 * даже если человек записывает дела всего десять дней. Дни ДО первой записи молча
 * считались нулевыми, база занижалась, и новичок получал «Перегрев ×5.5» там, где
 * просто начал пользоваться приложением. Та же арифметика давала «×0.0» вместо
 * понятного «за неделю записей нет».
 *
 * Что измеряем — и только это. Средний записанный опыт (XP) сферы за последние
 * 7 дней против её обычного дня за предыдущие до 28 дней. Это сравнение с самим
 * человеком по записанному, а не измерение усталости или состояния.
 *
 * Честная база:
 *   1) история: окно базы учитывает только дни, начиная с первой записи. Меньше
 *      MIN_BASE_DAYS наблюдённых дней до последней недели — сравнивать не с чем;
 *   2) сфера: норма есть, только если в окне базы по сфере были записи хотя бы
 *      в MIN_ACTIVE_DAYS разных днях и в среднем ≥ MIN_BASE_XP_PER_DAY XP.
 *      Иначе первая же активность дала бы «×∞».
 *
 * Пороги 7/28/×1.7 и сам XP не меняются: меняется только знаменатель базы для
 * молодой истории и то, что недостаточная база называется по имени.
 *
 * Чистый модуль: даты, числа и id на входе, данные на выходе. Ни DOM, ни State,
 * ни переводчика.
 */
(function exposeSphereLoad(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SphereLoadV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSphereLoad() {
  'use strict';

  const VERSION = '1.0.0';
  const RECENT_DAYS = 7;
  const BASE_DAYS = 28;
  const HIGHER = 1.7;           // прежний LOAD_HOT
  const LOWER = 0.5;
  const MIN_BASE_DAYS = 14;     // наблюдённых дней до последней недели
  const MIN_ACTIVE_DAYS = 3;    // разных дней с записями по сфере в окне базы
  const MIN_BASE_XP_PER_DAY = 3; // прежний порог «содержательной» базы
  const QUIET_DAYS = 7;
  const SCALE_MAX = 3;          // полоса: 0…×3, отметка нормы на ×1

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function isDate(value) { return typeof value === 'string' && DATE_RE.test(value); }
  function toUtc(date) { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); }
  function fromUtc(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(date, n) { return fromUtc(toUtc(date) + n * 86400000); }
  function daysBetween(from, to) { return Math.round((toUtc(to) - toUtc(from)) / 86400000); }
  function num(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; }

  function windows(today) {
    const recentFrom = addDays(today, -(RECENT_DAYS - 1));
    const baseTo = addDays(recentFrom, -1);
    const baseFrom = addDays(baseTo, -(BASE_DAYS - 1));
    return { recentFrom, recentTo: today, baseFrom, baseTo };
  }

  /** Первая дата записей: от неё и начинается наблюдаемая история. */
  function historyStartOf(events) {
    let first = null;
    for (const event of Array.isArray(events) ? events : []) {
      if (!event || !isDate(event.date) || !(num(event.xp) > 0)) continue;
      if (!first || event.date < first) first = event.date;
    }
    return first;
  }

  /** Сколько дней окна базы действительно наблюдалось (с первой записи). */
  function observedBaseDays(win, historyStart) {
    if (!isDate(historyStart) || historyStart > win.baseTo) return 0;
    const from = historyStart > win.baseFrom ? historyStart : win.baseFrom;
    return daysBetween(from, win.baseTo) + 1;
  }

  function stateFor(ratio, restores) {
    if (ratio >= HIGHER) return 'higher';
    if (ratio <= LOWER) return 'lower';
    return 'usual';
  }

  /**
   * @param {object} input
   * @param {Array<{date:string, skillId:string|null, xp:number}>} input.events
   * @param {Array<{id:string, name?:string, color?:string, memberIds?:string[], restores?:boolean,
   *   lastActive?:string|null, lifetimeXp?:number}>} input.spheres
   *   memberIds — id самой сферы и всех её потомков (агрегация по дереву делается снаружи).
   * @param {string} input.today — YYYY-MM-DD
   * @param {string|null} [input.historyStart] — по умолчанию первая дата событий
   */
  function compute(input) {
    const inp = input || {};
    const today = isDate(inp.today) ? inp.today : null;
    if (!today) throw new TypeError('SphereLoadV1.compute: today must be YYYY-MM-DD');
    const events = Array.isArray(inp.events) ? inp.events : [];
    const win = windows(today);
    const historyStart = isDate(inp.historyStart) ? inp.historyStart : historyStartOf(events);
    const observed = observedBaseDays(win, historyStart);
    const baseReady = observed >= MIN_BASE_DAYS;

    const recentBy = new Map(), baseBy = new Map(), baseDaysBy = new Map();
    for (const event of events) {
      if (!event || !event.skillId || !isDate(event.date)) continue;
      const xp = num(event.xp);
      if (!xp) continue;
      if (event.date >= win.recentFrom && event.date <= win.recentTo) {
        recentBy.set(event.skillId, (recentBy.get(event.skillId) || 0) + xp);
      } else if (event.date >= win.baseFrom && event.date <= win.baseTo) {
        baseBy.set(event.skillId, (baseBy.get(event.skillId) || 0) + xp);
        if (!baseDaysBy.has(event.skillId)) baseDaysBy.set(event.skillId, new Set());
        baseDaysBy.get(event.skillId).add(event.date);
      }
    }

    const rows = (Array.isArray(inp.spheres) ? inp.spheres : []).map((sphere) => {
      const ids = Array.isArray(sphere.memberIds) && sphere.memberIds.length ? sphere.memberIds : [sphere.id];
      let recentXp = 0, baseXp = 0;
      const activeDays = new Set();
      for (const id of ids) {
        recentXp += recentBy.get(id) || 0;
        baseXp += baseBy.get(id) || 0;
        for (const date of baseDaysBy.get(id) || []) activeDays.add(date);
      }
      const recentPerDay = recentXp / RECENT_DAYS;
      const basePerDay = observed ? baseXp / observed : 0;
      const restores = !!sphere.restores;
      const lastActive = isDate(sphere.lastActive) ? sphere.lastActive : null;
      const quietDays = lastActive ? Math.max(0, daysBetween(lastActive, today)) : null;
      let state, reason = null, ratio = null;
      if (!baseReady) { state = 'unknown'; reason = 'history'; }
      else if (activeDays.size < MIN_ACTIVE_DAYS || basePerDay < MIN_BASE_XP_PER_DAY) { state = 'unknown'; reason = 'sphere'; }
      else {
        ratio = Math.round((recentPerDay / basePerDay) * 100) / 100;
        state = recentXp > 0 ? stateFor(ratio) : 'none';
      }
      return {
        id: sphere.id, name: sphere.name, color: sphere.color, restores,
        recentXp: Math.round(recentXp), recentPerDay, basePerDay: ratio == null ? null : basePerDay,
        baseActiveDays: activeDays.size, ratio, state, reason, quietDays,
        lifetimeXp: num(sphere.lifetimeXp),
        hot: state === 'higher' && !restores,
        scalePct: ratio == null ? null : Math.max(0, Math.min(100, Math.round((ratio / SCALE_MAX) * 100))),
      };
    });

    return {
      version: VERSION,
      window: win,
      historyStart,
      observedBaseDays: observed,
      baseReady,
      needBaseDays: baseReady ? 0 : MIN_BASE_DAYS - observed,
      normPct: Math.round((1 / SCALE_MAX) * 100),
      rows,
    };
  }

  /**
   * Пара «заметно больше обычного» + «без записей 7+ дней». Без первой половины
   * вывода нет; «тишина» — только у сфер, где опыт вообще был.
   */
  function insight(result) {
    const rows = (result && Array.isArray(result.rows)) ? result.rows : [];
    const hot = rows.filter((row) => row.hot).sort((a, b) => b.ratio - a.ratio);
    if (!hot.length) return null;
    const quiet = rows
      .filter((row) => !row.hot && row.lifetimeXp > 0 && (row.quietDays == null || row.quietDays >= QUIET_DAYS))
      .sort((a, b) => (b.quietDays == null ? 999 : b.quietDays) - (a.quietDays == null ? 999 : a.quietDays))
      .slice(0, 2);
    return { hot: hot[0], quiet };
  }

  return {
    VERSION, RECENT_DAYS, BASE_DAYS, HIGHER, LOWER, MIN_BASE_DAYS, MIN_ACTIVE_DAYS,
    MIN_BASE_XP_PER_DAY, QUIET_DAYS, SCALE_MAX,
    addDays, daysBetween, windows, historyStartOf, observedBaseDays, compute, insight,
  };
});
