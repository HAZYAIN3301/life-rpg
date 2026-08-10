/* Satoru Arena Audit v1 (DISCIPLINE-ARENA-PLAN §5).
 *
 * «Если я вижу конкретного человека, которого хочу обогнать, это двигает меня
 * намного сильнее, чем абстрактные понятия. Но как сделать с учёбой, если я
 * лучший в классе? Как сделать с бизнесом?»
 *
 * Соперник — это УПАКОВКА, а не необходимое условие. Он поставляет четыре
 * отделимых элемента, и каждый можно собрать без него:
 *
 *   1. Мишень   — не «стать лучше», а «лучше вот этого»
 *   2. Табло    — счёт, который нельзя себе наврать
 *   3. Расписание — дата, когда встреча состоится
 *   4. Ставка   — что почувствуешь, если проиграешь
 *
 * Доказательство, что человек уже умеет это без соперника: зал работает на
 * числе с историей (150 → 170 кг). Табло есть — драйв есть. Учёба и бизнес не
 * работают не потому, что характер другой, а потому что там нет табло.
 *
 * Модуль отвечает на просьбу «в приложении должны быть диагностические
 * функции»: по сфере видно, каких элементов не хватает.
 *
 * ⚠️ Что модуль НЕ делает и не должен:
 *  — НЕ сравнивает пользователей между собой. Ни в каком виде: сравнение по
 *    чужим курируемым итогам — это доомскролл с лишним шагом, и оно прямо
 *    противоречит уже принятому решению убрать глобальный лидерборд. На входе
 *    только собственные данные одного человека, и добавить чужие некуда;
 *  — НЕ проверяет, что соперник взят «на ступень выше, а не недосягаемо
 *    далеко». Это свойство содержания, а не данных: недосягаемый соперник даёт
 *    не драйв, а отчаяние — он не противник, он пейзаж. Гейт живёт в
 *    формулировках подсказки, и здесь его закрыть нечем;
 *  — НЕ судит сферу, для которой человек отказался от соревнования. Соревнование
 *    нужно не всем (`BOARD-OF-CONTRACTS` §9), и `arena: false` это уважает;
 *  — НЕ возвращает готовых фраз, только флаги и идентификаторы элементов.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeArenaAudit(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ArenaAuditV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildArenaAudit() {
  'use strict';

  const VERSION = '1.0.0';

  // Порядок значим и он же — порядок достройки. Без мишени нечего мерить,
  // нечего назначать и нечего ставить: остальные три элемента описывают
  // отношение к ней. Поэтому пробел закрывается сверху вниз.
  const ELEMENTS = ['target', 'scoreboard', 'schedule', 'stake'];

  // Табло — это число С ИСТОРИЕЙ. Одна точка не табло: по ней не видно
  // движения, а именно движение (150 → 170) и производит драйв.
  const MIN_HISTORY_POINTS = 2;

  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  function isDay(s) { return typeof s === 'string' && ISO_DAY.test(s); }
  function filled(v) { return typeof v === 'string' && v.trim().length > 0; }

  function historyPoints(raw) {
    if (!Array.isArray(raw)) return 0;
    return raw.filter((p) => {
      if (p == null) return false;
      const v = typeof p === 'object' ? p.value : p;
      return Number.isFinite(Number(v));
    }).length;
  }

  /**
   * Аудит одной сферы.
   *
   * @param {{id:*, arena?:boolean, target?:string, metricHistory?:Array,
   *          dueDate?:string, stake?:string}} sphere
   * @param {string} today — YYYY-MM-DD
   * @returns {{sphereId:*, status:('skipped'|'audited'),
   *            elements:{target:boolean, scoreboard:boolean, schedule:boolean, stake:boolean},
   *            present:number, missing:string[], nextGap:(string|null),
   *            scheduleExpired:boolean}}
   */
  function auditSphere(sphere, today) {
    const s = sphere || {};
    const base = {
      sphereId: s.id,
      elements: { target: false, scoreboard: false, schedule: false, stake: false },
      present: 0, missing: ELEMENTS.slice(), nextGap: ELEMENTS[0], scheduleExpired: false,
    };

    // Отказ от соревнования — не пробел, а решение. Ничего не считаем.
    if (s.arena === false) {
      return { ...base, status: 'skipped', missing: [], nextGap: null };
    }

    const hasDate = isDay(s.dueDate);
    // Прошедшая дата — не расписание, а пропущенная встреча. Она считается
    // отсутствующей, но отмечается отдельно: подсказка «дата прошла, назначь
    // новую» точнее и человечнее, чем «нет даты» тому, кто её ставил.
    const scheduleExpired = hasDate && isDay(today) && s.dueDate < today;

    const elements = {
      target: filled(s.target),
      scoreboard: historyPoints(s.metricHistory) >= MIN_HISTORY_POINTS,
      schedule: hasDate && !scheduleExpired,
      stake: filled(s.stake),
    };

    const missing = ELEMENTS.filter((k) => !elements[k]);
    return {
      sphereId: s.id,
      status: 'audited',
      elements,
      present: ELEMENTS.length - missing.length,
      missing,
      nextGap: missing.length ? missing[0] : null,
      scheduleExpired,
    };
  }

  /**
   * Доля сфер, у которых собраны все четыре элемента. `skipped` в знаменатель
   * не входит: сфера без соревнования не может «не дотягивать».
   *
   * @returns {{index:(number|null), complete:number, counted:number}}
   */
  function arenaIndex(audits) {
    const list = (Array.isArray(audits) ? audits : []).filter((a) => a && a.status === 'audited');
    const complete = list.filter((a) => a.present === ELEMENTS.length).length;
    return { index: list.length ? complete / list.length : null, complete, counted: list.length };
  }

  /**
   * Одна сфера, которой не хватает больше всех, или null.
   *
   * Один сигнал за раз — тот же принцип, что у `BOUNDARY_PATTERNS`, схваток и
   * частот: показать человеку четыре недостроенные арены значит не достроить
   * ни одной.
   *
   * Порядок: меньше собрано → раньше в ELEMENTS стоит незакрытый пробел → id.
   * Второй ключ ставит вперёд сферу, где не хватает самого фундамента: там
   * один ответ («кто на ступень выше?») сдвигает больше всего.
   */
  function mostIncomplete(audits) {
    const list = (Array.isArray(audits) ? audits : [])
      .filter((a) => a && a.status === 'audited' && a.present < ELEMENTS.length);
    if (!list.length) return null;
    list.sort((a, b) => {
      if (a.present !== b.present) return a.present - b.present;
      const ga = ELEMENTS.indexOf(a.nextGap), gb = ELEMENTS.indexOf(b.nextGap);
      if (ga !== gb) return ga - gb;
      return String(a.sphereId) < String(b.sphereId) ? -1 : String(a.sphereId) > String(b.sphereId) ? 1 : 0;
    });
    return list[0];
  }

  return { VERSION, ELEMENTS, MIN_HISTORY_POINTS, auditSphere, arenaIndex, mostIncomplete };
});
