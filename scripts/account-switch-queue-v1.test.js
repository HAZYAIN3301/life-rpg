const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
function harness() {
  const cancel = app.slice(app.indexOf('  cancelPending() {'), app.indexOf('  _liveSlot(name) {'));
  const exclusive = app.slice(app.indexOf('  runExclusive(names, operation) {'), app.indexOf('  async _put(name,'));
  const context = vm.createContext({ clearTimeout, State: { me: { id: 'A' } } });
  const store = vm.runInContext(`({ _timers: {}, _writes: {}, _persisted: {}, _writeEpoch: 0, ${cancel}${exclusive} })`, context);
  return { store, state: context.State };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('switching account starts B writes without waiting for A; old completion cannot clear B queue', async () => {
  const { store, state } = harness();
  const a = deferred(), b = deferred(), startedA = deferred(), startedB = deferred();
  const old = store.runExclusive(['tasks'], async () => { startedA.resolve(); await a.promise; return true; });
  await startedA.promise;
  store.cancelPending(); state.me = { id: 'B' };
  const next = store.runExclusive(['tasks'], async owner => { startedB.resolve(owner.accountId); await b.promise; return true; });
  assert.equal(await Promise.race([startedB.promise, new Promise(r => setTimeout(() => r('blocked'), 100))]), 'B');
  const trackedB = store._writes.tasks;
  a.resolve(); assert.equal(await old, false);
  assert.equal(store._writes.tasks, trackedB);
  b.resolve(); assert.equal(await next, true);
  assert.equal(store._writes.tasks, undefined);
});

test('queued work from A never runs after account switch', async () => {
  const { store, state } = harness(); const a = deferred(), started = deferred(); let ran = false;
  const first = store.runExclusive(['settings'], async () => { started.resolve(); await a.promise; return true; });
  await started.promise;
  const queued = store.runExclusive(['settings'], async () => { ran = true; return true; });
  store.cancelPending(); state.me = { id: 'B' }; a.resolve();
  assert.equal(await first, false); assert.equal(await queued, false); assert.equal(ran, false);
});
