'use strict';
// Ночная ветка 21.10: удаление аккаунта оставляло id человека в analytics.json — код чистил только старый
// формат day.users, а события по целям лежат в day.byPurpose[*].users (и day.legacy.users).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('после удаления аккаунта его id не остаётся в аналитике', { timeout: 60000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-analytics-erasure-v1-'));
  const port = 49990 + process.pid % 9, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); }); fs.rmSync(dataDir, { recursive: true, force: true }); });
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  async function call(route, user, method = 'GET', body) {
    const res = await fetch(base + route, { method, headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  }
  await call('/api/auth/register', null, 'POST', { name: 'Erasure Admin', email: 'erasure-admin@example.test', password: 'erasure-testing-123' });
  const keep = await call('/api/auth/register', null, 'POST', { name: 'Erasure Keep', email: 'erasure-keep@example.test', password: 'erasure-testing-123' });
  const gone = await call('/api/auth/register', null, 'POST', { name: 'Erasure Gone', email: 'erasure-gone@example.test', password: 'erasure-testing-123' });
  const goneId = gone.data?.id || gone.data?.user?.id, keepId = keep.data?.id || keep.data?.user?.id;
  assert.ok(goneId && keepId);
  for (const user of [keep, gone]) assert.equal((await call('/api/analytics', user, 'POST', { event: 'view:today' })).data.recorded, true);
  const file = path.join(dataDir, 'analytics.json');
  // Старый формат тоже должен очищаться: подкладываем legacy-карман с тем же id.
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const day = Object.keys(data)[0];
  data[day].legacy = { events: { 'view:today': 1 }, users: { [goneId]: 1, [keepId]: 1 } };
  fs.writeFileSync(file, JSON.stringify(data));
  assert.equal((await call('/api/auth/delete-account', gone, 'POST', { password: 'erasure-testing-123', confirm: 'DELETE' })).status, 200);
  const after = fs.readFileSync(file, 'utf8');
  assert.equal(after.includes(goneId), false, 'id удалённого аккаунта исчез из byPurpose и legacy');
  assert.equal(after.includes(keepId), true, 'чужие счётчики не тронуты');
  assert.equal(JSON.parse(after)[day].byPurpose.product_improvement.events['view:today'], 2, 'обезличенный счётчик события остаётся');
});
