/* Satoru AI Request v1 — жизненный цикл одного ИИ-запроса: таймаут, отмена, поздний ответ (R04C).
 *
 * Что было. «Разбор недели» ждал ответа без ограничения: зависший провайдер держал
 * спиннер вечно. Закрытое окно поздний ответ открывал заново, а после смены
 * аккаунта разбор прошлого человека всплывал у следующего. Чат ассистента при
 * зависшем провайдере навсегда оставался «занят» — новый вопрос отправить было нельзя.
 *
 * Контракт:
 *   - каждый запрос получает AbortController и таймер; по таймауту запрос
 *     прерывается и завершается статусом `timeout`;
 *   - `cancel()` прерывает сетевой запрос и завершает его статусом `cancelled`;
 *   - ответ, пришедший после отмены или таймаута, никогда не возвращается как
 *     результат (`late: true`), а ответ, для которого `isCurrent()` уже ложно
 *     (закрыли окно, сменили аккаунт, начали новый запрос), — статус `stale`;
 *   - статус выставляется ровно один раз.
 *
 * Модуль не знает про DOM и State: ограду «текущий ли это ещё запрос» передаёт
 * вызывающий код через `isCurrent`.
 */
(function exposeAiRequest(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AiRequestV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAiRequest() {
  'use strict';

  const VERSION = '1.0.0';
  const DEFAULT_TIMEOUT_MS = 60000;
  const MIN_TIMEOUT_MS = 1000;
  const MAX_TIMEOUT_MS = 300000;

  function clampTimeout(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_TIMEOUT_MS;
    return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(n)));
  }

  /**
   * @param {{timeoutMs?:number, isCurrent?:() => boolean, setTimer?:Function, clearTimer?:Function}} [options]
   */
  function create(options) {
    const o = options || {};
    const timeoutMs = clampTimeout(o.timeoutMs);
    const isCurrent = typeof o.isCurrent === 'function' ? o.isCurrent : () => true;
    const setTimer = typeof o.setTimer === 'function' ? o.setTimer : setTimeout;
    const clearTimer = typeof o.clearTimer === 'function' ? o.clearTimer : clearTimeout;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let status = 'idle', timer = null, started = false;

    function settle(next) {
      if (status !== 'pending' && status !== 'idle') return false;
      status = next;
      if (timer != null) { clearTimer(timer); timer = null; }
      return true;
    }
    function abort() { try { if (controller) controller.abort(); } catch { /* already aborted */ } }

    /** Отмена по действию человека (закрыл окно, «Отменить», новый запрос, выход). */
    function cancel() {
      if (!settle('cancelled')) return false;
      abort();
      return true;
    }

    /**
     * @param {(signal: AbortSignal|undefined) => Promise<any>} fetcher
     * @returns {Promise<{status:'done'|'timeout'|'cancelled'|'stale'|'error', value?:any, error?:any, late?:boolean}>}
     */
    async function run(fetcher) {
      if (started) throw new Error('AiRequestV1: run() may be called once');
      started = true;
      if (status === 'cancelled') return { status };
      status = 'pending';
      timer = setTimer(() => { if (settle('timeout')) abort(); }, timeoutMs);
      let value, error, failed = false;
      try { value = await fetcher(controller ? controller.signal : undefined); }
      catch (caught) { failed = true; error = caught; }
      if (status !== 'pending') return { status, late: !failed };
      if (!isCurrent()) { settle('stale'); abort(); return { status: 'stale' }; }
      if (failed) { settle('error'); return { status: 'error', error }; }
      settle('done');
      return { status: 'done', value };
    }

    return {
      run,
      cancel,
      timeoutMs,
      get status() { return status; },
      get signal() { return controller ? controller.signal : undefined; },
    };
  }

  return { VERSION, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, create };
});
