'use strict';

/* Серверная часть массовых операций: владение, три отдельных шага, откат.
 *
 * Модульные тесты покрывают саму транзакцию. Здесь то, что видно только на живом
 * сервере: что чужие цели недоступны, что предпросмотр ничего не пишет, что повтор
 * отвечает спокойно, а не ошибкой, и что просроченный откат отказывает вслух.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-bulk-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  // Холодный старт занимает секунды: окно щедрое, чтобы не получить ложное падение.
  for (let i = 0; i < 700; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if ((await fetch(base + '/api/auth/profiles')).ok) return { child, dataDir, base }; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  child.kill('SIGKILL');
  throw new Error(`сервер не поднялся: ${out}`);
}

async function register(base, name, email) {
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'bulk-qa-2026' }),
  });
  const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')])
    .filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
  return { body: await r.json(), cookie };
}

const post = (base, cookie, route, body) => fetch(base + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
});

const GOALS = [
  { id: 'g1', title: 'Бегать три раза в неделю', archived: false },
  { id: 'g2', title: 'Jugend Forscht — биосенсор', archived: false },
  { id: 'g3', title: 'Jugend-Forscht: стенд', archived: true },
  { id: 'g4', title: 'Немецкий C1', archived: false },
];

test('Массовые операции: доступ, шаги и откат', { timeout: 120000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { try { rt.child.kill('SIGKILL'); } catch {} fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;

  const alice = await register(base, 'Алиса', 'a@bulk.test');
  const bob = await register(base, 'Боб', 'b@bulk.test');
  const goalsFile = path.join(rt.dataDir, 'users', alice.body.id, 'goals.json');
  fs.mkdirSync(path.dirname(goalsFile), { recursive: true });
  fs.writeFileSync(goalsFile, JSON.stringify(GOALS));

  await t.test('без сессии не отдаётся ничего', async () => {
    assert.strictEqual((await fetch(base + '/api/bulk/resolve', { method: 'POST' })).status, 401);
    assert.strictEqual((await fetch(base + '/api/bulk/apply', { method: 'POST' })).status, 401);
  });

  await t.test('фраза превращается в кандидатов, а не в действие', async () => {
    const d = await (await post(base, alice.cookie, '/api/bulk/resolve', { query: 'убери все цели Jugend Forscht' })).json();
    const ids = d.strong.map((c) => c.id);
    assert.ok(ids.includes('g2') && ids.includes('g3'));
    assert.ok(!ids.includes('g4'));
    assert.strictEqual(d.ambiguous, false);
    assert.strictEqual(d.preview, undefined, 'разбор не строит план за человека');
    const stored = JSON.parse(fs.readFileSync(goalsFile, 'utf8'));
    assert.deepStrictEqual(stored, GOALS, 'разбор ничего не изменил');
  });

  await t.test('🔴 цели одного человека не видны другому', async () => {
    const d = await (await post(base, bob.cookie, '/api/bulk/resolve', { query: 'Jugend Forscht' })).json();
    assert.strictEqual(d.strong.length + d.weak.length, 0);
    assert.strictEqual(d.ambiguous, true);
  });

  await t.test('🔴 предпросмотр ничего не пишет', async () => {
    const d = await (await post(base, alice.cookie, '/api/bulk/apply', { op: 'archive', ids: ['g1', 'g3'], preview: true })).json();
    assert.deepStrictEqual(d.preview.affected.map((a) => a.id), ['g1']);
    assert.deepStrictEqual(d.preview.skipped.map((a) => a.id), ['g3'], 'уже в архиве');
    assert.strictEqual(d.applied, undefined);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(goalsFile, 'utf8')), GOALS, 'файл не тронут');
  });

  await t.test('несуществующий id виден человеку, а не проглатывается', async () => {
    const d = await (await post(base, alice.cookie, '/api/bulk/apply', { op: 'archive', ids: ['g1', 'нет'], preview: true })).json();
    assert.deepStrictEqual(d.preview.missing, ['нет']);
  });

  let undoToken = '';
  await t.test('применение меняет только запланированное и выдаёт токен отката', async () => {
    const d = await (await post(base, alice.cookie, '/api/bulk/apply', { op: 'archive', ids: ['g2'] })).json();
    assert.strictEqual(d.applied, true);
    assert.ok(d.undo && d.undo.token);
    assert.ok(d.undo.expiresInMs > 0, 'клиент знает, сколько живёт кнопка');
    undoToken = d.undo.token;
    const stored = JSON.parse(fs.readFileSync(goalsFile, 'utf8'));
    assert.strictEqual(stored.find((g) => g.id === 'g2').archived, true);
    assert.strictEqual(stored.find((g) => g.id === 'g4').archived, false, 'непричастное не тронуто');
    assert.strictEqual(stored.length, GOALS.length, 'ничего не уничтожено');
  });

  await t.test('🔴 повтор отвечает спокойно, а не ошибкой', async () => {
    const r = await post(base, alice.cookie, '/api/bulk/apply', { op: 'archive', ids: ['g2'] });
    assert.strictEqual(r.status, 200, 'повтор — не ошибка');
    const d = await r.json();
    assert.strictEqual(d.applied, false);
    // g2 уже в архиве, поэтому план пуст — это «нечего менять», а не сбой.
    assert.ok(['already_applied', 'nothing_to_do'].includes(d.reason), d.reason);
  });

  await t.test('откат возвращает прежнее состояние', async () => {
    const d = await (await post(base, alice.cookie, '/api/bulk/undo', { token: undoToken })).json();
    assert.strictEqual(d.undone, true);
    const stored = JSON.parse(fs.readFileSync(goalsFile, 'utf8'));
    assert.strictEqual(stored.find((g) => g.id === 'g2').archived, false);
    assert.strictEqual(stored.find((g) => g.id === 'g3').archived, true, 'не участвовавший не тронут откатом');
  });

  await t.test('🔴 чужой и повторный токен отказывают вслух', async () => {
    const bad = await post(base, alice.cookie, '/api/bulk/undo', { token: 'подделка' });
    assert.strictEqual(bad.status, 409);
    assert.strictEqual((await bad.json()).undone, false);
    const again = await post(base, alice.cookie, '/api/bulk/undo', { token: undoToken });
    assert.strictEqual(again.status, 409, 'второй откат по тому же токену не проходит молча');
  });

  await t.test('журнал операций пишется и не копирует заголовки целей', () => {
    const led = JSON.parse(fs.readFileSync(path.join(rt.dataDir, 'users', alice.body.id, 'bulk-ledger.json'), 'utf8'));
    assert.ok(led.audit.length >= 2);
    assert.strictEqual(JSON.stringify(led.audit).includes('Jugend'), false);
    assert.strictEqual(led.undo, null, 'использованный откат снят');
  });

  await t.test('🔴 повреждённый файл целей — ошибка, а не «целей нет»', async () => {
    const good = fs.readFileSync(goalsFile, 'utf8');
    fs.writeFileSync(goalsFile, '{"не":"массив"}');
    assert.strictEqual((await post(base, alice.cookie, '/api/bulk/resolve', { query: 'бег' })).status, 422);
    assert.strictEqual((await post(base, alice.cookie, '/api/bulk/apply', { op: 'archive', ids: ['g1'] })).status, 422);
    fs.writeFileSync(goalsFile, good);
    assert.strictEqual((await post(base, alice.cookie, '/api/bulk/resolve', { query: 'бег' })).status, 200);
  });

  await t.test('неизвестная операция не исполняется', async () => {
    const r = await post(base, alice.cookie, '/api/bulk/apply', { op: 'delete', ids: ['g1'] });
    assert.strictEqual(r.status, 400, 'глагола «удалить» не существует');
  });
});

test('🔴 в блоке массовых операций нет разрушительных глаголов', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const from = src.indexOf("if (u === '/api/bulk/resolve'");
  const to = src.indexOf('// ---- Секретарь: журнал событий');
  const block = src.slice(from, to);
  assert.ok(block.length > 800, 'блок найден');
  for (const bad of ['unlinkSync', 'rmSync', 'rmdir', 'deleteUser', 'destroy']) {
    assert.strictEqual(block.includes(bad), false, `разрушительная операция на сервере: «${bad}»`);
  }
});
