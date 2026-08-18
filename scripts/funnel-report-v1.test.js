'use strict';
/* Отчёт по воронке первого пути.
 *
 * Считается из данных, которые человек и так создал, а не из новых событий с клиента.
 * Поэтому тест строит реальные аккаунты на разных стадиях пути и смотрит, что отчёт
 * различает их правильно — и, что не менее важно, что наружу не уходит ничего личного.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DAY = 86400000;

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-funnel-report-'));
  const port = 48200 + (process.pid % 150);
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
function client(base) {
  let cookie = '';
  return async (route, { method = 'GET', body } = {}) => {
    const headers = {}; if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  };
}
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

test('воронка различает стадии пути и не выдаёт личного', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  const now = Date.now();

  // Первый зарегистрированный — админ, он же «дошёл до конца».
  const admin = client(base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'Админ', email: 'f-admin@example.test', password: 'funnel-pass-11' } });
  await admin('/api/data/settings', { method: 'PUT', body: { skills: [{ id: 'study', name: 'Учёба' }] } });
  await admin('/api/data/tasks', { method: 'PUT', body: [
    { id: 't1', title: 'Раз', date: iso(now - 3 * DAY), done: true, completedAt: new Date(now - 3 * DAY).toISOString(), xpAwarded: 20 },
    { id: 't2', title: 'Два', date: iso(now), done: true, completedAt: new Date(now).toISOString(), xpAwarded: 20 },
  ] });
  await admin('/api/data/lootbox', { method: 'PUT', body: { opened: 2, goldWon: 80 } });

  // Дошёл до дела, но не закрыл ни одного.
  const b = client(base);
  await b('/api/auth/register', { method: 'POST', body: { name: 'Б', email: 'f-b@example.test', password: 'funnel-pass-11' } });
  await b('/api/data/settings', { method: 'PUT', body: { skills: [{ id: 'study', name: 'Учёба' }] } });
  await b('/api/data/tasks', { method: 'PUT', body: [{ id: 'b1', title: 'Не сделал', date: iso(now), done: false }] });

  // Зарегистрировался и пропал: ни настроек, ни дел.
  const c = client(base);
  await c('/api/auth/register', { method: 'POST', body: { name: 'В', email: 'f-c@example.test', password: 'funnel-pass-11' } });

  const rep = await admin('/api/admin/funnel');
  assert.equal(rep.status, 200);
  const by = Object.fromEntries(rep.data.steps.map((s) => [s.key, s.count]));

  assert.equal(by.registered, 3, 'зарегистрированных должно быть трое');
  assert.equal(by.firstTask, 2, 'дела завели двое');
  assert.equal(by.firstDone, 1, 'закрыл дела только один');
  assert.equal(by.firstReward, 1, 'до награды дошёл только один');
  assert.equal(by.returned, 1, 'активность в два разных дня — только у одного');

  // Воронка обязана сужаться: если следующий шаг больше предыдущего, счёт сломан.
  const order = ['registered', 'firstTask', 'firstDone', 'firstReward'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(by[order[i]] <= by[order[i - 1]], `${order[i]} больше, чем ${order[i - 1]}`);
  }
  // Доли считаются от зарегистрированных и не выходят за 100%.
  for (const s of rep.data.steps) assert.ok(s.pctOfRegistered >= 0 && s.pctOfRegistered <= 100);

  // 🔴 Наружу — только числа. Ни имени, ни email, ни идентификатора аккаунта.
  const raw = JSON.stringify(rep.data);
  for (const leak of ['f-admin@example.test', 'f-b@example.test', 'Админ', 'Б', 'funnel-pass-11']) {
    assert.equal(raw.includes(leak), false, `в отчёт утекло: ${leak}`);
  }
});

test('отчёт закрыт для всех, кроме админа', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  const admin = client(base), plain = client(base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'g-admin@example.test', password: 'funnel-pass-11' } });
  await plain('/api/auth/register', { method: 'POST', body: { name: 'P', email: 'g-plain@example.test', password: 'funnel-pass-11' } });

  assert.equal((await plain('/api/admin/funnel')).status, 403, 'обычный пользователь видит воронку');
  assert.equal((await fetch(base + '/api/admin/funnel')).status, 403, 'аноним видит воронку');
  assert.equal((await admin('/api/admin/funnel')).status, 200);
});

test('пустая база не роняет отчёт', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const admin = client(rt.base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'Один', email: 'h@example.test', password: 'funnel-pass-11' } });
  const rep = await admin('/api/admin/funnel');
  assert.equal(rep.status, 200);
  // Единственный аккаунт ничего не делал: деление на ноль и NaN здесь самая вероятная поломка.
  for (const s of rep.data.steps) {
    assert.ok(Number.isFinite(s.count) && Number.isFinite(s.pctOfRegistered), `${s.key} даёт NaN`);
  }
  assert.equal(rep.data.steps.find((s) => s.key === 'registered').pctOfRegistered, 100);
});

test('внешней аналитики не заводили', () => {
  // Решение 18.08: своя аналитика вместо PostHog — зависимость, отправка поведения третьей
  // стороне и противоречие обещанию «только агрегат, без личного контента».
  // Ищем ИСПОЛЬЗОВАНИЕ, а не упоминание: объяснение «почему не взяли» живёт в комментарии
  // рядом с кодом воронки, и первая версия этого теста падала на собственной документации.
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const server = strip(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8'));
  const app = strip(fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8'));
  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  for (const src of [server, app, pkg]) {
    assert.doesNotMatch(src, /posthog|mixpanel|amplitude|google-analytics|gtag\(/i);
  }
  assert.match(JSON.parse(pkg).dependencies ? JSON.stringify(JSON.parse(pkg).dependencies) : '{}', /^\{\}$/, 'появилась внешняя зависимость');
});
