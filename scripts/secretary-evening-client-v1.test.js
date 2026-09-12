'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Policy = require('../public/secretary-next-moves-v2.js');
const Producer = require('../public/secretary-next-moves-producer-v1.js');
const Client = require('../public/secretary-next-moves-client-v1.js');
const UI = require('../public/secretary-next-moves-ui-v1.js');
const APP = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const DAY = '2026-09-12', NOW = DAY + 'T21:05:00.000Z';
const KEY = 'satoru.secretary.next.owner';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
const snapshot = (extra = {}) => ({ now: NOW, today: DAY, utcOffsetMinutes: 0, dayClosed: false,
  lapse: null, tasks: [], habits: [], habitlog: {}, activeSession: false, guideActive: false, firstValueStatus: 'completed',
  settings: { secretary: { configured: true, dailyReminder: true, eveningTime: '21:00' } }, ...extra });
function eveningOffer(current = snapshot()) {
  const projected = Producer.build(current); assert.equal(projected.ok, true);
  const result = Policy.decide({ now: current.now, today: current.today, utcOffsetMinutes: current.utcOffsetMinutes,
    invocation: 'app_open', availableChannels: ['card'], enabledCapabilities: ['evening-close'],
    ledger: Policy.emptyLedger(), ...projected.context });
  assert.equal(result.ok, true); assert.equal(result.offer?.capabilityId, 'evening-close');
  return result.offer;
}
const receipt = (offer, outcome = 'accepted') => ({ ok: true, outcome, persistedAt: NOW,
  action: outcome === 'accepted' ? clone(offer.primary.action) : null });
const claim = offer => ({ ok: true, token: 'evening-claim', offer, persistedAt: NOW });
function clientHarness(rpc, stored = { value: null }) {
  let seq = 0;
  return { stored, client: Client.create({ accountId: 'owner', clientId: 'evening-tab', requestId: () => 'req-' + ++seq,
    currentAccount: () => 'owner', rpc, readPending: () => clone(stored.value), writePending: value => { stored.value = clone(value); } }) };
}

// Actual producer, policy, browser client and coordinator. Only clock, transport
// replies and browser effects are controlled here; no duplicated scheduling code.
function runtimeHarness({ current = snapshot(), storage = new Map(), request, renderLoads = false } = {}) {
  let clock = Date.parse(current.now), seq = 0, runtime, hidden = false, account = 'owner', changes = 0;
  const calls = [], opened = [], timers = new Map(), listeners = new Map(), renders = [];
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const add = (key, callback) => { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(callback); };
  const sandbox = vm.createContext({ Date: ClockDate, Promise, console, SecretaryNextMovesProducerV1: Producer,
    document: { addEventListener: (key, cb) => add('document:' + key, cb), removeEventListener: (key, cb) => listeners.get('document:' + key)?.delete(cb) },
    addEventListener: (key, cb) => add('window:' + key, cb), removeEventListener: (key, cb) => listeners.get('window:' + key)?.delete(cb),
    setTimeout: (callback, delay) => { const id = ++seq; timers.set(id, { callback, at: clock + Math.max(0, Number(delay)) }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  for (const file of ['secretary-next-moves-client-v1.js', 'secretary-next-moves-runtime-v1.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'), sandbox, { filename: file });
  }
  let lastOffer;
  const env = { account: () => account, id: () => String(++seq), visible: () => !hidden,
    snapshot: () => clone({ ...current, now: new Date(clock).toISOString() }),
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, init) => {
      assert.equal(url, '/api/secretary/next-moves');
      const body = JSON.parse(init.body); calls.push({ ...clone(body), headers: clone(init.headers) });
      let response;
      if (request) response = await request(body, env.snapshot());
      else if (body.op === 'decide') { lastOffer = eveningOffer(env.snapshot()); response = { ok: true, offer: lastOffer }; }
      else if (body.op === 'claim') response = claim(lastOffer);
      else response = receipt(lastOffer, body.outcome);
      return { ok: !response.error, status: response.error ? 409 : 200, json: async () => response };
    },
    changed: () => {
      assert.ok(++changes < 60, 'render-driven requests must remain bounded');
      if (runtime && renderLoads) renders.push(runtime.load());
    },
    expired: () => assert.fail('unexpected session expiry'), open: action => { opened.push(clone(action)); return true; },
  };
  runtime = sandbox.SecretaryNextMovesRuntimeV1.create(env);
  const flush = async () => { await turn(); await Promise.all(renders.splice(0)); await turn(); };
  async function advance(milliseconds) {
    const until = clock + milliseconds; let ticks = 0;
    while (true) {
      const next = [...timers.entries()].filter(([, value]) => value.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++ticks < 30, 'past decision boundary must not spin');
      clock = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
    }
    clock = until; await flush();
  }
  async function emit(key) { for (const callback of listeners.get(key) || []) callback(); await flush(); }
  return { runtime, current, env, calls, opened, timers, storage, flush, advance, emit,
    hide: value => { hidden = value; }, account: value => { account = value; }, dispose: () => runtime.dispose() };
}

test('evening capability negotiation and boundary action reject other capabilities, malformed HH:MM and dates', async () => {
  const offer = eveningOffer(), sent = [];
  assert.equal(Client.validOffer(offer), true);
  assert.equal(Client.validAcceptedReceipt(receipt(offer)), true);
  for (const alter of [
    item => { item.capabilityId = 'sleep-enforcer'; },
    item => { item.capabilityId = 'planned-start'; },
    item => { item.primary.action.type = 'task_open_prepared'; },
    item => { item.copy.titleKey = 'secretary.v2.planned_start.title'; },
    ...['24:00', '21:60', '9:00', '21:00:00', 2100, '', '<img>'].map(value => item => { item.primary.action.args.boundaryLocal = value; }),
    item => { item.primary.action.args.day = '2026-02-30'; },
  ]) { const invalid = clone(offer); alter(invalid); assert.equal(Client.validOffer(invalid), false); }
  const h = clientHarness(async body => { sent.push(clone(body)); return body.op === 'decide' ? { ok: true, offer }
    : body.op === 'claim' ? claim(offer) : receipt(offer); });
  await h.client.load({}); await h.client.outcome('accepted');
  for (const body of sent.slice(0, 2)) assert.deepEqual(body.supportedCapabilities, ['after-lapse-return', 'planned-start', 'evening-close']);
  assert.equal(Object.hasOwn(sent[2], 'supportedCapabilities'), false);
});

test('accepted evening receipt must match the exact chosen boundary, day and action', async () => {
  const offer = eveningOffer();
  for (const alter of [
    value => { value.action.args.boundaryLocal = '21:30'; },
    value => { value.action.args.day = '2026-09-13'; },
    value => { value.action = { type: 'ask_one_question', args: { day: DAY, questionId: 'return_next_smallest' } }; },
    value => { value.persistedAt = NOW.replace('.000', ''); },
  ]) {
    const h = clientHarness(async body => {
      if (body.op === 'decide') return { ok: true, offer };
      if (body.op === 'claim') return claim(offer);
      const value = receipt(offer); alter(value); return value;
    });
    await h.client.load({}); assert.equal(await h.client.outcome('accepted'), null);
    assert.equal(h.client.state().error, 'invalid_response'); assert.ok(h.client.pending());
    assert.equal(h.client.state().offer.offerId, offer.offerId);
  }
});

test('five locales ask one evening context question with three distinct answers and escaped boundary', () => {
  const offer = eveningOffer();
  for (const lang of UI.LANGS) {
    const card = UI.render({ offer, busy: false }, lang, snapshot());
    const question = UI.copy('secretary.v2.evening.context_question', lang);
    assert.ok(question); assert.equal(card.includes(question), false, 'question belongs to the accepted transition, not a second card prompt');
    const html = UI.renderEvening({ day: DAY, boundaryLocal: '21:00', lang });
    assert.equal(html.split(question).length - 1, 1, lang);
    assert.equal((html.match(/<button\b/g) || []).length, 3);
    assert.match(html, /<time>21:00<\/time>/);
    for (const [action, key] of [['ready', 'ready'], ['busy', 'busy'], ['planning', 'planning']]) {
      assert.ok(html.includes(`data-action="secretary-evening-${action}"`));
      assert.ok(html.includes(UI.copy('secretary.v2.evening.' + key, lang)));
    }
    assert.doesNotMatch(html, /<(?:input|select|textarea)\b|finish-evening-landing|close-day|quest-done|focus-task/);
  }
  const escaped = UI.renderEvening({ lang: 'en', boundaryLocal: '<svg onload="bad()">' });
  assert.equal(escaped.includes('<svg'), false); assert.match(escaped, /&lt;svg/);
});

test('closed workday permits the evening transition but keeps a planned task receipt deferred', async () => {
  const offer = eveningOffer();
  const evening = runtimeHarness({ current: snapshot({ dayClosed: true }) });
  await evening.runtime.load(); assert.equal(await evening.runtime.respond('accepted'), true);
  assert.deepEqual(evening.opened, [offer.primary.action]); evening.dispose();
  const planned = { ...receipt(offer), action: { type: 'task_open_prepared', args: { day: DAY, targetRef: 'quest:one', size: 'planned' } } };
  const storage = new Map([[KEY + '.open', JSON.stringify(planned)]]);
  const blocked = runtimeHarness({ current: snapshot({ dayClosed: true }), storage });
  assert.equal(await blocked.runtime.retry(), false);
  assert.equal(blocked.runtime.state().error, 'opening_deferred'); assert.equal(blocked.opened.length, 0);
  assert.equal(blocked.calls.length, 0); blocked.dispose();
});

test('active session beginning during evening acceptance defers its receipt through reload until explicit retry', async () => {
  const offer = eveningOffer(); let release;
  const response = new Promise(resolve => { release = resolve; });
  const h = runtimeHarness({ request: body => body.op === 'decide' ? { ok: true, offer } : body.op === 'claim' ? claim(offer) : response });
  await h.runtime.load(); const accepting = h.runtime.respond('accepted'); await h.flush();
  h.current.activeSession = true; release(receipt(offer));
  assert.equal(await accepting, false); assert.equal(h.opened.length, 0);
  assert.equal(h.runtime.state().error, 'opening_deferred');
  assert.deepEqual(JSON.parse(h.storage.get(KEY + '.open')).action, offer.primary.action);
  h.dispose();
  const reload = runtimeHarness({ storage: h.storage, current: snapshot({ activeSession: true }), request: () => assert.fail('accepted opening must not repeat the server outcome') });
  assert.equal(await reload.runtime.retry(), false); reload.current.activeSession = false;
  await reload.emit('window:focus'); await reload.runtime.load();
  assert.equal(reload.opened.length, 0);
  assert.equal(await reload.runtime.retry(), true);
  assert.deepEqual(reload.opened, [offer.primary.action]); assert.equal(reload.storage.has(KEY + '.open'), false);
  assert.equal(reload.calls.length, 0); reload.dispose();
});

test('lost evening acceptance reply reloads and resends the same outcome body before opening', async () => {
  const offer = eveningOffer(), sent = []; let durable = null;
  const h = runtimeHarness({ request: body => {
    if (body.op === 'decide') return { ok: true, offer };
    if (body.op === 'claim') return claim(offer);
    sent.push(clone(body)); durable = receipt(offer); throw new Error('reply lost after persistence');
  } });
  await h.runtime.load(); assert.equal(await h.runtime.respond('accepted'), false);
  assert.ok(durable); assert.equal(h.opened.length, 0);
  const pending = JSON.parse(h.storage.get(KEY + '.pending')).pending; h.dispose();
  const reload = runtimeHarness({ storage: h.storage, request: body => { sent.push(clone(body)); return durable; } });
  assert.equal(reload.runtime.state().error, 'unconfirmed');
  assert.equal(await reload.runtime.retry(), true);
  assert.deepEqual(sent, [pending, pending]); assert.deepEqual(reload.opened, [offer.primary.action]);
  assert.equal(reload.storage.has(KEY + '.pending'), false); reload.dispose();
});

test('changed boundary or disabled reminder invalidates an accepted deferred evening with stale_evening', async () => {
  const offer = eveningOffer();
  for (const change of [cfg => { cfg.eveningTime = '22:00'; }, cfg => { cfg.dailyReminder = false; }, cfg => { cfg.configured = false; }]) {
    const current = snapshot(); change(current.settings.secretary);
    const h = runtimeHarness({ current, storage: new Map([[KEY + '.open', JSON.stringify(receipt(offer))]]) });
    assert.equal(await h.runtime.retry(), false); assert.equal(h.runtime.state().error, 'stale_evening');
    assert.equal(h.storage.has(KEY + '.open'), false); assert.equal(h.opened.length, 0); assert.equal(h.calls.length, 0);
    for (const lang of UI.LANGS) assert.ok(UI.errorHTML('stale_evening', lang).includes(UI.copy('secretary.v2.evening.changed', lang)));
    h.dispose();
  }
});

test('yesterday or another account cannot consume an accepted evening opening', async () => {
  const offer = eveningOffer(), storage = new Map([[KEY + '.open', JSON.stringify(receipt(offer))]]);
  const nextDay = runtimeHarness({ storage: new Map(storage), current: snapshot({ today: '2026-09-13', now: '2026-09-13T21:05:00.000Z' }) });
  assert.equal(await nextDay.runtime.retry(), false); assert.equal(nextDay.runtime.state().error, 'stale_target');
  assert.equal(nextDay.storage.has(KEY + '.open'), false); assert.equal(nextDay.opened.length, 0); nextDay.dispose();
  const other = runtimeHarness({ storage: new Map(storage) }); other.account('someone-else');
  assert.equal(await other.runtime.retry(), false); assert.equal(other.opened.length, 0); assert.equal(other.calls.length, 0); other.dispose();
});

test('new known busy interval postpones a confirmed evening until its absolute end and explicit retry', async () => {
  const offer = eveningOffer(), current = snapshot({ tasks: [{ id: 'training', title: 'Owner workout', date: DAY, startTime: '21:00', estimateMin: 20, done: false }] });
  const projected = Producer.build(current);
  assert.equal(projected.context.tonightSchedule.busyUntilAt, DAY + 'T21:20:00.000Z');
  const h = runtimeHarness({ current, storage: new Map([[KEY + '.open', JSON.stringify(receipt(offer))]]) });
  assert.equal(await h.runtime.retry(), false); assert.equal(h.runtime.state().error, 'opening_deferred');
  await h.advance(15 * 60000); await h.emit('window:focus');
  assert.equal(h.opened.length, 0); assert.equal(await h.runtime.retry(), true);
  assert.deepEqual(h.opened, [offer.primary.action]); assert.equal(h.calls.length, 0); h.dispose();
});

test('a cross-midnight busy interval remains a blocker when its HH:MM projection is deliberately null', async () => {
  const offer = eveningOffer(), current = snapshot({ now: DAY + 'T23:40:00.000Z', tasks: [
    { id: 'late-workout', title: 'Late workout', date: DAY, startTime: '23:30', estimateMin: 60, done: false },
  ] });
  const projected = Producer.build(current);
  assert.equal(projected.context.tonightSchedule.busyUntilLocal, null);
  assert.equal(projected.context.tonightSchedule.busyUntilAt, '2026-09-13T00:30:00.000Z');
  const h = runtimeHarness({ current, storage: new Map([[KEY + '.open', JSON.stringify(receipt(offer))]]) });
  assert.equal(await h.runtime.retry(), false); assert.equal(h.runtime.state().error, 'opening_deferred');
  assert.equal(h.opened.length, 0); assert.equal(h.calls.length, 0);
  assert.ok(h.storage.has(KEY + '.open')); h.dispose();
});

test('real busy projection and server recheck converge to one foreground evening claim without render polling', async () => {
  const initial = snapshot({ now: DAY + 'T20:59:50.000Z', tasks: [
    { id: 'training', title: 'Private workout', date: DAY, startTime: '20:30', estimateMin: 31, done: false },
  ] });
  let offer;
  const h = runtimeHarness({ current: initial, renderLoads: true, request: (body, current) => {
    if (body.op === 'claim') return claim(offer);
    assert.equal(body.op, 'decide');
    const projected = Producer.build(current); assert.equal(projected.ok, true);
    if (projected.context.tonightSchedule) return { ok: true, offer: null,
      silence: { reason: 'known_busy', recheckAt: projected.context.tonightSchedule.busyUntilAt } };
    offer = eveningOffer(current); return { ok: true, offer };
  } });
  await h.runtime.load(); await h.flush();
  assert.equal(h.runtime.state().phase, 'silence');
  for (let i = 0; i < 6; i++) await h.runtime.load();
  assert.equal(h.calls.length, 1);
  await h.advance(10010); // The chosen evening boundary is reached, but workout continues.
  assert.equal(h.runtime.state().offer, null); assert.equal(h.calls.filter(item => item.op === 'claim').length, 0);
  await h.advance(60000); // Producer and server wake at the same busy-until deadline.
  assert.equal(h.runtime.state().offer.capabilityId, 'evening-close');
  assert.equal(h.calls.filter(item => item.op === 'claim').length, 1);
  assert.equal(h.opened.length, 0);
  const count = h.calls.length;
  for (let i = 0; i < 6; i++) await h.runtime.load();
  assert.equal(h.calls.length, count);
  for (const body of h.calls) {
    assert.equal(Object.hasOwn(body.context, 'eveningContract'), false);
    assert.equal(Object.hasOwn(body.context, 'tonightSchedule'), false);
    assert.equal(JSON.stringify(body.context).includes('Private workout'), false);
  }
  h.dispose();
});

function appHarness({ current = snapshot(), model = {}, account = 'owner' } = {}) {
  const events = [], State = { me: { id: account }, settings: clone(current.settings), tasks: [{ id: 'unchanged', done: false }],
    habits: [{ id: 'habit' }], days: { [DAY]: { note: 'Keep my day' } }, view: 'today', calDate: DAY };
  const overlay = { _attentionVM: { day: DAY, boundaryLocal: '21:00', accountId: 'owner', ...model } };
  const context = vm.createContext({ State, window: { SecretaryNextMovesUIV1: UI }, document: { getElementById: () => overlay },
    secretaryNextSnapshot: () => current, lang: () => 'en',
    closeAttentionDialog: options => events.push(['close', clone(options)]),
    openEveningLanding: (opener, options) => events.push(['evening', opener, clone(options)]),
    attentionStatus: (message, error) => events.push(['status', message, error]), render: () => events.push(['render']),
    addDays: (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10),
    fetch: () => assert.fail('respond must not persist anything'), Store: new Proxy({}, { get: () => assert.fail('respond must not mutate data') }),
  });
  const begin = APP.indexOf('function secretaryEveningRespond('), end = APP.indexOf('async function loadSecretaryOffer()', begin);
  assert.ok(begin >= 0 && end > begin);
  vm.runInContext(APP.slice(begin, end), context);
  return { context, events, State, before: clone(State), current, overlay };
}

test('actual Ready answer opens the existing evening landing with no speech or data mutation', () => {
  const h = appHarness({ current: snapshot({ dayClosed: true }) });
  h.context.secretaryEveningRespond('ready');
  assert.deepEqual(h.events, [['close', { restoreFocus: false, force: true }],
    ['evening', null, { active: true, speak: false, source: 'secretary-evening' }]]);
  assert.deepEqual(h.State, h.before);
});
test('actual Busy answer closes the question without changing settings, day or tasks', () => {
  const h = appHarness(); h.context.secretaryEveningRespond('busy');
  assert.deepEqual(h.events, [['close', undefined]]); assert.deepEqual(h.State, h.before);
});
test('actual Planning answer only navigates the existing calendar to tomorrow', () => {
  const h = appHarness(); h.context.secretaryEveningRespond('planning');
  assert.equal(h.State.view, 'calendar'); assert.equal(h.State.calDate, '2026-09-13');
  assert.deepEqual(h.State, { ...h.before, view: 'calendar', calDate: '2026-09-13' });
  assert.deepEqual(h.events, [['close', { restoreFocus: false, force: true }], ['render']]);
});
test('actual answer guards account, day, current boundary and live blockers before any transition', () => {
  for (const choice of ['ready', 'planning']) {
    for (const options of [
      { account: 'different' }, { model: { day: '2026-09-11' } }, { model: { boundaryLocal: '20:30' } },
      { current: snapshot({ settings: { secretary: { configured: true, dailyReminder: false, eveningTime: '21:00' } } }) },
      { current: snapshot({ activeSession: true }) }, { current: snapshot({ guideActive: true }) },
      { current: snapshot({ firstValueStatus: 'action_started' }) },
    ]) {
      const h = appHarness(options); h.context.secretaryEveningRespond(choice);
      assert.deepEqual(h.State, h.before); assert.equal(h.events.length, 1);
      assert.equal(h.events[0][0], 'status'); assert.equal(h.events[0][2], true);
    }
  }
  const h = appHarness(); h.context.secretaryEveningRespond('finish-all');
  assert.deepEqual(h.events, []); assert.deepEqual(h.State, h.before);
});
