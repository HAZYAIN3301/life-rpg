'use strict';
/* Тихий вопрос после долгого отсутствия (DISCIPLINE-ESCAPE-PLAN §5 слой A, §8 п.1).
 *
 * Задача — закрыть дыру, названную Альбертом словами «куда мне всё это записывается».
 * Никуда: вся система дисциплины ждёт, что человек сам расскажет, а срыв это ровно
 * тот момент, когда рассказывать перестают. Значит приложение должно заметить само.
 *
 * ⚠️ Самая опасная фича из всего плана, и вот почему. Она срабатывает в худший момент
 * человека, без его просьбы, и говорит первой. Один неверный тон здесь — и приложение
 * удаляют навсегда. Поэтому все решения ниже приняты в сторону молчания:
 *
 *  — тишина НЕ диагностируется. §8 п.1 прямо запрещает угадывать болезнь, отдых,
 *    поездку или работу вне Satoru. Модуль решает только «уместно ли спросить»,
 *    а текст обязан быть вопросом, а не выводом. Здесь нет и не может быть функции,
 *    возвращающей причину отсутствия;
 *  — один день тишины — это норма жизни, а не сигнал. Порог начинается с двух;
 *  — спросив, модуль замолкает на несколько дней. Повторный вопрос превращает заботу
 *    в преследование, а это ровно тот механизм, которым работает Duolingo и который
 *    в этом продукте запрещён;
 *  — ночью не спрашиваем никогда: человек либо спит, либо у него и так тяжёлый час;
 *  — вернулся сам — вопрос отменяется, даже если он был «заслужен» по счётчику.
 *
 * Чистая функция: ничего не читает и не пишет, только решает. Отправляет вызывающий.
 */

// Один тихий день ничего не значит: выходной, поездка, просто занят. Два — уже
// достаточно, чтобы вопрос не выглядел придиркой, и ещё достаточно рано, чтобы
// возврат стоил дёшево (чем дольше пауза, тем дороже вход обратно — §5 слой B).
const MIN_QUIET_DAYS = 2;

// Спросив, молчим три дня. Без этого счётчик тишины растёт и вопрос повторялся бы
// каждый день — то есть человек, которому и так тяжело, получал бы ежедневное
// напоминание о том, что он пропал.
const MIN_GAP_DAYS = 3;

// Окно суток. Не раньше — утро и так занято утренним чек-ином; не позже — поздний
// вопрос про пропавшие дни попадает ровно в тот час, когда сил отвечать нет.
const FROM_HOUR = 12;
const TO_HOUR = 20;

function daysBetween(fromDay, toDay) {
  const a = Date.parse(String(fromDay) + 'T00:00:00Z');
  const b = Date.parse(String(toDay) + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * @param {object} ctx
 * @param {number} ctx.quietDays   сколько дней не появлялся
 * @param {number} ctx.hour        местный час пользователя (0-23)
 * @param {string} ctx.today       локальная дата пользователя, YYYY-MM-DD
 * @param {string|null} ctx.askedAt дата прошлого тихого вопроса
 * @param {boolean} ctx.askedToday уже спрашивали что-то сегодня этим каналом
 * @returns {{ask: boolean, reason: string}} reason — почему решили ТАК (для логов и тестов)
 */
function decide(ctx, opts) {
  const o = Object.assign({
    minQuietDays: MIN_QUIET_DAYS, minGapDays: MIN_GAP_DAYS,
    fromHour: FROM_HOUR, toHour: TO_HOUR,
  }, opts || {});
  if (!ctx || typeof ctx !== 'object') return { ask: false, reason: 'no_context' };

  const quietDays = Number(ctx.quietDays);
  if (!Number.isFinite(quietDays) || quietDays < o.minQuietDays) return { ask: false, reason: 'not_quiet_enough' };

  const hour = Number(ctx.hour);
  if (!Number.isFinite(hour) || hour < o.fromHour || hour >= o.toHour) return { ask: false, reason: 'wrong_hour' };

  // Уже говорили сегодня — второй раз за день молчим при любом счётчике.
  if (ctx.askedToday) return { ask: false, reason: 'already_spoke_today' };

  if (ctx.askedAt) {
    const since = daysBetween(ctx.askedAt, ctx.today);
    if (since === null) return { ask: false, reason: 'bad_dates' };
    // Отрицательное значение = часы устройства уехали назад. Молчим: лучше не
    // спросить, чем спросить дважды из-за смены часового пояса.
    if (since < 0) return { ask: false, reason: 'clock_skew' };
    if (since < o.minGapDays) return { ask: false, reason: 'too_soon' };
  }

  return { ask: true, reason: 'quiet' };
}

/** Фабрика с настройками — тот же контракт, что у createPageVerifier в Board v2. */
function createQuietAsk(opts) {
  return { decide: (ctx) => decide(ctx, opts) };
}

module.exports = {
  MIN_QUIET_DAYS, MIN_GAP_DAYS, FROM_HOUR, TO_HOUR,
  decide, createQuietAsk, daysBetween,
};
