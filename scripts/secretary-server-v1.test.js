'use strict';

/* Серверная часть секретаря: владение, границы, идемпотентность, write guard.
 *
 * Модульные тесты уже покрывают выбор хода. Здесь — то, что видно только на живом
 * сервере: что чужие события недоступны, что повтор не плодит записи, что
 * повреждённый файл не превращается в «ничего не случилось», и что на диск не
 * попадает ничего из содержимого экрана.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const E = require('../public/secretary-events-v1.js');

// Свободный порт спрашиваем у ОС, а не считаем из pid: вычисленный порт
// сталкивается с осиротевшим сервером от прерванного прогона и вешает набор.
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-sec-'));
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
  // Холодный старт server.js на v210 занимает ~13 с, поэтому окно щедрое: короткое
  // ожидание давало ложное «сервер не поднялся» при полностью рабочем сервере.
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
    body: JSON.stringify({ name, email, password: 'secretary-qa-11' }),
  });
  const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')])
    .filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
  return { body: await r.json(), cookie };
}

const post = (base, cookie, route, body) => fetch(base + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
});
const get = (base, cookie, route, headers) => fetch(base + route, { headers: Object.assign({ Cookie: cookie }, headers || {}) });

// Router проверяет настоящее локальное утро. Тест не должен становиться красным
// после 13:00 или протухать из-за зашитой календарной даты, поэтому выбираем
// валидный UTC-offset, при котором текущий момент попадает примерно в 08:00,
// и строим today/yesterday из того же локального времени.
function morningContext(now = new Date()) {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  let tzOffsetMinutes = 8 * 60 - utcMinutes;
  while (tzOffsetMinutes < -12 * 60) tzOffsetMinutes += 24 * 60;
  while (tzOffsetMinutes > 14 * 60) tzOffsetMinutes -= 24 * 60;
  const localMs = now.getTime() + tzOffsetMinutes * 60000;
  const day = new Date(localMs).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return {
    day,
    yesterday,
    headers: { 'x-local-day': day, 'x-tz-offset': String(tzOffsetMinutes) },
  };
}

test('Секретарь: доступ, идемпотентность и честность записи', { timeout: 120000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { try { rt.child.kill('SIGKILL'); } catch {} fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;

  const alice = await register(base, 'Алиса', 'a@sec.test');
  const bob = await register(base, 'Боб', 'b@sec.test');
  const morning = morningContext();
  const YDAY = morning.yesterday, DAY = morning.day;
  const HDR = morning.headers;

  await t.test('без сессии не отдаётся ничего', async () => {
    assert.strictEqual((await fetch(base + '/api/secretary')).status, 401);
    assert.strictEqual((await fetch(base + '/api/secretary/event', { method: 'POST' })).status, 401);
  });

  await t.test('пустое состояние — молчание, а не выдуманный ход', async () => {
    const d = await (await get(base, alice.cookie, '/api/secretary', HDR)).json();
    assert.strictEqual(d.offer, null);
  });

  await t.test('🔴 повтор одного факта не создаёт вторую запись', async () => {
    const ev = { type: E.TYPES.ATTENTION_ESCAPED, day: YDAY, at: `${YDAY}T23:50:00.000Z`, ref: 'tiktok' };
    const first = await (await post(base, alice.cookie, '/api/secretary/event', ev)).json();
    const again = await (await post(base, alice.cookie, '/api/secretary/event', Object.assign({}, ev, { source: 'server' }))).json();
    assert.strictEqual(first.added, true);
    assert.strictEqual(again.added, false, 'дубль виден серверу');
    const stored = JSON.parse(fs.readFileSync(path.join(rt.dataDir, 'users', alice.body.id, 'secretary-events.json'), 'utf8'));
    assert.strictEqual(stored.events.length, 1);
  });

  await t.test('🔴 на диск не попадает содержимое экрана', async () => {
    await post(base, alice.cookie, '/api/secretary/event', {
      type: E.TYPES.ATTENTION_OVERRAN, day: YDAY, ref: 'game',
      plannedMinutes: 60, actualMinutes: 300,
      url: 'https://example.test/very-private', query: 'личный запрос', pageText: 'текст страницы',
    });
    const raw = fs.readFileSync(path.join(rt.dataDir, 'users', alice.body.id, 'secretary-events.json'), 'utf8');
    for (const leak of ['very-private', 'личный запрос', 'текст страницы', 'example.test']) {
      assert.strictEqual(raw.includes(leak), false, `утечка на диск: «${leak}»`);
    }
  });

  await t.test('утром после повода приходит ровно один ход', async () => {
    const d = await (await get(base, alice.cookie, '/api/secretary', HDR)).json();
    assert.ok(d.offer, 'ход должен быть');
    assert.strictEqual(d.offer.capability, 'morning-after-overrun');
    assert.ok(d.offer.cooldownKey);
    assert.strictEqual(Array.isArray(d.offer.channels), true);
  });

  await t.test('🔴 события одного человека не видны другому', async () => {
    const d = await (await get(base, bob.cookie, '/api/secretary', HDR)).json();
    assert.strictEqual(d.offer, null, 'у Боба своих поводов нет');
    const raw = await (await get(base, bob.cookie, '/api/secretary', HDR)).text();
    assert.strictEqual(raw.includes('tiktok'), false);
  });

  await t.test('🔴 отклонённое не возвращается в тот же день', async () => {
    const before = await (await get(base, alice.cookie, '/api/secretary', HDR)).json();
    const marked = await post(base, alice.cookie, '/api/secretary/offer', { cooldownKey: before.offer.cooldownKey, state: 'dismissed' });
    assert.strictEqual(marked.status, 200);
    const after = await (await get(base, alice.cookie, '/api/secretary', HDR)).json();
    assert.strictEqual(after.offer, null);
  });

  await t.test('мусорный статус и пустой ключ отвергаются', async () => {
    assert.strictEqual((await post(base, alice.cookie, '/api/secretary/offer', { cooldownKey: 'x', state: 'придумал' })).status, 400);
    assert.strictEqual((await post(base, alice.cookie, '/api/secretary/offer', { state: 'dismissed' })).status, 400);
  });

  await t.test('🔴 повреждённый журнал — ошибка, а не «ничего не случилось»', async () => {
    const file = path.join(rt.dataDir, 'users', alice.body.id, 'secretary-events.json');
    const good = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, '{"version":1,"events":[{"type":"мусор"}]}');
    assert.strictEqual((await get(base, alice.cookie, '/api/secretary', HDR)).status, 422);
    const write = await post(base, alice.cookie, '/api/secretary/event', { type: E.TYPES.DAY_SILENT, day: DAY });
    assert.strictEqual(write.status, 422, 'запись поверх битого журнала запрещена');
    fs.writeFileSync(file, good);
    assert.strictEqual((await get(base, alice.cookie, '/api/secretary', HDR)).status, 200);
  });
});

test('🔴 выбор хода не зависит от ИИ', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const from = src.indexOf("if (u === '/api/secretary'");
  const to = src.indexOf("if (u === '/api/founder-pass'");
  const block = src.slice(from, to);
  assert.ok(block.length > 800, 'блок секретаря найден');
  for (const bad of ['openai', 'gemini', 'groq', 'anthropic', '/api/ai/', 'aiProvider']) {
    assert.strictEqual(block.toLowerCase().includes(bad), false, `ИИ в детекторе: «${bad}»`);
  }
});
