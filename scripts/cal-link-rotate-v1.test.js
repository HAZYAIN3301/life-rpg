'use strict';
// Ночная ветка 21.10 (API-ACCESS-AUDIT.md): ссылку подписки на календарь можно сменить; она сбрасывается при смене
// пароля и «выйти на всех устройствах»; секрет сравнивается за постоянное время.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('старая ссылка календаря перестаёт работать после смены, смены пароля и выхода на всех устройствах', { timeout: 60000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-cal-rotate-v1-'));
  const port = 47600 + process.pid % 40, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); }); fs.rmSync(dataDir, { recursive: true, force: true }); });
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/version')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  const user = { cookie: '' };
  async function call(route, method = 'GET', body) {
    const res = await fetch(base + route, { method, headers: { Cookie: user.cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = (res.headers.get('set-cookie') || '').split(';')[0]; if (setCookie) user.cookie = setCookie;
    const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
    return { status: res.status, data };
  }
  assert.equal((await call('/api/auth/register', 'POST', { name: 'Cal Rotate', email: 'cal-rotate@example.test', password: 'cal-testing-123' })).status, 200);
  const feed = async (link) => (await fetch(`${base}/api/cal/${link.userId}/${link.secret}`)).status;
  const first = (await call('/api/auth/cal-secret', 'POST')).data;
  assert.equal(await feed(first), 200);
  assert.equal((await call('/api/auth/cal-secret', 'POST')).data.secret, first.secret, 'без rotate ссылка та же');
  const rotated = (await call('/api/auth/cal-secret', 'POST', { rotate: true })).data;
  assert.notEqual(rotated.secret, first.secret);
  assert.equal(await feed(first), 403, 'старая ссылка закрыта');
  assert.equal(await feed(rotated), 200);
  assert.equal(await feed({ userId: rotated.userId, secret: rotated.secret.slice(0, -1) }), 403, 'неверная длина не падает');
  assert.equal((await call('/api/auth/change-password', 'POST', { currentPassword: 'cal-testing-123', newPassword: 'cal-testing-456' })).status, 200);
  assert.equal(await feed(rotated), 403, 'смена пароля отзывает ссылку');
  const afterPassword = (await call('/api/auth/cal-secret', 'POST')).data;
  assert.notEqual(afterPassword.secret, rotated.secret);
  assert.equal(await feed(afterPassword), 200);
  assert.equal((await call('/api/auth/devices/revoke-all', 'POST', {})).status, 200);
  assert.equal(await feed(afterPassword), 403, '«выйти на всех устройствах» отзывает ссылку');
});

test('в окне подписки есть смена ссылки с предупреждением, строки переведены', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  assert.match(app, /<details class="cal-sub-rotate"><summary>\$\{esc\(t\('Ссылка попала не туда\?'\)\)\}<\/summary>/);
  assert.match(app, /data-action="cal-sub-rotate"/);
  assert.match(app, /action === 'cal-sub-rotate'[\s\S]{0,200}JSON\.stringify\(\{ rotate: true \}\)/);
  const extra = app.slice(app.indexOf('const I18N_EXTRA = {'), app.indexOf('const I18N = {'));
  for (const key of ["'Ссылка попала не туда?':", "'Новая ссылка заменит старую: календарь, подписанный на старую, перестанет обновляться.':", "'Сменить ссылку':", "'Ссылка сменена — старая больше не работает':"]) {
    const i = app.indexOf('  ' + key); assert.ok(i > 0, key);
    assert.ok(extra.includes('  ' + key + ' {'), key + ' лежит в I18N_EXTRA (объект по языкам), а не в строковой таблице');
    const line = app.slice(i, app.indexOf('\n', i)); for (const l of ['en:', 'de:', 'uk:', 'es:']) assert.ok(line.includes(l), key + l);
  }
});
