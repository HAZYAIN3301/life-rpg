/* Satoru Sphere Frequency v1 (DISCIPLINE-ARENA-PLAN §11, правило ±1 из
 * BOARD-OF-CONTRACTS §9).
 *
 * «Каждый день надо в балансе поддерживать все сферы» — плохая конструкция:
 * день дробится, каждому куску достаётся слишком мало, чтобы дойти до глубины,
 * и это прямо противоречит наблюдению про четыре часа концентрации. У сфер
 * разная естественная частота: сон и движение — ежедневно, ремесло и спорт —
 * два-три раза в неделю, обзор — раз в неделю.
 *
 * Отсюда главная замена: индекс баланса считается ПРОТИВ ЧАСТОТЫ, а не против
 * равномерности. Окно переживает плохой день и поездку; «всё каждый день»
 * ломается на первом же сбое и, сломавшись, обесценивает всю конструкцию.
 *
 * Правило ±1 (BOARD §9). Человек идеализирует, когда заполняет опросник: он
 * отвечает про желаемую жизнь, а не про фактическую. Сказал «три раза» — норма
 * считается 2–4. Без этого окна свободы приложение начнёт сообщать о провале
 * там, где его нет, и человек потеряет желание — это его собственная поправка,
 * и она здесь зашита в LOW/HIGH, а не оставлена на усмотрение UI.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ считает превышение частоты нарушением. `over` — это информация (режим
 *    🔼 из BACKLOG §6) и вход для «нужен день соло» из LIFE-CAPTURE §3, а не
 *    упрёк. Продукт толкает делать МЕНЬШЕ в перегруженной сфере, а не больше
 *    во всех сразу;
 *  — НЕ судит сферу, для которой человек не объявлял частоту: у такой статус
 *    `unset`, и говорить о ней нечего;
 *  — НЕ считает события — считает ДНИ касания. «Три раза в неделю» означает
 *    три дня, а не три дела: пять задач за один вечер не закрывают неделю;
 *  — НЕ возвращает готовых фраз, только сырые значения и статусы.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeSphereFrequency(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SphereFrequencyV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSphereFrequency() {
  'use strict';

  const VERSION = '1.0.0';

  // Окно — неделя, потому что частота объявляется «сколько раз в неделю».
  const WINDOW_DAYS = 7;

  // Окно свободы вокруг объявленной частоты (BOARD §9).
  const TOLERANCE = 1;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }

  function daysBetween(from, to) {
    if (!isDay(from) || !isDay(to)) return 0;
    const a = Date.parse(from + 'T00:00:00Z'), b = Date.parse(to + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }

  /** Дни касания в окне, без дублей: считаем дни, а не события. */
  function touchedDaysIn(touchDates, today, windowDays) {
    const days = new Set();
    for (const d of Array.isArray(touchDates) ? touchDates : []) {
      if (!isDay(d) || d > today) continue;
      const age = daysBetween(d, today);
      if (age < 0 || age >= windowDays) continue;
      days.add(d);
    }
    return days;
  }

  function lastTouch(touchDates, today) {
    let last = null;
    for (const d of Array.isArray(touchDates) ? touchDates : []) {
      if (!isDay(d) || d > today) continue;
      if (!last || d > last) last = d;
    }
    return last;
  }

  /**
   * Ритм одной сферы.
   *
   * @param {{id:*, targetPerWeek?:number, paused?:boolean}} sphere
   * @param {string[]} touchDates — даты, когда сферы касались (дубли допустимы)
   * @param {string} today — YYYY-MM-DD
   * @param {{windowDays?:number, tolerance?:number}} [opts]
   * @returns {{sphereId:*, status:('unset'|'paused'|'under'|'ok'|'over'),
   *            target:(number|null), low:(number|null), high:(number|null),
   *            actual:number, windowDays:number, daysSinceTouch:(number|null)}}
   */
  function sphereRhythm(sphere, touchDates, today, opts) {
    const s = sphere || {};
    const o = opts || {};
    const windowDays = Number(o.windowDays) > 0 ? Math.floor(Number(o.windowDays)) : WINDOW_DAYS;
    const tol = Number.isFinite(Number(o.tolerance)) && Number(o.tolerance) >= 0 ? Math.floor(Number(o.tolerance)) : TOLERANCE;

    const valid = isDay(today);
    const actual = valid ? touchedDaysIn(touchDates, today, windowDays).size : 0;
    const last = valid ? lastTouch(touchDates, today) : null;
    const daysSinceTouch = last ? daysBetween(last, today) : null;

    const base = { sphereId: s.id, actual, windowDays, daysSinceTouch, target: null, low: null, high: null };

    const target = Number(s.targetPerWeek);
    if (!Number.isFinite(target) || target <= 0) return { ...base, status: 'unset' };

    const t = Math.round(target);
    // Нижняя граница не опускается ниже 1: при частоте «раз в неделю» голое
    // t - 1 дало бы 0, и сфера, которую не трогали вообще, считалась бы в
    // норме — то есть правило ±1 отменило бы саму частоту. Окно свободы
    // смягчает объявленную норму, но не отменяет факт объявления.
    const low = Math.max(1, t - tol);
    const high = t + tol;

    // Пауза проверяется ПОСЛЕ вычисления чисел: человек, снявший сферу с паузы,
    // должен сразу видеть реальную картину, а не ноль.
    if (s.paused) return { ...base, target: t, low, high, status: 'paused' };

    const status = actual < low ? 'under' : actual > high ? 'over' : 'ok';
    return { ...base, target: t, low, high, status };
  }

  /**
   * Индекс баланса — доля сфер, попавших в собственную норму. Именно это
   * заменяет «равномерность»: сфера с частотой «раз в неделю» больше не тянет
   * баланс вниз просто потому, что её трогали реже остальных.
   *
   * `unset` и `paused` в знаменатель не входят: судить можно только то, про что
   * человек сам сказал, что хочет это делать.
   *
   * @returns {{index:(number|null), ok:number, under:number, over:number, counted:number}}
   */
  function balanceIndex(rhythms) {
    const list = Array.isArray(rhythms) ? rhythms : [];
    let ok = 0, under = 0, over = 0;
    for (const r of list) {
      if (!r) continue;
      if (r.status === 'ok') ok += 1;
      else if (r.status === 'under') under += 1;
      else if (r.status === 'over') over += 1;
    }
    const counted = ok + under + over;
    return { index: counted ? ok / counted : null, ok, under, over, counted };
  }

  /**
   * Одна сфера, которой не хватает больше всех, или null.
   *
   * Один сигнал за раз — тот же принцип, что у BOUNDARY_PATTERNS и схваток:
   * назвать человеку четыре запущенные сферы значит не починить ни одной.
   *
   * Порядок: больше недобор → дольше не трогали → id. Последний ключ нужен для
   * детерминизма, иначе подсказка прыгала бы между рендерами.
   */
  function mostNeglected(rhythms) {
    const list = (Array.isArray(rhythms) ? rhythms : []).filter((r) => r && r.status === 'under');
    if (!list.length) return null;
    list.sort((a, b) => {
      const da = (a.low || 0) - a.actual, db = (b.low || 0) - b.actual;
      if (da !== db) return db - da;
      const sa = a.daysSinceTouch == null ? Infinity : a.daysSinceTouch;
      const sb = b.daysSinceTouch == null ? Infinity : b.daysSinceTouch;
      if (sa !== sb) return sb - sa;
      return String(a.sphereId) < String(b.sphereId) ? -1 : String(a.sphereId) > String(b.sphereId) ? 1 : 0;
    });
    return list[0];
  }

  return { VERSION, WINDOW_DAYS, TOLERANCE, sphereRhythm, balanceIndex, mostNeglected, daysBetween };
});
