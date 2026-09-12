'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Evening = require('../public/evening-writes-v1.js');
const AccountData = require('../public/account-data-v1.js');
const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
const DAY = '2026-09-12';
function section(start, end) {
  const at = APP.indexOf(start), until = APP.indexOf(end, at + start.length);
  assert.ok(at >= 0 && until > at, 'actual app source section exists: ' + start);
  return APP.slice(at, until);
}

/** Execute the real Store queue/_put and actual app handlers, not a writer model.
 * The fetch fixture represents server receipts, including commit-before-loss.
 */
function harness({ storage = new Map(), server = { settings: { lang: 'ru', secretary: { configured: false, eveningTime: '', dailyReminder: false }, unrelated: 7 }, days: { [DAY]: { reflection: 'kept', closed: false } } } } = {}) {
  let day = DAY, mode = 'ok', blockedReads = false, gate = null, overlay = { id: 'first' }, nextOverlay = 0;
  const calls = [], effects = [], timers = new Map(); let timerId = 0;
  const State = { me: { id: 'owner' }, settings: clone(server.settings), days: clone(server.days), tasks: [], _accountDataLoadErrors: {} };
  const ctx = vm.createContext({ console: { error() {}, warn() {} }, structuredClone, JSON, Date, Promise, State,
    window: { EveningWritesV1: Evening, AccountDataV1: AccountData },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    todayStr: () => day, lang: () => 'ru', t: text => text,
    document: { getElementById: () => overlay, querySelector: () => ({}) },
    pwaWriteAllowed: () => true, accountDataWriteAllowed: () => true,
    accountDataPayloadAllowed: (slot, value) => slot !== 'days' || AccountData.validate(slot, value),
    taskWriteAllowed: () => true, skillTreePayloadAllowed: () => true, skillTreeWriteAllowed: () => true,
    goalWriteAllowed: () => true, settingsWriteAllowed: () => true, habitWriteAllowed: () => true,
    attentionDatasetSlot: () => false, attentionWriteAllowed: () => true,
    commitmentWriteBase: () => ({}), commitmentWriteData: () => ({}), commitmentGraphProtected: () => false,
    handleAccountSessionExpired: () => effects.push('auth-expired'),
    toast: text => effects.push(['toast', text]), attentionStatus: (text, error) => effects.push(['status', text, error]),
    attentionBusy: busy => effects.push(['busy', busy]),
    scheduleEveningReminder: () => effects.push('schedule'), setEveningDue: due => effects.push(['due', due]),
    showAttentionDialog: (screen, data) => { overlay = { id: ++nextOverlay }; effects.push(['dialog', screen, clone(data)]); return overlay; },
    closeAttentionDialog: () => { effects.push('close'); overlay = null; },
    speakEveningCoach: () => effects.push('speak'), render: () => effects.push('render'), sfx: name => effects.push(['sound', name]),
    focusPathChoiceTarget: () => effects.push('focus'), requestAnimationFrame: callback => { timers.set(++timerId, callback); },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
    fetch: async (route, init = {}) => {
      const slot = route.split('/').pop(), method = init.method || 'GET';
      const call = { method, slot, body: init.body ? JSON.parse(init.body) : null }; calls.push(clone(call));
      if (method === 'GET') {
        if (blockedReads) throw new Error('offline');
        return { ok: true, status: 200, json: async () => clone(server[slot]) };
      }
      assert.equal(method, 'PUT');
      if (gate) await gate;
      if (mode === 'unauthorized') return { ok: false, status: 401 };
      if (mode === 'fail') return { ok: false, status: 500 };
      server[slot] = clone(call.body);
      if (mode === 'lost') { blockedReads = true; throw new Error('reply lost after commit'); }
      if (mode === 'lost-readable') throw new Error('reply lost after commit');
      return { ok: true, status: 200 };
    },
  });
  vm.runInContext(section('function validateSettingsPayload(value)', 'function settingsWriteAllowed'), ctx);
  vm.runInContext(section('function validateAccountDataPayload(name, value)', 'async function loadAccountDataSlots'), ctx);
  vm.runInContext(section('const Store = {', '// Dedicated multi-file endpoints'), ctx);
  vm.runInContext(section('let _eveningWriter = null', 'function scheduleAttentionBoundary'), ctx);
  vm.runInContext('let _eveningPromptPersistTimer = null;\n' + section('async function markEveningPrompted(date)', 'async function showEveningNotification'), ctx);
  const api = vm.runInContext('({ Store, saveEveningSetup, commitDayClosed, finishEveningLanding, markEveningPrompted, eveningWriter })', ctx);
  return { ...api, State, server, storage, calls, effects, timers,
    form: () => ({ targetTime: { value: '22:30', focus() {} }, dailyReminder: { checked: true } }),
    mode: value => { mode = value; blockedReads = false; },
    blockReads: value => { blockedReads = value; },
    gate: value => { gate = value; }, day: value => { day = value; },
    switchAccount: () => { State.me = { id: 'other' }; State.settings = { secretary: { eveningTime: '19:00' } }; State.days = {}; api.Store.cancelPending(); },
    replaceDialog: () => { overlay = { id: 'replacement' }; },
    runTimers: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); },
  };
}

test('setup confirms through actual Store and preserves unrelated authoritative settings', async () => {
  const h = harness(); h.server.settings.remoteOnly = { kept: true };
  await h.saveEveningSetup(h.form());
  assert.equal(h.State.settings.secretary.eveningTime, '22:30');
  assert.deepEqual(h.State.settings.remoteOnly, { kept: true });
  assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1);
  assert.equal(h.eveningWriter().pending('setup'), null);
  assert.equal(h.effects.filter(e => Array.isArray(e) && e[0] === 'dialog').length, 1);
  h.runTimers(); assert.ok(h.effects.includes('speak'));
});

test('a failed Store write retains the intent, leaves owner state unchanged and reports uncertainty', async () => {
  const h = harness(); const before = clone(h.State.settings); h.mode('fail');
  await h.saveEveningSetup(h.form());
  assert.deepEqual(h.State.settings, before); assert.deepEqual(h.server.settings, before);
  assert.equal(h.eveningWriter().pending('setup').eveningTime, '22:30');
  assert.ok(h.effects.some(e => Array.isArray(e) && e[0] === 'status' && e[1].includes('не подтверждена')));
  assert.equal(h.effects.some(e => Array.isArray(e) && e[0] === 'dialog'), false);
  h.mode('ok'); await h.saveEveningSetup(h.form());
  assert.equal(h.State.settings.secretary.configured, true); assert.equal(h.storage.size, 0);
});

test('readback confirms a lost successful reply without a second write', async () => {
  const h = harness(); h.mode('lost-readable');
  assert.equal(await h.commitDayClosed(true), true);
  assert.equal(h.State.days[DAY].closed, true); assert.equal(h.State.days[DAY].reflection, 'kept');
  assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1); assert.equal(h.storage.size, 0);
});

test('lost reply plus offline readback survives reload and confirms the exact setup without another write', async () => {
  const h = harness(); h.mode('lost'); await h.saveEveningSetup(h.form());
  assert.equal(h.State.settings.secretary.configured, false); assert.equal(h.server.settings.secretary.configured, true);
  const reloaded = harness({ storage: h.storage, server: h.server });
  await reloaded.saveEveningSetup(reloaded.form());
  assert.equal(reloaded.calls.filter(c => c.method === 'PUT').length, 0);
  assert.equal(reloaded.storage.size, 0); assert.equal(reloaded.State.settings.secretary.eveningTime, '22:30');
});

test('a changed setup cannot replace an uncertain intent and retry restores its selected values', async () => {
  const h = harness(); h.mode('fail'); await h.saveEveningSetup(h.form()); h.mode('ok');
  const changed = h.form(); changed.targetTime.value = '23:45'; changed.dailyReminder.checked = false;
  const count = h.calls.length; await h.saveEveningSetup(changed);
  assert.equal(h.calls.length, count); assert.equal(changed.targetTime.value, '22:30'); assert.equal(changed.dailyReminder.checked, true);
  await h.saveEveningSetup(changed); assert.equal(h.server.settings.secretary.eveningTime, '22:30');
});

test('a day-close retry after reload at midnight retains yesterday and never closes the new day', async () => {
  const h = harness(); h.mode('lost'); assert.equal(await h.commitDayClosed(true, { reflection: 'explicit reflection' }), false);
  const reloaded = harness({ server: h.server, storage: h.storage }); reloaded.day('2026-09-13');
  reloaded.server.days['2026-09-13'] = { closed: false, reflection: 'new day' };
  assert.equal(await reloaded.commitDayClosed(true, { reflection: 'explicit reflection' }), false, 'old receipt cannot report today closed');
  assert.equal(reloaded.State.days[DAY].closed, true); assert.equal(reloaded.State.days['2026-09-13'].closed, false);
  assert.equal(reloaded.calls.filter(c => c.method === 'PUT').length, 0); assert.equal(reloaded.storage.size, 0);
  assert.equal(reloaded.effects.length, 0);
});

test('midnight during the day write saves only the captured day and suppresses completion UI', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const h = harness(); h.gate(gate);
  const finishing = h.finishEveningLanding(); await turn(); const effectsBeforeMidnight = h.effects.length;
  h.day('2026-09-13'); release(); await finishing;
  assert.equal(h.server.days[DAY].closed, true); assert.equal(h.server.days['2026-09-13'], undefined);
  assert.equal(h.effects.length, effectsBeforeMidnight); assert.equal(h.timers.size, 0);
});

test('account changes while setup or close writes await a response cannot touch the new state or UI', async () => {
  for (const kind of ['setup', 'close', 'prompt']) {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const h = harness(); h.gate(gate);
    const saving = kind === 'setup' ? h.saveEveningSetup(h.form()) : kind === 'close' ? h.finishEveningLanding() : h.markEveningPrompted(DAY);
    await turn(); h.switchAccount(); const before = clone(h.State), count = h.effects.length;
    release(); await saving; h.runTimers();
    assert.deepEqual(h.State.settings, before.settings); assert.deepEqual(h.State.days, before.days);
    assert.equal(h.effects.length, count, kind + ' must have no late dialog, toast, timer or voice');
    assert.equal(h.timers.size, 0); assert.equal(h.Store._persisted.settings, undefined);
  }
});

test('a late failed write from the previous account cannot publish an error in the new account', async () => {
  for (const mode of ['fail', 'unauthorized', 'lost']) {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const h = harness(); h.mode(mode); h.gate(gate);
    const saving = h.saveEveningSetup(h.form()); await turn(); h.switchAccount(); const count = h.effects.length;
    release(); await saving;
    assert.equal(h.effects.length, count, mode + ' must not publish an old Store error under the new account');
    assert.equal(h.State.settings.secretary.eveningTime, '19:00');
  }
});

test('a new session epoch in the same account ignores the old receipt and retains its exact pending intent', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const h = harness(); h.gate(gate);
  const saving = h.saveEveningSetup(h.form()); await turn(); h.Store.cancelPending(); const count = h.effects.length;
  release(); await saving;
  assert.equal(h.State.settings.secretary.configured, false); assert.equal(h.effects.length, count);
  assert.equal(h.eveningWriter().pending('setup').eveningTime, '22:30');
  await h.saveEveningSetup(h.form()); assert.equal(h.State.settings.secretary.configured, true);
  assert.equal(h.calls.filter(call => call.method === 'PUT').length, 1, 'new epoch confirms old intent by readback');
});

test('a replaced setup dialog does not reopen or speak after the old write completes', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const h = harness(); h.gate(gate);
  const saving = h.saveEveningSetup(h.form()); await turn(); h.replaceDialog(); const count = h.effects.length;
  release(); await saving; h.runTimers(); assert.equal(h.effects.length, count);
  assert.equal(h.State.settings.secretary.configured, true, 'healthy owner receipt still updates the same account');
});

test('queued settings writes read their base after earlier owner writes finish', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const h = harness(); h.Store._writes.settings = gate;
  const saving = h.saveEveningSetup(h.form()); await turn();
  h.server.settings.remoteOnly = 'written while queued'; release(); await saving;
  assert.equal(h.server.settings.remoteOnly, 'written while queued'); assert.equal(h.State.settings.remoteOnly, 'written while queued');
});

test('finish closes the day once and never follows it with a reminder settings write', async () => {
  const h = harness(); await h.finishEveningLanding();
  assert.deepEqual(h.calls.filter(c => c.method === 'PUT').map(c => c.slot), ['days']);
  assert.equal(h.State.days[DAY].closed, true); assert.ok(h.effects.includes('close'));
  assert.equal(h.server.settings.secretary.lastEveningPromptDate, undefined);
});

test('failed prompt bookkeeping neither lies locally nor schedules an automatic retry', async () => {
  const h = harness(); h.mode('fail');
  assert.equal(await h.markEveningPrompted(DAY), false);
  assert.equal(h.State.settings.secretary.lastEveningPromptDate, undefined);
  assert.equal(h.timers.size, 0); assert.ok(h.eveningWriter().pending('prompt'));
  h.mode('ok'); assert.equal(await h.markEveningPrompted(DAY), true);
  assert.equal(h.State.settings.secretary.lastEveningPromptDate, DAY);
});

test('malformed owner reads and malformed saved intents fail closed before any write', async () => {
  const broken = harness(); broken.server.settings.secretary.dailyReminder = 'false';
  await broken.saveEveningSetup(broken.form()); assert.equal(broken.calls.filter(c => c.method === 'PUT').length, 0);
  const storage = new Map([['satoru.evening.writes.owner', JSON.stringify({ version: 1, intents: { close: { kind: 'close', day: '2026-02-30', closed: true } } })]]);
  const h = harness({ storage }); assert.equal(await h.commitDayClosed(true), false); assert.equal(h.calls.length, 0);
});

test('write uncertainty copy is available in all five languages', () => {
  for (const lang of ['ru', 'en', 'de', 'uk', 'es']) {
    for (const error of ['unconfirmed', 'pending_intent', 'invalid_pending', 'storage', 'invalid', 'busy']) {
      assert.equal(typeof Evening.message(error, lang), 'string'); assert.ok(Evening.message(error, lang).length > 10);
    }
  }
});
