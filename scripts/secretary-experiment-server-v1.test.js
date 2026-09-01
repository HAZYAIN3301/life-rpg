'use strict';

/* Серверная часть тридцатидневного эксперимента.
 *
 * Модульные тесты покрывают саму честность замера. Здесь то, что видно только на
 * живом сервере: что чужой эксперимент недоступен, что два устройства не затирают
 * ответы друг друга, что мусор из клиента отклоняется вслух, и что повреждённый файл
 * становится ошибкой, а не пустыми тридцатью днями.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const X = require('../public/secretary-experiment-v1.js');

const START = '2026-09-02';
const HDR = { 'X-Local-Day': '2026-09-05', 'X-Tz-Offset': '120' };

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-exp-'));
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
    body: JSON.stringify({ name, email, password: 'exp-qa-2026' }),
  });
  const cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')])
    .filter(Boolean).map((c) => String(c).split(';')[0]).join('; ');
  return { body: await r.json(), cookie };
}

const post = (base, cookie, body) => fetch(base + '/api/secretary/experiment', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
});
const get = (base, cookie) => fetch(base + '/api/secretary/experiment', { headers: { Cookie: cookie, ...HDR } });

test('Эксперимент: владение, ревизия, порядок и порча файла', { timeout: 120000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { try { rt.child.kill('SIGKILL'); } catch {} fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { base } = rt;

  const alice = await register(base, 'Алиса', 'a@exp.test');
  const bob = await register(base, 'Боб', 'b@exp.test');
  const file = path.join(rt.dataDir, 'users', alice.body.id, 'secretary-experiment.json');

  await t.test('без сессии не отдаётся ничего', async () => {
    assert.strictEqual((await fetch(base + '/api/secretary/experiment')).status, 401);
    assert.strictEqual((await fetch(base + '/api/secretary/experiment', { method: 'POST' })).status, 401);
  });

  await t.test('пустое состояние — не выдуманный эксперимент', async () => {
    const d = await (await get(base, alice.cookie)).json();
    assert.strictEqual(d.experiment, null);
    assert.strictEqual(d.metrics, null);
    assert.strictEqual(d.revision, 0);
  });

  let revision = 0;
  await t.test('эксперимент открывается черновиком и активируется отдельно', async () => {
    const open = await (await post(base, alice.cookie, { op: 'open', id: 'e1', startedOn: START })).json();
    assert.strictEqual(open.ok, true);
    revision = open.revision;
    let d = await (await get(base, alice.cookie)).json();
    assert.strictEqual(d.experiment.status, 'draft', 'срок и приватность видны до старта');
    assert.strictEqual(d.experiment.endsOn, '2026-10-01');

    const on = await (await post(base, alice.cookie, { op: 'activate', id: 'e1', seq: 2, revision })).json();
    revision = on.revision;
    d = await (await get(base, alice.cookie)).json();
    assert.strictEqual(d.experiment.status, 'active');
  });

  await t.test('🔴 чужой эксперимент не виден и не меняется', async () => {
    const d = await (await get(base, bob.cookie)).json();
    assert.strictEqual(d.experiment, null, 'Боб не видит эксперимент Алисы');
    const r = await post(base, bob.cookie, { op: 'checkin', id: 'e1', day: START, checkIn: { afterEffect: 'worse' }, seq: 9 });
    assert.strictEqual(r.status, 404, 'и не может в него написать');
    const still = await (await get(base, alice.cookie)).json();
    assert.strictEqual(Object.keys(still.experiment.checkIns).length, 0, 'ответов Алисы не появилось');
  });

  await t.test('ответ сохраняется и попадает в сводку', async () => {
    const r = await (await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: START, seq: 3, revision,
      checkIn: { afterEffect: 'better', boundaryHeld: 'yes', regret: 'none' },
    })).json();
    assert.strictEqual(r.applied, true);
    revision = r.revision;
    const d = await (await get(base, alice.cookie)).json();
    assert.strictEqual(d.experiment.checkIns[START].afterEffect, 'better');
    assert.strictEqual(d.metrics.knownDays, 1);
    assert.strictEqual(d.metrics.calibrating, true, 'на одном ответе вывода нет');
    assert.strictEqual(d.metrics.offers.offered, null, 'показы сервер пока не считает');
  });

  await t.test('🔴 устаревшая ревизия не затирает чужую запись', async () => {
    const r = await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: '2026-09-03', seq: 4, revision: 0,
      checkIn: { afterEffect: 'worse' },
    });
    assert.strictEqual(r.status, 409);
    const d = await r.json();
    assert.strictEqual(d.error, 'stale_revision');
    assert.strictEqual(d.revision, revision, 'клиенту сказано, с чего перечитывать');
  });

  await t.test('🔴 устаревший порядковый номер отклоняется, повтор проходит спокойно', async () => {
    const stale = await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: START, seq: 1, revision, checkIn: { afterEffect: 'worse' },
    });
    assert.strictEqual(stale.status, 409);
    const same = await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: START, seq: 3, revision,
      checkIn: { afterEffect: 'better', boundaryHeld: 'yes', regret: 'none' },
    });
    assert.strictEqual(same.status, 200, 'повтор того же ответа — не ошибка');
    assert.strictEqual((await same.json()).applied, false);
    const d = await (await get(base, alice.cookie)).json();
    assert.strictEqual(d.experiment.checkIns[START].afterEffect, 'better', 'ответ уцелел');
  });

  await t.test('🔴 значение вне словаря отклоняется, а не превращается в «не ответил»', async () => {
    const r = await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: '2026-09-03', seq: 4, revision,
      checkIn: { afterEffect: 'великолепно' },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).field, 'afterEffect');
    const d = await (await get(base, alice.cookie)).json();
    assert.strictEqual('2026-09-03' in d.experiment.checkIns, false, 'мусор не записан вовсе');
  });

  await t.test('неизвестная операция не исполняется', async () => {
    for (const op of ['delete', 'reset', '']) {
      assert.strictEqual((await post(base, alice.cookie, { op, id: 'e1' })).status, 400, op);
    }
  });

  await t.test('🔴 заметка чистится и на сервере', async () => {
    const r = await (await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: '2026-09-03', seq: 5, revision,
      checkIn: { afterEffect: 'same', note: 'залип на https://youtube.com/watch?v=abc до трёх' },
    })).json();
    revision = r.revision;
    const stored = fs.readFileSync(file, 'utf8');
    assert.strictEqual(stored.includes('youtube'), false, 'ссылка не попала на диск');
    assert.strictEqual(stored.includes('залип'), true, 'слова человека остались');
  });

  await t.test('🔴 остановка не удаляет ответы', async () => {
    const r = await (await post(base, alice.cookie, { op: 'stop', id: 'e1', seq: 6, revision })).json();
    revision = r.revision;
    const d = await (await get(base, alice.cookie)).json();
    assert.strictEqual(d.experiment.status, 'stopped');
    assert.strictEqual(Object.keys(d.experiment.checkIns).length, 2, 'история осталась');
  });

  await t.test('🔴 повреждённый файл — ошибка, а не пустые тридцать дней', async () => {
    const good = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, '{"version":1,"experiments":"нет"}');
    assert.strictEqual((await get(base, alice.cookie)).status, 422);
    const write = await post(base, alice.cookie, { op: 'open', id: 'e2', startedOn: START });
    assert.strictEqual(write.status, 422, 'запись поверх битого файла запрещена');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"version":1,"experiments":"нет"}', 'файл не перезаписан');
    fs.writeFileSync(file, good);
    assert.strictEqual((await get(base, alice.cookie)).status, 200);
  });

  await t.test('переросший payload отклоняется без записи', async () => {
    const before = fs.readFileSync(file, 'utf8');
    const r = await post(base, alice.cookie, {
      op: 'checkin', id: 'e1', day: START, seq: 99, checkIn: { note: 'я'.repeat(20000) },
    });
    assert.ok(r.status >= 400, `огромный payload принят: ${r.status}`);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'файл не тронут');
  });
});

test('🔴 в блоке эксперимента нет разрушительных и платёжных глаголов', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const from = src.indexOf("if (u === '/api/secretary/experiment') {");
  const to = src.indexOf("if (u === '/api/founder-pass'");
  const block = src.slice(from, to);
  assert.ok(block.length > 800, 'блок найден');
  for (const bad of ['unlinkSync', 'rmSync', 'deleteUser', 'charge', 'stripe', 'openai']) {
    assert.strictEqual(block.includes(bad), false, `не место этому в замере: «${bad}»`);
  }
  // Сводка не должна уметь начислять: honest замер и награда несовместимы.
  for (const bad of ['xp', 'gold', 'streak']) {
    assert.strictEqual(new RegExp('(?<![a-z])' + bad + '(?![a-z])').test(block.toLowerCase()), false, bad);
  }
});
