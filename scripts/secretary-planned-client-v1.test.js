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

const NOW = '2026-09-11T12:00:00.000Z', DAY = '2026-09-11';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
const makePlan = (extra = {}) => ({ taskRef: 'quest:planned1', plannedAtLocal: '12:00', precision: 'exact_time',
  startedToday: false, doneToday: false, observedAt: NOW, ...extra });
const snapshot = (extra = {}) => ({ now: NOW, today: DAY, utcOffsetMinutes: 0, dayClosed: false, lapse: null,
  tasks: [{ id: 'planned1', title: 'Saved task', startTime: '12:00', date: DAY, done: false }],
  habits: [], habitlog: {}, settings: {}, guideActive: false, firstValueStatus: null, activeSession: false, ...extra });
function decide(now = NOW, plan = makePlan(), context = {}) {
  return Policy.decide({ now, today: DAY, utcOffsetMinutes: 0, invocation: 'app_open', availableChannels: ['card'],
    enabledCapabilities: ['planned-start'], ledger: Policy.emptyLedger(), plannedStart: plan, ...context });
}
const plannedOffer = () => {
  const result = decide(); assert.equal(result.ok, true); assert.equal(result.offer.capabilityId, 'planned-start'); return result.offer;
};
const claim = offer => ({ ok: true, offer, token: 'claim-planned', persistedAt: NOW });
const outcomeReceipt = (offer, outcome = 'accepted') => ({ ok: true, outcome,
  action: outcome === 'accepted' ? clone(offer.primary.action) : null, persistedAt: NOW });

function clientHarness(rpc, stored = { value: null }) {
  let id = 0;
  const client = Client.create({ accountId: 'owner', clientId: 'tab-planned', requestId: () => 'request-' + ++id,
    currentAccount: () => 'owner', rpc, readPending: () => clone(stored.value), writePending: value => { stored.value = clone(value); } });
  return { client, stored };
}

/** Run the actual browser coordinator and receipt client in a deterministic VM.
 * The producer's planned projection is injected as a scripted external fact.
 * Real Policy chooses offers; this fixture does not implement scheduling policy.
 */
function runtimeHarness({ current = snapshot(), projection = { plan: makePlan(), nextDecisionAt: null },
  request, responseStatus = () => 200, onChanged, storage = new Map() } = {}) {
  let clock = Date.parse(current.now), seq = 0, runtime, disposed = false;
  let hidden = false, view = 'today', changes = 0, account = 'owner';
  const calls = [], opened = [], timers = new Map(), listeners = new Map(), publications = [], renderLoads = [];
  const add = (surface, name, callback) => {
    const key = surface + ':' + name;
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(callback);
  };
  const remove = (surface, name, callback) => listeners.get(surface + ':' + name)?.delete(callback);
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const producer = { ...Producer, build: value => {
    const result = Producer.build(value);
    if (!result.ok) return result;
    return { ...result, context: { ...result.context, plannedStart: clone(projection.plan) }, nextDecisionAt: projection.nextDecisionAt };
  } };
  const sandbox = vm.createContext({ console, JSON, Promise, Date: ClockDate, SecretaryNextMovesProducerV1: producer,
    document: { addEventListener: (name, callback) => add('document', name, callback), removeEventListener: (name, callback) => remove('document', name, callback) },
    addEventListener: (name, callback) => add('window', name, callback), removeEventListener: (name, callback) => remove('window', name, callback),
    setTimeout: (callback, delay = 0) => { const handle = ++seq; timers.set(handle, { callback, at: clock + Math.max(0, Number(delay)) }); return handle; },
    clearTimeout: handle => timers.delete(handle),
  });
  for (const file of ['secretary-next-moves-client-v1.js', 'secretary-next-moves-runtime-v1.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8'), sandbox, { filename: file });
  }
  let lastOffer = null;
  const env = {
    account: () => account, id: () => String(++seq),
    snapshot: () => clone({ ...current, now: new Date(clock).toISOString() }), visible: () => !hidden && view === 'today',
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (route, init) => {
      assert.equal(route, '/api/secretary/next-moves');
      const body = JSON.parse(init.body); calls.push({ ...clone(body), headers: clone(init.headers) });
      let data;
      if (request) data = await request(body);
      else if (body.op === 'decide') {
        const result = decide(new Date(clock).toISOString(), projection.plan, body.context);
        assert.equal(result.ok, true); lastOffer = result.offer;
        data = { ok: true, offer: result.offer, silence: result.silence };
      } else if (body.op === 'claim') data = claim(lastOffer);
      else data = outcomeReceipt(lastOffer, body.outcome);
      const status = responseStatus(body, data);
      return { ok: status >= 200 && status < 300, status, json: async () => data };
    },
    changed: () => {
      changes += 1;
      if (runtime) publications.push(clone(runtime.state()));
      assert.ok(changes < 80, 'render-driven reentry must remain bounded');
      if (runtime && onChanged && !disposed) renderLoads.push(Promise.resolve(onChanged(runtime)));
    },
    expired: () => assert.fail('unexpected auth expiry'), open: action => opened.push(clone(action)),
  };
  runtime = sandbox.SecretaryNextMovesRuntimeV1.create(env);
  async function flush() { await turn(); await Promise.all(renderLoads.splice(0)); await turn(); }
  async function advance(milliseconds) {
    const until = clock + milliseconds;
    let ticks = 0;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++ticks < 30, 'decision timer must not spin on a past deadline');
      clock = next[1].at; timers.delete(next[0]); next[1].callback(); await flush();
    }
    clock = until; await flush();
  }
  async function emit(surface, event) { for (const callback of listeners.get(surface + ':' + event) || []) callback(); await flush(); }
  return { runtime, env, calls, opened, timers, listeners, publications, current, projection, storage, flush, advance, emit,
    changes: () => changes, hide: value => { hidden = value; }, view: value => { view = value; }, account: value => { account = value; },
    dispose: () => { disposed = true; runtime.dispose(); },
  };
}

test('actual planned Policy offer passes strict client validation and accepts only its saved action', async () => {
  const offer = plannedOffer(), sent = [];
  assert.equal(Client.validOffer(offer), true);
  assert.deepEqual(offer.primary.action.args, { targetRef: 'quest:planned1', size: 'planned', day: DAY });
  for (const alter of [
    o => { o.primary.action.args.day = '2026-02-30'; },
    o => { o.primary.action.args.day = '2026-09-11T00:00:00Z'; },
    o => { o.primary.action.args.targetRef = 'habit:planned1'; },
    o => { o.primary.action.args.targetRef = 'quest:https://example.test'; },
    o => { o.primary.action.args.size = 'minimum'; },
    o => { o.copy.titleKey = 'secretary.v2.return.title.minimum'; },
    o => { o.channel = 'push'; },
  ]) { const changed = clone(offer); alter(changed); assert.equal(Client.validOffer(changed), false); }
  const h = clientHarness(async body => { sent.push(clone(body)); return body.op === 'decide' ? { ok: true, offer }
    : body.op === 'claim' ? claim(offer) : outcomeReceipt(offer); });
  assert.equal(await h.client.load({}), true);
  assert.ok(await h.client.outcome('accepted'));
  assert.equal(h.client.state().offer, null);
  assert.deepEqual(sent.map(body => body.op), ['decide', 'claim', 'outcome']);
  for (const body of sent.slice(0, 2)) assert.deepEqual(body.supportedCapabilities, ['after-lapse-return', 'planned-start']);
  assert.equal(Object.hasOwn(sent[2], 'supportedCapabilities'), false, 'outcome retries retain their original mutation shape');
});

test('uncertain planned acceptance survives reload and replays exact identity, context and selected action', async () => {
  const offer = plannedOffer(), sent = [], storage = { value: null };
  const a = clientHarness(async body => {
    if (body.op === 'decide') return { ok: true, offer };
    if (body.op === 'claim') return claim(offer);
    sent.push(clone(body)); throw new Error('offline');
  }, storage);
  await a.client.load({ activeSession: { active: false } });
  assert.equal(await a.client.outcome('accepted', 'primary', { activeSession: { active: false }, generation: 1 }), null);
  const saved = clone(storage.value);
  assert.equal(saved.offer.primary.action.args.size, 'planned');
  const b = clientHarness(async body => { sent.push(clone(body)); return outcomeReceipt(offer); }, storage);
  assert.equal(b.client.state().error, 'unconfirmed');
  assert.equal(await b.client.outcome('dismissed'), null);
  assert.ok(await b.client.outcome('accepted', 'primary', { activeSession: { active: true }, generation: 2 }));
  assert.deepEqual(sent, [saved.pending, saved.pending]);
  assert.equal(storage.value, null);
  assert.equal(sent.every(body => !Object.hasOwn(body, 'supportedCapabilities')), true);
});

test('planned acceptance rejects a receipt that silently changes the selected size or valid calendar day', async () => {
  const offer = plannedOffer();
  for (const changedArgs of [{ ...offer.primary.action.args, size: 'minimum' }, { ...offer.primary.action.args, day: '2026-09-12' }]) {
    const h = clientHarness(async body => body.op === 'decide' ? { ok: true, offer }
      : body.op === 'claim' ? claim(offer)
        : { ...outcomeReceipt(offer), action: { ...offer.primary.action, args: changedArgs } });
    await h.client.load({});
    assert.equal(await h.client.outcome('accepted'), null);
    assert.equal(h.client.state().error, 'invalid_response');
    assert.ok(h.client.pending(), 'an unconfirmed result retains the exact original intent');
  }
});

test('the planned card becomes visible only after its durable channel claim', async () => {
  const offer = plannedOffer(); let release;
  const response = new Promise(resolve => { release = resolve; });
  const h = clientHarness(body => body.op === 'decide' ? { ok: true, offer } : response);
  const loading = h.client.load({}); await turn();
  assert.equal(h.client.state().offer, null);
  release(claim(offer));
  assert.equal(await loading, true); assert.equal(h.client.state().offer.offerId, offer.offerId);
});

test('all five locales show planned time and escaped owner title with distinct prepared size copy', () => {
  const offer = plannedOffer(), title = '<img src=x onerror="bad()"> & "saved"';
  const owner = snapshot({ tasks: [{ id: 'planned1', date: DAY, done: false, title, startTime: '12:00' }] });
  assert.deepEqual(UI.LANGS, ['ru', 'en', 'de', 'uk', 'es']);
  for (const lang of UI.LANGS) {
    const html = UI.render({ offer, busy: false }, lang, owner);
    for (const key of [offer.copy.titleKey, offer.copy.bodyKey, offer.primary.labelKey, 'secretary.v2.planned_start.at']) assert.ok(UI.COPY[lang][key]);
    assert.match(html, /<time>12:00<\/time>/);
    assert.equal(html.includes('<img'), false); assert.match(html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt; &amp; &quot;saved&quot;/);
    assert.ok(html.includes(UI.COPY[lang]['secretary.v2.planned_start.at']));
    const prepared = { lang, kind: 'quest', ref: 'quest:planned1', id: 'planned1', title, ownerHTML: '<li>Owner task controls</li>', startLabel: 'Start', minimum: 'Saved minimum' };
    const planned = UI.renderPrepared({ ...prepared, size: 'planned' });
    const minimum = UI.renderPrepared({ ...prepared, size: 'minimum' });
    assert.ok(planned.includes(UI.COPY[lang]['secretary.v2.planned_start.prepared']));
    assert.equal(planned.includes('Saved minimum'), false); assert.ok(minimum.includes('Saved minimum'));
    assert.equal(planned.includes('<img'), false); assert.ok(planned.includes('data-action="focus-task"'));
  }
  const timeInjection = UI.render({ offer }, 'en', snapshot({ tasks: [{ ...owner.tasks[0], startTime: '<svg onload=bad()>' }] }));
  assert.equal(timeInjection.includes('<svg'), false); assert.match(timeInjection, /&lt;svg onload=bad\(\)&gt;/);
});

test('planned nextDecisionAt wakes the real runtime without click and unchanged renders reuse silence', async () => {
  const initial = '2026-09-11T11:49:50.000Z', boundary = '2026-09-11T11:50:00.000Z';
  const h = runtimeHarness({ current: snapshot({ now: initial }), projection: { plan: makePlan({ observedAt: initial }), nextDecisionAt: boundary },
    onChanged: runtime => runtime.load() });
  await h.runtime.load(); await h.flush();
  assert.equal(h.runtime.state().phase, 'silence'); assert.equal(h.calls.length, 1);
  for (let i = 0; i < 5; i++) await h.runtime.load();
  assert.equal(h.calls.length, 1, 'renders before the future boundary must not poll');
  await h.advance(9999); assert.equal(h.calls.length, 1);
  h.projection.nextDecisionAt = null; // The fixture now supplies its next chronological projection.
  await h.advance(20);
  assert.deepEqual(h.calls.map(body => body.op), ['decide', 'decide', 'claim']);
  for (const body of h.calls) {
    assert.equal(Object.hasOwn(body.context, 'plannedStart'), false, 'the server rebuilds the task projection from owner data');
    assert.equal(JSON.stringify(body.context).includes('Saved task'), false);
    assert.equal(body.headers['X-Local-Day'], DAY);
  }
  assert.equal(h.runtime.state().phase, 'offered'); assert.equal(h.opened.length, 0);
  h.dispose();
});

test('hidden and off-Today timer wakes do not claim; visibility/focus resumes the planned decision', async () => {
  for (const reason of ['hidden', 'off-today']) {
    const h = runtimeHarness({ current: snapshot({ now: '2026-09-11T11:49:50.000Z' }),
      projection: { plan: makePlan({ observedAt: '2026-09-11T11:49:50.000Z' }), nextDecisionAt: '2026-09-11T11:50:00.000Z' } });
    await h.runtime.load();
    if (reason === 'hidden') h.hide(true); else h.view('calendar');
    h.projection.nextDecisionAt = null;
    await h.advance(10020); await h.runtime.load();
    await h.emit('window', 'focus'); await h.emit('document', 'visibilitychange');
    assert.equal(h.calls.length, 1, reason + ' suppresses network and claim');
    h.hide(false); h.view('today');
    await h.emit(reason === 'hidden' ? 'document' : 'window', reason === 'hidden' ? 'visibilitychange' : 'focus');
    assert.deepEqual(h.calls.map(body => body.op), ['decide', 'decide', 'claim']);
    assert.equal(h.runtime.state().phase, 'offered'); h.dispose();
  }
});

test('leaving Today or hiding while decide is in flight prevents the subsequent claim', async () => {
  for (const reason of ['hidden', 'off-today']) {
    let release;
    const response = new Promise(resolve => { release = resolve; }), offer = plannedOffer();
    const h = runtimeHarness({ request: body => body.op === 'decide' ? response : claim(offer) });
    const loading = h.runtime.load(); await h.flush();
    if (reason === 'hidden') h.hide(true); else h.view('calendar');
    release({ ok: true, offer }); await loading; await h.flush();
    assert.equal(h.calls.filter(body => body.op === 'claim').length, 0, reason + ' must be rechecked before channel claim');
    assert.equal(h.runtime.state().offer, null); h.dispose();
  }
});

test('a changed scheduled task invalidates prior silence once without render polling', async () => {
  const h = runtimeHarness({ projection: { plan: makePlan({ plannedAtLocal: '15:00' }), nextDecisionAt: '2026-09-11T14:50:00.000Z' },
    onChanged: runtime => runtime.load() });
  await h.runtime.load(); await h.flush(); assert.equal(h.runtime.state().phase, 'silence');
  await h.runtime.load(); assert.equal(h.calls.length, 1);
  h.current.tasks[0].startTime = '12:00'; h.projection.plan = makePlan(); h.projection.nextDecisionAt = null;
  await h.runtime.load(); await h.flush();
  assert.deepEqual(h.calls.map(body => body.op), ['decide', 'decide', 'claim']);
  assert.equal(h.runtime.state().offer.capabilityId, 'planned-start');
  for (let i = 0; i < 3; i++) await h.runtime.load();
  assert.equal(h.calls.length, 3); h.dispose();
});

test('dispose cancels scheduled wakes and listeners and ignores late decide/claim replies', async () => {
  for (const delayedOperation of ['decide', 'claim']) {
    let release;
    const response = new Promise(resolve => { release = resolve; }), offer = plannedOffer();
    const h = runtimeHarness({ projection: { plan: makePlan(), nextDecisionAt: '2026-09-11T12:01:00.000Z' },
      request: body => body.op === delayedOperation ? response : { ok: true, offer } });
    const loading = h.runtime.load(); await h.flush();
    assert.ok(h.timers.size > 0); assert.equal([...h.listeners.values()].reduce((n, set) => n + set.size, 0), 2);
    h.dispose(); const changes = h.changes(), requests = h.calls.length;
    assert.equal(h.timers.size, 0); assert.equal([...h.listeners.values()].reduce((n, set) => n + set.size, 0), 0);
    release(delayedOperation === 'decide' ? { ok: true, offer } : claim(offer));
    await loading; await h.advance(120000); await h.emit('window', 'focus'); await h.emit('document', 'visibilitychange');
    assert.equal(h.calls.length, requests); assert.equal(h.changes(), changes);
    assert.equal(h.runtime.state().offer, null); assert.equal(h.opened.length, 0);
  }
});

test('dispose after a planned offer cancels its expiry mutation timer', async () => {
  const h = runtimeHarness(); await h.runtime.load(); assert.equal(h.runtime.state().phase, 'offered');
  assert.ok(h.timers.size > 0); h.dispose(); await h.advance(60 * 60000);
  assert.equal(h.timers.size, 0); assert.deepEqual(h.calls.map(body => body.op), ['decide', 'claim']);
});

test('acceptance confirmed after hiding waits for visible retry and opens without repeating the outcome', async () => {
  const offer = plannedOffer(); let release;
  const response = new Promise(resolve => { release = resolve; });
  const h = runtimeHarness({ request: body => body.op === 'decide' ? { ok: true, offer }
    : body.op === 'claim' ? claim(offer) : response });
  await h.runtime.load();
  const accepting = h.runtime.respond('accepted'); await h.flush();
  h.hide(true); release(outcomeReceipt(offer));
  assert.equal(await accepting, false); assert.equal(h.opened.length, 0);
  assert.equal(h.runtime.state().error, 'opening_deferred');
  const saved = JSON.parse(h.storage.get('satoru.secretary.next.owner.open'));
  assert.deepEqual(saved.action, offer.primary.action);
  assert.equal(await h.runtime.retry(), false); assert.equal(h.opened.length, 0);
  h.hide(false); await h.emit('document', 'visibilitychange');
  assert.equal(h.opened.length, 0, 'becoming visible does not substitute for the requested retry');
  assert.equal(await h.runtime.retry(), true);
  assert.deepEqual(h.opened, [offer.primary.action]);
  assert.equal(h.storage.has('satoru.secretary.next.owner.open'), false);
  assert.equal(h.calls.filter(body => body.op === 'outcome').length, 1);
  h.dispose();
});

test('a deferred planned receipt from yesterday cannot reopen after reload on a new valid local day', async () => {
  const offer = plannedOffer(), storage = new Map([['satoru.secretary.next.owner.open', JSON.stringify(outcomeReceipt(offer))]]);
  const h = runtimeHarness({ storage, current: snapshot({ now: '2026-09-12T12:00:00.000Z', today: '2026-09-12' }),
    request: () => assert.fail('stale deferred open must be rejected without a network mutation') });
  assert.equal(h.runtime.state().error, 'opening_deferred');
  assert.equal(await h.runtime.retry(), false);
  assert.equal(h.runtime.state().error, 'stale_target');
  assert.equal(h.storage.has('satoru.secretary.next.owner.open'), false);
  assert.equal(h.opened.length, 0); assert.equal(h.calls.length, 0); h.dispose();
});

test('held and legacy-held silence wake at the server deadline without render polling or a click', async () => {
  for (const reason of ['held', 'legacy_held']) {
    const offer = plannedOffer(), recheckAt = '2026-09-11T12:00:05.000Z';
    let decisions = 0;
    const h = runtimeHarness({
      projection: { plan: makePlan(), nextDecisionAt: '2026-09-11T12:01:00.000Z' },
      request: body => body.op === 'decide'
        ? ++decisions === 1 ? { ok: true, offer: null, silence: { reason, recheckAt } } : { ok: true, offer }
        : claim(offer),
      onChanged: runtime => runtime.load(),
    });
    await h.runtime.load(); await h.flush();
    assert.equal(h.runtime.state().phase, 'silence'); assert.equal(h.runtime.state().silence.reason, reason);
    assert.equal(h.timers.size, 2, 'the held deadline and the future producer boundary remain independent');
    for (let i = 0; i < 6; i++) await h.runtime.load();
    assert.deepEqual(h.calls.map(body => body.op), ['decide']);
    await h.advance(5009);
    assert.equal(h.calls.length, 1, 'do not reacquire before the server deadline plus its safety margin');
    await h.advance(1);
    assert.deepEqual(h.calls.map(body => body.op), ['decide', 'decide', 'claim']);
    assert.equal(h.runtime.state().phase, 'offered'); assert.equal(h.opened.length, 0);
    for (let i = 0; i < 6; i++) await h.runtime.load();
    await h.advance(1000);
    assert.equal(h.calls.length, 3, 'rendering the acquired card does not schedule another held poll');
    h.dispose();
  }
});

test('a competing claim HTTP 409 retains its recheck deadline and recovers through decide and claim', async () => {
  const offer = plannedOffer(), recheckAt = '2026-09-11T12:00:05.000Z';
  let claims = 0;
  const h = runtimeHarness({ request: body => body.op === 'decide' ? { ok: true, offer }
    : ++claims === 1 ? { error: 'held', recheckAt } : claim(offer),
    responseStatus: (_body, data) => data.error === 'held' ? 409 : 200,
    onChanged: runtime => runtime.load() });
  await h.runtime.load(); await h.flush();
  assert.equal(h.runtime.state().phase, 'silence'); assert.equal(h.runtime.state().silence.recheckAt, recheckAt);
  assert.equal(h.runtime.state().offer, null); assert.equal(h.timers.size, 1);
  for (let i = 0; i < 4; i++) await h.runtime.load();
  assert.deepEqual(h.calls.map(body => body.op), ['decide', 'claim']);
  await h.advance(5010);
  assert.deepEqual(h.calls.map(body => body.op), ['decide', 'claim', 'decide', 'claim']);
  assert.equal(h.runtime.state().phase, 'offered'); h.dispose();
});

test('malformed held deadlines fail visibly and cannot create a wake timer or render retry loop', async () => {
  for (const transport of ['silence', 'claim-conflict']) {
    for (const recheckAt of ['tomorrow', '2026-09-11T12:00:05Z', '2026-02-30T12:00:00.000Z', 1789128005000, {}]) {
      const offer = plannedOffer();
      const h = runtimeHarness({ request: body => transport === 'silence'
        ? { ok: true, offer: null, silence: { reason: 'held', recheckAt } }
        : body.op === 'decide' ? { ok: true, offer } : { error: 'held', recheckAt },
        responseStatus: (_body, data) => data.error === 'held' ? 409 : 200,
        onChanged: runtime => runtime.load() });
      await h.runtime.load(); await h.flush();
      assert.equal(h.runtime.state().phase, 'error'); assert.equal(h.runtime.state().error, 'invalid_response');
      assert.equal(h.runtime.state().offer, null); assert.equal(h.timers.size, 0);
      const count = h.calls.length;
      for (let i = 0; i < 4; i++) await h.runtime.load();
      await h.advance(60000);
      assert.equal(h.calls.length, count, transport + ' must not turn a malformed deadline into a timer loop');
      assert.equal(h.opened.length, 0); h.dispose();
    }
  }
});

test('hidden and off-Today held expiry stay silent until visibility or focus resumes the decision', async () => {
  for (const reason of ['hidden', 'off-today']) {
    const offer = plannedOffer(); let decisions = 0;
    const h = runtimeHarness({ request: body => body.op === 'decide'
      ? ++decisions === 1 ? { ok: true, offer: null, silence: { reason: 'held', recheckAt: '2026-09-11T12:00:05.000Z' } } : { ok: true, offer }
      : claim(offer), onChanged: runtime => runtime.load() });
    await h.runtime.load(); await h.flush();
    if (reason === 'hidden') h.hide(true); else h.view('calendar');
    await h.advance(5010); await h.runtime.load();
    await h.emit('document', 'visibilitychange'); await h.emit('window', 'focus');
    assert.equal(h.calls.length, 1, reason + ' cannot decide or claim after held expiry');
    assert.equal(h.runtime.state().offer, null);
    h.hide(false); h.view('today');
    await h.emit(reason === 'hidden' ? 'document' : 'window', reason === 'hidden' ? 'visibilitychange' : 'focus');
    assert.deepEqual(h.calls.map(body => body.op), ['decide', 'decide', 'claim']);
    assert.equal(h.runtime.state().phase, 'offered'); h.dispose();
  }
});

test('held wake cannot cross an account switch and dispose cancels it and its listeners', async () => {
  for (const action of ['account-switch', 'dispose']) {
    const h = runtimeHarness({ request: () => ({ ok: true, offer: null,
      silence: { reason: 'held', recheckAt: '2026-09-11T12:00:05.000Z' } }) });
    await h.runtime.load(); assert.equal(h.timers.size, 1);
    const changes = h.changes();
    if (action === 'account-switch') h.account('other-owner');
    else {
      h.dispose(); assert.equal(h.timers.size, 0);
      assert.equal([...h.listeners.values()].reduce((count, callbacks) => count + callbacks.size, 0), 0);
    }
    await h.advance(10000); await h.emit('window', 'focus'); await h.emit('document', 'visibilitychange');
    await h.runtime.load();
    assert.equal(h.calls.length, 1, action + ' must prevent the old owner from claiming');
    assert.equal(h.changes(), changes); assert.equal(h.opened.length, 0); h.dispose();
  }
});
