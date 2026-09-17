'use strict';
/* Сессии устройства — настоящий сервер (DEVICE-SESSIONS-V264.md).
 *
 * Модуль решений разобран отдельно. Здесь проверяется склейка, где ошибки опаснее всего:
 * какой маршрут принимает куку, какой — токен, и что происходит с токенами, когда
 * человек меняет пароль, выходит везде или удаляет аккаунт.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-devices-'));
  const port = 50600 + (process.pid % 150);
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
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base, output: () => output }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM');
  throw new Error(`server did not start: ${output}`);
}

async function api(base, route, { method = 'GET', cookie = '', bearer = '', body, ip } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (ip) headers['X-Forwarded-For'] = ip;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await response.json(); } catch {}
  const setCookie = response.headers.get('set-cookie') || '';
  return { status: response.status, data, cookie: setCookie.split(';')[0] };
}

async function account(base, email, ip) {
  const reg = await api(base, '/api/auth/register', {
    method: 'POST', ip, body: { name: 'Альберт', email, password: 'right-pass-2026' },
  });
  assert.equal(reg.status, 200, JSON.stringify(reg.data));
  return { cookie: reg.cookie, id: reg.data.id };
}

const remember = (name = 'iPhone', platform = 'ios') => ({ remember: true, name, platform });

async function withServer(t) {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  return rt;
}

// ============================================================

test('устройство регистрируется только по куке, и токен открывает то же, что сессия', { timeout: 30000 }, async (t) => {
  const { base } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.1');

  const version = await api(base, '/api/version');
  assert.equal(version.data.capabilities.deviceSessions, true, 'сервер честно говорит, что умеет');

  assert.equal((await api(base, '/api/auth/devices/register', { method: 'POST', body: remember() })).status, 401,
    'без куки устройство не регистрируется');
  const noConfirm = await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: { name: 'iPhone' } });
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.data.error, 'confirmation_required');

  const phone = await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember() });
  assert.equal(phone.status, 200, JSON.stringify(phone.data));
  assert.match(phone.data.accessToken, /^dat1\./);
  assert.match(phone.data.refreshToken, /^drt1\./);

  const whoami = await api(base, '/api/auth/me', { bearer: phone.data.accessToken });
  assert.equal(whoami.status, 200);
  assert.equal(whoami.data.id, me.id);
  // Токен даёт ровно тот же ответ, что кука, а без того и другого — отказ.
  for (const route of ['/api/data/settings', '/api/data/tasks', '/api/attention']) {
    const byCookie = await api(base, route, { cookie: me.cookie });
    const byToken = await api(base, route, { bearer: phone.data.accessToken });
    const anonymous = await api(base, route);
    assert.notEqual(byCookie.status, 401, `${route}: кука`);
    assert.equal(byToken.status, byCookie.status, `${route}: токен отвечает как кука`);
    assert.deepEqual(byToken.data, byCookie.data, `${route}: и тем же содержимым`);
    assert.equal(anonymous.status, 401, `${route}: без входа`);
  }

  const second = await api(base, '/api/auth/devices/register', { method: 'POST', bearer: phone.data.accessToken, body: remember('iPad') });
  assert.equal(second.status, 401, 'устройство не может выпустить другое устройство');

  const listed = await api(base, '/api/auth/devices', { bearer: phone.data.accessToken });
  assert.equal(listed.status, 200);
  assert.equal(listed.data.devices.length, 1);
  assert.equal(listed.data.devices[0].current, true);
  assert.equal(JSON.stringify(listed.data).includes('Hash'), false, 'хеши наружу не уходят');
});

test('копия старого ключа обновления отзывает устройство целиком', { timeout: 30000 }, async (t) => {
  const { base } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.2');
  const a = (await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember() })).data;
  const b = (await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: a.refreshToken } })).data;
  const c = (await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: b.refreshToken } })).data;
  assert.ok(c.refreshToken && c.accessToken);

  const stolen = await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: a.refreshToken } });
  assert.equal(stolen.status, 401);
  assert.deepEqual([stolen.data.error, stolen.data.reason], ['device_revoked', 'refresh_reused']);
  assert.equal((await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: c.refreshToken } })).status, 401,
    'законный текущий ключ тоже мёртв');
  assert.equal((await api(base, '/api/auth/me', { bearer: c.accessToken })).status, 401, 'и выданный access');

  const listed = await api(base, '/api/auth/devices', { cookie: me.cookie });
  assert.equal(listed.data.devices[0].revokedReason, 'refresh_reused', 'хозяин видит причину');
});

test('смена пароля, «выйти везде» и удаление аккаунта убивают токены устройств', { timeout: 30000 }, async (t) => {
  const { base, dataDir } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.3');
  const register = async (cookie) => (await api(base, '/api/auth/devices/register', { method: 'POST', cookie, body: remember() })).data;

  const beforePassword = await register(me.cookie);
  const changed = await api(base, '/api/auth/change-password', {
    method: 'POST', cookie: me.cookie, body: { currentPassword: 'right-pass-2026', newPassword: 'another-pass-2026' },
  });
  assert.equal(changed.status, 200);
  assert.equal((await api(base, '/api/auth/me', { bearer: beforePassword.accessToken })).status, 401, 'смена пароля');
  const afterPassword = await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: beforePassword.refreshToken } });
  assert.equal(afterPassword.data.reason, 'session_rotated');

  const cookie = changed.cookie;
  const beforeLogoutAll = await register(cookie);
  assert.equal((await api(base, '/api/auth/me', { bearer: beforeLogoutAll.accessToken })).status, 200);
  assert.equal((await api(base, '/api/auth/logout', { method: 'POST', cookie, body: { all: true } })).status, 200);
  assert.equal((await api(base, '/api/auth/me', { bearer: beforeLogoutAll.accessToken })).status, 401, '«выйти везде»');

  const again = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'albert@example.test', password: 'another-pass-2026' } });
  const beforeDelete = await register(again.cookie);
  const devicesFile = path.join(dataDir, 'users', me.id, 'devices.json');
  assert.equal(fs.existsSync(devicesFile), true);
  const deleted = await api(base, '/api/auth/delete-account', {
    method: 'POST', cookie: again.cookie, body: { confirm: 'DELETE', password: 'another-pass-2026' },
  });
  assert.equal(deleted.status, 200);
  assert.equal((await api(base, '/api/auth/me', { bearer: beforeDelete.accessToken })).status, 401, 'удаление аккаунта');
  assert.equal((await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: beforeDelete.refreshToken } })).status, 401);
  assert.equal(fs.existsSync(devicesFile), false, 'файл устройств ушёл вместе с аккаунтом');
});

test('токеном можно выйти только самому; «отозвать все» и подтверждение — только по куке', { timeout: 30000 }, async (t) => {
  const { base } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.4');
  const phone = (await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember('iPhone') })).data;
  const mac = (await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember('Mac', 'macos') })).data;

  const other = await api(base, '/api/auth/devices/revoke', { method: 'POST', bearer: phone.accessToken, body: { deviceId: mac.device.id } });
  assert.equal(other.status, 403);
  assert.equal((await api(base, '/api/auth/me', { bearer: mac.accessToken })).status, 200, 'Mac жив');

  assert.equal((await api(base, '/api/auth/devices/revoke-all', { method: 'POST', bearer: phone.accessToken })).status, 401);
  assert.equal((await api(base, '/api/auth/devices/ack', { method: 'POST', bearer: phone.accessToken, body: { deviceId: phone.device.id } })).status, 401,
    'вор не может погасить уведомление о себе своим же токеном');

  const self = await api(base, '/api/auth/devices/revoke', { method: 'POST', bearer: phone.accessToken, body: { deviceId: phone.device.id } });
  assert.equal(self.status, 200);
  assert.equal((await api(base, '/api/auth/me', { bearer: phone.accessToken })).status, 401, 'выход немедленный');

  const ack = await api(base, '/api/auth/devices/ack', { method: 'POST', cookie: me.cookie, body: { deviceId: mac.device.id } });
  assert.equal(ack.status, 200);
  const all = await api(base, '/api/auth/devices/revoke-all', { method: 'POST', cookie: me.cookie });
  assert.equal(all.status, 200);
  assert.equal((await api(base, '/api/auth/me', { bearer: mac.accessToken })).status, 401);
  assert.equal((await api(base, '/api/auth/me', { cookie: me.cookie })).status, 200, 'кука при этом жива');
});

test('испорченный файл устройств — забор: токены не открывают, запись не идёт, кука работает', { timeout: 30000 }, async (t) => {
  const { base, dataDir } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.5');
  const phone = (await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember() })).data;
  const file = path.join(dataDir, 'users', me.id, 'devices.json');
  const broken = '{"schema":"satoru.device-sessions/1","devices":[{"id":"оборвано';
  fs.writeFileSync(file, broken);

  assert.equal((await api(base, '/api/auth/me', { bearer: phone.accessToken })).status, 401);
  assert.equal((await api(base, '/api/auth/devices', { cookie: me.cookie })).status, 503);
  assert.equal((await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember('iPad') })).status, 503);
  assert.equal((await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken: phone.refreshToken } })).status, 503);
  assert.equal(fs.readFileSync(file, 'utf8'), broken, 'поверх испорченного ничего не записано');
  assert.equal((await api(base, '/api/auth/me', { cookie: me.cookie })).status, 200, 'хозяин не заперт снаружи своего аккаунта');
});

test('сбой записи не выдаёт токенов', { timeout: 30000, skip: process.getuid && process.getuid() === 0 ? 'root пишет в read-only каталог' : false }, async (t) => {
  const { base, dataDir } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.6');
  const dir = path.join(dataDir, 'users', me.id);
  fs.chmodSync(dir, 0o555);
  t.after(() => { try { fs.chmodSync(dir, 0o755); } catch {} });
  const failed = await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember() });
  fs.chmodSync(dir, 0o755);
  assert.equal(failed.status, 500);
  assert.equal(failed.data.error, 'write_failed');
  assert.equal('refreshToken' in failed.data, false);
  assert.equal('accessToken' in failed.data, false);
});

test('кривые заголовки и токены — 401 без падения сервера', { timeout: 30000 }, async (t) => {
  const { base, child } = await withServer(t);
  const me = await account(base, 'albert@example.test', '10.1.0.7');
  const phone = (await api(base, '/api/auth/devices/register', { method: 'POST', cookie: me.cookie, body: remember() })).data;
  const [, uid, id, exp, sig] = phone.accessToken.split('.');
  const headers = [
    'Bearer', 'Bearer ', `Basic ${phone.accessToken}`, `bearer ${phone.accessToken}`,
    `Bearer ${phone.accessToken} extra`, `Bearer ${'a'.repeat(5000)}`,
    `Bearer dat1.${uid}.${id}.${Number(exp) + 60000}.${sig}`, `Bearer ${phone.refreshToken}`,
    `Bearer dat1.../..%2f.${exp}.${sig}`,
  ];
  for (const value of headers) {
    const response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: value } });
    assert.equal(response.status, 401, value.slice(0, 40));
  }
  for (const refreshToken of [undefined, null, 42, '', phone.accessToken, 'drt1.x.y.z', { a: 1 }]) {
    const response = await api(base, '/api/auth/devices/refresh', { method: 'POST', body: { refreshToken } });
    assert.equal(response.status, 401, String(refreshToken));
  }
  assert.equal(child.exitCode, null, 'сервер жив');
});

test('перебор ключей обновления упирается в 429', { timeout: 30000 }, async (t) => {
  const { base } = await withServer(t);
  let limited = false;
  for (let i = 0; i < 80 && !limited; i += 1) {
    const response = await api(base, '/api/auth/devices/refresh', { method: 'POST', ip: '203.0.113.9', body: { refreshToken: `drt1.x.y.${i}` } });
    limited = response.status === 429;
  }
  assert.ok(limited);
});

test('файл устройств не входит в перенос аккаунта, админскую выгрузку и бэкапы', () => {
  // Это секреты входа, а не данные аккаунта: перенос в другой аккаунт или показ
  // администратору открыл бы вход, а не показал бы запись.
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const AccountImportV1 = require('../public/account-import-v1.js');
  assert.equal(AccountImportV1.FILES.some((name) => /device/i.test(name)), false);
  const dataNames = /const DATA_NAMES = \[([^\]]+)\]/.exec(server)[1];
  assert.equal(/device/i.test(dataNames), false);
  assert.equal(/backup\([^)]*devices/.test(server), false);
});
