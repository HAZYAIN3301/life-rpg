'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const A = require('../public/account-import-v1');
const APP = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const clone = x => JSON.parse(JSON.stringify(x));
function between(start, end) { const a = APP.indexOf(start), b = APP.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start); return APP.slice(a, b); }
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => clone(data) });
function harness({ preview = [], commit = [], locale = 'en', reset = false } = {}) {
  const events = [], calls = [], locks = [], server = { settings: { lang: locale }, tasks: [{ id: 'old' }], days: { old: {} } };
  const State = { me: { id: 'owner-a' }, settings: clone(server.settings), tasks: clone(server.tasks), days: clone(server.days) };
  const control = () => ({ disabled: false, textContent: '', focused: 0, focus() { this.focused++; } });
  const button = control(), close = control(), cancel = control(), input = { ...control(), value: 'RESET' };
  const status = { textContent: '' };
  const overlay = { id: reset ? 'account-reset-modal' : 'account-import-modal', isConnected: true,
    _accountId: State.me.id, _writeEpoch: 0,
    _archive: { data: { tasks: [{ id: 'new', title: 'Archive task' }], days: { imported: { text: 'Archive day' } }, purchases: [{ id: 'old-purchase', cost: 7 }] } },
    querySelector(selector) {
      if (selector.includes('result')) return status;
      if (selector.includes('input')) return input;
      if (selector === '[data-action="confirm-account-import"]' && reset) return null;
      return button;
    }, querySelectorAll() { return [button, close, cancel, input]; }, status, button, close, cancel, input };
  const context = vm.createContext({ State, window: { AccountImportV1: A }, structuredClone, AbortSignal, setTimeout, clearTimeout,
    uid: () => 'unique_request', lang: () => State.settings.lang, t: s => s,
    commitmentWriteBase: () => ({ settings: { exists: true, value: clone(server.settings) }, tasks: { exists: true, value: clone(server.tasks) } }),
    accountResetDataCandidate: () => ({ settings: clone(State.settings), tasks: [], days: {} }),
    rememberDedicatedCommitSlots: data => { events.push(['remember', clone(data)]); return true; },
    closeAccountDialog: id => { events.push(['close', id]); overlay.isConnected = false; },
    toast: s => events.push(['toast', s]), render: () => events.push(['render']),
    location: { reload: () => events.push(['reload']) },
    handleAccountSessionExpired: () => { events.push(['expired']); State.me = null; context.api.Store.cancelPending(); },
    showAccountImportDialog: () => events.push(['opened']),
    document: { getElementById: () => ({ textContent: '', setAttribute() {} }) },
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body), preparing = url.endsWith('/preview');
      assert.ok(['/api/account/import', '/api/account/import/preview'].includes(url));
      calls.push({ url, body: options.body, payload });
      const mode = (preparing ? preview : commit).shift();
      if (typeof mode === 'function') return mode(payload);
      if (mode === 'offline') throw Error('offline');
      if (mode === 500) return response(500, { error: 'write_failed' });
      if (mode === 'conflict') return response(409, { error: 'import_revision_conflict' });
      if (mode === 'malformed') return response(200, { ok: true });
      if (mode === '401') return response(401, { error: 'not logged in' });
      if (preparing) return response(200, { ok: true, files: Object.keys(payload.data), ticket: { version: 1,
        requestId: payload.requestId, requestHash: 'a'.repeat(64), signature: 'b'.repeat(64),
        revisions: Object.fromEntries(A.namesFor(payload.data).map(n => [n, 'c'.repeat(64)])) } });
      const replay = Object.keys(payload.data).every(n => A.canonical(server[n]) === A.canonical(payload.data[n]));
      if (!replay) { Object.assign(server, clone(payload.data)); events.push(['server-commit']); }
      if (mode === 'lost') throw Error('response lost after durable commit');
      return response(200, { ok: true, writeVersion: 2, files: Object.keys(payload.data),
        requestId: payload.ticket.requestId, requestHash: payload.ticket.requestHash, replay });
    },
  });
  vm.runInContext('const Store = { _timers: {}, _writes: {}, _persisted: {}, _writeEpoch: 0, '
    + between('  cancelPending() {', '  async _put(') + '};\n'
    + between('function accountImportCurrent(', 'function showAccountImportDialog(')
    + '\nglobalThis.api = { Store, prepareAccountImport, commitAccountImport, accountImportRequest };', context);
  const run = context.api.Store.runExclusive.bind(context.api.Store);
  context.api.Store.runExclusive = (names, operation) => { locks.push(clone(names)); return run(names, operation); };
  return { ...context.api, context, State, overlay, calls, events, locks, server };
}

test('archive preview retries without a save and requires a separate explicit confirmation', async () => {
  const h = harness({ preview: [500] });
  assert.equal(await h.prepareAccountImport(h.overlay), false);
  assert.equal(h.overlay.status.textContent, A.text('preparingFailed', 'en'));
  assert.equal(await h.commitAccountImport(h.overlay), false, 'retry only prepares the archive');
  assert.equal(h.calls.length, 2); assert.equal(h.calls[0].body, h.calls[1].body);
  assert.ok(h.calls.every(c => c.url.endsWith('/preview')));
  assert.ok(h.overlay._importAttempt.ticket); assert.deepEqual(h.events, []);
  assert.equal(await h.commitAccountImport(h.overlay), true);
  assert.deepEqual(h.locks[0].sort(), ['settings', 'tasks', 'days', 'purchases'].sort());
  assert.deepEqual(h.events.map(e => e[0]), ['server-commit', 'reload']);
  assert.equal(h.Store._writeEpoch, 1, 'old local writers are fenced before reload');
});
for (const mode of [500, 'offline', 'malformed']) test('failed import retains the exact candidate: ' + mode, async () => {
  const h = harness({ commit: [mode] }); await h.prepareAccountImport(h.overlay);
  const before = clone(h.State);
  assert.equal(await h.commitAccountImport(h.overlay), false);
  assert.deepEqual(h.State, before); assert.deepEqual(h.events, []);
  assert.equal(h.overlay.status.textContent, A.text('unconfirmed', 'en'));
  assert.equal(h.overlay.button.disabled, false);
  h.overlay._archive.data.tasks[0].title = 'later UI mutation';
  assert.equal(await h.commitAccountImport(h.overlay), true);
  assert.equal(h.calls[1].body, h.calls[2].body);
  assert.equal(h.server.tasks[0].title, 'Archive task');
});
test('lost import reply replays once; no false unchanged-data promise and no duplicate apply', async () => {
  const h = harness({ commit: ['lost'] }); await h.prepareAccountImport(h.overlay);
  assert.equal(await h.commitAccountImport(h.overlay), false);
  assert.equal(h.overlay.status.textContent, A.text('unconfirmed', 'en'));
  assert.equal(h.server.tasks[0].id, 'new'); assert.equal(h.State.tasks[0].id, 'old');
  assert.equal(await h.commitAccountImport(h.overlay), true);
  assert.equal(h.calls[1].body, h.calls[2].body);
  assert.deepEqual(h.events.map(e => e[0]), ['server-commit', 'reload']);
});
for (const locale of ['ru', 'en', 'de', 'uk', 'es']) for (const mode of ['conflict', 500])
test(locale + ': inline import failure ' + mode, async () => {
  const h = harness({ locale, commit: [mode] }); await h.prepareAccountImport(h.overlay);
  assert.equal(await h.commitAccountImport(h.overlay), false);
  assert.equal(h.overlay.status.textContent, A.text(mode === 'conflict' ? 'conflict' : 'unconfirmed', locale));
  assert.equal(h.overlay.button.focused, 1); assert.deepEqual(h.events, []);
});
for (const phase of ['preview', 'commit']) for (const boundary of ['fetch', 'json']) for (const status of [200, 401, 409])
test(`${phase}: account switch while awaiting ${boundary}/${status} cannot affect the new account`, async () => {
  const gate = deferred();
  const body = status === 401 ? { error: 'not logged in' } : { error: 'import_revision_conflict' };
  const delayed = () => boundary === 'fetch' ? gate.promise
    : { status, ok: status === 200, json: () => gate.promise };
  const h = harness({ [phase]: [delayed] });
  if (phase === 'commit') await h.prepareAccountImport(h.overlay);
  const pending = phase === 'preview' ? h.prepareAccountImport(h.overlay) : h.commitAccountImport(h.overlay);
  await tick();
  h.State.me = { id: 'owner-b' }; h.Store.cancelPending();
  const visible = h.overlay.status.textContent;
  gate.resolve(boundary === 'fetch' ? response(status, body) : body);
  assert.equal(await pending, false);
  assert.equal(h.State.me.id, 'owner-b'); assert.deepEqual(h.events, []);
  assert.equal(h.overlay.status.textContent, visible, 'old dialog is not updated after account switch');
});
for (const invalidate of ['epoch', 'closed']) test('late preview cannot affect an invalidated dialog: ' + invalidate, async () => {
  const gate = deferred(), h = harness({ preview: [() => gate.promise] });
  const pending = h.prepareAccountImport(h.overlay); await tick();
  if (invalidate === 'epoch') h.Store.cancelPending(); else h.overlay.isConnected = false;
  const visible = h.overlay.status.textContent;
  gate.resolve(response(401, { error: 'not logged in' }));
  assert.equal(await pending, false); assert.deepEqual(h.events, []);
  assert.equal(h.State.me.id, 'owner-a'); assert.equal(h.overlay.status.textContent, visible);
});
test('a malformed successful preview cannot authorize a save', async () => {
  const h = harness({ preview: ['malformed'] });
  assert.equal(await h.prepareAccountImport(h.overlay), false);
  assert.equal(h.overlay._importAttempt.ticket, undefined); assert.deepEqual(h.events, []);
  assert.equal(h.overlay.status.textContent, A.text('preparingFailed', 'en'));
});
test('reset shares the signed preview/receipt and preserves a frozen retry candidate', async () => {
  const h = harness({ reset: true, commit: ['lost'] });
  assert.equal(await h.commitAccountImport(h.overlay), false);
  assert.deepEqual(h.State.tasks, [{ id: 'old' }]);
  assert.deepEqual(h.server.tasks, []);
  h.overlay.input.value = '';
  assert.equal(await h.commitAccountImport(h.overlay), false, 'RESET is required on every click');
  assert.equal(h.calls.length, 2);
  h.overlay.input.value = 'RESET'; h.State.settings.extra = 'not in the frozen reset';
  assert.equal(await h.commitAccountImport(h.overlay), true);
  assert.equal(h.calls[1].body, h.calls[2].body);
  assert.deepEqual(h.State.tasks, []); assert.deepEqual(h.State.days, {});
  assert.equal(h.State.settings.extra, undefined);
  assert.deepEqual(h.locks[0].sort(), ['days', 'settings', 'tasks']);
  assert.deepEqual(h.events.map(e => e[0]), ['server-commit', 'remember', 'close', 'toast', 'render']);
});
test('file reading cannot open an archive dialog in another account', async () => {
  const h = harness(), gate = deferred();
  h.context.e = { target: { id: 'account-import-file', value: 'picked', isConnected: true,
    files: [{ size: 5, text: () => gate.promise }], closest: () => ({}) } };
  vm.runInContext('(function(){' + between("  if (e.target.id === 'account-import-file') {", '  // Юзер сам выбрал сферу') + '})();', h.context);
  h.State.me = { id: 'owner-b' }; h.Store.cancelPending();
  gate.resolve(JSON.stringify({ format: 'satoru-account', version: 1, data: { tasks: [] } })); await tick();
  assert.deepEqual(h.events, []);
});
