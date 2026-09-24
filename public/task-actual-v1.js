(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TaskActualV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function minutes(hours, remainder) {
    const h = String(hours ?? '').trim(), m = String(remainder ?? '').trim();
    if (!/^\d+$/.test(h) || !/^\d+$/.test(m)) return null;
    const total = Number(h) * 60 + Number(m);
    return Number(m) < 60 && Number.isSafeInteger(total) ? total : null;
  }
  // Absolute replacement, never a reward event. A retry of a committed value is safe;
  // a different concurrent edit requires reopening rather than silently overwriting it.
  function update(tasks, id, total, expected, timerTaskId) {
    if (!Array.isArray(tasks) || !Number.isSafeInteger(total) || total < 0 || id === timerTaskId) return null;
    const task = tasks.find(item => item.id === id);
    if (!task || ((task.actualMin ?? null) !== expected && (task.actualMin ?? null) !== (total || null))) return null;
    return tasks.map(item => item.id === id ? { ...item, actualMin: total || null } : item);
  }
  return { minutes, update };
});
