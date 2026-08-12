'use strict';
/* fb_mq49778tspbi — «не могу дать випку друзьям: если они делают профиль на
 * другом языке или какие-то символы, то оно не даёт випку, хоть всё написано
 * правильно».
 *
 * Разбор: Unicode-бага нет. Поле ждало внутренний id (`albert`, `user5`), а на
 * экране человек видит ИМЯ — у нас оно часто не латиницей. Сервер честно не
 * находил профиль с id «Виолетта». Теперь имя принимается, но только когда
 * совпадение ровно одно: Pro не должен уехать случайному однофамильцу.
 *
 * Настоящая просьба из репорта — пикер профилей вместо ручного ввода — живёт в
 * `app.js` и ждёт своего окна; это фикс сервера, который чинит текущий поток. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function cookieOf(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-grantpro-'));
  const port = 45500 + (process.pid % 300);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });
  const base = `http://127.0.0.1:${port}`;
  // 8 секунд, унаследованных от соседнего харнесса, оказались оптимизмом: под
  // нагрузкой (параллельные агенты, чужие dev-серверы) старт занимает дольше, и
  // тест падал с пустым выводом — как будто сервер не поднялся, хотя он просто
  // не успел. Ждём заметно дольше: ложное падение дороже лишних секунд.
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

const reg = (base, name, email) => api(base, '/api/auth/register', {
  method: 'POST', body: { name, email, password: 'passphrase-1234' },
});

test('Pro выдаётся по имени, когда оно однозначно, и никогда наугад', { timeout: 120000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base } = runtime;

  // Первый зарегистрированный — админ.
  const admin = await reg(base, 'Root', 'root@example.test');
  assert.equal(admin.response.status, 200);
  assert.equal(admin.data.isAdmin, true);
  const A = admin.cookie;

  const viola = await reg(base, 'Виолетта', 'viola@example.test');
  assert.equal(viola.response.status, 200);
  assert.notEqual(viola.data.id, 'Виолетта', 'id намеренно не выводится из имени — в этом и была ловушка');

  // Ровно то, что делал Альберт: вводил видимое имя.
  const byName = await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: 'Виолетта' } });
  assert.equal(byName.response.status, 200, 'имя должно приниматься');
  assert.equal(byName.data.id, viola.data.id, 'Pro уехал не тому профилю');

  // Регистр и пробелы не должны решать судьбу випки.
  const revoke = await api(base, '/api/auth/revoke-pro', { method: 'POST', cookie: A, body: { userId: '  виолетта  ' } });
  assert.equal(revoke.response.status, 200, 'снятие должно быть таким же терпимым, как выдача');
  assert.equal(revoke.data.id, viola.data.id);

  // Точный id по-прежнему главный путь.
  const byId = await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: viola.data.id } });
  assert.equal(byId.response.status, 200);

  // Комбинирующие знаки: «Алёна» в NFD выглядит так же, но не равна по ===.
  const alena = await reg(base, 'Алёна'.normalize('NFC'), 'alena@example.test');
  assert.equal(alena.response.status, 200);
  const nfd = await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: 'Алёна'.normalize('NFD') } });
  assert.equal(nfd.response.status, 200, 'визуально одинаковые имена должны совпадать');
  assert.equal(nfd.data.id, alena.data.id);

  // 🔴 Однофамильцы: угадывать нельзя. Только явный отказ со списком.
  const twin = await reg(base, 'Виолетта', 'viola2@example.test');
  assert.equal(twin.response.status, 200);
  const ambiguous = await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: 'Виолетта' } });
  assert.equal(ambiguous.response.status, 409, 'при двух совпадениях нельзя выбирать за админа');
  assert.equal(ambiguous.data.matches.length, 2);
  assert.ok(ambiguous.data.matches.every((m) => m.id && m.name), 'в отказе должны быть id для уточнения');
  // …но точный id разводит неоднозначность сразу.
  const exact = await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: twin.data.id } });
  assert.equal(exact.response.status, 200);
  assert.equal(exact.data.id, twin.data.id);

  // Несуществующее имя — по-прежнему честный 404.
  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: 'Никого' } })).response.status, 404);
  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: A, body: { userId: '   ' } })).response.status, 404);

  // 🔴 Права не ослабли: обычный пользователь не выдаёт Pro ни по имени, ни по id.
  const B = viola.cookie;
  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: B, body: { userId: 'Алёна' } })).response.status, 403);
  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', cookie: B, body: { userId: alena.data.id } })).response.status, 403);
  assert.equal((await api(base, '/api/auth/revoke-pro', { method: 'POST', cookie: B, body: { userId: alena.data.id } })).response.status, 403);
  // И без сессии тоже.
  assert.equal((await api(base, '/api/auth/grant-pro', { method: 'POST', body: { userId: 'Алёна' } })).response.status, 403);
});
