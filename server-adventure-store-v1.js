'use strict';

const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Policy = require('./server-adventure-policy-v1.js');
const FILE = 'party-adventures-v1.json';

// Foundation only: not registered in server.js, not reachable through /api/data.
// Caller supplies authenticated context and OWN authoritative task reads after WAL recovery.
// All dependencies must be synchronous. One Node writer; no multi-process guarantees.
function createService({ read, write, confirm = () => {}, context, readTask }) {
  for (const fn of [read, write, confirm, context, readTask]) if (typeof fn !== 'function') throw new TypeError('adventure_dependencies');
  const sync = value => {
    if (value && typeof value.then === 'function') throw new TypeError('adventure_async_dependency');
    return value;
  };
  const snapshot = () => Policy.validate(sync(read()) ?? Policy.empty());
  function save(result) {
    if (!result.replay) sync(write(result.state));
    else if (result.state.revision > 0) sync(confirm()); // Finish an ambiguous rename/fsync.
    return result;
  }
  function join(actor, input) {
    const ctx = sync(context(actor));
    if (ctx?.actor !== actor) throw new Error('adventure_actor_mismatch');
    const result = save(Policy.join(snapshot(), ctx, input));
    return { replay: result.replay, chapter: Policy.view(result.state, ctx) };
  }
  function contribute(actor, input) {
    const ctx = sync(context(actor));
    if (ctx?.actor !== actor) throw new Error('adventure_actor_mismatch');
    const state = snapshot();
    // Validate authority, consent, payload, replay and version BEFORE reading personal data.
    let result;
    try { result = Policy.contribute(state, ctx, input, null); }
    catch (error) {
      if (error.code !== 'task_not_saved') throw error;
      result = Policy.contribute(state, ctx, input, sync(readTask(actor, input.taskId)));
    }
    save(result);
    return { replay: result.replay, chapter: Policy.view(result.state, ctx) };
  }
  function view(actor) {
    const ctx = sync(context(actor));
    if (ctx?.actor !== actor) throw new Error('adventure_actor_mismatch');
    return Policy.view(snapshot(), ctx);
  }
  return Object.freeze({ join, contribute, view,
    // Internal lifecycle hooks, never pass a client-supplied actor to these.
    withdraw: (actor, partyId) => { const r = save(Policy.withdraw(snapshot(), actor, partyId)); return { replay: r.replay }; },
    eraseAccount: actor => { const r = save(Policy.eraseAccount(snapshot(), actor)); return { replay: r.replay }; } });
}

function fileStorage(dataDir, io = fs) {
  if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) throw new TypeError('absolute_data_dir_required');
  const file = path.join(dataDir, FILE);
  function confirm() {
    for (const target of [file, dataDir]) {
      let fd;
      try { fd = io.openSync(target, 'r'); io.fsyncSync(fd); }
      finally { if (fd !== undefined) io.closeSync(fd); }
    }
  }
  return {
    confirm,
    read() {
      try { return Policy.validate(JSON.parse(io.readFileSync(file, 'utf8'))); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    write(state) {
      Policy.validate(state);
      io.mkdirSync(dataDir, { recursive: true });
      const temporary = `${file}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
      let fd;
      try {
        fd = io.openSync(temporary, 'wx', 0o600);
        io.writeFileSync(fd, JSON.stringify(state)); io.fsyncSync(fd); io.closeSync(fd); fd = undefined;
        io.renameSync(temporary, file);
        fd = io.openSync(dataDir, 'r'); io.fsyncSync(fd); io.closeSync(fd); fd = undefined;
      } catch (error) {
        if (fd !== undefined) { try { io.closeSync(fd); } catch {} }
        try { io.unlinkSync(temporary); } catch {}
        throw error; // A retry re-reads the receipt even if rename already committed.
      }
    },
  };
}
module.exports = Object.freeze({ FILE, createService, fileStorage });
