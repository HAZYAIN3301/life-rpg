'use strict';
/* Сброс пароля письмом (Q17, fb_mspzme8vixjf «код легко потерять»).
 *
 * Здесь поднимается настоящий сервер, а Resend подменяется локальной заглушкой через
 * RESEND_API_BASE: отправлять живые письма из тестов нельзя, но и мокать сам эндпоинт
 * приложения бессмысленно — тогда проверялась бы заглушка, а не код сброса.
 *
 * Главное, что стережём: письмо не должно превращаться в способ узнать, кто
 * зарегистрирован в Satoru, а ссылка — работать дважды, вечно или после смены пароля.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

// Ловушка писем: принимает POST /emails, как Resend, и складывает их в память.
async function startMailTrap() {
  const inbox = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { inbox.push(JSON.parse(raw)); } catch { inbox.push({ raw }); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'test-' + inbox.length }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { inbox, server, url: `http://127.0.0.1:${server.address().port}/emails` };
}

async function startServer(env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-reset-'));
  const port = 46200 + (process.pid % 300);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал ${child.exitCode}: ${out}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((r) => setTimeout(r, 30));
  }
  child.kill('SIGTERM'); throw new Error(`сервер не поднялся: ${out}`);
}
async function api(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}; if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}
const linkOf = (mail) => (String(mail.html).match(/href="([^"]+)"/) || [])[1];
const paramsOf = (link) => new URL(link).searchParams;

test('без ключа Resend фича спит, а старый путь по коду продолжает работать', { timeout: 20000 }, async (t) => {
  const rt = await startServer({ RESEND_API_KEY: '' });
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;

  assert.equal((await api(base, '/api/auth/reset-available')).data.configured, false);
  const reg = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'A', email: 'a@example.test', password: 'first-pass-1' } });
  assert.equal(reg.response.status, 200);

  const forgot = await api(base, '/api/auth/forgot', { method: 'POST', body: { email: 'a@example.test' } });
  assert.equal(forgot.response.status, 200);
  assert.equal(forgot.data.configured, false, 'без ключа сервер обязан честно сказать, что письма не будет');

  // Код восстановления — по-прежнему рабочий путь, письмо его не заменило.
  const byCode = await api(base, '/api/auth/reset', { method: 'POST', body: { email: 'a@example.test', code: reg.data.recoveryCode, newPassword: 'second-pass-2' } });
  assert.equal(byCode.response.status, 200);
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { email: 'a@example.test', password: 'second-pass-2' } })).response.status, 200);
});

test('ссылка из письма меняет пароль ровно один раз', { timeout: 20000 }, async (t) => {
  const trap = await startMailTrap();
  const rt = await startServer({ RESEND_API_KEY: 'test-key', RESEND_API_BASE: trap.url, PUBLIC_BASE_URL: 'https://satoru.test' });
  t.after(() => { rt.child.kill('SIGTERM'); trap.server.close(); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;

  assert.equal((await api(base, '/api/auth/reset-available')).data.configured, true);
  await api(base, '/api/auth/register', { method: 'POST', body: { name: 'B', email: 'b@example.test', password: 'old-pass-11' } });

  assert.equal((await api(base, '/api/auth/forgot', { method: 'POST', body: { email: 'b@example.test' } })).data.mailed, true);
  assert.equal(trap.inbox.length, 1, 'письмо не ушло');
  const mail = trap.inbox[0];
  assert.deepEqual(mail.to, ['b@example.test']);
  const link = linkOf(mail);
  assert.ok(link.startsWith('https://satoru.test/?reset='), `ссылка ведёт не туда: ${link}`);
  const token = paramsOf(link).get('reset');
  assert.ok(token && token.length >= 32, 'токен слишком короткий для одноразовой ссылки');

  // Чужой токен не подходит, даже если email правильный.
  assert.equal((await api(base, '/api/auth/reset-token', { method: 'POST', body: { email: 'b@example.test', token: 'x'.repeat(43), newPassword: 'hack-pass-99' } })).response.status, 401);

  const done = await api(base, '/api/auth/reset-token', { method: 'POST', body: { email: 'b@example.test', token, newPassword: 'new-pass-22' } });
  assert.equal(done.response.status, 200);
  assert.ok(done.cookie, 'после сброса человек должен оказаться внутри, а не на форме входа');
  assert.ok(done.data.recoveryCode, 'код восстановления обязан провернуться');

  // Одноразовость: та же ссылка второй раз не работает.
  assert.equal((await api(base, '/api/auth/reset-token', { method: 'POST', body: { email: 'b@example.test', token, newPassword: 'third-pass-33' } })).response.status, 401);
  // Новый пароль работает, старый — нет.
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { email: 'b@example.test', password: 'new-pass-22' } })).response.status, 200);
  assert.equal((await api(base, '/api/auth/login', { method: 'POST', body: { email: 'b@example.test', password: 'old-pass-11' } })).response.status, 401);
});

test('форма не рассказывает, кто зарегистрирован', { timeout: 20000 }, async (t) => {
  const trap = await startMailTrap();
  const rt = await startServer({ RESEND_API_KEY: 'test-key', RESEND_API_BASE: trap.url });
  t.after(() => { rt.child.kill('SIGTERM'); trap.server.close(); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  await api(base, '/api/auth/register', { method: 'POST', body: { name: 'C', email: 'real@example.test', password: 'real-pass-11' } });

  const known = await api(base, '/api/auth/forgot', { method: 'POST', body: { email: 'real@example.test' } });
  const unknown = await api(base, '/api/auth/forgot', { method: 'POST', body: { email: 'nobody@example.test' } });
  // Статус и тело обязаны совпадать до байта — иначе перебором вычисляется база адресов.
  assert.equal(known.response.status, unknown.response.status);
  assert.deepEqual(known.data, unknown.data);
  assert.equal(trap.inbox.length, 1, 'несуществующему адресу письмо слать нельзя');

  // Повтор в пределах кулдауна отвечает так же, но письма не шлёт.
  const again = await api(base, '/api/auth/forgot', { method: 'POST', body: { email: 'real@example.test' } });
  assert.deepEqual(again.data, known.data);
  assert.equal(trap.inbox.length, 1, 'кулдаун не удержал второе письмо');
});

test('токен хранится только хешем и не уезжает клиенту', { timeout: 20000 }, async (t) => {
  const trap = await startMailTrap();
  const rt = await startServer({ RESEND_API_KEY: 'test-key', RESEND_API_BASE: trap.url });
  t.after(() => { rt.child.kill('SIGTERM'); trap.server.close(); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = rt;
  const reg = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'D', email: 'd@example.test', password: 'd-pass-1111' } });
  await api(base, '/api/auth/forgot', { method: 'POST', body: { email: 'd@example.test' } });
  const token = paramsOf(linkOf(trap.inbox[0])).get('reset');

  const usersRaw = fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8');
  assert.ok(!usersRaw.includes(token), 'открытый токен лежит в users.json — утечка файла сбрасывает чужие пароли');
  assert.ok(usersRaw.includes('resetHash'), 'хеш токена не сохранён');

  // Профиль пользователя наружу токен тоже не отдаёт.
  const me = await api(base, '/api/auth/me', { cookie: reg.cookie });
  assert.equal(me.response.status, 200);
  for (const field of ['resetHash', 'resetExp', 'pwHash', 'recoveryHash']) {
    assert.equal(field in me.data, false, `${field} утёк в /api/auth/me`);
  }
});
