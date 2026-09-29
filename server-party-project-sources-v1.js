'use strict';
const fs = require('node:fs'), path = require('node:path');
const Focus = require('./server-focus-sessions-v1.js');
// Read only after the account journal has recovered. Missing files are empty;
// malformed files must not turn into a successful empty contribution list.
function read(dir, name, fallback, valid) {
  let value;
  try { value = JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  if (!valid(value)) throw Error('project_source_storage');
  return value;
}
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
function load(dir, hash) {
  const tasks = read(dir, 'tasks', [], Array.isArray);
  const habits = read(dir, 'habits', [], Array.isArray);
  const log = read(dir, 'habitlog', {}, object);
  const rows = tasks.filter(t => t && typeof t.id === 'string').map(task => ({ ...task, kind: 'task', source: hash(task.id) }));
  for (const [day, entries] of Object.entries(log)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !object(entries)) throw Error('project_source_storage');
    for (const [id, entry] of Object.entries(entries)) {
      if (!object(entry)) throw Error('project_source_storage');
      const habit = habits.find(h => h?.id === id);
      if (!habit) continue;
      const key = JSON.stringify([day, id]);
      rows.push({ id: key, kind: 'habit', title: habit.title, done: true, completedAt: entry.at,
        source: hash(key, 'habit') });
    }
  }
  const seen = new Set();
  for (const s of Focus.load(dir).sessions.slice().reverse()) {
    const task = tasks.find(t => t?.id === s.taskId);
    if (!task || task.done || seen.has(s.taskId)) continue;
    seen.add(s.taskId);
    rows.push({ id: s.taskId, kind: 'focus', title: task.title, done: true, completedAt: s.endedAt, source: hash(s.taskId) });
  }
  return rows;
}
module.exports = { load };
