'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const source = app.slice(app.indexOf('function achUnlocked('), app.indexOf('// ============================================================', app.indexOf('function achUnlocked(')));
function fixture() {
  let disk = {}, gate = null, writes = 0;
  const notices = [];
  const c = { State: { me: { id: 'alice' }, achievements: {}, _accountDataLoadErrors: {}, phase: 'app' },
    ACHIEVEMENTS: [{ id: 'first', title: 'Title', ttl: 'Rank', test: () => true }],
    t: x => `localized:${x}`, announce: (...args) => notices.push(args), systemMode: () => false, sfx() {}, render() {} };
  c.Store = { _writeEpoch: 1, fail: false, lose: false, async updateNow(slot, build, apply) {
    assert.equal(slot, 'achievements'); writes++;
    const value = build(structuredClone(c.State.achievements));
    if (!value || this.fail) return false;
    if (gate) await gate;
    disk = structuredClone(value);
    if (this.lose) return false;
    return apply(structuredClone(value));
  } };
  vm.createContext(c); vm.runInContext(source, c);
  return { c, notices, disk: () => disk, writes: () => writes, hold: () => { let release; gate = new Promise(r => { release = r; }); return release; } };
}
test('achievement refusal stays locked and silent; successful retry localizes receipt once', async () => {
  const f = fixture(); f.c.Store.fail = true;
  assert.equal(await f.c.checkAchievements(false), false);
  assert.equal(Object.keys(f.c.State.achievements).length, 0); assert.equal(f.notices.length, 0);
  f.c.Store.fail = false; assert.equal(await f.c.checkAchievements(false), true);
  assert.ok(f.disk().first); assert.match(f.notices[0][1], /localized:Title.*localized:Rank/);
  await f.c.checkAchievements(false); assert.equal(f.notices.length, 1);
});
test('concurrent checks wait for the same receipt, without premature unlock or duplicate notice', async () => {
  const f = fixture(), release = f.hold();
  const one = f.c.checkAchievements(false), two = f.c.checkAchievements(false);
  assert.equal(one, two); assert.equal(f.notices.length, 0); assert.equal(Object.keys(f.c.State.achievements).length, 0);
  release(); await one; assert.equal(f.writes(), 1); assert.equal(f.notices.length, 1);
});
test('lost acknowledgement and reload do not issue a second award', async () => {
  const f = fixture(); f.c.Store.lose = true; await f.c.checkAchievements(false);
  const timestamp = f.disk().first; assert.ok(timestamp); assert.equal(f.notices.length, 0);
  f.c.Store.lose = false; await f.c.checkAchievements(false); assert.equal(f.disk().first, timestamp);
  f.c.State.achievements = structuredClone(f.disk()); await f.c.checkAchievements(true);
  assert.equal(f.notices.length, 1);
});
test('late achievement receipt cannot announce or unlock in another account', async () => {
  const f = fixture(), release = f.hold(); const pending = f.c.checkAchievements(false);
  f.c.State.me.id = 'bob'; f.c.Store._writeEpoch++; release();
  assert.equal(await pending, false); assert.equal(f.notices.length, 0);
  assert.equal(Object.keys(f.c.State.achievements).length, 0);
});
