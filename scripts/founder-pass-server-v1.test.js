'use strict';

/* Серверная часть Founder Pass: доступ, границы, честность счётчика.
 *
 * Проверяется то, что модульным тестом не поймать: что чужие ответы не утекают,
 * что мест не выдаётся больше обещанного, и что повреждённый файл не превращается
 * в «сто мест свободно» — иначе одна битая запись сотрёт весь собранный замер.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const F = require('../public/founder-pass-v1.js');

// Свободный порт спрашиваем у ОС, а не вычисляем из pid. Вычисленный порт
// сталкивается с осиротевшим сервером от прерванного прогона и вешает набор
// намертво — это уже случалось (`auth-rate-limit-v1`, разбор 27.08).
// `server.js` печатает сконфигурированный PORT, а не назначенный, поэтому
// PORT=0 здесь не годится: узнать реальный порт из лога невозможно.
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = require('node:net').createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-fp-'));
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
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if ((await fetch(base + '/api/auth/profiles')).ok) return { child, dataDir, base }; } catch {}
    await new Promise((r) => setTimeout(r, 30));
  }
  child.kill('SIGKILL');
  throw new Error(`сервер не поднялся: ${out}`);
}

async function register(base, name, email) {
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'founder-pass-11' }),
  });
  const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')])
    .filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
  return { body: await r.json(), cookie };
}

const call = (base, cookie, method, body) => fetch(base + '/api/founder-pass', {
  method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test('Founder Pass: доступ, счётчик и приватность ответов', async (t) => {
  const rt = await startServer();
  t.after(() => { try { rt.child.kill('SIGKILL'); } catch {} fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;

  const admin = await register(base, 'Админ', 'admin@fp.test');   // первый = админ
  const alice = await register(base, 'Алиса', 'alice@fp.test');
  const bob = await register(base, 'Боб', 'bob@fp.test');

  await t.test('без сессии не отдаётся ничего', async () => {
    const r = await fetch(base + '/api/founder-pass');
    assert.strictEqual(r.status, 401);
  });

  await t.test('пустой список — сто свободных мест и ни одного своего ответа', async () => {
    const d = await (await call(base, alice.cookie, 'GET')).json();
    assert.strictEqual(d.left, F.CAPACITY);
    assert.strictEqual(d.full, false);
    assert.strictEqual(d.mine, null);
    assert.strictEqual(d.offer.priceCents, 1999);
  });

  await t.test('«беру» занимает место, цена пишется серверная', async () => {
    const r = await call(base, alice.cookie, 'POST', { answer: 'interested', priceCents: 1, currency: 'XXX' });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.mine.answer, 'interested');
    assert.strictEqual(d.mine.priceCents, 1999, 'клиент не назначает цену');
    assert.strictEqual(d.mine.currency, 'EUR');
    assert.strictEqual(d.left, F.CAPACITY - 1);
  });

  await t.test('«дорого» места не занимает, но сохраняется с возражением', async () => {
    const d = await (await call(base, bob.cookie, 'POST', { answer: 'too_expensive', note: 'дорого для школьника' })).json();
    assert.strictEqual(d.mine.answer, 'too_expensive');
    assert.strictEqual(d.mine.note, 'дорого для школьника');
    assert.strictEqual(d.left, F.CAPACITY - 1, 'занято по-прежнему одно место');
  });

  await t.test('🔴 чужие ответы наружу не выдаются', async () => {
    const raw = await (await call(base, bob.cookie, 'GET')).text();
    assert.ok(!raw.includes('Алиса'), 'имя другого участника не должно попадать в ответ');
    assert.ok(!raw.includes('alice@fp.test'));
    const d = JSON.parse(raw);
    assert.strictEqual(d.mine.answer, 'too_expensive', 'свой ответ — виден');
    assert.strictEqual(d.entries, undefined, 'списка ответов в публичном ответе нет');
    // Сколько людей сказали «дорого» — внутренняя цифра, а не давление на следующего.
    assert.strictEqual(d.tooExpensive, undefined);
    assert.strictEqual(d.interested, undefined);
  });

  await t.test('передумать можно — это правка, а не вторая запись', async () => {
    const d = await (await call(base, bob.cookie, 'POST', { answer: 'interested' })).json();
    assert.strictEqual(d.mine.answer, 'interested');
    assert.strictEqual(d.left, F.CAPACITY - 2);
    const again = await (await call(base, bob.cookie, 'POST', { answer: 'interested' })).json();
    assert.strictEqual(again.left, F.CAPACITY - 2, 'повторное нажатие не отбирает место у себя же');
  });

  await t.test('мусорный ответ отвергается', async () => {
    const r = await call(base, alice.cookie, 'POST', { answer: 'куплю-ка' });
    assert.strictEqual(r.status, 400);
  });

  await t.test('полный список даётся только админу, и он именной', async () => {
    const denied = await fetch(base + '/api/admin/founder-pass', { headers: { Cookie: alice.cookie } });
    assert.strictEqual(denied.status, 403);
    const d = await (await fetch(base + '/api/admin/founder-pass', { headers: { Cookie: admin.cookie } })).json();
    assert.strictEqual(d.interested, 2);
    assert.strictEqual(d.answered, 2);
    assert.ok(d.entries.some((e) => e.name === 'Алиса'), 'админу нужны имена, чтобы связаться');
    assert.ok(d.entries.some((e) => e.email === 'bob@fp.test'));
  });

  await t.test('🔴 повреждённый файл не читается как пустой список', async () => {
    const file = path.join(rt.dataDir, 'founderpass.json');
    const good = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, '{"version":1,"entries":[{"userId":"x"}]}');
    const r = await call(base, alice.cookie, 'GET');
    assert.strictEqual(r.status, 422, 'битый файл — ошибка, а не «сто мест свободно»');
    const w = await call(base, alice.cookie, 'POST', { answer: 'interested' });
    assert.strictEqual(w.status, 422, 'и запись поверх битого файла запрещена');
    fs.writeFileSync(file, good);
    assert.strictEqual((await call(base, alice.cookie, 'GET')).status, 200, 'после починки снова читается');
  });

  await t.test('🔴 мест не выдаётся больше обещанного', async () => {
    const file = path.join(rt.dataDir, 'founderpass.json');
    const entries = [];
    for (let i = 0; i < F.CAPACITY; i += 1) {
      entries.push({ userId: 'filler' + i, answer: 'interested', at: '2026-08-27T10:00:00.000Z', priceCents: 1999, currency: 'EUR', note: '' });
    }
    fs.writeFileSync(file, JSON.stringify({ version: 1, capacity: F.CAPACITY, entries }));
    const d = await (await call(base, alice.cookie, 'GET')).json();
    assert.strictEqual(d.left, 0);
    assert.strictEqual(d.full, true);
    const r = await call(base, alice.cookie, 'POST', { answer: 'interested' });
    assert.strictEqual(r.status, 409, 'сто первое место не выдаётся');
    // Но сказать «дорого» можно и при заполненном списке — это не бронь.
    assert.strictEqual((await call(base, alice.cookie, 'POST', { answer: 'too_expensive' })).status, 200);
  });
});

test('🔴 в Фазе 0 сервер не знает ни одного платёжного провайдера', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const block = src.slice(src.indexOf('/api/founder-pass'), src.indexOf('Полка возвращения (DISCIPLINE-ESCAPE-PLAN §13)'));
  assert.ok(block.length > 500, 'блок Founder Pass найден');
  for (const bad of ['paddle', 'stripe', 'lemonsqueezy', 'checkout', 'webhook', 'iban']) {
    assert.equal(block.toLowerCase().includes(bad), false, `платёжная сущность в Фазе 0: «${bad}»`);
  }
});
