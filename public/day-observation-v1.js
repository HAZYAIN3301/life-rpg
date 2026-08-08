/* Satoru Day Observation v1 (JARVIS-3-PLAN §5, правило 3).
 *
 * «Сначала своё наблюдение, потом просьба поправить» — самый сильный механизм
 * из шести правил честной рефлексии. Люди поправляют охотнее, чем признаются.
 * «По данным похоже, что день ушёл после десяти утра. Так и было?» → человек
 * поправляет → эта поправка и есть рефлексия.
 *
 * Правило 1 (никогда не «как прошёл день») и правило 2 (про день, не про
 * человека) держатся тем, что наблюдение — узкий проверяемый факт, а не
 * открытый вопрос. Правило 4 (никогда не обязательно) — на стороне вызывающего
 * кода: это только текст наблюдения, показывать или нет решает UI.
 *
 * ⚠️ Что этот модуль НЕ делает и не должен: защита от углубления депрессии
 * (JARVIS-3-PLAN §5, серия отрицательных самоотчётов → приложение молчит) —
 * чувствительная зона, только с Альбертом, здесь её нет и быть не должно.
 *
 * Один сигнал за раз — тот же принцип, что у BOUNDARY_PATTERNS: назвать
 * человеку три наблюдения разом — снова шум, а не рефлексия.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State сам.
 */
(function exposeDayObservation(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DayObservationV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildDayObservation() {
  'use strict';

  const VERSION = '1.0.0';

  // Порог «поздний старт» — намеренно консервативный (полдень, не 10 утра из примера
  // в плане): ложное наблюдение раздражает сильнее и подрывает доверие сильнее, чем
  // молчание. Тот же принцип, которым уже отмерены пороги в detectBoundaryPattern.
  const LATE_START_HOUR = 12;
  const QUIET_DAY_HOUR = 19;
  const SPHERE_DOMINANT_SHARE = 0.7;
  const SPHERE_DOMINANT_MIN_MINUTES = 60;

  function hourOf(iso) { const d = new Date(iso); return isNaN(d) ? null : d.getHours(); }

  /**
   * @param {object} input
   * @param {Array<{completedAt: (string|null), done: boolean, skillId: string, minutes: number}>} input.tasks — дела ЭТОГО дня
   * @param {Object<string,string>} input.skillNames — id сферы → человекочитаемое имя
   * @param {Date} [input.now] — для тестов; по умолчанию текущее время
   * @param {boolean} [input.hasPlan] — было ли в этот день хоть что-то запланировано
   * @returns {{id:string, statement:string, question:string}|null}
   */
  function observeDay(input) {
    const inp = input || {};
    const tasks = Array.isArray(inp.tasks) ? inp.tasks : [];
    const skillNames = inp.skillNames || {};
    const now = inp.now instanceof Date && !isNaN(inp.now) ? inp.now : new Date();
    const hasPlan = inp.hasPlan !== false && (inp.hasPlan || tasks.length > 0);

    const done = tasks.filter((t) => t && t.done && t.completedAt);

    // ── Кандидат 1: поздний старт. Первое дело дня отмечено после полудня.
    if (done.length) {
      const hours = done.map((t) => hourOf(t.completedAt)).filter((h) => h != null);
      if (hours.length) {
        const first = Math.min(...hours);
        if (first >= LATE_START_HOUR) {
          const statement = `Первое дело сегодня отмечено только в ${first}:00.`;
          return { id: 'late-start', statement, question: `${statement} Так и было?` };
        }
      }
    }

    // ── Кандидат 2: одна сфера съела почти всё время дня.
    if (done.length) {
      const bySphere = {};
      let total = 0;
      for (const t of done) {
        const min = Math.max(0, Number(t.minutes) || 0);
        if (!min) continue;
        bySphere[t.skillId] = (bySphere[t.skillId] || 0) + min;
        total += min;
      }
      if (total >= SPHERE_DOMINANT_MIN_MINUTES) {
        const top = Object.entries(bySphere).sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] / total >= SPHERE_DOMINANT_SHARE) {
          const name = skillNames[top[0]] || top[0];
          const pct = Math.round((top[1] / total) * 100);
          const statement = `Почти всё время сегодня (${pct}%) ушло в «${name}».`;
          return { id: 'sphere-dominant', statement, question: `${statement} Так и было?` };
        }
      }
    }

    // ── Кандидат 3: тихий день — план был, час поздний, не сделано ничего.
    // hasPlan обязателен: пустой день без единого запланированного дела — это не
    // «наблюдение», а укор в никуда, ни на что не отвечающий (правило 2).
    if (hasPlan && !done.length && now.getHours() >= QUIET_DAY_HOUR) {
      const statement = 'Судя по данным, сегодня почти ничего не отмечено.';
      return { id: 'quiet-day', statement, question: `${statement} Так и было, или просто забыл записать?` };
    }

    return null;
  }

  return { VERSION, LATE_START_HOUR, QUIET_DAY_HOUR, SPHERE_DOMINANT_SHARE, SPHERE_DOMINANT_MIN_MINUTES, observeDay };
});
