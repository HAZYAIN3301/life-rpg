'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const source = app.slice(app.indexOf('function ensureCompanion('), app.indexOf('function compTierIdx('));
function fixture() {
  const c = { State: { me: { id: 'alice' }, settings: { companion: { bond: 5, check: {}, journal: [] } } },
    structuredClone, todayStr: () => '2026-09-27', globalPerk: () => 0, t: x => x, toast: () => {} };
  let queue = Promise.resolve(), disk = structuredClone(c.State.settings);
  c.Store = { _writeEpoch: 1, fail: false, beforeApply: null,
    updateNow: (_slot, build, apply) => {
      const run = queue.then(async () => {
        const next = build(structuredClone(c.State.settings));
        if (!next || c.Store.fail) return false;
        disk = structuredClone(next);
        if (c.Store.beforeApply) await c.Store.beforeApply();
        return apply(structuredClone(next));
      }); queue = run.catch(() => {}); return run;
    } };
  vm.createContext(c); vm.runInContext(source, c);
  return { c, saved: () => disk, care: (kind, text) => c.saveCompanionCare(kind, text) };
}
test('failed care leaves bond, daily marker and note unchanged; retry commits once', async () => {
  const f = fixture(); f.c.Store.fail = true;
  assert.equal(await f.care('e', 'A small result'), false);
  assert.equal(f.c.State.settings.companion.bond, 5);
  assert.equal(f.saved().companion.journal.length, 0);
  f.c.Store.fail = false;
  assert.equal(await f.care('e', 'A small result'), true);
  assert.equal(await f.care('e', 'Changed repeated text'), false);
  assert.equal(f.saved().companion.bond, 7);
  assert.equal(f.saved().companion.journal.length, 1);
  assert.equal(f.saved().companion.journal[0].text, 'A small result');
});
test('concurrent pet entry points share one saved daily marker', async () => {
  const f = fixture();
  assert.deepEqual(await Promise.all([f.care('pet'), f.care('pet')]), [true, false]);
  assert.equal(f.saved().companion.bond, 6);
  assert.equal(f.saved().companion.pet, '2026-09-27');
});
test('pending and late care cannot apply to another account', async () => {
  const f = fixture(); let release;
  const wait = new Promise(r => { release = r; });
  f.c.Store.beforeApply = () => wait;
  const pending = f.care('pet'); await Promise.resolve();
  assert.equal(f.c.State.settings.companion.bond, 5);
  f.c.State.me = { id: 'bob' }; f.c.State.settings = { companion: { bond: 20 } };
  f.c.Store._writeEpoch++; release();
  assert.equal(await pending, false);
  assert.equal(f.c.State.settings.companion.bond, 20);
});
test('rename waits for persistence; refusal leaves the old name and retry preserves care', async () => {
  const f = fixture();
  f.c.State.settings.companion.name = 'Before';
  f.c.Store.fail = true;
  assert.equal(await f.c.saveCompanionName('After'), false);
  assert.equal(f.c.State.settings.companion.name, 'Before');
  f.c.Store.fail = false;
  assert.equal(await f.c.saveCompanionName('After'), true);
  assert.equal(f.saved().companion.name, 'After');
  assert.equal(f.saved().companion.bond, 5);
});
test('a late rename receipt cannot overwrite another account', async () => {
  const f = fixture(); let release;
  const wait = new Promise(r => { release = r; });
  f.c.Store.beforeApply = () => wait;
  const pending = f.c.saveCompanionName('Alice'); await Promise.resolve();
  f.c.State.me = { id: 'bob' }; f.c.State.settings = { companion: { name: 'Bob', bond: 20 } };
  f.c.Store._writeEpoch++; release();
  assert.equal(await pending, false);
  assert.equal(f.c.State.settings.companion.name, 'Bob');
});
