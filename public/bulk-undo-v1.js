/* Satoru Bulk Undo v1 — массовая операция как одна обратимая транзакция.
 *
 * Договорённость 01.09: ассистент получает массовые операции («убери все цели
 * Jugend Forscht», «перенеси связанные задачи на следующую неделю»), но каждая
 * обязана иметь предпросмотр и Undo. Необратимого уничтожения нет ни в одном виде.
 *
 * Это не противоречит правилу `assistant-actions-v1`, а исполняет его: у ассистента
 * по-прежнему нет глагола «удалить». «Убрать» — обратимая смена статуса, и этот
 * модуль отвечает за то, чтобы обратимость была настоящей, а не обещанной.
 *
 * ⚠️ Четыре свойства, без которых массовая операция опасна:
 *
 * 1. **Предпросмотр точен.** `plan()` перечисляет ровно те объекты, которые
 *    изменятся, и отдельно — те, что уже в нужном состоянии. Человек видит список
 *    ДО того, как что-то произошло. Это прямой ответ на «задел не то».
 *
 * 2. **Undo хранит прошлые значения, а не догадку.** Восстановление возвращает
 *    именно то, что было у каждого объекта, а не «противоположное действие»: у
 *    половины объектов противоположное действие было бы неверным.
 *
 * 3. **Повтор не удваивает.** Одна и та же транзакция, применённая дважды (retry,
 *    двойное нажатие, второе устройство), меняет состояние один раз.
 *
 * 4. **Просроченный Undo отказывает вслух.** Молчаливое «ничего не произошло»
 *    хуже честного отказа: человек уверен, что откатил, а состояние прежнее.
 *
 * ⚠️ Чего модуль не делает: не удаляет, не трогает аккаунт, ключи и приватность,
 * не решает, что показать, и не исполняет ничего сам — отдаёт новое состояние,
 * сохраняет вызывающий.
 *
 * Чистый модуль: только данные на входе, ничего не читает из DOM/State/времени сам.
 */
(function exposeBulkUndo(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BulkUndoV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildBulkUndo() {
  'use strict';

  const VERSION = '1.0.0';

  // Потолок пачки. Не техническое ограничение, а продуктовое: список, который
  // человек не может прочитать глазами, он и не проверит — а значит предпросмотр
  // перестанет быть предпросмотром.
  const MAX_ITEMS = 50;
  // Окно отката. Достаточно, чтобы заметить ошибку, и мало, чтобы состояние не
  // висело в неопределённости сутками.
  const UNDO_TTL_MS = 30 * 60 * 1000;
  const MAX_ID = 64;

  /* Закрытый список полей, которые массовая операция вправе менять. Всё остальное
   * недоступно: неизвестное поле не имеет исполнителя. */
  const OPS = Object.freeze({
    archive:   { field: 'archived', to: true },
    unarchive: { field: 'archived', to: false },
    pause:     { field: 'paused',   to: true },
    resume:    { field: 'paused',   to: false },
  });
  const OP_LIST = Object.freeze(Object.keys(OPS));

  function text(v, max) {
    const raw = typeof v === 'string' ? v : '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function idOf(v) { return text(v, MAX_ID); }

  /**
   * Предпросмотр. Ничего не меняет.
   *
   * `affected` — что действительно изменится, с прошлым и будущим значением.
   * `skipped` — уже в нужном состоянии; они не попадут ни в изменение, ни в Undo,
   * иначе откат «вернул» бы им состояние, которого у них не было.
   * `missing` — id, которых нет среди своих объектов. Их наличие не отменяет
   * операцию, но человек обязан их увидеть: это признак, что список собран неверно.
   *
   * @returns {{planId,op,field,to,affected,skipped,missing}|null}
   */
  function plan(input) {
    const inp = input || {};
    const op = OP_LIST.indexOf(String(inp.op)) >= 0 ? String(inp.op) : '';
    if (!op) return null;
    const items = Array.isArray(inp.items) ? inp.items : null;
    if (!items) return null;
    const ids = (Array.isArray(inp.ids) ? inp.ids : []).map(idOf).filter(Boolean);
    if (!ids.length || ids.length > MAX_ITEMS) return null;

    const spec = OPS[op];
    const seen = new Set();
    const affected = [], skipped = [], missing = [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (seen.has(id)) continue;           // дубль в запросе — не повод тронуть дважды
      seen.add(id);
      const item = items.find((x) => x && idOf(x.id) === id);
      if (!item) { missing.push(id); continue; }
      const prev = !!item[spec.field];
      const row = { id, title: text(item.title, 80), field: spec.field, from: prev, to: spec.to };
      if (prev === spec.to) skipped.push(row); else affected.push(row);
    }
    // planId детерминирован: тот же запрос даёт тот же id, и повторное подтверждение
    // распознаётся как повтор, а не как новая операция.
    const planId = `${op}|${affected.map((a) => a.id).sort().join(',')}`;
    return { planId, op, field: spec.field, to: spec.to, affected, skipped, missing };
  }

  /**
   * Применение. Возвращает новое состояние и запись отката.
   *
   * `appliedPlans` — журнал уже применённых planId. Если план в нём есть, состояние
   * возвращается без изменений и `applied: false`: повтор не удваивает.
   */
  function apply(items, planned, nowIso, appliedPlans) {
    const list = Array.isArray(items) ? items : [];
    if (!planned || !planned.planId || !Array.isArray(planned.affected)) {
      return { items: list, undo: null, applied: false, reason: 'bad_plan' };
    }
    const done = Array.isArray(appliedPlans) ? appliedPlans : [];
    if (done.indexOf(planned.planId) >= 0) {
      return { items: list, undo: null, applied: false, reason: 'already_applied' };
    }
    if (!planned.affected.length) {
      return { items: list, undo: null, applied: false, reason: 'nothing_to_do' };
    }
    const at = typeof nowIso === 'string' && !isNaN(Date.parse(nowIso)) ? nowIso : new Date().toISOString();
    const byId = new Map(planned.affected.map((a) => [a.id, a]));
    const next = list.map((item) => {
      const row = item && byId.get(idOf(item.id));
      if (!row) return item;
      const copy = Object.assign({}, item);
      copy[row.field] = row.to;
      return copy;
    });
    // Прошлые значения сохраняются поимённо. Откат не «делает наоборот», а
    // возвращает то, что было: у части объектов «наоборот» было бы неверным.
    const undo = {
      token: `${planned.planId}|${at}`,
      planId: planned.planId,
      at,
      op: planned.op,
      restore: planned.affected.map((a) => ({ id: a.id, field: a.field, prev: a.from })),
    };
    return { items: next, undo, applied: true, reason: '' };
  }

  function isExpired(undoRecord, nowIso, ttlMs) {
    if (!undoRecord || typeof undoRecord.at !== 'string') return true;
    const at = Date.parse(undoRecord.at);
    const now = Date.parse(typeof nowIso === 'string' ? nowIso : '');
    if (!Number.isFinite(at) || !Number.isFinite(now)) return true;
    const ttl = Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : UNDO_TTL_MS;
    return now - at > ttl;
  }

  /**
   * Откат. Отказывает вслух при чужом токене и по истечении окна — молчаливое
   * «ничего не произошло» оставило бы человека уверенным, что он откатил.
   *
   * @returns {{items, undone: boolean, reason: string}}
   */
  function undo(items, undoRecord, token, nowIso, ttlMs) {
    const list = Array.isArray(items) ? items : [];
    if (!undoRecord || !undoRecord.token) return { items: list, undone: false, reason: 'no_record' };
    if (String(token) !== String(undoRecord.token)) return { items: list, undone: false, reason: 'bad_token' };
    if (isExpired(undoRecord, nowIso, ttlMs)) return { items: list, undone: false, reason: 'expired' };
    const restore = Array.isArray(undoRecord.restore) ? undoRecord.restore : [];
    if (!restore.length) return { items: list, undone: false, reason: 'nothing_to_undo' };
    const byId = new Map(restore.map((r) => [idOf(r.id), r]));
    const next = list.map((item) => {
      const row = item && byId.get(idOf(item.id));
      if (!row) return item;
      const copy = Object.assign({}, item);
      copy[row.field] = row.prev;
      return copy;
    });
    return { items: next, undone: true, reason: '' };
  }

  /**
   * Запись в журнал операций. Хранит, что произошло, — но не содержимое объектов:
   * заголовки в аудите быстро устаревают и превращаются во вторую копию данных.
   */
  function auditEntry(planned, result, nowIso) {
    if (!planned || !result) return null;
    return {
      at: typeof nowIso === 'string' && !isNaN(Date.parse(nowIso)) ? nowIso : new Date().toISOString(),
      op: planned.op,
      planId: planned.planId,
      applied: !!result.applied,
      reason: result.reason || '',
      affected: planned.affected.length,
      skipped: planned.skipped.length,
      missing: planned.missing.length,
    };
  }

  return Object.freeze({
    VERSION, MAX_ITEMS, UNDO_TTL_MS, OPS, OP_LIST,
    plan, apply, undo, isExpired, auditEntry,
  });
});
