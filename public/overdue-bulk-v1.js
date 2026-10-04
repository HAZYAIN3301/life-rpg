/* Pure selection guard. Persistence and commitment release belong to the existing WAL. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OverdueBulkV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const stamp = value => JSON.stringify(value, function (_, v) {
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v;
  });
  const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  const eligible = (task, day) => !!task && !task.done && !task.amnesty
    && validDay(task.date) && task.date < day;
  function snapshot(tasks, day) {
    return (tasks || []).filter(t => eligible(t, day)).map(t => ({
      id: String(t.id), title: t.title, date: t.date, stamp: stamp(t),
    }));
  }
  function select(tasks, shown, ids, day, { kind, date, activeTaskId } = {}) {
    if (!validDay(day) || !['move', 'delete'].includes(kind)) return { ok: false, error: 'invalid' };
    if (kind === 'move' && (!validDay(date) || date < day)) return { ok: false, error: 'date' };
    const keys = [...new Set((ids || []).map(String))];
    if (!keys.length || keys.length > 50) return { ok: false, error: 'selection' };
    if (activeTaskId && keys.includes(String(activeTaskId))) return { ok: false, error: 'focus' };
    const selected = [];
    for (const id of keys) {
      const original = shown.find(t => t.id === id), matches = tasks.filter(t => String(t.id) === id);
      if (!original || matches.length !== 1 || !eligible(matches[0], day)
        || stamp(matches[0]) !== original.stamp) return { ok: false, error: 'changed' };
      selected.push(matches[0]);
    }
    return { ok: true, tasks: selected };
  }
  return Object.freeze({ snapshot, select });
});
