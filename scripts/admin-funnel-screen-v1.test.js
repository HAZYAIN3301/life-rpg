'use strict';
// Ночная ветка 14.10: воронка на одном экране (стратегия 12.10) — сервер считает «в пати с другом»,
// админский раздел настроек показывает воронку. Только количества, без имён и email.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

test('админская воронка считает людей в пати с другом и не отдаёт личных данных', { timeout: 60000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-funnel-v1-'));
  const port = 49700 + process.pid % 250, base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); }); fs.rmSync(dataDir, { recursive: true, force: true }); });
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 30)); }
  async function api(route, user, body) {
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json(), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  }
  const users = [];
  for (const name of ['Admin', 'Friend', 'Alone']) users.push(await api('/api/auth/register', null, { name: 'Funnel ' + name, email: `funnel-${name.toLowerCase()}@example.test`, password: 'funnel-testing-123' }));
  users.forEach((u) => assert.equal(u.status, 200));
  const created = await api('/api/party/create', users[0], { name: 'Funnel QA', shareProgress: true, acknowledgedVisibility: true });
  assert.equal((await api('/api/party/join', users[1], { code: created.data.party.code, shareProgress: true, acknowledgedVisibility: true })).status, 200);
  assert.equal((await api('/api/admin/funnel', users[1])).status, 403, 'не админ воронку не видит');
  const funnel = await api('/api/admin/funnel', users[0]);
  assert.equal(funnel.status, 200);
  assert.deepEqual(funnel.data.social, { withFriend: 2, pctOfRegistered: 66.7 });
  assert.equal(funnel.data.steps[0].count, 3);
  const raw = JSON.stringify(funnel.data);
  for (const leak of ['funnel-friend@example.test', 'Funnel Friend', users[1].data.id]) assert.equal(raw.includes(leak), false, `утечка: ${leak}`);
});

test('экран воронки показывает шаги, друга и доску из ответа сервера', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
  const code = app.slice(app.indexOf('const FUNNEL_LABELS'), app.indexOf('function analyticsHTML() {'));
  const context = { State: { funnel: {
    steps: [{ key: 'registered', count: 10, pctOfRegistered: 100 }, { key: 'firstDone', count: 4, pctOfRegistered: 40 }],
    social: { withFriend: 2, pctOfRegistered: 20 },
    boardFunnel: { steps: [{ key: 'sawBoard', count: 8, pctOfSaw: 100 }, { key: 'took', count: 3, pctOfSaw: 37.5 }] },
    cohortsByWeek: { '2026-10-12': { registered: 6, firstDone: 2 } },
  } }, t: (x) => x, esc: (x) => String(x), fetch: () => new Promise(() => {}), render() {} };
  vm.createContext(context); vm.runInContext(code, context);
  const html = context.funnelHTML();
  for (const needle of ['Зарегистрировались', 'Выполнили первое дело', '40%', 'В пати хотя бы с одним другом', '8 (100%) → 3 (37.5%)', '2026-10-12', 'без имён и email']) assert.ok(html.includes(needle), needle);
  context.State.funnel = {}; assert.match(context.funnelHTML(), /Воронка недоступна/);
  assert.match(app, /\$\{funnelHTML\(\)\}/, 'воронка подключена в админский раздел');
});
