'use strict';
/* Выгрузка чужих данных для разбора сбоя.
 *
 * Единственный оставшийся launch-blocker — креш Календаря и Статистики у Виолы, и без её
 * данных он не воспроизводится. Альберт разрешил заглянуть. Разрешение получено на РАЗБОР
 * СБОЯ, а не на чтение чужого дневника, и разница обязана держаться кодом, а не памятью
 * того, кто будет смотреть файл.
 *
 * Поэтому тест проверяет не «эндпоинт отвечает 200», а ровно две вещи:
 *  — механика для репро на месте;
 *  — личное не уехало с сервера ни при каких обстоятельствах.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-crash-'));
  const port = 46700 + (process.pid % 200);
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
async function api(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}; if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { r, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

// Дневниковое содержимое с узнаваемым маркером: если он всплывёт в выгрузке — утечка.
const SECRET = 'ЛИЧНОЕ-НЕ-ДЛЯ-ЧУЖИХ-ГЛАЗ';

test('выгрузка даёт механику и НЕ даёт дневник', { timeout: 20000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = rt;

  // Первый зарегистрированный становится админом в этой сборке; второй — «жертва».
  const admin = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Админ', email: 'admin@example.test', password: 'admin-pass-11' } });
  const victim = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Виола', email: 'viola@example.test', password: 'viola-pass-11' } });
  const victimId = (await (await fetch(base + '/api/auth/me', { headers: { Cookie: victim.cookie } })).json()).id;

  // Кладём и механику, и дневник.
  await api(base, '/api/data/tasks', { method: 'PUT', cookie: victim.cookie, body: [{ id: 'q1', title: 'Квест', date: '2026-08-01', done: true }] });
  await api(base, '/api/data/days', { method: 'PUT', cookie: victim.cookie, body: { '2026-08-01': { closed: true, note: SECRET } } });
  await api(base, '/api/data/inbox', { method: 'PUT', cookie: victim.cookie, body: [{ id: 'n1', text: SECRET }] });
  await api(base, '/api/data/episodes', { method: 'PUT', cookie: victim.cookie, body: [{ id: 'e1', title: SECRET }] });

  // Не-админ не получает чужое вообще.
  const asVictim = await fetch(`${base}/api/admin/crash-export/${victimId}`, { headers: { Cookie: victim.cookie } });
  assert.equal(asVictim.status, 403, 'обычный пользователь скачал чужие данные');
  const anon = await fetch(`${base}/api/admin/crash-export/${victimId}`);
  assert.equal(anon.status, 403, 'аноним скачал чужие данные');

  const res = await fetch(`${base}/api/admin/crash-export/${victimId}`, { headers: { Cookie: admin.cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') || '', /attachment; filename=/, 'должно скачиваться файлом, а не показываться на экране');
  const raw = await res.text();

  // 🔴 Главное утверждение теста.
  assert.equal(raw.includes(SECRET), false, 'дневниковое содержимое уехало в выгрузку');

  const data = JSON.parse(raw);
  assert.equal(data.format, 'satoru-crash-repro');
  // Механика, на которой падает Календарь, обязана быть — иначе выгрузка бесполезна.
  for (const name of ['settings', 'tasks', 'habits', 'habitlog', 'goals']) {
    assert.ok(name in data.files, `в выгрузке нет ${name}, а без него репро не собрать`);
  }
  assert.equal(data.files.tasks[0].title, 'Квест');
  // Личные файлы не просто пустые — их вообще нет в ответе.
  for (const name of ['days', 'inbox', 'episodes', 'weeks', 'profile']) {
    assert.equal(name in data.files, false, `${name} попал в выгрузку`);
  }
  // И выгрузка сама объявляет, что именно из неё вырезано.
  assert.ok(Array.isArray(data.excluded) && data.excluded.includes('days') && data.excluded.includes('inbox'));

  // Файлы на диске не тронуты: выгрузка только читает.
  const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'users', victimId, 'days.json'), 'utf8'));
  assert.equal(onDisk['2026-08-01'].note, SECRET, 'выгрузка изменила данные пользователя');
});

test('белый список, а не чёрный: новый личный файл не утечёт по забывчивости', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const block = src.slice(src.indexOf('crash-export'), src.indexOf('satoru-crash-repro'));
  // Перечисление того, что МОЖНО, — единственный способ пережить появление нового файла
  // с личным содержимым. Чёрный список пришлось бы дополнять, и однажды бы забыли.
  assert.match(block, /const MECHANICS = \[/);
  assert.doesNotMatch(block, /DATA_NAMES/, 'выгрузка ходит по общему списку файлов вместо белого');
});
