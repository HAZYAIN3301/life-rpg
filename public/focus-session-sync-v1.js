(function(root) {
  'use strict';
  function snapshot(tm, ended) {
    const elapsed = tm.accumulatedMs + (tm.running ? ended - tm.startedAt : 0);
    const activeMs = Math.floor(elapsed - (tm.breakMs || 0) - (tm.phase === 'break' ? Math.max(0, elapsed - (tm.phaseStartElapsed || 0)) : 0));
    if (!tm.focusId || activeMs < 60000) return null;
    return { id: tm.focusId, taskId: tm.taskId, startedAt: tm.focusStartedAt,
      endedAt: new Date(ended).toISOString(), activeMs: Math.min(86400000, activeMs) };
  }
  function create({ account, storage, request, changed }) {
    let busy = false;
    const key = id => 'satoru.focus.pending.v1:' + id;
    const read = id => { const value = JSON.parse(storage.getItem(key(id)) || '[]'); if (!Array.isArray(value)) throw Error('focus_queue'); return value; };
    function count() { try { return account() ? read(account()).length : 0; } catch { return -1; } }
    function enqueue(row) {
      const id = account(); if (!id) return false;
      try {
        const rows = read(id); if (!rows.some(r => r.id === row.id)) rows.push(row);
        storage.setItem(key(id), JSON.stringify(rows)); changed(); void flush(); return true;
      } catch { return false; }
    }
    async function flush() {
      const id = account(); if (!id || busy) return;
      busy = true;
      try {
        for (const row of read(id)) {
          if (account() !== id) break;
          const response = await request(row), data = await response.json();
          const exact = response.ok && data.receipt && Object.keys(row).every(k => data.receipt[k] === row[k]);
          const alreadyStopped = response.status === 409 && data.error === 'focus_conflict' && data.receipt
            && ['id','taskId','startedAt'].every(k => data.receipt[k] === row[k]);
          if (account() !== id || !(exact || alreadyStopped)) break;
          storage.setItem(key(id), JSON.stringify(read(id).filter(r => r.id !== row.id)));
          changed();
        }
      } catch { /* Keep the exact request for explicit or online retry. */ }
      finally { busy = false; }
    }
    return { enqueue, flush, count };
  }
  root.FocusSessionSyncV1 = { create, snapshot };
  if (typeof module === 'object') module.exports = root.FocusSessionSyncV1;
})(typeof window === 'undefined' ? globalThis : window);
