'use strict';
/* Ограничение частоты на авторизации.
 *
 * До этого 429 во всём сервере стоял ровно в одном месте — на озвучке. Вход, регистрация и
 * сброс пароля не были ограничены ничем, а публичный запуск означает, что сервер впервые
 * встретится с чужими людьми.
 *
 * Опаснее всего не подбор пароля, а стоимость scrypt: каждая попытка входа — это десятки
 * миллисекунд процессора ПО ПОСТРОЕНИЮ. Несколько тысяч запросов в минуту кладут инстанс для
 * всех остальных, и для этого не нужно ни уязвимости, ни умысла.
 *
 * Тест проверяет три вещи, и третья не менее важна первых двух: лимит не должен превращаться
 * в оружие против самого пользователя.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-rate-'));
  const port = 47800 + (process.pid % 150);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((r) => setTimeout(r, 30));
  }
  child.kill('SIGTERM'); throw new Error(`сервер не поднялся: ${out}`);
}
// Разные адреса подделываются заголовком, который за прокси ставит сам прокси. В тесте это
// единственный способ изобразить разные источники, и заодно проверка, что сервер его читает.
function post(base, route, body, ip) {
  return fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}) },
    body: JSON.stringify(body),
  });
}

test('перебор пароля упирается в 429, а не в процессор', { timeout: 30000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  await post(base, '/api/auth/register', { name: 'Ц', email: 'target@example.test', password: 'right-pass-11' }, '10.0.0.1');

  let limited = null, attempts = 0;
  for (let i = 0; i < 60 && !limited; i += 1) {
    attempts += 1;
    const r = await post(base, '/api/auth/login', { email: 'target@example.test', password: 'wrong-' + i }, '10.0.0.9');
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, `за ${attempts} попыток подбора сервер ни разу не ответил 429`);
  assert.ok(attempts < 60, 'лимит сработал слишком поздно, чтобы снять нагрузку');

  // Ответ обязан сказать, когда возвращаться, иначе клиент будет долбить вслепую.
  const retryAfter = limited.headers.get('retry-after');
  assert.ok(Number(retryAfter) > 0, 'нет заголовка Retry-After');
  const body = await limited.json();
  assert.ok(Number(body.retryAfter) > 0);
  // И НЕ обязан говорить, существует ли учётка и какой порог сработал.
  assert.doesNotMatch(String(body.error), /пароль|email|не найден|account/i, 'ответ 429 подсказывает лишнее');
});

test('чужой не может запереть вход человеку, которого знает по email', { timeout: 30000 }, async (t) => {
  // Самый неприятный способ сломать лимит — сделать его оружием. Если перебор с чужого
  // адреса блокирует учётку целиком, любого можно отрезать от собственного аккаунта.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  await post(base, '/api/auth/register', { name: 'Ж', email: 'victim@example.test', password: 'victim-pass-11' }, '10.0.1.1');

  // Злоумышленник выбирает лимит по учётке со своего адреса.
  for (let i = 0; i < 25; i += 1) {
    await post(base, '/api/auth/login', { email: 'victim@example.test', password: 'guess-' + i }, '203.0.113.7');
  }
  // Хозяин заходит со своего адреса с ВЕРНЫМ паролем.
  const owner = await post(base, '/api/auth/login', { email: 'victim@example.test', password: 'victim-pass-11' }, '10.0.1.1');
  assert.notEqual(owner.status, 429, 'чужой перебор запер хозяину вход — лимит стал оружием');
  assert.equal(owner.status, 200, `хозяин не смог войти: ${owner.status}`);
});

test('регистрация ограничена: папку на диске не наплодить', { timeout: 30000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = rt;

  let created = 0, limited = false;
  for (let i = 0; i < 20 && !limited; i += 1) {
    const r = await post(base, '/api/auth/register', { name: 'M' + i, email: `mass-${i}@example.test`, password: 'mass-pass-111' }, '198.51.100.4');
    if (r.status === 429) limited = true; else if (r.status === 200) created += 1;
  }
  assert.ok(limited, 'массовая регистрация с одного адреса ничем не ограничена');
  assert.ok(created <= 6, `создано ${created} аккаунтов до срабатывания лимита`);

  // Папки на диске появились ровно под созданные аккаунты, а не под все попытки.
  const usersDir = path.join(dataDir, 'users');
  const dirs = fs.existsSync(usersDir) ? fs.readdirSync(usersDir).length : 0;
  assert.ok(dirs <= created + 1, `на диске ${dirs} папок при ${created} успешных регистрациях`);
});

test('другой источник не наследует чужой лимит', { timeout: 30000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  await post(base, '/api/auth/register', { name: 'Н', email: 'shared@example.test', password: 'shared-pass-11' }, '10.0.2.1');

  // Выбираем лимит по адресу A.
  for (let i = 0; i < 40; i += 1) await post(base, '/api/auth/login', { email: `nobody-${i}@example.test`, password: 'x' }, '192.0.2.50');
  const blocked = await post(base, '/api/auth/login', { email: 'shared@example.test', password: 'shared-pass-11' }, '192.0.2.50');
  assert.equal(blocked.status, 429, 'адрес, выбравший лимит, всё ещё пропускают');

  // Адрес B ни при чём и работает.
  const other = await post(base, '/api/auth/login', { email: 'shared@example.test', password: 'shared-pass-11' }, '192.0.2.51');
  assert.equal(other.status, 200, 'лимит одного адреса задел другой');
});

test('сброс пароля тоже под лимитом', { timeout: 30000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  await post(base, '/api/auth/register', { name: 'Р', email: 'reset@example.test', password: 'reset-pass-11' }, '10.0.3.1');

  let limited = false;
  for (let i = 0; i < 30 && !limited; i += 1) {
    const r = await post(base, '/api/auth/reset', { email: 'reset@example.test', code: `AAAA-BBBB-CCCC-${String(i).padStart(4, '0')}`, newPassword: 'new-pass-1111' }, '198.51.100.9');
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, 'подбор кода восстановления ничем не ограничен');
});
