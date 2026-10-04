'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ID = /^[a-zA-Z0-9_-]{8,80}$/;
function fault(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
function text(value, max) {
  if (typeof value !== 'string' || value.length > max) throw fault('invalid_chat');
  return value;
}
function content(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.messages) || value.messages.length > 300) throw fault('chat_limit');
  const seen = new Set();
  const messages = value.messages.map(m => {
    if (!m || !ID.test(m.id) || seen.has(m.id) || !['user', 'assistant'].includes(m.role)) throw fault('invalid_chat');
    seen.add(m.id);
    return { id: m.id, role: m.role, content: text(m.content, 32000), ...(m.failed === true ? { failed: true } : {}) };
  });
  let route = null;
  if (value.route != null) {
    if (!['entry', 'review', 'plan'].includes(value.route.mode)) throw fault('invalid_chat');
    route = { mode: value.route.mode, context: JSON.parse(JSON.stringify(value.route.context || {})), instruction: text(value.route.instruction || '', 5000) };
    if (JSON.stringify(route.context).length > 24000) throw fault('chat_limit');
  }
  const result = { title: text(value.title, 120).trim(), context: text(value.context || '', 6000), archived: value.archived === true, route, messages };
  if (!result.title || Buffer.byteLength(JSON.stringify(result)) > 512 * 1024) throw fault('chat_limit');
  return result;
}
function createService({ userDir, write }) {
  const dir = uid => path.join(userDir(uid), 'chat-threads');
  const file = (uid, id) => { if (!ID.test(id)) throw fault('invalid_chat_id'); return path.join(dir(uid), id + '.json'); };
  function read(uid, id) {
    const target = file(uid, id);
    if (!fs.existsSync(target)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
      if (raw.id !== id || !Number.isSafeInteger(raw.revision) || raw.revision < 1) throw new Error();
      return { id, revision: raw.revision, updatedAt: raw.updatedAt, ...content(raw) };
    } catch { throw fault('chat_damaged', 422); }
  }
  function all(uid) {
    if (!fs.existsSync(dir(uid))) return [];
    return fs.readdirSync(dir(uid)).filter(f => /^[a-zA-Z0-9_-]{8,80}\.json$/.test(f)).map(f => read(uid, f.slice(0, -5)));
  }
  function save(uid, id, payload) {
    // This entire read/CAS/write runs synchronously after the request body arrives.
    const previous = read(uid, id), next = content(payload);
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) throw fault('invalid_revision');
    const digest = x => crypto.createHash('sha256').update(JSON.stringify(content(x))).digest('hex');
    if (previous && previous.revision === payload.revision + 1 && digest(previous) === digest(next)) return previous;
    if ((previous?.revision || 0) !== payload.revision) throw fault('chat_conflict', 409);
    if (!previous && all(uid).length >= 100) throw fault('chat_limit', 409);
    const result = { id, revision: payload.revision + 1, updatedAt: new Date().toISOString(), ...next };
    fs.mkdirSync(dir(uid), { recursive: true });
    write(file(uid, id), result);
    return result;
  }
  function list(uid) { return all(uid).map(({ messages, route, context, ...row }) => ({ ...row, count: messages.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  return { read, save, list, all };
}
module.exports = { createService, content };
