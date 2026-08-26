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
    assert.doesNotMatch(src, /posthog|mixpanel|amplitude|google-analytics|\bgtag\(/i);
  }
  assert.match(JSON.parse(pkg).dependencies ? JSON.stringify(JSON.parse(pkg).dependencies) : '{}', /^\{\}$/, 'появилась внешняя зависимость');
});

/* ── Воронка доски заказов: показ → взял → выполнил → фото ───────────────────
 *
 * Считается из тех же данных аккаунта, без новых событий с клиента. Тест строит
 * аккаунты на разных стадиях доски и проверяет, что отчёт их различает, что воронка
 * сужается, и что фотография выполненного заказа не утекает в отчёт вместе со счётом.
 */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('воронка доски различает стадии и сужается', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;
  const today = iso(Date.now());
  const skills = [{ id: 'body', name: 'Тело' }];

  // Админ: дошёл до конца — взял, выполнил, приложил фото, да ещё и написал свой заказ.
  const admin = client(base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'Админ', email: 'bf-admin@example.test', password: 'funnel-pass-11' } });
  await admin('/api/data/settings', { method: 'PUT', body: { skills, board: {
    version: 1, active: [], done: [{ orderId: 'b-body-water', doneAt: today }], rested: [],
    custom: [{ id: 'own-1', title: 'Свой заказ' }],
  } } });
  await admin('/api/data/boardmedia', { method: 'PUT', body: {
    'b-body-water': { dataUrl: PNG, caption: 'озеро на рассвете, вода ледяная' },
  } });

  // Взял и выполнил, но фото не приложил.
  const b = client(base);
  await b('/api/auth/register', { method: 'POST', body: { name: 'Б', email: 'bf-b@example.test', password: 'funnel-pass-11' } });
  await b('/api/data/settings', { method: 'PUT', body: { skills, board: {
    version: 1, active: [], done: [{ orderId: 'b-mind-book', doneAt: today }], rested: [],
  } } });

  // Взял и держит — до выполнения не дошёл.
  const c = client(base);
  await c('/api/auth/register', { method: 'POST', body: { name: 'В', email: 'bf-c@example.test', password: 'funnel-pass-11' } });
  await c('/api/data/settings', { method: 'PUT', body: { skills, board: {
    version: 1, active: [{ orderId: 'b-place-sunrise', takenAt: today }], done: [], rested: [],
  } } });

  // Прошёл онбординг, доску видел, но не тронул.
  const d = client(base);
  await d('/api/auth/register', { method: 'POST', body: { name: 'Г', email: 'bf-d@example.test', password: 'funnel-pass-11' } });
  await d('/api/data/settings', { method: 'PUT', body: { skills } });

  // Зарегистрировался и пропал: до «Сегодня» не дошёл, доски не видел.
  const e = client(base);
  await e('/api/auth/register', { method: 'POST', body: { name: 'Д', email: 'bf-e@example.test', password: 'funnel-pass-11' } });

  const rep = await admin('/api/admin/funnel');
  assert.equal(rep.status, 200);
  const bf = rep.data.boardFunnel;
  assert.ok(bf, 'блока boardFunnel нет в отчёте');
  const by = Object.fromEntries(bf.steps.map((s) => [s.key, s.count]));

  assert.equal(by.sawBoard, 4, 'доску видели четверо — пятый не дошёл до Сегодня');
  assert.equal(by.took, 3, 'заказ брали трое');
  assert.equal(by.completed, 2, 'выполнили двое');
  assert.equal(by.photo, 1, 'фото приложил один');
  assert.equal(bf.wroteOwnOrder, 1, 'свой заказ написал один');

  // Воронка обязана сужаться. Расширяющаяся воронка врёт молча, поэтому проверяем шагами.
  const order = ['sawBoard', 'took', 'completed', 'photo'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(by[order[i]] <= by[order[i - 1]], `${order[i]} больше, чем ${order[i - 1]}`);
  }
  for (const s of bf.steps) {
    assert.ok(Number.isFinite(s.pctOfSaw) && s.pctOfSaw >= 0 && s.pctOfSaw <= 100, `${s.key} даёт негодный процент`);
  }
  assert.equal(bf.steps.find((s) => s.key === 'sawBoard').pctOfSaw, 100, 'знаменатель — увидевшие доску');

  // 🔴 Шага «поделился» нет как действия. Ноль означал бы «никто не делится» —
  // это неправда, поэтому числа быть не должно вовсе.
  assert.equal(bf.shared.available, false, 'появился счёт «поделился» без самого действия');
  assert.equal(Object.prototype.hasOwnProperty.call(bf.shared, 'count'), false, 'выдано число там, где действия ещё нет');

  // 🔴 Фотография и подпись к ней — личный контент. Наружу уходит только счёт.
  const raw = JSON.stringify(rep.data);
  for (const leak of [PNG.slice(0, 40), 'озеро на рассвете', 'Свой заказ', 'b-body-water', 'bf-admin@example.test']) {
    assert.equal(raw.includes(leak), false, `в отчёт утекло: ${leak}`);
  }
});

test('взятый заказ засчитывает показ даже без пройденного онбординга', { timeout: 40000 }, async (t) => {
  // Показ точного следа не оставляет и считается по онбордингу. Но взять заказ,
  // не увидев доски, нельзя — иначе `took` оказался бы больше `sawBoard`,
  // и воронка расширилась бы на первом же шаге.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const admin = client(rt.base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'bg-admin@example.test', password: 'funnel-pass-11' } });
  await admin('/api/data/settings', { method: 'PUT', body: { board: {
    version: 1, active: [{ orderId: 'b-body-stairs', takenAt: iso(Date.now()) }], done: [], rested: [],
  } } });

  const bf = (await admin('/api/admin/funnel')).data.boardFunnel;
  const by = Object.fromEntries(bf.steps.map((s) => [s.key, s.count]));
  assert.equal(by.sawBoard, 1, 'взявший заказ обязан считаться увидевшим доску');
  assert.equal(by.took, 1);
});

test('возвращённые заказы воронка не считает', { timeout: 40000 }, async (t) => {
  // board-v1 намеренно не оставляет следа, по которому можно посчитать брошенные:
  // «доска приключений превратилась бы в ещё один источник вины». Возврат обязан
  // выглядеть как взятый и невыполненный — и никак иначе.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const admin = client(rt.base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'bh-admin@example.test', password: 'funnel-pass-11' } });
  await admin('/api/data/settings', { method: 'PUT', body: { skills: [{ id: 'body', name: 'Тело' }], board: {
    version: 1, active: [], done: [], rested: [{ orderId: 'b-body-water', restedAt: iso(Date.now()) }],
  } } });

  const rep = await admin('/api/admin/funnel');
  const bf = rep.data.boardFunnel;
  const by = Object.fromEntries(bf.steps.map((s) => [s.key, s.count]));
  assert.equal(by.took, 1, 'возвращённый заказ всё-таки был взят');
  assert.equal(by.completed, 0);
  // Ни одного поля со словом «вернул»/«бросил»: считать возвраты здесь нельзя.
  assert.doesNotMatch(JSON.stringify(bf).toLowerCase(), /returned|rested|abandon|броше|верну/);
});

test('пустая доска не роняет отчёт', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const admin = client(rt.base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'Один', email: 'bi@example.test', password: 'funnel-pass-11' } });
  // Мусор вместо доски: старый аккаунт, битая миграция, ручная правка файла.
  await admin('/api/data/settings', { method: 'PUT', body: { board: 'не объект' } });
  await admin('/api/data/boardmedia', { method: 'PUT', body: [] });

  const rep = await admin('/api/admin/funnel');
  assert.equal(rep.status, 200, 'битая доска уронила отчёт');
  const bf = rep.data.boardFunnel;
  for (const s of bf.steps) {
    assert.ok(Number.isFinite(s.count) && Number.isFinite(s.pctOfSaw), `${s.key} даёт NaN`);
  }
  assert.equal(bf.steps.find((s) => s.key === 'took').count, 0);
  assert.equal(bf.wroteOwnOrder, 0);
});
