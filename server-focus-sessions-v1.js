'use strict';
const fs = require('node:fs'), path = require('node:path');
const FILE = 'focus-sessions';
const fail = code => { throw Object.assign(Error(code), { code }); };
function valid(row) {
  return row && Object.keys(row).sort().join('|') === 'activeMs|endedAt|id|startedAt|taskId'
    && typeof row.id === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(row.id)
    && typeof row.taskId === 'string' && row.taskId.length > 0 && row.taskId.length <= 200
    && Number.isSafeInteger(row.activeMs) && row.activeMs >= 60000 && row.activeMs <= 86400000
    && Number.isFinite(Date.parse(row.startedAt)) && Number.isFinite(Date.parse(row.endedAt))
    && Date.parse(row.endedAt) - Date.parse(row.startedAt) >= row.activeMs;
}
function load(dir) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(dir, FILE + '.json'), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return { version: 1, sessions: [] }; throw e; }
  if (data?.version !== 1 || !Array.isArray(data.sessions) || data.sessions.some(r => !valid(r))
    || new Set(data.sessions.map(r => r.id)).size !== data.sessions.length) fail('focus_storage');
  return data;
}
function save(dir, input, tasks, write, now = Date.now()) {
  if (!valid(input) || Date.parse(input.endedAt) > now || Date.parse(input.startedAt) > now) fail('focus_request');
  const data = load(dir), old = data.sessions.find(r => r.id === input.id);
  if (old) {
    if (Object.keys(old).some(k => old[k] !== input[k])) {
      write(path.join(dir, FILE + '.json'), data);
      throw Object.assign(Error('focus_conflict'), { code: 'focus_conflict', receipt: old });
    }
  } else {
    if (!Array.isArray(tasks) || !tasks.some(t => t?.id === input.taskId)) fail('focus_task');
    if (data.sessions.length >= 20000) fail('focus_capacity');
    data.sessions.push(input);
  }
  write(path.join(dir, FILE + '.json'), data);
  return { receipt: input, replay: !!old };
}
module.exports = { FILE, load, save, valid };
