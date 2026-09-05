'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');

function cookieOf(response) {
  const value = response.headers.get('set-cookie') || '';
  return value.split(';')[0];
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-account-v123-'));
  const port = 45100 + (process.pid % 300);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { const response = await fetch(`${base}/api/auth/profiles`); if (response.ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not start: ${output}`);
}

async function api(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: cookieOf(response) };
}

test('Account v123: auth, ownership, portable data, revocation and deletion are durable', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = runtime;

  const regA = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Alpha', email: 'alpha@example.test', password: 'alpha-pass-123' } });
  assert.equal(regA.response.status, 200); assert.match(regA.cookie, /^lrpg_sess=/); assert.ok(regA.data.recoveryCode);
  let cookieA = regA.cookie;
  const regB = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Beta', email: 'beta@example.test', password: 'beta-pass-123' } });
  assert.equal(regB.response.status, 200); let cookieB = regB.cookie;
  const regPin = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Pinnie', pin: '1234' } });
  assert.equal(regPin.response.status, 200); const oldPinCookie = regPin.cookie;
  const pinChanged = await api(base, '/api/auth/change-pin', { method: 'POST', cookie: oldPinCookie, body: { oldPin: '1234', newPin: '9876' } });
  assert.equal(pinChanged.response.status, 200); assert.match(pinChanged.cookie, /^lrpg_sess=/);
  assert.equal((await api(base, '/api/auth/me', { cookie: oldPinCookie })).response.status, 401, 'PIN change revokes old sessions');
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { userId: regPin.data.id, pin: '1234' } })).response.status, 401);
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { userId: regPin.data.id, pin: '9876' } })).response.status, 200);

  assert.equal((await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Dup', email: 'alpha@example.test', password: 'duplicate-123' } })).response.status, 400);
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { email: 'alpha@example.test', password: 'wrong-pass' } })).response.status, 401);

  const alphaTasks = [{ id: 'alpha-task', title: 'Owned by Alpha', date: '2026-08-09', done: false }];
  assert.equal((await api(base, '/api/data/tasks', { method: 'PUT', cookie: cookieA, body: alphaTasks })).response.status, 200);
  const alphaBoardMedia = { 'b-place-city': { caption: 'Alpha private story', dataUrl: 'data:image/jpeg;base64,AA==' } };
  assert.equal((await api(base, '/api/data/boardmedia', { method: 'PUT', cookie: cookieA, body: alphaBoardMedia })).response.status, 200);
  assert.equal((await api(base, '/api/data/tasks?userId=alpha', { cookie: cookieB })).response.status, 404, 'query injection must not cross ownership');

  const exported = await api(base, '/api/account/export', { cookie: cookieA });
  assert.equal(exported.response.status, 200); assert.equal(exported.data.format, 'satoru-account');
  assert.deepEqual(exported.data.data.tasks, alphaTasks);
  assert.deepEqual(exported.data.data.boardmedia, alphaBoardMedia, 'private board journal is portable account data');
  assert.equal('aiKeys' in exported.data.data, false); assert.equal('strava' in exported.data.data, false); assert.equal('push' in exported.data.data, false);

  const invalidArchive = structuredClone(exported.data);
  invalidArchive.data.settings = [];
  assert.equal((await api(base, '/api/account/import', { method: 'POST', cookie: cookieB, body: invalidArchive })).response.status, 400);
  assert.equal((await api(base, '/api/data/tasks', { cookie: cookieB })).response.status, 404, 'invalid import must write nothing');
  assert.equal((await api(base, '/api/account/import', { method: 'POST', cookie: cookieB, body: exported.data })).response.status, 200);
  assert.deepEqual((await api(base, '/api/data/tasks', { cookie: cookieB })).data, alphaTasks, 'archive imports only into the authenticated account');
  assert.deepEqual((await api(base, '/api/data/boardmedia', { cookie: cookieB })).data, alphaBoardMedia, 'journal imports only into the authenticated account');

  const oldCookieA = cookieA;
  const changed = await api(base, '/api/auth/change-password', { method: 'POST', cookie: cookieA, body: { currentPassword: 'alpha-pass-123', newPassword: 'alpha-pass-456' } });
  assert.equal(changed.response.status, 200); assert.ok(changed.data.recoveryCode); cookieA = changed.cookie;
  assert.equal((await api(base, '/api/auth/me', { cookie: oldCookieA })).response.status, 401, 'password change revokes old sessions');
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { email: 'alpha@example.test', password: 'alpha-pass-123' } })).response.status, 401);

  const reset = await api(base, '/api/auth/reset', { method: 'POST', body: { email: 'alpha@example.test', code: changed.data.recoveryCode, newPassword: 'alpha-reset-789' } });
  assert.equal(reset.response.status, 200); assert.ok(reset.data.recoveryCode); const preResetCookie = cookieA; cookieA = reset.cookie;
  assert.equal((await api(base, '/api/auth/me', { cookie: preResetCookie })).response.status, 401, 'recovery revokes previous sessions');
  assert.equal((await api(base, '/api/auth/reset', { method: 'POST', body: { email: 'alpha@example.test', code: changed.data.recoveryCode, newPassword: 'another-pass-1' } })).response.status, 401, 'recovery code is one-use');

  const secondLogin = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'alpha@example.test', password: 'alpha-reset-789' } });
  const secondCookieA = secondLogin.cookie;
  const logoutAll = await api(base, '/api/auth/logout', { method: 'POST', cookie: cookieA, body: { all: true } });
  assert.equal(logoutAll.response.status, 200);
  assert.equal((await api(base, '/api/auth/me', { cookie: secondCookieA })).response.status, 401, 'logout-all revokes every device');
  const relogin = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'alpha@example.test', password: 'alpha-reset-789' } }); cookieA = relogin.cookie;

  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: cookieB, body: { userId: regA.data.id } })).response.status, 403, 'non-admin cannot mutate another entitlement');
  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: cookieA, body: { userId: regB.data.id, days: 30 } })).response.status, 200);
  assert.equal((await api(base, '/api/auth/me', { cookie: cookieB })).data.entitlement.tier, 'pro');

  await api(base, '/api/feedback', { method: 'POST', cookie: cookieA, body: { kind: 'privacy', text: 'delete me' } });
  await api(base, '/api/analytics', { method: 'POST', cookie: cookieA, body: { event: 'view:settings' } });
  fs.writeFileSync(path.join(dataDir, 'parties.json'), JSON.stringify([{ id: 'party-delete-fixture', createdBy: regA.data.id, members: [regA.data.id, regB.data.id], cheers: { [regA.data.id]: 1 }, raid: { claimed: [regA.data.id] } }]));
  assert.equal((await api(base, '/api/auth/delete-account', { method: 'POST', cookie: cookieA, body: { password: 'alpha-reset-789', confirm: 'NO' } })).response.status, 400);
  assert.equal((await api(base, '/api/auth/delete-account', { method: 'POST', cookie: cookieA, body: { password: 'wrong-pass', confirm: 'DELETE' } })).response.status, 401);
  const deleted = await api(base, '/api/auth/delete-account', { method: 'POST', cookie: cookieA, body: { password: 'alpha-reset-789', confirm: 'DELETE' } });
  assert.equal(deleted.response.status, 200);
  assert.equal((await api(base, '/api/auth/me', { cookie: cookieA })).response.status, 401);
  assert.equal((await api(base, '/api/data/tasks', { method: 'PUT', cookie: cookieA, body: [] })).response.status, 401, 'deleted cookie cannot recreate user data');
  assert.equal(fs.existsSync(path.join(dataDir, 'users', regA.data.id)), false);
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8')); assert.equal(users.some((user) => user.id === regA.data.id), false);
  const feedback = JSON.parse(fs.readFileSync(path.join(dataDir, 'feedback.json'), 'utf8')); assert.equal(feedback.some((row) => row.userId === regA.data.id), false);
  const analytics = JSON.parse(fs.readFileSync(path.join(dataDir, 'analytics.json'), 'utf8')); assert.equal(Object.values(analytics).some((day) => day.users && day.users[regA.data.id]), false);
  const parties = JSON.parse(fs.readFileSync(path.join(dataDir, 'parties.json'), 'utf8'));
  assert.equal(parties[0].createdBy, regB.data.id); assert.deepEqual(parties[0].members, [regB.data.id]); assert.equal(regA.data.id in (parties[0].cheers || {}), false);

  const secret = JSON.parse(fs.readFileSync(path.join(dataDir, 'secret.json'), 'utf8')).secret;
  const expiredPayload = `${regB.data.id}.${Date.now() - 1}.deadbeef`;
  const expiredSig = crypto.createHmac('sha256', secret).update(expiredPayload).digest('hex');
  assert.equal((await api(base, '/api/auth/me', { cookie: `lrpg_sess=${expiredPayload}.${expiredSig}` })).response.status, 401);
});

test('Admin gold v139 is server-owned and can adjust only the signed-in admin account', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = runtime;
  const admin = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Admin', email: 'admin@example.test', password: 'admin-pass-123' } });
  const member = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Member', email: 'member@example.test', password: 'member-pass-123' } });
  assert.equal(admin.data.isAdmin, true); assert.equal(member.data.isAdmin, false);
  assert.equal((await api(base, '/api/auth/me', { cookie: admin.cookie })).data.adminGold, 0);
  assert.equal((await api(base, '/api/admin/self-gold', { method: 'POST', cookie: member.cookie, body: { delta: 50 } })).response.status, 403);
  const foreignField = await api(base, '/api/admin/self-gold', { method: 'POST', cookie: admin.cookie, body: { delta: 50, userId: member.data.id } });
  assert.equal(foreignField.response.status, 400, 'the endpoint must not accept a target identity');
  const credited = await api(base, '/api/admin/self-gold', { method: 'POST', cookie: admin.cookie, body: { delta: 500 } });
  assert.equal(credited.response.status, 200); assert.equal(credited.data.adminGold, 500);
  assert.equal((await api(base, '/api/auth/me', { cookie: admin.cookie })).data.adminGold, 500, 'credit survives a new auth read');
  const overdraft = await api(base, '/api/admin/self-gold', { method: 'POST', cookie: admin.cookie, body: { delta: -501 } });
  assert.equal(overdraft.response.status, 400);
  const debited = await api(base, '/api/admin/self-gold', { method: 'POST', cookie: admin.cookie, body: { delta: -200 } });
  assert.equal(debited.response.status, 200); assert.equal(debited.data.adminGold, 300);
  const ledger = JSON.parse(fs.readFileSync(path.join(dataDir, 'admin-gold.json'), 'utf8'));
  assert.deepEqual(Object.keys(ledger), [admin.data.id], 'no member identity can be written through the self-only endpoint');
  assert.equal(ledger[admin.data.id].balance, 300); assert.equal(ledger[admin.data.id].history.length, 2);
  assert.equal((await api(base, '/api/auth/delete-account', { method: 'POST', cookie: admin.cookie, body: { password: 'admin-pass-123', confirm: 'DELETE' } })).response.status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'admin-gold.json'), 'utf8')), {}, 'account deletion removes the server-only credit ledger entry');
});

test('Account v123 client contract has honest async states and accessible dialogs', () => {
  assert.match(APP, /\/api\/auth\/change-password/);
  assert.match(APP, /\/api\/account\/export/);
  assert.match(APP, /\/api\/account\/import/);
  assert.match(APP, /body\.confirm\s*=\s*f\.confirm\.value\.trim\(\)/);
  assert.match(APP, /function accountResetDataCandidate\(\)[\s\S]{0,1400}commitmentApi\.release[\s\S]{0,900}validateCommitPayload\(\{ base, data: \{ settings, tasks \} \}\)[\s\S]{0,180}return \{ settings, tasks, days: \{\} \}/,
    'reset must release live quest commitments and validate the resulting settings/tasks graph');
  assert.match(APP, /const archive = \{ format: 'satoru-account', version: 1, base, data: resetData \}/,
    'reset import must carry the exact persisted CAS base');
  assert.match(APP, /Store\.runExclusive\(\['days', 'settings', 'tasks'\][\s\S]{0,650}commitmentBoundaryRejected\(response\)[\s\S]{0,220}rememberDedicatedCommitSlots\(resetData/,
    'reset must serialize the whole graph and advance snapshots only after server success');
  assert.doesNotMatch(APP, /State\.tasks = \[\]; State\.days = \{\}; Store\.save\('tasks'/);
  assert.match(APP, /role', 'dialog'/);
  assert.match(APP, /aria-modal', 'true'/);
  assert.match(APP, /Notification permission[^]*явного нажатия/);
  assert.doesNotMatch(APP, /setTimeout\(\(\) => \{ pushEnable\(\)/);
  assert.match(APP, /if \(r\.status === 401\) \{ handleAccountSessionExpired\(\)/);
  assert.match(APP, /response\.status === 401 && \(data\.error === 'not logged in' \|\| data\.error === 'user not found'\)/);
  assert.doesNotMatch(APP, /if \(authenticated && response\.status === 401\) handleAccountSessionExpired\(\)/);
  assert.match(APP, /State\.inbox = null; State\.inboxOpen = false; State\.antihabits = null; State\.episodes = null;/);
  assert.match(APP, /State\.leaderboard = null; State\.party = null; State\.adminUsers = null;/);
  for (const key of ['неверный email или пароль', 'неверный код восстановления', 'неверный текущий пароль', 'неверный текущий PIN', 'триал уже был использован']) {
    assert.match(APP, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': \\{ en: .* de: .* uk: .* es:`));
  }
  assert.match(CSS, /Account & data lifecycle v123/);
  assert.match(CSS, /@media \(pointer: coarse\)[^]*account-dialog-box/);
  assert.match(APP, /function adminGoldCredit\(\)/);
  assert.match(APP, /\/api\/admin\/self-gold/);
  assert.match(APP, /data-admin-gold-delta="1"/);
  assert.match(APP, /data-admin-gold-delta="-1"/);
});
