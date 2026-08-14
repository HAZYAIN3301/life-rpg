'use strict';
/* fb_msjex84y8ffb — «даже во время ввода данных полностью правильных, и нажатия
 * на кнопку вход, просто потом не получалось в приложение войти».
 *
 * Пароль нигде не обрезался от пробелов. Мобильная клавиатура/автозаполнение/
 * вставка из заметок легко добавляют пробел в начале или конце ровно один раз
 * из двух вводов — при регистрации есть, при входе нет (или наоборот). Такой
 * пароль выглядит «неправильным», хотя введён верно с точки зрения человека. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function cookieOf(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-pwspace-'));
  const port = 45800 + (process.pid % 300);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });
  const base = `http://127.0.0.1:${port}`;
  // Дедлайн поднят по опыту 12.08: под нагрузкой параллельных прогонов сервер
  // стартует дольше унаследованных 8 секунд, и это давало ложные падения.
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { const r = await fetch(`${base}/api/auth/profiles`); if (r.ok) return { child, dataDir, base }; } catch {}
    await new Promise((res) => setTimeout(res, 40));
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

test('пробел на краю пароля не превращает верный вход в отказ', { timeout: 120000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base } = runtime;

  // 🔴 Ровно сценарий репорта: при регистрации мобильная клавиатура/автозаполнение
  // добавило пробел в конце пароля, человек этого не видел и не заметил.
  const reg = await api(base, '/api/auth/register', {
    method: 'POST', body: { name: 'Виола', email: 'viola@example.test', password: 'my-real-password ' },
  });
  assert.equal(reg.response.status, 200);

  // При входе человек набирает пароль как ему кажется правильным — без пробела.
  const loginNoSpace = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'viola@example.test', password: 'my-real-password' } });
  assert.equal(loginNoSpace.response.status, 200, 'вход без пробела должен пройти, хотя при регистрации пробел был');

  // И наоборот: пробел добавился при входе, а не при регистрации.
  const loginWithSpace = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'viola@example.test', password: '  my-real-password  ' } });
  assert.equal(loginWithSpace.response.status, 200, 'лишние пробелы по краям при входе не должны ломать совпадение');

  // Обрезаются только края — пробел ВНУТРИ пароля остаётся значимым символом.
  const inner = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Кто-то', email: 'inner@example.test', password: 'two words pass' } });
  assert.equal(inner.response.status, 200);
  const innerOk = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'inner@example.test', password: 'two words pass' } });
  assert.equal(innerOk.response.status, 200);
  const innerBroken = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'inner@example.test', password: 'twowordspass' } });
  assert.equal(innerBroken.response.status, 401, 'пробелы внутри пароля обязаны оставаться значимыми');

  // Настоящая опечатка по-прежнему отклоняется — обрезка не делает пароль дырявым.
  const wrong = await api(base, '/api/auth/login', { method: 'POST', body: { email: 'viola@example.test', password: 'my-real-passwore' } });
  assert.equal(wrong.response.status, 401);

  // Пароль из одних пробелов не проходит минимальную длину и не хешируется в пустую строку.
  const spacesOnly = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'X', email: 'spaces@example.test', password: '        ' } });
  assert.equal(spacesOnly.response.status, 400, 'пароль из пробелов не должен пройти проверку длины');

  // Смена пароля и подтверждение удаления идут той же дорогой.
  const cookie = reg.cookie;
  const changed = await api(base, '/api/auth/change-password', { method: 'POST', cookie, body: { currentPassword: ' my-real-password', newPassword: 'brand-new-pass-1' } });
  assert.equal(changed.response.status, 200, 'смена пароля тоже обязана прощать пробел на краю текущего пароля');
});
