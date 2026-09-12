'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Economy = require('../public/economy-write-v1.js');
const Account = require('../public/account-data-v1.js');
const Feedback = require('../public/purchase-feedback-v1.js');
const Progress = require('../public/personal-progress-v1.js');
const APP = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
const snapshot = value => ({ exists: true, value: clone(value) });
function between(start, end) {
  const a = APP.indexOf(start), b = APP.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start); return APP.slice(a, b);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => clone(body),
    clone() { return response(status, body); } };
}
function control(dataset = {}) {
  return { dataset, disabled: false, attributes: {}, focused: 0,
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; }, focus() { this.focused++; } };
}
function modal(kind = 'gear') {
  const confirm = control(), cancel = control(), close = control(), status = { textContent: '' };
  const nodes = { '[data-action="confirm-economy-action"]': confirm,
    '[data-action="close-economy-confirm"]:not(.modal-x)': cancel,
    '.modal-x': close, '.economy-confirm-status': status };
  return { dataset: { kind, item: kind === 'gear' ? 'sword-1' : 'reward-1' }, isConnected: true,
    querySelector: selector => nodes[selector], confirm, cancel, close, status };
}
function harness(modes = [], locale = 'en') {
  const State = { me: { id: 'account-a' }, settings: { lang: locale, gear: { owned: [], equipped: {} } },
    tasks: [], purchases: [], rewards: [{ id: 'reward-1', name: 'Tea', cost: 10 }] };
  const events = [], calls = [], queue = modes.slice();
  const server = { settings: snapshot(State.settings), purchases: snapshot([]), tasks: snapshot([]) };
  const before = clone(State), initialSnapshots = clone(server);
  let sequence = 0;
  const context = vm.createContext({ State, window: { AccountDataV1: Account, EconomyWriteV1: Economy, PurchaseFeedbackV1: Feedback, PersonalProgressV1: Progress },
    structuredClone, AbortSignal, clearTimeout, setTimeout, CSS: { escape: String },
    console: { error() {}, warn() {} }, lang: () => State.settings.lang, t: value => value,
    accountDataWriteAllowed: () => true, settingsWriteAllowed: () => true,
    skillTreePayloadAllowed: () => true, validateSettingsPayload: value => !!value && !Array.isArray(value),
    validateAccountDataPayload: (name, value) => Account.validate(name, clone(value)),
    commitmentWriteBase: () => ({ settings: clone(context.Store._persisted.settings), tasks: clone(context.Store._persisted.tasks) }),
    reportCommitmentConflict: async () => events.push(['report']),
    toast: value => events.push(['toast', value]), render: () => events.push(['render']),
    sfx: value => events.push(['sound', value]), checkAchievements: () => events.push(['achievements']),
    closeAccountDialog: id => events.push(['close', id]),
    mountAccountDialog: () => events.push(['mount']), esc: String,
    document: { getElementById: () => null, querySelector: () => null, createElement: () => modal() },
    handleAccountSessionExpired: () => { events.push(['expired']); State.me = null; context.Store.cancelPending(); },
    uid: () => String(++sequence), goldBalance: () => 100,
    economyConfirmationData: (kind, id) => ({ kind, id, cost: 10, name: kind === 'gear' ? 'Sword' : 'Tea' }),
    gearById: id => id === 'sword-1' ? { id, slot: 'weapon', name: 'Sword' } : null,
    ensureGear: () => State.settings.gear, guideV3ContextActive: () => false,
    fetch: async (url, options) => {
      assert.equal(url, '/api/economy/commit');
      const payload = JSON.parse(options.body); calls.push({ body: options.body, payload });
      const mode = queue.shift();
      if (typeof mode === 'function') return mode(payload);
      if (typeof mode === 'object' && mode !== null) return mode;
      if (mode === 500 || mode === 401) return response(mode, { error: 'test_failure' });
      if (typeof mode === 'string' && mode.startsWith('purchase_')) return response(409, { error: mode });
      if (mode === 'invalid_purchase_equipment') return response(409, { error: mode });
      if (mode === 'offline') throw Error('offline before write');
      const decision = Economy.decide(server, payload.data, payload.economyBase);
      assert.ok(['commit', 'replay'].includes(decision), decision);
      for (const [name, value] of Object.entries(payload.data)) server[name] = snapshot(value);
      if (mode === 'lost') throw Error('committed but reply lost');
      return response(200, { ok: true, snapshots: Object.fromEntries([...new Set([...Object.keys(payload.data), 'settings', 'tasks'])].map(name => [name, server[name]])) });
    },
  });
  // Actual app transport, lock, receipt guard and modal/equipment handlers. Only
  // catalog/DOM leaves and HTTP responses are fixtures; no replacement commit.
  vm.runInContext(between('function commitmentEnvelope(', '// 409 и 428')
    + between('async function commitmentBoundaryInfo(', '// Разбор конфликта')
    + between('async function commitmentBoundaryRejected(', 'function accountResetDataCandidate(')
    + between('const Store = {', '// Dedicated multi-file endpoints')
    + between('function rememberDedicatedCommitSlots(', '// Attention keeps one checked envelope.')
    + between('const economyRequests =', 'async function goalDataCommit(')
    + between('function purchaseProgressError(', 'async function commitEconomyConfirmation(')
    + between('async function commitEconomyConfirmation(', '// ============================================================')
    + '\n globalThis.Store = Store;', context);
  context.Store._writeEpoch = 4; context.Store._persisted = clone(server);
  const candidate = { purchases: [{ id: 'p-fixed', rewardId: 'reward-1', name: 'Tea', cost: 10, at: '2026-09-12T10:00:00.000Z' }] };
  const run = () => context.economyCommit(candidate);
  return { context, State, events, calls, queue, server, before, initialSnapshots, candidate, run, Store: context.Store };
}
function noSuccess(h) {
  assert.equal(h.events.some(([kind]) => ['sound', 'achievements', 'close', 'render'].includes(kind)), false);
}
function changeScope(h, scope) {
  if (scope === 'account') h.State.me = { id: 'account-b' };
  else h.Store._writeEpoch++;
  h.State.settings = { lang: 'de', gear: { owned: ['other'], equipped: { weapon: 'other' } } };
  h.State.purchases = [{ id: 'private-new-scope' }]; h.State._commitmentConflict = false;
  h.State._commitmentBoundaryCode = 'new-scope';
  h.Store._persisted = { settings: snapshot(h.State.settings), purchases: snapshot(h.State.purchases), tasks: snapshot([]) };
  return { state: clone(h.State), persisted: clone(h.Store._persisted), events: clone(h.events) };
}
function unchangedScope(h, saved) {
  assert.deepEqual(clone(h.State), saved.state); assert.deepEqual(clone(h.Store._persisted), saved.persisted);
  assert.deepEqual(h.events, saved.events);
}

const CODES = ['purchase_level_required', 'purchase_progress_unavailable', 'purchase_pro_required',
  'purchase_ownership_changed', 'purchase_relics_changed', 'invalid_purchase_equipment', 'purchase_credit_changed'];
for (const locale of ['ru', 'en', 'de', 'uk', 'es']) {
  test(`${locale}: all admission refusals retain their exact localized reason without a generic CAS conflict`, async () => {
    for (const code of CODES) {
      const h = harness([code], locale);
      assert.equal(await h.run(), false);
      assert.equal(h.context.economySaveUnconfirmed(h.candidate), Feedback.text(code, locale));
      assert.ok(Feedback.text(code, locale).length > 30);
      if (locale !== 'en') assert.notEqual(Feedback.text(code, locale), Feedback.text(code, 'en'));
      assert.equal(h.State._commitmentConflict, undefined);
      assert.deepEqual(h.State, h.before); assert.deepEqual(h.Store._persisted, h.initialSnapshots);
      assert.deepEqual(h.events, []);
    }
  });
}

for (const mode of [500, 'offline', 'lost']) {
  test(`${mode}: explicit retry reuses exact request bytes and confirms at most one purchase`, async () => {
    const h = harness([mode]), unconfirmed = h.context.economySaveUnconfirmed(h.candidate);
    assert.equal(await h.run(), false); assert.equal(h.context.economySaveUnconfirmed(h.candidate), unconfirmed);
    assert.deepEqual(h.State, h.before); assert.deepEqual(h.Store._persisted, h.initialSnapshots); noSuccess(h);
    assert.equal(h.server.purchases.value.length, mode === 'lost' ? 1 : 0);
    // Changing current CAS inputs cannot rebuild the original explicit retry.
    h.Store._persisted.tasks = snapshot([{ id: 'later-task' }]);
    assert.equal(await h.run(), true); assert.equal(h.calls[1].body, h.calls[0].body);
    assert.equal(h.server.purchases.value.length, 1); assert.equal(h.Store._persisted.purchases.value.length, 1);
  });
}

const BAD_RECEIPTS = {
  'null body': null, 'missing snapshots': { ok: true }, 'false ok': { ok: false },
  'truthy string ok': { ok: 'yes' }, 'numeric ok': { ok: 1 },
  'wrong candidate': { ok: true }, 'missing protected pair': { ok: true },
  'invalid protected tasks': { ok: true }, 'invalid absent protected settings': { ok: true },
  'extra snapshot slot': { ok: true, extraSlot: true },
};
for (const [label, malformed] of Object.entries(BAD_RECEIPTS)) {
  test(`malformed 200 (${label}) cannot confirm or advance any snapshot`, async () => {
    const h = harness([payload => {
      let body = clone(malformed);
      if (body && !['null body', 'missing snapshots'].includes(label)) {
        body.snapshots = { purchases: snapshot(payload.data.purchases), settings: snapshot(h.State.settings), tasks: snapshot([]) };
        if (body.extraSlot) { delete body.extraSlot; body.snapshots.rewards = snapshot([{ id: 'unexpected-reward' }]); }
        if (label === 'wrong candidate') body.snapshots.purchases = snapshot([]);
        if (label === 'missing protected pair') { delete body.snapshots.settings; delete body.snapshots.tasks; }
        if (label === 'invalid protected tasks') body.snapshots.tasks = snapshot({});
        if (label === 'invalid absent protected settings') body.snapshots.settings = { exists: false, value: {} };
      }
      return response(200, body);
    }]);
    const unconfirmed = h.context.economySaveUnconfirmed(h.candidate);
    assert.equal(await h.run(), false); assert.equal(h.context.economySaveUnconfirmed(h.candidate), unconfirmed);
    assert.deepEqual(h.Store._persisted, h.initialSnapshots); assert.deepEqual(h.State, h.before); noSuccess(h);
  });
}

test('a malformed JSON receipt leaves the purchase unconfirmed and can be retried', async () => {
  const h = harness([{ status: 200, ok: true, json: async () => { throw new SyntaxError('truncated JSON'); } }]);
  assert.equal(await h.run(), false); assert.deepEqual(h.Store._persisted, h.initialSnapshots); noSuccess(h);
  assert.equal(await h.run(), true); assert.equal(h.calls[0].body, h.calls[1].body);
});
test('valid absent protected snapshots are accepted without inventing settings or tasks', async () => {
  const h = harness();
  for (const name of ['settings', 'tasks']) h.server[name] = { exists: false, value: null };
  assert.equal(await h.run(), true);
  assert.deepEqual(h.Store._persisted.settings, { exists: false, value: null });
  assert.deepEqual(h.Store._persisted.tasks, { exists: false, value: null });
  assert.deepEqual(h.State, h.before, 'transport stores snapshots; caller owns live application');
});

for (const mode of [500, 'lost']) {
  test(`a new ${mode} retry has an uncertain outcome rather than reusing the previous level refusal`, async () => {
    const held = deferred(), h = harness(['purchase_level_required', () => held.promise]);
    const generic = h.context.economySaveUnconfirmed(h.candidate);
    assert.equal(await h.run(), false);
    assert.equal(h.context.economySaveUnconfirmed(h.candidate), Feedback.text('purchase_level_required', 'en'));
    const pending = h.run(); await turn();
    assert.equal(h.context.economySaveUnconfirmed(h.candidate), generic);
    if (mode === 'lost') held.reject(Error('new reply lost'));
    else held.resolve(response(500, { error: 'failed' }));
    assert.equal(await pending, false); assert.equal(h.context.economySaveUnconfirmed(h.candidate), generic);
    assert.equal(await h.run(), true); assert.equal(h.context.economySaveUnconfirmed(h.candidate), generic);
    assert.equal(new Set(h.calls.map(call => call.body)).size, 1);
  });
}

for (const scope of ['account', 'epoch']) {
  for (const outcome of [401, 409, 500, 200, 'lost']) {
    test(`late ${outcome} after ${scope} change cannot affect auth, conflict, snapshots or UI`, async () => {
      const held = deferred(), h = harness([() => held.promise]);
      const pending = h.run(); await turn(); const saved = changeScope(h, scope);
      if (outcome === 'lost') held.reject(Error('late error'));
      else held.resolve(response(outcome, outcome === 200 ? { ok: true, snapshots: { ...h.initialSnapshots, purchases: snapshot(h.candidate.purchases) } }
        : { error: 'purchase_level_required' }));
      assert.equal(await pending, false); unchangedScope(h, saved);
      assert.equal(await h.run(), false, 'same frozen candidate cannot be resubmitted by another scope');
      assert.equal(h.calls.length, 1);
    });
  }
  for (const status of [200, 409]) {
    test(`late ${status} JSON after ${scope} change is checked again before effects`, async () => {
      const held = deferred();
      const h = harness([() => ({ status, ok: status === 200, json: () => held.promise,
        clone() { return { json: () => held.promise }; } })]);
      const pending = h.run(); await turn(); const saved = changeScope(h, scope);
      held.resolve(status === 200 ? { ok: true, snapshots: { ...h.initialSnapshots, purchases: snapshot(h.candidate.purchases) } }
        : { error: 'purchase_pro_required' });
      assert.equal(await pending, false); unchangedScope(h, saved);
    });
  }
  test(`common CAS boundary checks ${scope} again after decoding JSON`, async () => {
    const held = deferred(), h = harness();
    const id = h.State.me.id, epoch = h.Store._writeEpoch;
    const pending = h.context.commitmentBoundaryRejected({ status: 409, clone: () => ({ json: () => held.promise }) },
      { isCurrent: () => h.State.me?.id === id && h.Store._writeEpoch === epoch });
    const saved = changeScope(h, scope); held.resolve({ error: 'commitment_revision_conflict' });
    assert.equal(await pending, true); unchangedScope(h, saved);
  });
}

test('an actual current-account 401 expires once without applying the attempted purchase', async () => {
  const h = harness([401]); assert.equal(await h.run(), false);
  assert.equal(h.State.me, null); assert.deepEqual(h.State.purchases, []);
  assert.deepEqual(h.events, [['expired']]);
});
test('a real CAS conflict still reaches the shared boundary, unlike a permission denial', async () => {
  const h = harness([response(409, { error: 'commitment_revision_conflict' })]);
  assert.equal(await h.run(), false); assert.equal(h.State._commitmentConflict, true);
  assert.equal(h.State._commitmentBoundaryCode, 'commitment_revision_conflict');
  assert.equal(h.events.filter(([kind]) => kind === 'toast').length, 1); noSuccess(h);
});

for (const kind of ['gear', 'reward']) {
  test(`${kind} modal waits for save, keeps one attempt through lost reply, then applies once`, async () => {
    const held = deferred(), h = harness([() => held.promise, 'lost']), overlay = modal(kind);
    const run = () => h.context.commitEconomyConfirmation(overlay);
    const pending = run(); await turn();
    assert.equal(overlay.confirm.disabled, true); assert.equal(overlay.status.textContent, 'Сохраняю…');
    assert.deepEqual(h.State, h.before); noSuccess(h);
    await run(); assert.equal(h.calls.length, 1, 'second click while saving cannot spend twice');
    held.resolve(response(409, { error: 'purchase_level_required' })); await pending;
    assert.equal(overlay.status.textContent, Feedback.text('purchase_level_required', 'en'));
    assert.equal(overlay.confirm.disabled, false); assert.deepEqual(h.State, h.before); noSuccess(h);
    await run(); assert.equal(overlay.status.textContent, h.context.economySaveUnconfirmed(overlay._attempt.payload));
    assert.deepEqual(h.State, h.before); noSuccess(h);
    await run(); assert.equal(new Set(h.calls.map(call => call.body)).size, 1);
    assert.equal(h.State.purchases.length, 1); assert.equal(h.server.purchases.value.length, 1);
    if (kind === 'gear') assert.deepEqual(clone(h.State.settings.gear), { owned: ['sword-1'], equipped: { weapon: 'sword-1' } });
    assert.equal(h.events.filter(([event]) => event === 'sound').length, 1);
    assert.equal(h.events.filter(([event]) => event === 'close').length, 1);
  });
}
test('equipment has no early local effect and retries the original payload despite a new candidate', async () => {
  const held = deferred(), h = harness([() => held.promise]), el = control({ action: 'equip-gear', id: 'sword-1' });
  const data = { settings: { ...clone(h.State.settings), gear: { owned: ['sword-1'], equipped: { weapon: 'sword-1' } } } };
  const after = () => h.events.push(['after']);
  const pending = h.context.commitEquipment(data, el, after); await turn();
  assert.equal(el.disabled, true); assert.equal(el.attributes['aria-busy'], 'true'); assert.deepEqual(h.State, h.before);
  assert.equal(await h.context.commitEquipment(data, el, after), false); assert.equal(h.calls.length, 1);
  held.resolve(response(500, { error: 'failed' })); assert.equal(await pending, false); noSuccess(h);
  assert.equal(el.disabled, false); assert.equal(el.focused, 1);
  assert.equal(await h.context.commitEquipment({ settings: { wrong: true } }, el, after), true);
  assert.equal(h.calls[1].body, h.calls[0].body); assert.deepEqual(clone(h.State.settings), data.settings);
  assert.equal(h.events.filter(([event]) => event === 'after').length, 1);
  assert.equal(h.events.filter(([event]) => event === 'render').length, 1);
});
for (const path of ['modal', 'equipment']) {
  for (const scope of ['account', 'epoch']) {
    for (const status of [200, 401, 409]) {
      test(`${path}: late ${status} after ${scope} change cannot apply the purchase or show old feedback`, async () => {
        const held = deferred(), h = harness([() => held.promise]), overlay = modal();
        const el = control({ action: 'equip-gear', id: 'sword-1' });
        const pending = path === 'modal' ? h.context.commitEconomyConfirmation(overlay)
          : h.context.commitEquipment({ settings: clone(h.State.settings) }, el, () => h.events.push(['after']));
        await turn(); const saved = changeScope(h, scope);
        const data = h.calls[0].payload.data;
        held.resolve(response(status, status === 200 ? { ok: true, snapshots: { ...h.initialSnapshots, ...Object.fromEntries(Object.entries(data).map(([n, v]) => [n, snapshot(v)])) } }
          : { error: 'purchase_pro_required' }));
        await pending; unchangedScope(h, saved);
        if (path === 'modal') assert.equal(overlay.status.textContent, 'Сохраняю…', 'old status is not replaced with feedback from a different scope');
      });
    }
  }
}

for (const kind of ['gear', 'den-theme', 'den-item']) {
  test(`${kind}: actual confirmation preflight uses personal progress and does not mutate or buy`, () => {
    const h = harness(), item = { id: 'level-two', lvl: 2, level: 2 };
    h.context.gearById = () => item; h.context.DEN_THEMES = [item]; h.context.denItem = () => item;
    h.State.partyXp = 999999; h.State.leaderboardXp = 999999;
    const before = clone(h.State);
    assert.equal(h.context.showEconomyConfirm(kind, item.id), null);
    assert.deepEqual(h.events, [['toast', Feedback.text('purchase_level_required', 'en')]]);
    assert.deepEqual(h.State, before); assert.equal(h.calls.length, 0);
    h.State.tasks = [{ done: true, xpAwarded: 100 }];
    const earned = clone(h.State), dialog = h.context.showEconomyConfirm(kind, item.id);
    assert.ok(dialog); assert.equal(h.events.filter(([event]) => event === 'mount').length, 1);
    assert.deepEqual(h.State, earned); assert.equal(h.calls.length, 0, 'opening confirmation is not a purchase');
    h.State.tasks = null;
    assert.equal(h.context.showEconomyConfirm(kind, item.id), null);
    assert.deepEqual(h.events.at(-1), ['toast', Feedback.text('purchase_progress_unavailable', 'en')]);
  });
}
