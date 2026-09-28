'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const Den = require('../server-party-den-v1.js');
const root = path.resolve(__dirname, '..');
test('shared Den policy: owned items, private ownership, CAS and replay', () => {
  const ctx = { actor: 'alice', partyId: 'p', owned: ['seat-forest'], now: '2026-09-28T12:00:00Z' };
  const input = { partyId: 'p', operationId: 'request-1', revision: 0, slot: 'seat', itemId: 'seat-forest', share: true };
  const first = Den.change(undefined, input, ctx);
  assert.equal(first.room.revision, 1);
  assert.equal(Den.change(first.room, input, ctx).replay, true);
  for (const [patch, code] of [[{ operationId: 12345678 }, 'invalid_room_request'], [{ share: false }, 'room_consent_required'], [{ actor: 'bob' }, 'invalid_room_request'], [{ itemId: 'not-real' }, 'invalid_room_item']])
    assert.throws(() => Den.change(undefined, { ...input, ...patch }, ctx), { code });
  assert.throws(() => Den.change(undefined, input, { ...ctx, owned: [] }), { code: 'room_item_not_owned' });
  assert.throws(() => Den.change(first.room, { ...input, operationId: 'request-2' }, ctx), { code: 'room_conflict' });
  assert.throws(() => Den.change(first.room, { ...input, operationId: 'request-2', revision: 1 }, { ...ctx, actor: 'bob' }), { code: 'room_slot_occupied' });
  assert.throws(() => Den.change(first.room, { ...input, itemId: null }, ctx), { code: 'room_operation_conflict' });
  assert.deepEqual(Den.view(first.room, ['alice']).placements, first.room.placements);
  assert.equal(Den.view(first.room, ['bob']).placements.length, 0);
  assert.equal(Den.view(first.room, ['alice']).receipts, undefined);
  const departed = Den.depart(first.room, ['alice']);
  assert.equal(departed.placements.length, 0); assert.equal(departed.receipts.length, 0);
  assert.throws(() => Den.validate({ version: 1, revision: 0 }), { code: 'room_unreadable' });
});

test('shared Den HTTP: persistence, denied writes, replay after restart and membership lifecycle', { timeout: 60000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-shared-den-'));
  const port = 52001, base = `http://127.0.0.1:${port}`, file = path.join(dir, 'parties.json');
  const fault = path.join(dir, 'fault'), preload = path.join(dir, 'preload.cjs');
  fs.writeFileSync(preload, `const fs=require('node:fs'),rename=fs.renameSync;
    fs.renameSync=function(a,b){let mode;try{mode=fs.readFileSync(${JSON.stringify(fault)},'utf8')}catch{}
    if(b===${JSON.stringify(file)}&&mode==='before')throw Error('injected');
    const r=rename.apply(this,arguments);
    if(b===${JSON.stringify(file)}&&mode==='crash'){fs.unlinkSync(${JSON.stringify(fault)});process.exit(89)}return r;}`);
  let child;
  async function start() {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), PUSH_SCHED: 'off' }, stdio: 'ignore' });
    for (let i = 0; i < 200; i++) {
      if (child.exitCode !== null) throw Error('server exited');
      try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {}
      await new Promise(r => setTimeout(r, 20));
    }
    throw Error('startup timeout');
  }
  async function stop() { if (child && child.exitCode === null) await new Promise(r => { child.once('exit', r); child.kill(); }); }
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  async function api(route, user, body, headers = {}) {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  }
  const room = (user, body, headers) => api('/api/party/den', user, body, headers);
  await start();
  const password = 'shared-den-only-test';
  const users = [];
  for (const name of ['Alice', 'Bob', 'Outside']) users.push(await api('/api/auth/register', null, { name, email: name + '@example.test', password }));
  const [a, b, outsider] = users;
  const party = (await api('/api/party/create', a, { name: 'Shared room QA', shareProgress: true, acknowledgedVisibility: true })).data.party;
  await api('/api/party/join', b, { code: party.code, shareProgress: true, acknowledgedVisibility: true });
  const input = { partyId: party.id, operationId: 'place-first', revision: 0, share: true, slot: 'seat', itemId: 'seat-forest' };
  const settingsFile = path.join(dir, 'users', a.data.id, 'settings.json');
  // Isolated historical owned-inventory fixture; production mutations still use its economy owner.
  const settings = { den: { owned: ['seat-forest'] }, secret: 'PRIVATE_PLAN' };
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(settings));
  await t.test('auth, scope, strict payload and verified ownership', async () => {
    assert.equal((await room(null)).status, 401); assert.equal((await room(outsider)).status, 404);
    assert.equal((await room(a, input, { Origin: 'https://outside.test' })).status, 403);
    assert.equal((await room(a, input, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await room(a, { ...input, data: 'x'.repeat(2200) })).status, 413);
    assert.equal((await room(a, { ...input, share: false })).status, 412);
    assert.equal((await room(b, input)).data.error, 'room_item_not_owned');
    assert.equal((await room(a, { ...input, actor: b.data.id })).status, 400);
    assert.equal((await room(a, { ...input, partyId: 'other' })).status, 409);
    assert.equal((await room(a, { ...input, slot: 'light', itemId: 'light-six' })).status, 403);
  });
  await t.test('failure before write, durable retry and lost response through real process exit', async () => {
    fs.writeFileSync(fault, 'before'); assert.equal((await room(a, input)).status, 503);
    fs.unlinkSync(fault); assert.equal((await room(a)).data.room.revision, 0);
    fs.writeFileSync(fault, 'crash'); await assert.rejects(room(a, input)); await stop(); await start();
    const retry = await room(a, input); assert.equal(retry.status, 200); assert.equal(retry.data.replay, true);
    assert.equal(retry.data.room.revision, 1); assert.equal(retry.data.room.placements.length, 1);
    const other = await room(b); assert.equal(other.data.room.placements[0].itemId, 'seat-forest');
    assert.equal(JSON.stringify(other.data).includes('PRIVATE_PLAN'), false);
    assert.equal(JSON.stringify(other.data).includes('operationId'), false);
    assert.equal(fs.readFileSync(settingsFile, 'utf8'), JSON.stringify(settings));
    assert.equal(fs.existsSync(path.join(path.dirname(settingsFile), 'purchases.json')), false);
  });
  await t.test('no overwriting friends; stale requests, remove, leave and account erasure', async () => {
    assert.equal((await room(b, { ...input, operationId: 'friend-remove', revision: 1, itemId: null })).data.error, 'room_slot_occupied');
    assert.equal((await room(a, { ...input, operationId: 'stale-req' })).data.error, 'room_conflict');
    const second = { ...input, operationId: 'second-place', revision: 1, slot: 'light', itemId: 'light-lantern' };
    assert.equal((await room(b, second)).status, 200);
    assert.equal((await room(a, { ...input, operationId: 'my-remove', revision: 2, itemId: null })).status, 200);
    assert.equal((await room(a)).data.room.placements.length, 1);
    await room(a, { ...input, operationId: 'put-it-back', revision: 3 });
    assert.equal((await api('/api/party/leave', a, {})).status, 200);
    const remaining = (await room(b)).data.room;
    assert.equal(remaining.placements.length, 1); assert.equal(remaining.placements[0].actor, b.data.id);
    assert.equal(fs.readFileSync(settingsFile, 'utf8'), JSON.stringify(settings));
    await api('/api/party/join', a, { code: party.code, shareProgress: true, acknowledgedVisibility: true });
    assert.equal((await room(a, input)).status, 409, 'old request cannot resurrect display after rejoin');
    assert.equal((await api('/api/auth/delete-account', b, { confirm: 'DELETE', password })).status, 200);
    assert.equal((await room(a)).data.room.placements.length, 0);
    assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))[0].sharedDen).includes(b.data.id), false);
  });
  await t.test('corrupted storage is not treated as an empty room', async () => {
    const original = fs.readFileSync(file, 'utf8'); const rows = JSON.parse(original); rows[0].sharedDen.placements = [{ nope: true }];
    fs.writeFileSync(file, JSON.stringify(rows)); assert.equal((await room(a)).status, 503);
    assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(rows)); fs.writeFileSync(file, original);
  });
});
