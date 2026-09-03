const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const AccountData = require(path.join(ROOT, 'public/account-data-v1.js'));
const APP = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

test('account-data validator accepts current defaults and future JSON fields', () => {
  const fixtures = {
    days: { '2026-08-26': { reflection: '', closed: false, future: { ok: true } } },
    weeks: { '2026-08-24': { intention: '', review: '', future: 1 } },
    rewards: [{ id: 'r1', name: 'Reward', cost: 10, future: true }],
    purchases: [{ id: 'p1', cost: 10, at: '2026-08-26T00:00:00.000Z' }],
    achievements: { first: '2026-08-26T00:00:00.000Z', future: { rank: 2 } },
    lootbox: { day: '2026-08-26', opened: 0, goldWon: 0, carry: 0, titles: [], history: [], vouchers: [], future: {} },
    episodes: [{ id: 'e1', from: '2026-08-20', to: '2026-08-26', profile: [] }],
    profile: { text: '', updatedAt: null, auto: true, future: {} },
  };
  assert.deepEqual(AccountData.SLOTS, Object.keys(fixtures));
  for (const [slot, value] of Object.entries(fixtures)) assert.equal(AccountData.validate(slot, value), true, slot);
});

test('account-data validator rejects hostile shapes without throwing', () => {
  for (const slot of AccountData.SLOTS) {
    for (const value of [null, undefined, 'bad', 1, true]) {
      assert.doesNotThrow(() => AccountData.validate(slot, value));
      assert.equal(AccountData.validate(slot, value), false, `${slot}:${String(value)}`);
    }
  }
  assert.equal(AccountData.validate('days', []), false);
  assert.equal(AccountData.validate('weeks', { monday: null }), false);
  assert.equal(AccountData.validate('rewards', [{}]), true);
  assert.equal(AccountData.validate('rewards', [null]), false);
  assert.equal(AccountData.validate('lootbox', { opened: Infinity }), false);
  assert.equal(AccountData.validate('lootbox', { vouchers: 2 }), true, 'legacy voucher count remains migratable');
  assert.equal(AccountData.validate('profile', { text: [] }), false);
  assert.equal(AccountData.validate('profile', JSON.parse('{"__proto__":{}}')), false);
  assert.equal(AccountData.validate('unknown', {}), false);
});

test('validator has bounded rows, strings, depth and cycles', () => {
  assert.equal(AccountData.validate('rewards', Array.from({ length: AccountData.LIMITS.rewards + 1 }, () => ({}))), false);
  assert.equal(AccountData.validate('profile', { text: 'x'.repeat(AccountData.LIMITS.string + 1) }), false);
  let deep = {}; let cursor = deep;
  for (let index = 0; index < AccountData.LIMITS.depth + 2; index += 1) cursor = cursor.next = {};
  assert.equal(AccountData.validate('profile', deep), false);
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(AccountData.validate('profile', cyclic), false);
});

test('economy affected slots are exact and prototype-safe', () => {
  assert.deepEqual(AccountData.affectedSlots({ rewards: [], settings: {}, lootbox: {} }), ['rewards', 'lootbox']);
  assert.deepEqual(AccountData.affectedSlots(Object.create({ purchases: [] })), []);
  assert.deepEqual(AccountData.affectedSlots(null), []);
});

test('runtime uses checked loads and blocks writes only for damaged slots', () => {
  assert.match(APP, /names\.map\(async \(name\) => \[name, await Store\.loadChecked\(/);
  assert.match(APP, /for \(const name of ACCOUNT_DATA_SLOTS\) State\[name\] = accountDataLoad\.values\[name\]/);
  for (const slot of AccountData.SLOTS) {
    assert.doesNotMatch(APP, new RegExp(`Store\\.load\\('${slot}'`), `${slot} must not use silent load`);
  }
  assert.match(APP, /function accountDataWriteAllowed\(name, source, notify = true\)/);
  assert.match(APP, /contract\.affectedSlots\(data\)/);
  assert.match(APP, /if \(!accountDataWriteAllowed\(name, 'save', true\)\) return false;/);
  assert.match(APP, /if \(!accountDataWriteAllowed\(name, 'saveNow', true\)\) return false;/);
  assert.match(APP, /if \(!accountDataWriteAllowed\(name, '_put', true\)\) return false;/);
});

test('recovery UI is accessible, retryable and does not expose personal contents', () => {
  assert.match(APP, /function accountDataRecoveryCard\(\)/);
  assert.match(APP, /class="card settings-recovery account-data-recovery" role="alert" aria-live="assertive"/);
  assert.match(APP, /data-action="retry-account-data-load"/);
  assert.match(APP, /const accountDataLabels = Object\.freeze\(\{/);
  assert.doesNotMatch(APP, /JSON\.stringify\(State\._accountDataLoadErrors/);
  assert.match(APP, /action === 'retry-account-data-load'/);
  for (const language of ['en', 'de', 'uk', 'es']) {
    assert.match(APP, new RegExp(`'Часть данных требует восстановления': \\{[^\\n]+${language}:`));
  }
});

test('module loads before app and remains pinned in the v181 offline shell', () => {
  const moduleAt = INDEX.indexOf('account-data-v1.js?v=20260826-launch-hardening-v178-1');
  const appAt = INDEX.indexOf('app.js?v=20260903-write-fence-v215-16');
  assert.ok(moduleAt >= 0 && appAt > moduleAt);
  assert.match(SW, /const CACHE = 'satoru-v240';/);
  assert.match(SW, /'account-data-v1\.js'/);
});
