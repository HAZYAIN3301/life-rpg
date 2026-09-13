'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const M = require('../public/morning-outcome-v1.js');
const ROOT = path.resolve(__dirname, '..');
async function start(dataDir) {
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 700; i += 1) {
    if (child.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + '/api/auth/profiles')).ok) return { child, base }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill('SIGKILL'); throw new Error('server did not start: ' + output);
}
async function stop(rt) { if (rt.child.exitCode === null) { const exited = once(rt.child, 'exit'); rt.child.kill('SIGKILL'); await exited; } }
async function register(rt, name) {
  const response = await fetch(rt.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: name + '@morning.test', password: 'morning-replay-fixture' }) });
  assert.equal(response.status, 200);
  return { ...(await response.json()), cookie: response.headers.get('set-cookie').split(';')[0] };
}
test('morning HTTP: lost receipt, restart, ownership, terminal replay, corruption and failed write', { timeout: 120000 }, async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-morning-v261-'));
  let rt = await start(dataDir);
  t.after(async () => { await stop(rt); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const alice = await register(rt, 'alice'), bob = await register(rt, 'bob');
  const dir = path.join(dataDir, 'users', alice.id), file = path.join(dir, 'secretary-ledger.json');
  const post = async (route, value, user = alice) => {
    const r = await fetch(rt.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: user?.cookie || '' }, body: JSON.stringify(value) });
    return { status: r.status, body: await r.json() };
  };
  const make = async (date = '2026-09-13') => {
    const cooldownKey = 'morning-recovery|' + date, offerId = cooldownKey + '|known';
    const claim = await post('/api/secretary/claim', { offerId, channel: 'card' }); assert.equal(claim.status, 200);
    await post('/api/secretary/claim/settle', { offerId, token: claim.body.token, outcome: 'delivered' });
    return { version: 1, accountId: alice.id, offerId, cooldownKey, token: claim.body.token, state: 'accepted' };
  };
  const body = await make(), exactJSON = JSON.stringify(body);
  const claimsBefore = fs.readFileSync(path.join(dir, 'secretary-claims.json'), 'utf8');
  await t.test('anonymous, other account and wrong claim cannot write the outcome', async () => {
    assert.equal((await post('/api/secretary/offer', body, null)).status, 401);
    assert.equal((await post('/api/secretary/offer', body, bob)).status, 403);
    assert.equal((await post('/api/secretary/offer', { ...body, token: 'another-token' })).status, 409);
    assert.equal(fs.existsSync(file), false);
  });
  let firstReceipt, bytes;
  await t.test('client loses saved response; identical body survives reload and SIGKILL restart', async () => {
    const storage = new Map(), calls = [];
    let lost = true, opened = 0, committed = 0;
    const env = { scope: () => ({ accountId: alice.id, epoch: 1 }), today: () => '2026-09-13', canOpen: () => true,
      storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      changed: () => {}, expired: () => assert.fail('unexpected expired session'), committed: () => { committed += 1; }, open: () => { opened += 1; },
      fetch: async (route, options) => {
        calls.push(options.body);
        const response = await fetch(rt.base + route, { ...options, headers: { ...options.headers, Cookie: alice.cookie } });
        if (lost) { firstReceipt = await response.json(); lost = false; throw new Error('response lost'); }
        return response;
      } };
    const client = M.create(env);
    await client.respond('accepted', { token: body.token, view: { ...body, domAction: 'attention-open-return' } });
    assert.equal(committed, 0); assert.equal(opened, 0); assert.equal(M.validReceipt(firstReceipt, body), true);
    bytes = fs.readFileSync(file, 'utf8');
    assert.deepEqual(JSON.parse(bytes).delivered[body.cooldownKey].receipt, firstReceipt);
    assert.equal(fs.readFileSync(path.join(dir, 'secretary-claims.json'), 'utf8'), claimsBefore);
    client.dispose(); await stop(rt); rt = await start(dataDir);
    const reload = M.create(env); assert.equal(await reload.retry(), true);
    assert.deepEqual(calls, [exactJSON, exactJSON]); assert.equal(committed, 1); assert.equal(opened, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'replay performs no ledger rewrite');
  });
  await t.test('receipt survives pruned claim; conflicting/legacy replies cannot rewrite it', async () => {
    fs.writeFileSync(path.join(dir, 'secretary-claims.json'), JSON.stringify({ version: 1, claims: {} }));
    const retry = await post('/api/secretary/offer', body);
    assert.deepEqual(retry.body, { ...firstReceipt, repeat: true });
    assert.equal((await post('/api/secretary/offer', { ...body, state: 'dismissed' })).status, 409);
    assert.equal((await post('/api/secretary/offer', { cooldownKey: body.cooldownKey, state: 'offered' })).status, 409);
    assert.equal((await post('/api/secretary/offer', { cooldownKey: body.cooldownKey, state: 'accepted' })).status, 200);
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
  });
  await t.test('500 save failure preserves the old ledger; same body subsequently saves', async () => {
    const next = await make('2026-09-14');
    fs.chmodSync(dir, 0o500);
    let failed;
    try { failed = await post('/api/secretary/offer', next); } finally { fs.chmodSync(dir, 0o700); }
    assert.equal(failed.status, 500); assert.equal(failed.body.error, 'save_failed');
    assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    const saved = await post('/api/secretary/offer', next); assert.equal(saved.status, 200); assert.equal(M.validReceipt(saved.body, next), true);
  });
  await t.test('corrupt saved receipt is 422, never overwritten or treated as silence', async () => {
    const good = fs.readFileSync(file, 'utf8'), bad = JSON.parse(good);
    bad.delivered[body.cooldownKey].receipt.token = '';
    const damaged = JSON.stringify(bad); fs.writeFileSync(file, damaged);
    assert.equal((await post('/api/secretary/offer', body)).status, 422);
    assert.equal(fs.readFileSync(file, 'utf8'), damaged); fs.writeFileSync(file, good);
  });
  await t.test('unreadable ledger is 500, distinct from invalid JSON/schema', async () => {
    const before = fs.readFileSync(file, 'utf8'); fs.chmodSync(file, 0o000);
    let failed;
    try { failed = await post('/api/secretary/offer', body); } finally { fs.chmodSync(file, 0o600); }
    assert.equal(failed.status, 500); assert.equal(failed.body.error, 'secretary_read_failed');
    assert.equal(fs.readFileSync(file, 'utf8'), before);
  });
  await t.test('parallel opposite answers have one terminal winner; old payload remains supported', async () => {
    const next = await make('2026-09-15');
    const replies = await Promise.all([post('/api/secretary/offer', next), post('/api/secretary/offer', { ...next, state: 'dismissed' })]);
    assert.deepEqual(replies.map(x => x.status).sort(), [200, 409]);
    assert.equal((await post('/api/secretary/offer', { cooldownKey: 'old-compatibility-key', state: 'dismissed' })).status, 200);
    for (const value of [null, [], { ...body, version: 2 }, { ...body, unknown: 'field' }]) assert.equal((await post('/api/secretary/offer', value)).status, 400);
  });
});
