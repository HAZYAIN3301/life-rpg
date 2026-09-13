'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const C = require('../public/commitment-v2.js');
const Store = require('../public/commitment-store-v1.js');
const P = require('../public/secretary-next-moves-producer-v1.js');
const Policy = require('../public/secretary-next-moves-v2.js');
const UI = require('../public/secretary-next-moves-ui-v1.js');
const Client = require('../public/secretary-next-moves-client-v1.js');
const Service = require('../server-secretary-next-moves-v1.js');
const ROOT = path.resolve(__dirname, '..');
const DAY = '2026-09-13', NOW = DAY + 'T12:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
const pause = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function step(id = 'a', extra = {}) {
  return { id: 'quest:' + id, kind: 'step', title: 'Saved result ' + id, win: 'Send the first draft',
    edge: { kind: 'time', at: '15:00' }, core: true, modes: [], history: [], decidedOn: DAY, ...extra };
}
function snapshot() {
  return { now: NOW, today: DAY, utcOffsetMinutes: 0, dayClosed: false, guideActive: false,
    activeSession: false, firstValueStatus: null, habits: [], habitlog: {},
    tasks: [{ id: 'a', title: 'Task A', done: false, date: DAY, commitmentId: 'quest:a' },
      { id: 'b', title: 'Task B', done: false, date: DAY }],
    settings: { commitmentsV1: { version: 2, mode: 'default', items: [step()], log: {} } },
    lapse: { confirmed: true, source: 'user_confirmed', eventKey: 'attention:test', day: DAY,
      endedAt: DAY + 'T11:59:00.000Z', observedAt: NOW } };
}
function context(s) { const result = P.build(s); assert.equal(result.ok, true, result.error); return result.context; }
function decide(s, enabledCapabilities = ['after-lapse-return']) {
  return Policy.decide({ ...context(s), now: s.now, today: s.today, utcOffsetMinutes: s.utcOffsetMinutes,
    invocation: 'app_open', availableChannels: ['card'], enabledCapabilities, ledger: Policy.emptyLedger() });
}
function release(s) { s.settings.commitmentsV1.items[0].archivedAt = DAY; }

test('only the explicit, valid, due V2 owner task relation becomes a secretary step', () => {
  const s = snapshot(), before = clone(s);
  s.settings.commitmentsV1.items.push({ id: 'attention', kind: 'attention', title: 'Read', win: 'One chapter',
    target: 'book', edge: { kind: 'duration', minutes: 15 }, core: false, modes: [], history: [] });
  const preserved = clone(s);
  assert.equal(Store.validateTaskGraph(s.tasks, s.settings.commitmentsV1), true);
  const items = context(s).commitmentItems;
  assert.equal(items.length, 1); assert.equal(items[0].taskRef, 'quest:a'); assert.equal(items[0].win, step().win);
  assert.equal(context(s).plannedStart, null, 'finish boundary never manufactures a start time');
  assert.deepEqual(s, preserved); assert.deepEqual(context(s).commitmentItems, items);
  for (const mutate of [
    s => { delete s.tasks[0].commitmentId; },
    s => { s.tasks[0].commitmentId = 'quest:b'; },
    s => { s.settings.commitmentsV1.items.push(step()); },
    s => { s.tasks.push(clone(s.tasks[0])); },
    s => { s.settings.commitmentsV1.items[0].kind = 'care'; },
    s => { s.settings.commitmentsV1.items[0].win = ''; },
    s => { s.settings.commitmentsV1.items[0].unexpected = true; },
    s => { s.settings.commitmentsV1.items[0].decidedOn = '2026-09-14'; },
    s => { s.settings.commitmentsV1.items[0].modes = ['travel']; },
    s => { s.tasks[0].done = true; },
    s => { s.tasks[0].done = null; },
    s => { s.tasks[0].completedAt = NOW; },
    s => { s.tasks[0].date = '2026-09-14'; },
    s => { s.tasks[0].date = '2026-09-12'; },
    s => { delete s.tasks[0].date; },
    s => { s.settings.commitmentsV1.log[DAY] = { 'quest:a': 'win' }; },
    s => { s.settings.commitmentsV1.log[DAY] = { 'quest:a': 'miss' }; },
    release,
  ]) {
    const bad = clone(before); mutate(bad);
    assert.deepEqual(P.linkedCommitments(bad), [], String(mutate));
  }
  const legacy = clone(before); legacy.settings.commitmentsV1.version = 1;
  assert.equal(context(legacy).commitmentItems[0].taskRef, 'quest:a', 'lossless V1 migration keeps an existing explicit link');
  assert.equal(legacy.settings.commitmentsV1.version, 1, 'projection does not persist migration');
});

test('a linked step is a bounded fallback; original task wins and quotes follow that exact task', () => {
  const s = snapshot(), offer = decide(s).offer;
  assert.equal(offer.action.args.targetRef, 'quest:a');
  assert.equal(offer.quote.win, step().win);
  assert.equal(offer.action.args.commitmentBasis, context(s).commitmentItems[0].commitmentBasis);
  assert.equal(Client.validOffer(offer), true);
  s.lapse.originalRef = 'quest:b';
  const original = decide(s).offer;
  assert.equal(original.action.args.targetRef, 'quest:b'); assert.equal(original.quote, null);
  assert.equal(original.action.args.commitmentBasis, undefined);
  const raw = Policy.decide({ ...context(s), lapse: { ...context(s).lapse, originalRef: undefined },
    commitmentItems: [step()], now: NOW, today: DAY, utcOffsetMinutes: 0, invocation: 'app_open',
    availableChannels: ['card'], enabledCapabilities: ['after-lapse-return'], ledger: Policy.emptyLedger() });
  assert.equal(raw.offer.action.type, 'ask_one_question', 'raw commitment id is not an executable owner link');
  s.lapse = null;
  assert.equal(decide(s).offer, null, 'a boundary without a confirmed lapse does not create a new reminder');
  s.lapse = snapshot().lapse; s.settings.secretary = { configured: true, eveningTime: '11:00', dailyReminder: false };
  assert.notEqual(decide(s).offer.action.type, 'task_open_prepared', 'own evening boundary still blocks work');
});

test('card quotes use the saved result, escape personal words and disappear with a stale link in all five locales', () => {
  const s = snapshot(); s.settings.commitmentsV1.items[0].title = 'Draft <img src=x>';
  s.settings.commitmentsV1.items[0].win = 'Send <script>unsafe()</script> & finish';
  const offer = decide(s).offer;
  for (const lang of UI.LANGS) {
    const html = UI.render({ offer, busy: false }, lang, s);
    assert.ok(html.includes('&lt;script&gt;unsafe()&lt;/script&gt; &amp; finish'));
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
    assert.ok(html.includes(UI.copy('secretary.v2.common.own_words', lang)));
    assert.ok(UI.copy('secretary.v2.commitment.hint', lang));
    assert.ok(UI.copy('secretary.v2.commitment.unconfirmed', lang));
    const changed = clone(s); changed.settings.commitmentsV1.items[0].win = 'A new result';
    const stale = UI.render({ offer, busy: false }, lang, changed);
    assert.ok(!stale.includes('data-action="secretary-next-accept"'));
    assert.ok(!stale.includes('unsafe')); assert.ok(stale.includes('role="alert"'));
  }
});

function serviceHarness(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-links-v261-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let fail = false, seq = 0;
  const writes = [];
  function durableWrite(file, value) {
    if (fail) throw new Error('synthetic_write_failure');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
    const parent = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    writes.push(file);
  }
  const service = Service.createService({ userDir: uid => path.join(dir, uid), durableWrite });
  const save = (s, uid = 'alice') => {
    for (const name of ['settings', 'tasks', 'habits', 'habitlog']) durableWrite(path.join(dir, uid, name + '.json'), s[name]);
  };
  const body = (s, op, extra = {}) => ({ op, clientId: 'tab_a', requestId: 'request_' + ++seq,
    context: { lapse: s.lapse, activeSession: { active: s.activeSession }, guide: { active: s.guideActive },
      firstValue: { pending: false } }, supportedCapabilities: ['after-lapse-return', 'planned-start'], ...extra });
  const call = (s, b, uid = 'alice') => service.transact(uid, b, { now: s.now, today: s.today, offset: s.utcOffsetMinutes });
  function claim(s) {
    const offer = call(s, body(s, 'decide')).body.offer; assert.ok(offer);
    return call(s, body(s, 'claim', { offerId: offer.offerId })).body;
  }
  const outcome = (s, claimed, type = 'accepted') => body(s, 'outcome', {
    offerId: claimed.offer.offerId, token: claimed.token, actionId: 'primary', outcome: type });
  const read = (uid = 'alice') => JSON.parse(fs.readFileSync(path.join(dir, uid, 'secretary.json'), 'utf8'));
  return { save, body, call, claim, outcome, read, writes, setFail: value => { fail = value; } };
}

test('authoritative service never accepts removed, revised, completed, moved or forged owner links', async t => {
  for (const [name, mutate] of [
    ['released', release], ['removed', s => { s.tasks[0].commitmentId = undefined; }],
    ['revised result', s => { s.settings.commitmentsV1.items[0].win = 'A different finish'; }],
    ['revised boundary', s => { s.settings.commitmentsV1.items[0].edge.at = '16:00'; }],
    ['finished', s => { s.tasks[0].done = true; }],
    ['moved', s => { s.tasks[0].date = '2026-09-14'; }],
    ['removed record', s => { s.settings.commitmentsV1.items = []; }],
  ]) await t.test(name, t => {
    const h = serviceHarness(t), s = snapshot(); h.save(s);
    const claimed = h.claim(s); mutate(s); h.save(s);
    const result = h.call(s, h.outcome(s, claimed));
    assert.equal(result.status, 409); assert.equal(result.body.error, 'stale_target');
    assert.equal(h.read().delivery.offers[claimed.offer.offerId].state, 'expired');
  });
  await t.test('account files are the only source; forged context and tokens do not supply a link', t => {
    const h = serviceHarness(t), s = snapshot(); h.save(s);
    const claimed = h.claim(s), other = snapshot(); other.tasks = []; other.settings = {}; h.save(other, 'bob');
    const body = h.body(other, 'decide'); body.context.commitmentItems = context(s).commitmentItems;
    assert.equal(h.call(other, body, 'bob').body.offer.action.type, 'ask_one_question');
    assert.throws(() => h.call(other, h.outcome(other, claimed), 'bob'), e => e.code === 'offer_not_found');
  });
});

test('planned revalidation keeps the whole graph and binds only the planned task quote', t => {
  const h = serviceHarness(t), s = snapshot(); s.lapse = null; s.tasks[0].startTime = '12:00';
  s.tasks[1].commitmentId = 'quest:b'; s.settings.commitmentsV1.items.push(step('b'));
  h.save(s); const claimed = h.claim(s);
  assert.equal(claimed.offer.capabilityId, 'planned-start'); assert.equal(claimed.offer.quote.id, 'quest:a');
  s.tasks[1].startTime = '12:01'; h.save(s);
  const receipt = h.call(s, h.outcome(s, claimed));
  assert.equal(receipt.status, 200, 'another nearer task does not invalidate the frozen planned target or truncate the link graph');
  assert.equal(receipt.body.action.args.targetRef, 'quest:a');
});

test('accepted link receipt follows durable write, retries exactly once, and a failed write acknowledges nothing', t => {
  const h = serviceHarness(t), s = snapshot(); h.save(s); const claimed = h.claim(s), request = h.outcome(s, claimed);
  const before = h.read(); h.setFail(true);
  assert.throws(() => h.call(s, request), e => e.code === 'secretary_save_failed'); h.setFail(false);
  assert.deepEqual(h.read(), before);
  const receipt = h.call(s, request), persisted = h.read();
  assert.equal(receipt.status, 200); assert.equal(persisted.delivery.offers[claimed.offer.offerId].state, 'accepted');
  const writes = h.writes.length, again = h.call(s, request);
  assert.equal(again.body.repeat, true); assert.deepEqual(again.body.action, receipt.body.action);
  assert.equal(h.writes.length, writes);
});

function runtimeHarness(t, { onReply } = {}) {
  const h = serviceHarness(t), current = snapshot(), storage = new Map(), calls = [], opened = [];
  let account = 'alice', epoch = 1, seq = 0, visible = true;
  h.save(current);
  const sandbox = vm.createContext({ console, Date, JSON, Promise, SecretaryNextMovesProducerV1: P,
    setTimeout: () => ++seq, clearTimeout: () => {} });
  for (const name of ['client', 'runtime']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'secretary-next-moves-' + name + '-v1.js'), 'utf8'), sandbox);
  const env = { account: () => account, epoch: () => epoch, snapshot: () => clone(current), visible: () => visible, id: () => String(++seq),
    storage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (route, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      let result;
      try { result = h.call(current, body, account); }
      catch (e) { result = { status: e.status || 500, body: { error: e.code || e.message } }; }
      if (onReply) await onReply(body, result);
      return { ok: result.status === 200, status: result.status, json: async () => clone(result.body) };
    },
    changed: () => {}, expired: () => { throw new Error('unexpected expiry'); },
    open: action => { opened.push(clone(action)); return true; } };
  let runtime = sandbox.SecretaryNextMovesRuntimeV1.create(env);
  t.after(() => runtime.dispose());
  return { ...h, current, calls, opened, storage, runtime, env,
    switchAccount: () => { account = 'bob'; }, nextEpoch: () => { epoch++; },
    visible: value => { visible = value; },
    reload: () => { runtime.dispose(); runtime = sandbox.SecretaryNextMovesRuntimeV1.create(env); return runtime; } };
}

test('actual runtime opens only after durable acceptance and blocks late account/epoch changes', async t => {
  for (const type of ['account', 'epoch', 'link']) await t.test(type, async t => {
    const waiting = pause(), continueReply = pause();
    const h = runtimeHarness(t, { onReply: async body => {
      if (body.op === 'outcome') { waiting.resolve(); await continueReply.promise; }
    } });
    await h.runtime.load(); const outcome = h.runtime.respond('accepted'); await waiting.promise;
    assert.equal(h.opened.length, 0); assert.equal(Object.values(h.read().delivery.offers)[0].state, 'accepted');
    if (type === 'account') h.switchAccount();
    if (type === 'epoch') h.nextEpoch();
    if (type === 'link') { release(h.current); h.save(h.current); }
    continueReply.resolve(); assert.equal(await outcome, false); assert.equal(h.opened.length, 0);
    if (type === 'link') assert.equal(h.runtime.state().error, 'stale_target');
  });
});

test('lost accepted response survives reload; exact retry cannot open a subsequently released link', async t => {
  let lose = true;
  const h = runtimeHarness(t, { onReply: async body => {
    if (body.op === 'outcome' && lose) { lose = false; throw new Error('lost_reply'); }
  } });
  await h.runtime.load(); assert.equal(await h.runtime.respond('accepted'), false);
  const first = clone(h.calls.find(call => call.op === 'outcome')); assert.equal(h.opened.length, 0);
  release(h.current); h.save(h.current);
  const reloaded = h.reload(); assert.equal(await reloaded.retry(), false);
  assert.deepEqual(h.calls.filter(call => call.op === 'outcome')[1], first);
  assert.equal(reloaded.state().error, 'stale_target'); assert.equal(h.opened.length, 0);
});

test('a deferred accepted link rechecks before open, survives reload, and opens at most once', async t => {
  const h = runtimeHarness(t, { onReply: async body => { if (body.op === 'outcome') h.current.activeSession = true; } });
  await h.runtime.load(); assert.equal(await h.runtime.respond('accepted'), false);
  assert.ok(h.storage.has('satoru.secretary.next.alice.open')); assert.equal(h.opened.length, 0);
  const reloaded = h.reload(); h.current.activeSession = false;
  assert.equal(await reloaded.retry(), true); assert.equal(h.opened.length, 1);
  await reloaded.retry(); assert.equal(h.opened.length, 1);
  assert.equal(h.storage.has('satoru.secretary.next.alice.open'), false);
});

test('a stale visible quote can be expired on retry without falsely recording acceptance', async t => {
  const h = runtimeHarness(t); await h.runtime.load();
  h.current.settings.commitmentsV1.items[0].win = 'Changed result'; h.save(h.current);
  await h.runtime.retry();
  assert.equal(Object.values(h.read().delivery.offers)[0].state, 'expired');
  assert.equal(h.opened.length, 0); assert.ok(!h.runtime.state().offer);
});

const appSource = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
function appHarness({ onFetch, onRefresh } = {}) {
  const current = snapshot(), requests = [], events = [];
  delete current.tasks[0].commitmentId; current.settings.commitmentsV1.items = [];
  let committed = 0;
  const sandbox = vm.createContext({ console: { ...console, error: () => {} }, structuredClone, CSS: { escape: s => s },
    window: { CommitmentV2: C, CommitmentStoreV1: Store }, State: { me: { id: 'alice' }, settings: current.settings, tasks: current.tasks },
    todayStr: () => DAY, taskWriteAllowed: () => true, settingsWriteAllowed: () => true,
    validateSettingsPayload: () => true, validateTasksPayload: () => true, t: s => s, toast: s => events.push(s), track: s => events.push(s),
    commitmentWriteBase: () => clone({ settings: { exists: true, value: current.settings }, tasks: { exists: true, value: current.tasks } }),
    commitmentBoundaryCode: async response => response.code,
    commitmentBoundaryRejected: async response => [409, 428].includes(response.status),
    refreshCommitmentWriteBase: async owner => onRefresh ? onRefresh(owner, sandbox) : null,
    rememberDedicatedCommitSlots: () => { committed++; return true; },
    fetch: async (url, init) => {
      assert.equal(url, '/api/commitments/commit');
      const payload = JSON.parse(init.body); requests.push(payload);
      assert.equal(Store.validateCommitPayload(payload), true);
      return onFetch ? onFetch(payload, sandbox) : { ok: true, status: 200, json: async () => ({ ok: true, files: ['settings', 'tasks'] }) };
    } });
  sandbox.Store = { _writeEpoch: 1, runExclusive: async (slots, operation) => {
    assert.deepEqual(Array.from(slots), ['settings', 'tasks']);
    return operation({ writeEpoch: sandbox.Store._writeEpoch, accountId: String(sandbox.State.me.id) });
  } };
  vm.runInContext(appSource.slice(appSource.indexOf('function questCommitmentId('), appSource.indexOf('async function migrateLegacyGamification(')), sandbox);
  vm.runInContext(appSource.slice(appSource.indexOf('let _commitmentUiBusy ='), appSource.indexOf('function openQuestCommitmentDialog(')), sandbox);
  return { sandbox, requests, events, committed: () => committed };
}

test('actual app boundary builder stores the pair together and preserves V2 attention through take, revise and release', async () => {
  const h = appHarness(), a = h.sandbox;
  const attention = { id: 'attention', kind: 'attention', title: 'Read', win: 'One chapter', target: 'book',
    edge: { kind: 'duration', minutes: 15 }, core: false, modes: [], history: [] };
  a.State.settings.commitmentsV1.items.push(attention);
  assert.equal(await a.takeQuestCommitment(a.State.tasks[0], '15:00', 'First draft'), true);
  assert.equal(a.State.tasks[0].commitmentId, 'quest:a'); assert.equal(h.committed(), 1);
  assert.equal(await a.reviseQuestCommitment(a.State.tasks[0], '16:00', 'Short draft'), true);
  assert.equal(await a.releaseQuestCommitment(a.State.tasks[0]), true);
  assert.deepEqual(clone(a.State.settings.commitmentsV1.items.find(item => item.id === 'attention')), attention);
  assert.equal(a.State.settings.commitmentsV1.items.find(item => item.id === 'quest:a').archivedAt, DAY);
  assert.ok(h.requests.every(request => request.base !== 'server'));
});

test('actual app awaits a valid durable body and ignores late account/epoch/401 results', async t => {
  for (const type of ['account', 'epoch', '401', 'malformed']) await t.test(type, async () => {
    const pending = pause(), ready = pause();
    const h = appHarness({ onFetch: async (payload, a) => {
      if (type === '401') { a.State.me.id = 'bob'; return { ok: false, status: 401 }; }
      return { ok: true, status: 200, json: async () => { ready.resolve(); return pending.promise; } };
    } });
    h.sandbox.handleAccountSessionExpired = () => { throw new Error('old 401 expired current account'); };
    const take = h.sandbox.takeQuestCommitment(h.sandbox.State.tasks[0], '15:00', 'First draft');
    if (type !== '401') {
      await ready.promise; assert.equal(h.committed(), 0); assert.equal(h.sandbox.State.tasks[0].commitmentId, undefined);
      if (type === 'account') h.sandbox.State.me.id = 'bob';
      if (type === 'epoch') h.sandbox.Store._writeEpoch++;
      pending.resolve(type === 'malformed' ? { ok: true } : { ok: true, files: ['settings', 'tasks'] });
    }
    assert.equal(await take, false); assert.equal(h.committed(), 0); assert.equal(h.events.length, 0);
  });
});

test('actual app retries one fresh CAS rebuild; a second conflict never writes with a server base', async () => {
  let refreshes = 0;
  const h = appHarness({ onFetch: async () => ({ ok: false, status: 409, code: 'commitment_revision_conflict' }),
    onRefresh: async (owner, a) => { refreshes++; return clone({ settings: { ...a.State.settings, otherDevice: 'preserved' }, tasks: a.State.tasks }); } });
  assert.equal(await h.sandbox.takeQuestCommitment(h.sandbox.State.tasks[0], '15:00', 'First draft'), false);
  assert.equal(refreshes, 1); assert.equal(h.requests.length, 2); assert.equal(h.committed(), 0);
  assert.equal(h.requests[1].data.settings.otherDevice, 'preserved');
  assert.ok(h.requests.every(request => request.base !== 'server'));
});

test('late UI completion cannot release the next account action lock', () => {
  const h = appHarness(), a = h.sandbox;
  const control = () => ({ isConnected: true, setAttribute() {}, removeAttribute() {} });
  const old = control(), next = control();
  assert.equal(a.beginCommitmentUiAction(old), true);
  a.State.me.id = 'bob'; a.Store._writeEpoch++;
  assert.equal(a.beginCommitmentUiAction(next), true); a.endCommitmentUiAction(old);
  assert.equal(a.beginCommitmentUiAction(control()), false);
  a.endCommitmentUiAction(next); assert.equal(a.beginCommitmentUiAction(control()), true);
});

test('actual confirm/release handlers produce no late toast, modal close, sound or render for another owner', async t => {
  for (const action of ['commitment-confirm', 'commitment-release']) await t.test(action, async () => {
    const pending = pause(), ready = pause(), h = appHarness(), a = h.sandbox;
    const effects = [];
    a.document = { getElementById: id => ({ value: id.endsWith('-time') ? '15:00' : 'First draft' }) };
    a.questById = id => a.State.tasks.find(task => task.id === id); a.confirm = () => true;
    a.render = () => effects.push('render'); a.closeAccountDialog = () => effects.push('close');
    a.toast = () => effects.push('toast'); a.sfx = () => effects.push('sound');
    a.takeQuestCommitment = a.releaseQuestCommitment = async () => { ready.resolve(); await pending.promise; return false; };
    const start = appSource.indexOf("} else if (action === 'commitment-confirm') {");
    const end = appSource.indexOf("} else if (action === 'commitment-close') {", start);
    vm.runInContext('async function commitAction(action, id, el) { if (false) {' + appSource.slice(start, end) + '} }', a);
    const control = { isConnected: false, dataset: { mode: 'take' }, setAttribute() {} };
    const result = a.commitAction(action, 'a', control); await ready.promise;
    a.State.me.id = 'bob'; a.Store._writeEpoch++; pending.resolve(); await result;
    assert.deepEqual(effects, []);
  });
});
