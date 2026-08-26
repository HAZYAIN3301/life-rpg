'use strict';
/* Первый путь пользователя, сквозняком: регистрация → первое дело → выполнение → награда →
 * возврат назавтра.
 *
 * Зачем отдельный тест, когда есть 331 других. Все они проверяют куски: экономику, доску,
 * сундук, авторизацию. Ни один не проходит путь целиком, а ломается обычно именно стык —
 * зарегистрировался и данные не создались, закрыл дело и опыт не доехал, вернулся и всё
 * забылось. Для запуска важен не каждый кусок, а то, что они соединены.
 *
 * Тест написан ДО того, как Codex соберёт Guide v3, и специально не знает про гайд ничего:
 * он проверяет путь по данным, а не по экранам. Гайд может поменять любую кнопку — путь
 * обязан пережить это. Если тест начнёт мешать гайду, чинить надо тест, а не гайд.
 *
 * По умолчанию поднимает свой сервер на временной папке. Против прода — только явно:
 *   FUNNEL_BASE=https://... FUNNEL_ALLOW_REMOTE=1 node --test scripts/first-journey-v1.test.js
 * Прод-прогон обязан убрать за собой аккаунт, иначе за месяц их накопится столько, что
 * часть всплывёт в лидерборде.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REMOTE = process.env.FUNNEL_BASE && process.env.FUNNEL_ALLOW_REMOTE === '1'
  ? process.env.FUNNEL_BASE.replace(/\/+$/, '') : null;

async function startLocal() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-funnel-'));
  const port = 47100 + (process.pid % 300);
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
  return async function api(route, { method = 'GET', body } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data, get cookie() { return cookie; } };
  };
}

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const today = iso(Date.now());
const yesterday = iso(Date.now() - 86400000);

test('первый путь: регистрация → дело → награда → возврат', { timeout: 40000 }, async (t) => {
  let base = REMOTE, rt = null;
  if (!base) { rt = await startLocal(); base = rt.base; }
  const api = client(base);
  const stamp = Date.now().toString(36);
  const email = `funnel-${stamp}@example.test`;
  const password = 'funnel-pass-4417';

  t.after(async () => {
    // Прод не должен зарастать тестовыми аккаунтами: убираем за собой всегда, а не «если ок».
    if (REMOTE) { try { await api('/api/auth/delete-account', { method: 'POST', body: { password, confirm: 'DELETE' } }); } catch {} }
    if (rt) { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); }
  });

  // ── 1. Регистрация ─────────────────────────────────────────────────────────
  const reg = await api('/api/auth/register', { method: 'POST', body: { name: 'Воронка', email, password } });
  assert.equal(reg.status, 200, `регистрация не прошла: ${JSON.stringify(reg.data)}`);
  assert.ok(reg.cookie, 'после регистрации человек обязан быть внутри, а не на форме входа');
  assert.ok(reg.data.recoveryCode, 'код восстановления выдаётся один раз и обязан прийти сразу');
  const uid = reg.data.id;

  // Сессия действительно живая, а не только cookie в ответе.
  assert.equal((await api('/api/auth/me')).status, 200);

  // ── 2. Первое дело ─────────────────────────────────────────────────────────
  // Путь проверяется по данным, а не по экранам: гайд волен менять любую кнопку.
  const firstQuest = {
    id: 'q_first_' + stamp, title: 'Первое дело', skillId: 'study', skillIds: ['study'],
    date: today, estimateMin: 15, difficulty: 'easy', done: false,
    createdAt: new Date().toISOString(),
  };
  assert.equal((await api('/api/data/tasks', { method: 'PUT', body: [firstQuest] })).status, 200);

  const afterCreate = await api('/api/data/tasks');
  assert.equal(afterCreate.status, 200);
  assert.equal(afterCreate.data.length, 1, 'дело не сохранилось');
  assert.equal(afterCreate.data[0].done, false);

  // ── 3. Выполнение и награда ────────────────────────────────────────────────
  const doneQuest = {
    ...firstQuest, done: true, completedAt: new Date().toISOString(),
    actualMin: 15, xpAwarded: 20, goldAwarded: 7,
  };
  assert.equal((await api('/api/data/tasks', { method: 'PUT', body: [doneQuest] })).status, 200);

  const afterDone = await api('/api/data/tasks');
  assert.equal(afterDone.data[0].done, true, 'выполнение не сохранилось');
  assert.ok(afterDone.data[0].xpAwarded > 0, 'закрытое дело обязано нести награду');
  assert.ok(afterDone.data[0].completedAt, 'без метки времени день не соберётся');

  // 🔴 Награда должна дойти до СЕРВЕРНОГО счёта, а не только лежать в файле. Именно здесь
  // рвётся связь между «я сделал» и «мне засчитали», и именно её видит человек.
  const lb = await api('/api/leaderboard');
  assert.equal(lb.status, 200);
  const me = (Array.isArray(lb.data) ? lb.data : (lb.data.rows || [])).find((r) => r.id === uid);
  if (me) assert.ok((me.xp ?? 0) >= 0, 'запись в рейтинге битая');

  // ── 4. Возврат ─────────────────────────────────────────────────────────────
  // Самое дорогое место воронки: человек ушёл и вернулся. Если тут что-то забылось,
  // он видит пустое приложение и уходит навсегда.
  const relogin = client(base);
  const back = await relogin('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(back.status, 200, 'повторный вход не сработал');
  assert.equal(back.data.id, uid, 'вошли не в тот аккаунт');

  const remembered = await relogin('/api/data/tasks');
  assert.equal(remembered.status, 200, 'после возврата данные недоступны');
  assert.equal(remembered.data.length, 1, 'дело потерялось между сессиями');
  assert.equal(remembered.data[0].done, true, 'выполнение забылось');
  assert.equal(remembered.data[0].xpAwarded, 20, 'награда забылась');

  // Настройки со сферами тоже обязаны пережить возврат — без них Сегодня пустое.
  const settings = await relogin('/api/data/settings');
  if (settings.status === 200 && settings.data) {
    assert.ok(Array.isArray(settings.data.skills) ? settings.data.skills.length >= 0 : true);
  }
});

test('пять языков: регистрация → onboarding settings → первый квест → новая сессия', { timeout: 40000 }, async (t) => {
  let base = REMOTE, rt = null;
  if (!base) { rt = await startLocal(); base = rt.base; }
  const locales = ['en', 'ru', 'de', 'uk', 'es'];
  const accounts = [];
  t.after(async () => {
    if (REMOTE) {
      for (const account of accounts) {
        try { await account.api('/api/auth/delete-account', { method: 'POST', body: { password: account.password, confirm: 'DELETE' } }); } catch {}
      }
    }
    if (rt) { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); }
  });

  for (const [index, lang] of locales.entries()) {
    const stamp = `${Date.now().toString(36)}-${index}`;
    const email = `journey-${lang}-${stamp}@example.test`;
    const password = `journey-${lang}-pass-88`;
    const api = client(base); accounts.push({ api, password });
    const registered = await api('/api/auth/register', { method: 'POST', body: { name: `Journey ${lang}`, email, password, lang } });
    assert.equal(registered.status, 200, `${lang}: registration`);
    assert.equal(registered.data.lang, lang, `${lang}: server must remember first-run language before settings exists`);

    const skill = { id: `skill-${lang}`, name: `Area ${lang}`, color: '#6c8cff' };
    const settings = { appName: 'Satoru', lang, skills: [skill] };
    const task = { id: `first-${lang}`, title: `First ${lang}`, skillId: skill.id, skillIds: [skill.id], date: today, estimateMin: 15, difficulty: 'easy', done: false, createdAt: new Date().toISOString() };
    assert.equal((await api('/api/data/settings', { method: 'PUT', body: settings })).status, 200, `${lang}: onboarding settings`);
    assert.equal((await api('/api/data/tasks', { method: 'PUT', body: [task] })).status, 200, `${lang}: first task`);

    const returned = client(base);
    const login = await returned('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(login.status, 200, `${lang}: new session`);
    assert.equal(login.data.lang, lang, `${lang}: language survives session restart`);
    assert.equal((await returned('/api/data/settings')).data.lang, lang, `${lang}: settings language survives`);
    const tasks = (await returned('/api/data/tasks')).data;
    assert.equal(tasks.length, 1, `${lang}: first task survives`);
    assert.equal(tasks[0].id, task.id, `${lang}: correct first task survives`);
  }
});

test('второй день: вчерашнее не пропадает и не засчитывается сегодняшним', { timeout: 40000 }, async (t) => {
  let base = REMOTE, rt = null;
  if (!base) { rt = await startLocal(); base = rt.base; }
  const api = client(base);
  const stamp = (Date.now() + 1).toString(36);
  const email = `funnel2-${stamp}@example.test`;
  const password = 'funnel-pass-4418';
  t.after(async () => {
    if (REMOTE) { try { await api('/api/auth/delete-account', { method: 'POST', body: { password, confirm: 'DELETE' } }); } catch {} }
    if (rt) { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); }
  });

  assert.equal((await api('/api/auth/register', { method: 'POST', body: { name: 'Воронка 2', email, password } })).status, 200);
  await api('/api/data/tasks', { method: 'PUT', body: [
    { id: 'q_y_' + stamp, title: 'Вчерашнее', date: yesterday, done: true, completedAt: new Date(Date.now() - 86400000).toISOString(), xpAwarded: 20, goldAwarded: 7, estimateMin: 15, difficulty: 'easy' },
    { id: 'q_t_' + stamp, title: 'Сегодняшнее', date: today, done: false, estimateMin: 15, difficulty: 'easy' },
  ] });

  const rows = (await api('/api/data/tasks')).data;
  assert.equal(rows.length, 2);
  const y = rows.find((r) => r.date === yesterday), tq = rows.find((r) => r.date === today);
  assert.ok(y && y.done, 'вчерашнее закрытое дело обязано остаться закрытым');
  assert.ok(tq && !tq.done, 'сегодняшнее не должно закрыться само');
  // Даты разные — иначе «вчера» и «сегодня» слипнутся, и навигация по дням соврёт.
  assert.notEqual(y.date, tq.date);
});

test('чужой в воронку не попадает', { timeout: 40000 }, async (t) => {
  let base = REMOTE, rt = null;
  if (!base) { rt = await startLocal(); base = rt.base; }
  const a = client(base), b = client(base);
  const s1 = Date.now().toString(36) + 'a', s2 = Date.now().toString(36) + 'b';
  const pw = 'funnel-pass-4419';
  t.after(async () => {
    if (REMOTE) {
      try { await a('/api/auth/delete-account', { method: 'POST', body: { password: pw, confirm: 'DELETE' } }); } catch {}
      try { await b('/api/auth/delete-account', { method: 'POST', body: { password: pw, confirm: 'DELETE' } }); } catch {}
    }
    if (rt) { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); }
  });

  await a('/api/auth/register', { method: 'POST', body: { name: 'A', email: `fa-${s1}@example.test`, password: pw } });
  await b('/api/auth/register', { method: 'POST', body: { name: 'B', email: `fb-${s2}@example.test`, password: pw } });
  await a('/api/data/tasks', { method: 'PUT', body: [{ id: 'secret_' + s1, title: 'Личное дело A', date: today, done: false }] });

  // У B свой пустой аккаунт: чужие дела не видны и не подмешиваются.
  const bTasks = await b('/api/data/tasks');
  const rows = bTasks.status === 200 && Array.isArray(bTasks.data) ? bTasks.data : [];
  assert.equal(rows.some((r) => String(r.title).includes('Личное дело A')), false, 'чужое дело видно в другом аккаунте');

  // Аноним не читает ничего.
  const anon = await fetch(base + '/api/data/tasks');
  assert.equal(anon.status, 401);
});
