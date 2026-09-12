'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const A = require('../public/account-import-v1'), J = require('../public/commitment-journal-v1');
const ROOT = path.resolve(__dirname, '..'), clone = x => JSON.parse(JSON.stringify(x));
const archive = data => ({ format: 'satoru-account', version: 1, data });
const fixture = label => Object.fromEntries(A.FILES.filter(n => n !== 'questionnaire').map(name => [name,
  name === 'shelf' ? { version: 1, items: [], label }
    : name === 'profile' ? { text: label }
      : A.TYPES[name] === 'array' ? [{ id: name + '_' + label, title: label, cost: 1 }]
        : { label }]));

async function runtime(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-import-v259-'));
  const port = 48900 + process.pid % 400, base = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null)
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
  };
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const start = async (extra = {}) => {
    child = spawn(process.execPath, ['server.js'], { cwd: ROOT,
      env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), PUSH_SCHED: 'off',
        COMMITMENT_CRASH_AT: '', COMMITMENT_FAIL_AFTER_FILE: '', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    for (let n = 0; n < 300; n++) {
      if (child.exitCode !== null) throw Error(output);
      try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    throw Error('server start timeout: ' + output);
  };
  const api = async (route, cookie = '', data, method = data === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000) });
    let body; try { body = await response.json(); } catch {}
    return { status: response.status, body, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  };
  await start();
  const register = name => api('/api/auth/register', '', { name, email: name + '@example.test', password: 'synthetic-import-259' });
  const user = await register('import-owner'); assert.equal(user.status, 200);
  const userDir = path.join(dir, 'users', user.body.id);
  const snapshot = () => Object.fromEntries(fs.readdirSync(userDir).filter(n => n.endsWith('.json'))
    .map(name => [name, fs.readFileSync(path.join(userDir, name), 'utf8')]));
  const read = name => JSON.parse(fs.readFileSync(path.join(userDir, name + '.json'), 'utf8'));
  const seed = values => {
    fs.mkdirSync(userDir, { recursive: true });
    for (const [name, value] of Object.entries(values)) fs.writeFileSync(path.join(userDir, name + '.json'), JSON.stringify(value));
  };
  const prepare = async data => {
    const payload = { ...archive(data), writeVersion: 2, requestId: 'import_' + Math.random().toString(36).slice(2) };
    const result = await api('/api/account/import/preview', user.cookie, payload);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return { ...payload, ticket: result.body.ticket };
  };
  return { api, user, userDir, read, seed, prepare, snapshot, start, stop, register, child: () => child };
}

test('portable import: read-only preview, bound ticket, exact revisions, durable receipt and replay', { timeout: 30000 }, async t => {
  const r = await runtime(t), before = fixture('before'); r.seed(before);
  const data = { tasks: [{ id: 'imported-task', title: 'Archive task', done: true, goldAwarded: 25 }],
    days: { '2026-09-12': { reflection: 'Imported day' } }, purchases: [{ id: 'old-earned', cost: 5 }] };
  const initial = r.snapshot(), request = await r.prepare(data);
  assert.deepEqual(r.snapshot(), initial, 'preview creates neither backups nor account writes');
  assert.equal(A.ticketValid(request.ticket, data), true);
  assert.equal((await r.api('/api/account/import/preview', '', request)).status, 401);
  assert.equal((await r.api('/api/account/import', '', request)).status, 401);
  const other = await r.register('import-other');
  assert.equal((await r.api('/api/account/import', other.cookie, request)).body.error, 'invalid_import_ticket');
  for (const mutate of [x => x.data.tasks[0].title = 'tamper', x => x.ticket.signature = 'f'.repeat(64),
    x => x.ticket.revisions.days = 'f'.repeat(64), x => x.requestId = 'import_other']) {
    const bad = clone(request); mutate(bad);
    assert.equal((await r.api('/api/account/import', r.user.cookie, bad)).status, 409);
    assert.deepEqual(r.snapshot(), initial);
  }
  const committed = await r.api('/api/account/import', r.user.cookie, request);
  assert.equal(committed.status, 200); assert.equal(committed.body.replay, false);
  assert.equal(A.receiptValid(committed.body, request.ticket, data), true);
  for (const [name, value] of Object.entries(data)) assert.deepEqual(r.read(name), value);
  assert.deepEqual(r.read('settings'), before.settings);
  const once = r.snapshot();
  await r.stop(); await r.start();
  const repeated = await r.api('/api/account/import', r.user.cookie, request);
  assert.equal(repeated.status, 200); assert.equal(repeated.body.replay, true);
  assert.deepEqual(r.snapshot(), once, 'replay does not repeat backups or writes');
  const conflict = await r.prepare({ days: { marker: 'new archive' } });
  assert.equal((await r.api('/api/data/days', r.user.cookie, { marker: 'other tab' }, 'PUT')).status, 200);
  const rejected = await r.api('/api/account/import', r.user.cookie, conflict);
  assert.equal(rejected.status, 409); assert.equal(rejected.body.error, 'import_revision_conflict');
  assert.deepEqual(r.read('days'), { marker: 'other tab' });
  const pairConflict = await r.prepare({ weeks: { marker: 'week archive' } });
  await r.api('/api/data/settings', r.user.cookie, { marker: 'other settings' }, 'PUT');
  assert.equal((await r.api('/api/account/import', r.user.cookie, pairConflict)).body.error, 'import_revision_conflict');
  assert.deepEqual(r.read('weeks'), before.weeks);
});

test('portable import: real SIGKILL after each file restores one complete state, including new WAL slots', { timeout: 60000 }, async t => {
  const r = await runtime(t), before = fixture('before'), after = fixture('after');
  const names = J.FILES.filter(n => n !== 'questionnaire');
  for (const point of [...names.map(name => 'after_' + name.replace(/-/g, '_') + '_write'), 'after_committed_journal']) {
    await t.test(point, async () => {
      await r.stop(); r.seed(before); await r.start();
      const request = await r.prepare(after);
      await r.stop(); await r.start({ COMMITMENT_CRASH_AT: point });
      const died = new Promise(resolve => r.child().once('exit', (code, signal) => resolve({ code, signal })));
      await assert.rejects(() => r.api('/api/account/import', r.user.cookie, request));
      assert.equal((await died).signal, 'SIGKILL');
      await r.start();
      const expected = point === 'after_committed_journal' ? after : before;
      for (const name of names) assert.deepEqual(r.read(name), expected[name], point + ':' + name);
      assert.equal(fs.existsSync(path.join(r.userDir, '.commitment-journal-v1.json')), false);
      const result = await r.api('/api/account/import', r.user.cookie, request);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.replay, point === 'after_committed_journal');
      for (const name of names) assert.deepEqual(r.read(name), after[name]);
    });
  }
});

test('portable import: rollback, legacy archives, secret exclusion and corrupted-state fencing', { timeout: 30000 }, async t => {
  const r = await runtime(t), before = fixture('before'), after = fixture('after'); r.seed(before);
  await r.stop(); await r.start({ COMMITMENT_FAIL_AFTER_FILE: '5' });
  assert.equal((await r.api('/api/account/import', r.user.cookie, archive(after))).status, 500);
  for (const name of Object.keys(before)) assert.deepEqual(r.read(name), before[name]);
  await r.stop(); await r.start();
  assert.equal((await r.api('/api/account/import', r.user.cookie, archive(after))).status, 200);
  assert.equal((await r.api('/api/account/import', r.user.cookie, archive(after))).body.replay, true);
  for (const name of ['secretary', 'party-rewards', 'ai-keys', 'strava', 'push'])
    assert.equal((await r.api('/api/account/import', r.user.cookie, archive({ [name]: {} }))).status, 400);
  const untouched = r.snapshot();
  assert.equal((await r.api('/api/account/import', r.user.cookie, archive({ settings: [] }))).status, 400);
  assert.deepEqual(r.snapshot(), untouched);
  fs.writeFileSync(path.join(r.userDir, '.commitment-journal-v1.json'), '{corrupt');
  for (const route of ['/api/data/days', '/api/shelf', '/api/attention', '/api/account/export'])
    assert.equal((await r.api(route, r.user.cookie)).body.error, 'commitment_recovery_required', route);
  assert.equal((await r.api('/api/data/profile', r.user.cookie, { text: 'must not write' }, 'PUT')).status, 409);
  assert.deepEqual(r.read('profile'), after.profile);
  assert.equal((await r.api('/api/auth/me', r.user.cookie)).status, 200, 'auth remains usable during recovery');
});
