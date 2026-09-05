'use strict';

/* Серверное согласие на телеметрию (AG-51 / AG-53 / AG-54).
 *
 * На диске проверяется то, чего не видно в чистом модуле: что без согласия сбор
 * действительно не происходит, что необходимое не даёт права на остальное, что
 * отказ не ломает приложение, что чужое согласие недосягаемо, и что разделение
 * целей видно в самих данных, а не только в коде.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-telemetry-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  // Окно шире привычных 6 секунд: на медленном диске старт занимает больше, а
  // цикл всё равно выходит по первому успешному ответу.
  for (let i = 0; i < 2400; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((r) => setTimeout(r, 50));
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

async function signedIn(base, email) {
  const c = client(base);
  const r = await c('/api/auth/register', { method: 'POST', body: { name: 'A', email, password: 'telemetry-pass-11' } });
  assert.equal(r.status, 200, `регистрация ${email}: ${JSON.stringify(r.data)}`);
  return { c, uid: r.data.id };
}

function analytics(dataDir) {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'analytics.json'), 'utf8')); } catch { return {}; }
}
const today = () => new Date().toISOString().slice(0, 10);

test('🔴 старый track() продолжает работать, разрез по целям виден в данных', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'default@example.test');

  // Ровно то, что сегодня шлёт track() из app.js: имя события и больше ничего.
  const legacy = await c('/api/analytics', { method: 'POST', body: { event: 'view:today' } });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.data.recorded, true, 'умолчание — сбор идёт');
  // Немаркированное событие не считается служебным: оно про полезность, и у него
  // свой выключатель и свой срок хранения.
  assert.equal(legacy.data.purpose, 'product_improvement');
  assert.equal(legacy.data.retentionDays, 180);

  await c('/api/analytics', { method: 'POST', body: { event: 'save:failed', purpose: 'service_operation' } });
  await c('/api/analytics', { method: 'POST', body: { event: 'streak:seen', purpose: 'engagement_optimization' } });

  const stored = analytics(rt.dataDir)[today()];
  assert.equal(stored.events['view:today'], 1);
  assert.equal(stored.events['save:failed'], 1);
  // AG-53/54 в самих данных: вовлечение отделимо от пользы и от служебного.
  assert.deepEqual(stored.purposes, { product_improvement: 1, service_operation: 1, engagement_optimization: 1 });
});

test('🔴 эксперименты по умолчанию выключены', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'experiments@example.test');

  const state = await c('/api/telemetry/consent');
  assert.equal(state.status, 200);
  // Сбор — одно, опыт на человеке — другое. Умолчания у них разные (AG-51).
  assert.equal(state.data.consent.purposes.product_improvement, true);
  assert.equal(state.data.consent.purposes.experimentation, false);
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'x', purpose: 'experimentation' } })).data.recorded, false);

  const on = await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { experimentation: true } } });
  assert.equal(on.status, 200);
  assert.deepEqual(on.data.changed, ['experimentation']);
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'x', purpose: 'experimentation' } })).data.recorded, true);
});

test('🔴 выключатель работает и выключает ровно одну цель', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'switch@example.test');

  const off = await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { engagement_optimization: false } } });
  assert.equal(off.status, 200);
  assert.deepEqual(off.data.changed, ['engagement_optimization']);
  assert.equal(off.data.consent.purposes.engagement_optimization, false);
  assert.equal(off.data.consent.purposes.product_improvement, true, 'польза не выключилась заодно');

  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'a', purpose: 'engagement_optimization' } })).data.recorded, false);
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'b', purpose: 'product_improvement' } })).data.recorded, true);

  const stored = analytics(rt.dataDir)[today()];
  assert.equal(stored.events.a, undefined, 'после выключения не записалось ничего');
  assert.equal(stored.events.b, 1);

  // Решение датировано и записано в обе стороны, когда человек его вернёт.
  await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { engagement_optimization: true } } });
  const onDisk = JSON.parse(fs.readFileSync(path.join(rt.dataDir, 'users', uid, 'telemetry-consent.json'), 'utf8'));
  assert.equal(onDisk.history.length, 2);
  assert.deepEqual(onDisk.history.map((h) => h.granted), [false, true]);
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'c', purpose: 'engagement_optimization' } })).data.recorded, true);
});

test('🔴 необходимое нельзя выключить, но оно и не даёт права на остальное', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'essential@example.test');

  const state = await c('/api/telemetry/consent');
  assert.deepEqual(state.data.essential, ['service_operation'], 'необходима ровно одна цель');
  assert.ok(state.data.human.includes('включено по умолчанию — можно выключить'), 'человек видит, что это можно выключить');

  const forced = await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { service_operation: false } } });
  assert.equal(forced.status, 400);
  assert.equal(forced.data.error, 'essential_not_a_choice:service_operation');

  // Человек выключил всё, что мог. Служебное осталось — и ничего сверх себя не открыло.
  const allOff = await c('/api/telemetry/consent', {
    method: 'PUT',
    body: { source: 'settings', purposes: { safety: false, product_improvement: false, personalization: false, engagement_optimization: false } },
  });
  assert.equal(allOff.data.consent.purposes.service_operation, true);
  for (const purpose of ['safety', 'product_improvement', 'personalization', 'engagement_optimization', 'experimentation']) {
    const r = await c('/api/analytics', { method: 'POST', body: { event: 'e', purpose } });
    assert.equal(r.data.recorded, false, `${purpose} должен быть выключен`);
    assert.equal(r.data.reason, 'consent_missing');
  }
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'save:failed', purpose: 'service_operation' } })).data.recorded, true);
});

test('🔴 свободный текст не попадает в телеметрию', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'props@example.test');

  const leaked = await c('/api/analytics', {
    method: 'POST',
    body: { event: 'quest:completed', purpose: 'product_improvement', props: { title: 'Позвонить маме про анализы' } },
  });
  assert.equal(leaked.data.recorded, false);
  assert.equal(leaked.data.reason, 'free_text_not_allowed');

  const ok = await c('/api/analytics', {
    method: 'POST',
    body: { event: 'quest:completed', purpose: 'product_improvement', props: { minutes: 12, wasFirst: true } },
  });
  assert.equal(ok.data.recorded, true);

  // Ни в одном файле каталога данных нет содержимого жизни человека.
  const leftovers = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (fs.readFileSync(full, 'utf8').includes('маме')) leftovers.push(full);
    }
  };
  walk(rt.dataDir);
  assert.deepEqual(leftovers, [], 'текст задачи не осел ни в аналитике, ни в логах');
});

test('🔴 чужое решение недосягаемо', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const a = await signedIn(rt.base, 'own-a@example.test');
  const b = await signedIn(rt.base, 'own-b@example.test');

  await a.c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { engagement_optimization: false } } });
  const mine = await b.c('/api/telemetry/consent');
  assert.equal(mine.data.consent.purposes.engagement_optimization, true, 'решение соседа ничего не меняет у меня');
  assert.equal((await b.c('/api/analytics', { method: 'POST', body: { event: 'x', purpose: 'engagement_optimization' } })).data.recorded, true);
  assert.equal((await a.c('/api/analytics', { method: 'POST', body: { event: 'x', purpose: 'engagement_optimization' } })).data.recorded, false);

  const anon = client(rt.base);
  assert.equal((await anon('/api/telemetry/consent')).status, 401);
  assert.equal((await anon('/api/telemetry/consent', { method: 'PUT', body: { purposes: { safety: false } } })).status, 401);
  assert.equal((await anon('/api/analytics', { method: 'POST', body: { event: 'x' } })).status, 401);
});

test('🔴 порча файла не воскрешает выключенный сбор', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'broken@example.test');
  const file = path.join(rt.dataDir, 'users', uid, 'telemetry-consent.json');

  await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { personalization: false } } });
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Поле с целями испортилось, история цела: отзыв не забыт. При opt-out это
  // единственное, что мешает «починке умолчанием» молча вернуть сбор.
  fs.writeFileSync(file, JSON.stringify({ purposes: { personalization: 'да' }, history: saved.history }));
  const partial = await c('/api/telemetry/consent');
  assert.equal(partial.data.consent.purposes.personalization, false, 'отзыв пережил порчу');
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: 'x', purpose: 'personalization' } })).data.recorded, false);

  // Полностью нечитаемый файл — честно возвращаемся к умолчанию, а не к пустоте.
  fs.writeFileSync(file, '{ это не json');
  const reset = await c('/api/telemetry/consent');
  assert.equal(reset.status, 200);
  assert.equal(reset.data.consent.purposes.personalization, true);
  assert.equal(reset.data.consent.purposes.experimentation, false, 'но опыты всё равно не включаются сами');
});

test('PUT проверяет решение и не принимает выдуманных целей', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'guard@example.test');

  assert.equal((await c('/api/telemetry/consent', { method: 'PUT', body: { purposes: { нет_такой: true } } })).status, 400);
  assert.equal((await c('/api/telemetry/consent', { method: 'PUT', body: { purposes: { safety: 'да' } } })).status, 400);
  assert.equal((await c('/api/telemetry/consent', { method: 'PUT', body: {} })).status, 400);
  assert.equal((await c('/api/telemetry/consent', { method: 'POST', body: {} })).status, 405);
  assert.equal((await c('/api/analytics', { method: 'POST', body: { event: '' } })).status, 400);

  // Источник 'import' подписать решение не может: согласие принимают, а не восстанавливают.
  // Сервер отвергает запрос целиком — иначе журнал выглядел бы как осознанное
  // решение в настройках, хотя человек его там не принимал.
  const imported = await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'import', purposes: { safety: false } } });
  assert.equal(imported.status, 400);
  assert.equal(imported.data.error, 'invalid_consent_source');
});

test('🔴 удаление аккаунта уносит решение', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'erase@example.test');
  await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { safety: false } } });
  const file = path.join(rt.dataDir, 'users', uid, 'telemetry-consent.json');
  assert.equal(fs.existsSync(file), true);

  const gone = await c('/api/auth/delete-account', { method: 'POST', body: { password: 'telemetry-pass-11', confirm: 'DELETE' } });
  assert.equal(gone.status, 200, JSON.stringify(gone.data));
  assert.equal(fs.existsSync(file), false);
});

test('решение не входит в переносимый архив аккаунта', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'archive@example.test');
  await c('/api/telemetry/consent', { method: 'PUT', body: { source: 'settings', purposes: { engagement_optimization: false } } });

  // Осознанный выбор: список ACCOUNT_PORTABLE_FILES управляет и экспортом, и
  // импортом. Импорт архива не имеет права заново включить сбор, который человек
  // выключил, поэтому решение читается только своим GET-ом.
  const archive = await c('/api/account/export');
  assert.equal(archive.status, 200);
  assert.equal(archive.data.data['telemetry-consent'], undefined);
  assert.equal(JSON.stringify(archive.data).includes('engagement_optimization'), false);

  const own = await c('/api/telemetry/consent');
  assert.equal(own.data.consent.purposes.engagement_optimization, false, 'но своё решение человек видит целиком');
  assert.ok(own.data.human.includes('Оптимизация вовлечения'));
});
