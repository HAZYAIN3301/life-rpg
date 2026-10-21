'use strict';
// Ночная ветка 21.10 (PRIVACY-TELEMETRY-AUDIT.md п. 2): открытие чужих данных админом записывается в журнал —
// кто, когда, что, чей аккаунт; без содержимого. Журнал видит только админ.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('доступ админа к чужому аккаунту записывается, журнал закрыт для остальных', { timeout: 60000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-admin-access-v1-'));
  const port = 47650 + process.pid % 40, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); }); fs.rmSync(dataDir, { recursive: true, force: true }); });
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/version')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  async function call(route, user, method = 'GET', body) {
    const res = await fetch(base + route, { method, headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  }
  const admin = await call('/api/auth/register', null, 'POST', { name: 'Log Admin', email: 'log-admin@example.test', password: 'log-testing-123' });
  const person = await call('/api/auth/register', null, 'POST', { name: 'Log Person', email: 'log-person@example.test', password: 'log-testing-123' });
  const personId = person.data?.id || person.data?.user?.id, adminId = admin.data?.id || admin.data?.user?.id;
  await call('/api/data/inbox', person, 'PUT', [{ id: 'n1', kind: 'text', text: 'ЛИЧНАЯ-ЗАМЕТКА', at: new Date().toISOString() }]);
  assert.equal((await call(`/api/admin/userdata/${personId}`, admin)).status, 200);
  assert.equal((await call(`/api/admin/crash-export/${personId}`, admin)).status, 200);
  assert.equal((await call(`/api/admin/userdata/${personId}`, person)).status, 403, 'не админ — отказ и без записи');
  assert.equal((await call('/api/admin/access-log', person)).status, 403, 'журнал не виден обычному аккаунту');
  assert.equal((await call('/api/admin/access-log', null)).status, 403);
  const log = await call('/api/admin/access-log', admin);
  assert.equal(log.status, 200);
  assert.deepEqual(log.data.entries.map((e) => [e.action, e.target, e.admin]), [['crash-export', personId, adminId], ['userdata', personId, adminId]]);
  assert.ok(log.data.entries.every((e) => !Number.isNaN(Date.parse(e.at))));
  assert.equal(fs.readFileSync(path.join(dataDir, 'admin-access-log.jsonl'), 'utf8').includes('ЛИЧНАЯ-ЗАМЕТКА'), false, 'в журнале нет содержимого');
});
