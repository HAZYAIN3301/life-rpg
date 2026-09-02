/* Satoru Secretary offer view v1
 *
 * Движок решает, случилось ли что-то и какой ровно один ход предложить. Он не
 * решает, как это назвать словами и какую поверхность открыть — это здесь.
 *
 * Главное правило — fail-closed на незнакомом. Если движок пришлёт причину или
 * действие, которых этот клиент не знает, ход не показывается вовсе. Подставить
 * «ближайшее похожее» значило бы открыть человеку не то, что ему предложили, и
 * молча: словарь `action` намеренно закрытый, и незнакомое слово в нём — признак
 * того, что клиент устарел, а не приглашение угадывать.
 *
 * Модуль чистый: без DOM, State, сети и чтения часов.
 */
(function exposeSecretaryOfferView(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryOfferViewV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryOfferView() {
  'use strict';

  // Причина → строка, которая называет факт и не ставит диагноз. Слов «срыв»,
  // «провал» и «ты снова» здесь нет и не будет: это проверяется тестом.
  const REASON_COPY = Object.freeze({
    escaped: 'Вчера ты отметил, что тебя унесло.',
    overran: 'Вчера окно вышло за свою границу.',
    late: 'Вчера день закончился позже вечерней границы.',
    silent: 'Вчера в Satoru было тихо. Что это было?',
  });

  // Действие → существующая поверхность. Новых экранов у хода нет: он открывает
  // то, что в приложении уже есть.
  const ACTION_SURFACE = Object.freeze({
    recovery_day_open: { label: 'Вернуться одним шагом', domAction: 'attention-open-return' },
    rest_start_prepared: { label: 'Отдохнуть с границей', domAction: 'recovery-open' },
    evening_transition_open: { label: 'Завершить вечер', domAction: 'evening-open' },
    // Вопрос не открывает поверхность: у него нет плана, только ответ.
    ask_one_question: { label: 'Ответить', domAction: '' },
  });

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function nonEmptyString(value) { return typeof value === 'string' && !!value.trim(); }

  function quoteOf(raw) {
    if (!isObject(raw)) return null;
    const title = nonEmptyString(raw.title) ? raw.title.trim().slice(0, 120) : '';
    if (!title) return null;
    const win = nonEmptyString(raw.win) ? raw.win.trim().slice(0, 120) : '';
    return win ? { title, win } : { title, win: '' };
  }

  /**
   * Что показать по одному ходу. `null` — показывать нечего, и это нормальный
   * исход: молчание приходит чаще хода.
   */
  function presentOffer(offer) {
    if (!isObject(offer) || !nonEmptyString(offer.offerId)) return null;
    const reasonCopy = REASON_COPY[offer.reason];
    const surface = ACTION_SURFACE[offer.action];
    if (!reasonCopy || !surface) return null;

    // `askOnly` — это вопрос, а не план. Даже если действие известно, поверхность
    // не открывается: иначе вопрос превратился бы в утверждение о человеке.
    const askOnly = offer.askOnly === true;
    return {
      offerId: offer.offerId,
      cooldownKey: nonEmptyString(offer.cooldownKey) ? offer.cooldownKey : offer.offerId,
      reasonCopy,
      actionLabel: surface.label,
      domAction: askOnly ? '' : surface.domAction,
      askOnly,
      quote: quoteOf(offer.quote),
    };
  }

  return Object.freeze({ REASON_COPY, ACTION_SURFACE, presentOffer });
});
