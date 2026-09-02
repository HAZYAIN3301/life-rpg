/* Satoru Secretary attention producer v1
 *
 * Кто именно порождает `attention.escaped` и `attention.overran` — дефект №5
 * интеграционного контракта. Предыдущее предложение было «все четыре продюсера
 * серверные, на существующих швах записи», и для двух событий про внимание оно
 * **не работает**: правила и эпизоды внимания по умолчанию живут в `mode: 'local'`
 * и на сервер не уходят вовсе: при `local` `AttentionStore.save` пишет только в
 * локальное хранилище браузера, а при переходе `contracts → local` очищает серверную копию.
 * Сервер про эти эпизоды не знает ничего, и серверный продюсер молчал бы всегда.
 *
 * Поэтому производит клиент — не как «второй источник того же факта», а как
 * единственный, у кого этот факт есть. Здесь только решение о том, какие события
 * причитаются за один закрытый эпизод; отправку и повторы делает вызывающий,
 * идемпотентность — сервер (`type|day|ref`, дневная гранулярность).
 *
 * Модуль чистый: без DOM, State, сети и чтения часов. День приходит параметром —
 * локальный день события знает только вызывающий.
 */
(function exposeSecretaryAttentionProducer(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SecretaryAttentionProducerV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSecretaryAttentionProducer() {
  'use strict';

  const ESCAPED = 'attention.escaped';
  const OVERRAN = 'attention.overran';
  const REF_MAX = 60;

  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function isIso(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }

  function validDay(raw) {
    if (typeof raw !== 'string') return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  /**
   * Ярлык занятия для `ref`. Это собственное слово человека («TikTok»), а не адрес
   * и не запрос: по нему Router выбирает, какой уговор процитировать. Приводится к
   * скромному ключу, чтобы «TikTok» и «tiktok» не стали двумя разными поводами.
   */
  function refOf(label) {
    if (typeof label !== 'string') return '';
    return label.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, REF_MAX);
  }

  function finiteMinutes(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }

  /**
   * Какие события причитаются за один закрытый эпизод.
   *
   * Возвращает и то, что послано не будет, вместе с причиной: молчание без причины
   * неотличимо от сломанного продюсера, а «замера нет» и «превышения не было» —
   * разные факты о человеке.
   */
  function eventsForEpisode(input) {
    const options = isObject(input) ? input : {};
    const episode = options.episode;
    const skipped = [];
    const events = [];
    const done = () => ({ events, skipped });

    if (!isObject(episode)) { skipped.push({ type: null, reason: 'no_episode' }); return done(); }
    // Событие-момент без валидного `at` сервер отвергает, и правильно: «меня унесло
    // в 23:50» и «меня унесло неизвестно когда» — разные утверждения.
    if (!isIso(episode.endedAt)) { skipped.push({ type: null, reason: 'no_ended_at' }); return done(); }
    if (!validDay(options.day)) { skipped.push({ type: null, reason: 'no_local_day' }); return done(); }

    const ref = refOf(options.label);
    const base = { day: options.day, at: episode.endedAt, source: 'client' };
    if (ref) base.ref = ref;

    if (episode.outcome === 'escaped') events.push({ ...base, type: ESCAPED });
    else skipped.push({ type: ESCAPED, reason: 'not_escaped' });

    const actual = finiteMinutes(episode.actualMinutes);
    const planned = finiteMinutes(episode.plannedMinutes);
    if (episode.actualMinutes === null || actual === null) {
      // Платформа могла не знать длительность. Это отсутствие замера, а не ноль,
      // и превышения из него не выводится никогда.
      skipped.push({ type: OVERRAN, reason: 'not_measured' });
    } else if (planned === null) {
      skipped.push({ type: OVERRAN, reason: 'no_boundary' });
    } else if (actual > planned) {
      events.push({ ...base, type: OVERRAN, plannedMinutes: planned, actualMinutes: actual });
    } else {
      skipped.push({ type: OVERRAN, reason: 'within_boundary' });
    }
    return done();
  }

  return Object.freeze({ ESCAPED, OVERRAN, refOf, eventsForEpisode });
});
