'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Shelf = require('../public/return-shelf-v1.js');
const Profile = require('../public/inspiration-profile-v1.js');
const Supply = require('../public/inspiration-supply-runtime-v1.js');
const Copy = require('../public/inspiration-supply-ui-v1.js');
const APP = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const DAY = '2026-09-12', NOW = DAY + 'T12:00:00.000Z';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
function between(start, end) {
  const a = APP.indexOf(start), b = APP.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start); return APP.slice(a, b);
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function harness(path, modes = []) {
  const catalog = Supply.prepare({ day: DAY, now: NOW, locale: 'en', profile: Profile.configure({
    interests: [{ id: 'rest', label: 'rest' }], formats: ['quote'],
  }) }).catalog;
  const item = catalog[0], savedId = 'ins-' + item.id;
  const State = { me: { id: 'account-a' }, _shelfBusy: '', _shelfLoadError: '', _shelfError: '',
    shelf: { version: 1, items: [{ id: 'private-a', kind: 'energy', title: 'Private A', why: 'Personal memory', note: 'Only A', addedOn: DAY }] } };
  if (path === 'restore') State.shelf.items.push({ id: savedId, catalogId: item.id, kind: 'energy', title: item.title,
    why: 'My saved material', addedOn: DAY, archivedOn: DAY });
  State.shelf = Shelf.normalize(State.shelf);
  const Store = { _writeEpoch: 4 }, before = clone(State.shelf), server = { shelf: clone(State.shelf) };
  const events = [], calls = [], queue = modes.slice();
  const next = Shelf.archive(State.shelf, 'private-a', DAY);
  const context = vm.createContext({ State, Store, window: { ReturnShelfV1: Shelf }, CSS: { escape: String },
    shelfEngine: () => Shelf, shelfState: () => State.shelf, inspirationCatalog: () => catalog,
    todayStr: () => DAY, inspirationSupplyCopy: key => Copy.copy(key, 'en'), t: value => value,
    render: () => events.push(['render']), toast: value => events.push(['toast', value]),
    sfx: value => events.push(['sound', value]), track: value => events.push(['track', value]),
    console: { error: (...args) => events.push(['log', ...args.map(String)]) },
    handleAccountSessionExpired: () => {
      events.push(['expired']); State.me = null; Store._writeEpoch += 1;
      State.shelf = Shelf.emptyState(); State._shelfBusy = ''; State._shelfError = '';
    },
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body), accountId = State.me?.id;
      calls.push({ url, payload, accountId });
      const mode = queue.shift();
      if (typeof mode === 'function') return mode({ url, payload, accountId });
      if (mode === 'network') throw new Error('offline before write');
      if (mode === 401 || mode === 500) return { status: mode, ok: false, json: async () => ({ error: 'test refusal' }) };
      // Simulate the existing POST upsert receipt, or whole-envelope PUT receipt.
      // The real ShelfStore and app handlers below own request construction/effects.
      if (url === '/api/shelf/item') {
        const at = server.shelf.items.findIndex(row => row.id === payload.item.id);
        if (at < 0) server.shelf.items.push(clone(payload.item)); else server.shelf.items[at] = clone(payload.item);
      } else { assert.equal(url, '/api/shelf'); server.shelf = clone(payload.data); }
      if (mode === 'lost-reply') throw new Error('write committed, reply lost');
      return { status: 200, ok: true, json: async () => ({ ok: true, stored: payload.item?.id, count: server.shelf.items.length }) };
    },
  });
  vm.runInContext(between('function validateShelfEnvelope(', '// ============================================================')
    + between('async function saveInspirationCatalogItem(', 'function inspirationEmbedAllowed(')
    + between('async function commitShelf(', 'async function archiveShelfItem(')
    + '\n globalThis.ShelfStore = ShelfStore;', context);
  const run = () => path === 'commit' ? context.commitShelf(next, { toastKey: 'Saved' }) : context.saveInspirationCatalogItem(item.id);
  return { context, State, Store, item, savedId, before, next, events, calls, queue, server, run };
}

for (const path of ['add', 'restore', 'commit']) {
  for (const scope of ['account', 'epoch']) {
    for (const outcome of [200, 401, 500, 'network']) {
      test(`${path}: late ${outcome} after ${scope} change cannot mutate the new shelf, auth or UI`, async () => {
        const response = deferred(), h = harness(path, [() => response.promise]);
        const pending = h.run(); await turn(); assert.equal(h.calls.length, 1);
        if (scope === 'account') h.State.me = { id: 'account-b' };
        else h.Store._writeEpoch += 1;
        h.State.shelf = { version: 1, items: [{ id: 'new-scope', title: 'New scope', kind: 'energy', why: 'Keep' }] };
        h.State._shelfBusy = 'new-operation'; h.State._shelfError = 'new-error';
        h.State._shelfFocusAfterCommit = 'new-focus';
        const protectedState = clone(h.State), count = h.events.length;
        if (outcome === 'network') response.reject(new Error('late network error'));
        else response.resolve({ status: outcome, ok: outcome === 200, json: async () => ({ ok: outcome === 200, stored: h.savedId }) });
        await pending;
        assert.deepEqual(h.State, protectedState);
        assert.equal(h.events.length, count, 'old auth/error/success/render effects must all stop');
      });
    }
  }
}

test('add rechecks scope after its asynchronous response body before acting on a late 401', async () => {
  const body = deferred(), h = harness('add', [() => ({ status: 401, ok: false, json: () => body.promise })]);
  const pending = h.run(); await turn();
  h.State.me = { id: 'account-b' }; h.Store._writeEpoch += 1;
  h.State.shelf = Shelf.emptyState(); h.State._shelfBusy = 'new-operation';
  const protectedState = clone(h.State), count = h.events.length;
  body.resolve({ error: 'not logged in' }); await pending;
  assert.deepEqual(h.State, protectedState); assert.equal(h.events.length, count);
});

for (const path of ['add', 'restore', 'commit']) {
  test(`${path}: current-account 500 remains visible, then explicit retry confirms the original action`, async () => {
    const h = harness(path, [500]);
    await h.run();
    assert.deepEqual(h.State.shelf, h.before); assert.deepEqual(h.server.shelf, h.before);
    assert.equal(h.State._shelfBusy, ''); assert.equal(h.State._shelfError, Copy.copy('save_error', 'en'));
    assert.equal(h.events.some(event => ['sound', 'track', 'expired'].includes(event[0])), false);
    await h.run();
    assert.equal(h.calls.length, 2); assert.deepEqual(h.calls[0].payload, h.calls[1].payload);
    assert.deepEqual(clone(h.State.shelf), h.server.shelf);
    assert.equal(h.State._shelfError, '', 'confirmed retry clears the earlier error');
    if (path === 'add') assert.equal(h.events.filter(event => event[0] === 'track' && event[1] === 'inspiration:save').length, 1);
    else if (path === 'restore') assert.equal(h.State.shelf.items.find(row => row.id === h.savedId).archivedOn, undefined);
  });
  test(`${path}: lost reply reports uncertainty and retry neither duplicates the saved row nor fakes early success`, async () => {
    const h = harness(path, ['lost-reply']);
    await h.run();
    assert.deepEqual(h.State.shelf, h.before); assert.notDeepEqual(h.server.shelf, h.before);
    assert.equal(h.State._shelfError, Copy.copy('save_error', 'en'));
    assert.equal(h.events.some(event => ['sound', 'track'].includes(event[0])), false);
    await h.run();
    assert.deepEqual(h.calls[0].payload, h.calls[1].payload);
    assert.deepEqual(clone(h.State.shelf), h.server.shelf);
    assert.equal(h.State._shelfError, '');
    assert.equal(new Set(h.server.shelf.items.map(row => row.id)).size, h.server.shelf.items.length);
    if (path !== 'commit') assert.equal(h.server.shelf.items.filter(row => row.id === h.savedId).length, 1);
  });
  test(`${path}: a current-account 401 expires that session without applying the candidate afterward`, async () => {
    const h = harness(path, [401]); await h.run();
    assert.equal(h.State.me, null); assert.deepEqual(h.State.shelf, Shelf.emptyState());
    assert.equal(h.events.filter(event => event[0] === 'expired').length, 1);
    assert.equal(h.events.some(event => ['sound', 'track', 'toast'].includes(event[0])), false);
    assert.deepEqual(h.server.shelf, h.before);
  });
}
