'use strict';

/* Серверная память ассистента (AG-35).
 *
 * Обещание карточки — explainable, editable, portable — проверяется там, где оно
 * может сломаться по-настоящему: на диске и на границе аккаунта. Чужая память
 * недосягаема; правка одной записи не трогает профиль; повреждённый файл не
 * перезаписывается пустым; экспорт и удаление аккаунта видят память сами.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-02T10:00:00.000Z';

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-ai-memory-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  // Окно ожидания шире привычных 6 секунд: сервер читает несколько десятков
  // модулей, и на медленном или синхронизирующемся диске старт занимает больше.
  // Цикл всё равно выходит по первому успешному ответу, так что на здоровой
  // машине это ничего не стоит.
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
  const r = await c('/api/auth/register', { method: 'POST', body: { name: 'A', email, password: 'memory-pass-11' } });
  assert.equal(r.status, 200, `регистрация ${email}: ${JSON.stringify(r.data)}`);
  return { c, uid: r.data.id };
}

const entry = (over = {}) => Object.assign({
  id: 'm1',
  text: 'Работает лучше утром',
  category: 'pattern',
  scopes: ['assistant_prompt'],
  sourceType: 'explicit',
  sourceRef: 'settings_form',
  confidence: 1,
  sensitivity: 'normal',
  status: 'active',
  createdAt: T0,
  updatedAt: T0,
}, over);

// Кладём profile.json ровно так, как он лежит на диске у живого пользователя.
function writeProfile(dataDir, uid, value) {
  const dir = path.join(dataDir, 'users', uid);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), typeof value === 'string' ? value : JSON.stringify(value));
}
function readProfile(dataDir, uid) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'users', uid, 'profile.json'), 'utf8'));
}

const LEGACY_TEXT = '## Кто это\nАльберт, 11 класс.\n## Открытые нитки\nJuFo-регистрация';

test('🔴 чужая память недосягаема', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });

  const a = await signedIn(rt.base, 'a@example.test');
  const b = await signedIn(rt.base, 'b@example.test');
  writeProfile(rt.dataDir, a.uid, { text: 'профиль A', updatedAt: T0, auto: true, entries: [entry({ id: 'a1', text: 'секрет A' })] });
  writeProfile(rt.dataDir, b.uid, { text: 'профиль B', updatedAt: T0, auto: true, entries: [entry({ id: 'b1', text: 'секрет B' })] });

  const mine = await b.c('/api/ai/memory');
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.data.entries.map((e) => e.id), ['b1'], 'видна только своя память');
  assert.equal(JSON.stringify(mine.data).includes('секрет A'), false, 'чужой текст не утекает');
  assert.equal(mine.data.legacy.text, 'профиль B');

  // id чужой записи не даёт к ней доступа: у B такой записи просто нет.
  const stolen = await b.c('/api/ai/memory/a1', { method: 'DELETE' });
  assert.equal(stolen.status, 404, 'чужой id не находится, а не удаляется');
  assert.deepEqual(readProfile(rt.dataDir, a.uid).entries.map((e) => e.id), ['a1'], 'память A цела');

  const anon = client(rt.base);
  assert.equal((await anon('/api/ai/memory')).status, 401);
  assert.equal((await anon('/api/ai/memory/a1', { method: 'DELETE' })).status, 401);
  assert.equal((await anon('/api/ai/memory/export')).status, 401);
});

test('GET отдаёт объяснённые записи и старый профиль дословно', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'get@example.test');

  writeProfile(rt.dataDir, uid, {
    text: LEGACY_TEXT, updatedAt: T0, auto: true,
    entries: [
      entry({ id: 'e1', sourceType: 'explicit', sourceRef: 'settings_form' }),
      entry({ id: 'e2', sourceType: 'inferred', sourceRef: 'weekly_pattern_detector', confidence: 0.6, text: 'Часто переносит спорт' }),
    ],
  });

  const r = await c('/api/ai/memory');
  assert.equal(r.status, 200);
  assert.equal(r.data.legacy.text, LEGACY_TEXT, 'старый профиль дословный');
  assert.equal(r.data.legacy.source, 'profile-memory-v1');
  assert.equal(r.data.partial, false);

  const byId = Object.fromEntries(r.data.entries.map((e) => [e.id, e]));
  assert.ok(byId.e1.origin.includes('сказали это сами'), `origin: ${byId.e1.origin}`);
  assert.ok(byId.e1.origin.includes('settings_form'), 'источник назван поимённо');
  assert.ok(byId.e2.origin.includes('Посчитано программой'), `origin: ${byId.e2.origin}`);
  assert.ok(byId.e2.origin.includes('weekly_pattern_detector'));
  assert.equal(byId.e1.editable, true);
  assert.equal(byId.e1.deletable, true);
  // Явное стоит выше выведенного.
  assert.deepEqual(r.data.entries.map((e) => e.id), ['e1', 'e2']);
});

test('🔴 правка и удаление одной записи не трогают ни профиль, ни соседей, ни другие файлы', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'edit@example.test');

  const dir = path.join(rt.dataDir, 'users', uid);
  writeProfile(rt.dataDir, uid, {
    text: LEGACY_TEXT, updatedAt: T0, auto: false,
    entries: [entry({ id: 'a', text: 'первая' }), entry({ id: 'b', text: 'вторая' })],
  });
  fs.writeFileSync(path.join(dir, 'goals.json'), JSON.stringify([{ id: 'g1', title: 'JuFo' }]));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ lang: 'ru' }));
  const goalsBefore = fs.readFileSync(path.join(dir, 'goals.json'), 'utf8');
  const settingsBefore = fs.readFileSync(path.join(dir, 'settings.json'), 'utf8');

  const patched = await c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'update', patch: { text: 'поправлено' } } });
  assert.equal(patched.status, 200, JSON.stringify(patched.data));
  assert.equal(patched.data.entry.text, 'поправлено');
  // Человек поправил — значит сказал сам.
  assert.equal(patched.data.entry.sourceType, 'explicit');

  let onDisk = readProfile(rt.dataDir, uid);
  assert.equal(onDisk.text, LEGACY_TEXT, 'свободный текст профиля не тронут');
  assert.equal(onDisk.updatedAt, T0, 'его updatedAt не тронут');
  assert.equal(onDisk.auto, false, 'ручной профиль не стал автоматическим');
  assert.equal(onDisk.entries.find((e) => e.id === 'b').text, 'вторая', 'соседняя запись цела');
  assert.equal(fs.readFileSync(path.join(dir, 'goals.json'), 'utf8'), goalsBefore, 'цели не тронуты');
  assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), settingsBefore, 'настройки не тронуты');

  const deleted = await c('/api/ai/memory/a', { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  onDisk = readProfile(rt.dataDir, uid);
  assert.deepEqual(onDisk.entries.map((e) => e.id), ['b'], 'удалена ровно одна');
  assert.equal(onDisk.text, LEGACY_TEXT, 'удаление записи не трогает профиль');
  assert.equal(fs.readFileSync(path.join(dir, 'goals.json'), 'utf8'), goalsBefore);
});

test('🔴 убранная запись перестаёт работать, но остаётся видимой человеку', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'dismiss@example.test');
  writeProfile(rt.dataDir, uid, { text: '', entries: [entry({ id: 'a' })] });

  const off = await c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'dismiss' } });
  assert.equal(off.status, 200);
  assert.equal(off.data.entry.status, 'dismissed');
  assert.ok(off.data.entry.usage.includes('не попадает'), 'человек видит, что запись больше не работает');
  assert.equal(readProfile(rt.dataDir, uid).entries[0].status, 'dismissed');

  // Убранная запись не исчезает из списка: её можно вернуть.
  const listed = await c('/api/ai/memory');
  assert.deepEqual(listed.data.entries.map((e) => e.id), ['a']);

  const back = await c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'restore' } });
  assert.equal(back.data.entry.status, 'active');
});

test('🔴 повреждённый профиль не перезаписывается пустым', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'broken@example.test');

  const broken = '{ это не json';
  writeProfile(rt.dataDir, uid, broken);
  for (const call of [
    () => c('/api/ai/memory'),
    () => c('/api/ai/memory/export'),
    () => c('/api/ai/memory/a', { method: 'DELETE' }),
    () => c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'dismiss' } }),
  ]) {
    const r = await call();
    assert.equal(r.status, 422, `повреждённый файл — ошибка, а не пустая память: ${JSON.stringify(r.data)}`);
    assert.equal(r.data.error, 'invalid_memory_state');
  }
  assert.equal(fs.readFileSync(path.join(rt.dataDir, 'users', uid, 'profile.json'), 'utf8'), broken, 'файл не тронут');

  // Частично нечитаемый файл: уцелевшее видно, но писать нельзя.
  writeProfile(rt.dataDir, uid, { text: 'жив', entries: [entry({ id: 'ok' }), { id: 'сломано' }, null] });
  const partial = await c('/api/ai/memory');
  assert.equal(partial.status, 200);
  assert.deepEqual(partial.data.entries.map((e) => e.id), ['ok'], 'уцелевшая запись показана');
  assert.equal(partial.data.partial, true, 'сервер признаёт, что память неполная');

  const refused = await c('/api/ai/memory/ok', { method: 'DELETE' });
  assert.equal(refused.status, 422);
  assert.equal(refused.data.error, 'store_not_writable');
  assert.equal(readProfile(rt.dataDir, uid).entries.length, 3, 'непрочитанное на месте');
});

test('🔴 sensitive из вывода не отдаётся и не переживает чтение', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'sensitive@example.test');

  // Такую пару мог записать только сломанный или враждебный клиент в обход политики.
  writeProfile(rt.dataDir, uid, {
    text: '', entries: [
      entry({ id: 'guess', sourceType: 'inferred', sensitivity: 'sensitive', text: 'Похоже, у него депрессия' }),
      entry({ id: 'said', sourceType: 'explicit', sensitivity: 'sensitive', text: 'Сейчас тяжёлый период' }),
    ],
  });

  const r = await c('/api/ai/memory');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.entries.map((e) => e.id), ['said'], 'выведенное чувствительное не отдаётся');
  assert.equal(JSON.stringify(r.data).includes('депрессия'), false, 'догадка о человеке никуда не уходит');
  assert.equal(r.data.partial, true, 'и файл честно помечен неполным');

  // Пока такая запись в файле, писать поверх нельзя — иначе она молча исчезнет.
  const refused = await c('/api/ai/memory/said', { method: 'DELETE' });
  assert.equal(refused.status, 422);
  assert.equal(refused.data.error, 'store_not_writable');
});

test('PATCH проверяет операцию, поля и id', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'guard@example.test');
  writeProfile(rt.dataDir, uid, { text: '', entries: [entry({ id: 'a' })] });

  assert.equal((await c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'создать' } })).status, 400);
  assert.equal((await c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'update', patch: { sourceType: 'explicit' } } })).status, 400);
  assert.equal((await c('/api/ai/memory/нет', { method: 'PATCH', body: { op: 'dismiss' } })).status, 404);
  assert.equal((await c('/api/ai/memory/a', { method: 'POST', body: {} })).status, 405);
  assert.equal((await c('/api/ai/memory', { method: 'DELETE' })).status, 405);

  // actor из тела не даёт клиенту права писать выводом: правка всё равно explicit.
  const spoof = await c('/api/ai/memory/a', { method: 'PATCH', body: { op: 'update', actor: 'system', patch: { text: 'иначе' } } });
  assert.equal(spoof.status, 200);
  assert.equal(spoof.data.entry.sourceType, 'explicit');
  assert.equal(spoof.data.entry.sourceRef, 'user_edit');
});

test('🔴 экспорт памяти читается обратно, а экспорт аккаунта её содержит', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'export@example.test');
  const policy = require('../public/ai-memory-policy-v1.js');

  writeProfile(rt.dataDir, uid, {
    text: LEGACY_TEXT, updatedAt: T0, auto: true,
    entries: [entry({ id: 'a' }), entry({ id: 'b', sourceType: 'inferred', confidence: 0.6, text: 'второе', status: 'dismissed' })],
  });

  const archive = await c('/api/ai/memory/export');
  assert.equal(archive.status, 200);
  assert.equal(archive.data.format, 'satoru-ai-memory');
  assert.equal(archive.data.counts.total, 2);
  assert.equal(archive.data.counts.dismissed, 1, 'убранное тоже уезжает: человек должен видеть и его');
  assert.equal(archive.data.legacy.text, LEGACY_TEXT);

  const restored = policy.normalizeMemoryStore(archive.data);
  assert.equal(restored.damaged, false);
  assert.equal(restored.dropped, 0);
  assert.deepEqual(restored.entries.map((e) => e.id).sort(), ['a', 'b'], 'архив читается обратно без потерь');
  assert.equal(restored.legacy.text, LEGACY_TEXT);

  // Общий экспорт аккаунта подхватывает память сам: отдельной проводки не нужно.
  const account = await c('/api/account/export');
  assert.equal(account.status, 200);
  assert.ok(account.data.data.profile, 'profile входит в переносимые файлы');
  assert.deepEqual(account.data.data.profile.entries.map((e) => e.id).sort(), ['a', 'b'], 'память едет с аккаунтом');
  assert.equal(account.data.data.profile.text, LEGACY_TEXT);
});

test('🔴 удаление аккаунта уносит память', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'erase@example.test');
  writeProfile(rt.dataDir, uid, { text: 'профиль', entries: [entry({ id: 'a', text: 'личное наблюдение' })] });
  const file = path.join(rt.dataDir, 'users', uid, 'profile.json');
  assert.equal(fs.existsSync(file), true);

  const gone = await c('/api/auth/delete-account', { method: 'POST', body: { password: 'memory-pass-11', confirm: 'DELETE' } });
  assert.equal(gone.status, 200, JSON.stringify(gone.data));
  assert.equal(fs.existsSync(file), false, 'файл памяти удалён вместе с аккаунтом');

  // И на всякий случай: нигде в data-каталоге не осталось текста записи.
  const leftovers = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (fs.readFileSync(full, 'utf8').includes('личное наблюдение')) leftovers.push(full);
    }
  };
  walk(rt.dataDir);
  assert.deepEqual(leftovers, [], 'память не осталась в резервных копиях');
});

test('пользователь без profile.json получает пустую, но валидную память', { timeout: 180000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c } = await signedIn(rt.base, 'fresh@example.test');

  const r = await c('/api/ai/memory');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.entries, []);
  assert.equal(r.data.legacy.text, '');
  assert.equal(r.data.partial, false, 'отсутствие файла — это не поломка');

  const archive = await c('/api/ai/memory/export');
  assert.equal(archive.status, 200);
  assert.equal(archive.data.counts.total, 0);
});

test('🔴 общий путь записи профиля не пускает память мимо политики', { timeout: 180000 }, async (t) => {
  // Вторая дверь в тот же файл: /api/data/profile пишет profile.json напрямую и про
  // политику памяти не знает. Без замка через неё заезжает то, что потом нельзя
  // прочитать, — и файл из-за этого закрывается на запись целиком, унося с собой
  // доступ человека к его нормальным записям.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'backdoor@example.test');

  // Старый профиль без записей проходит нетронутым — ровно как сегодня из app.js.
  const legacy = await c('/api/data/profile', { method: 'PUT', body: { text: LEGACY_TEXT, updatedAt: T0, auto: true } });
  assert.equal(legacy.status, 200);
  assert.equal(readProfile(rt.dataDir, uid).text, LEGACY_TEXT);

  // Валидные записи проходят.
  const good = await c('/api/data/profile', {
    method: 'PUT',
    body: { text: LEGACY_TEXT, updatedAt: T0, auto: true, entries: [entry({ id: 'ok' })] },
  });
  assert.equal(good.status, 200, JSON.stringify(good.data));
  assert.deepEqual(readProfile(rt.dataDir, uid).entries.map((e) => e.id), ['ok']);

  // А вот это — нет. Каждый случай политика прочитать не может, значит записи не будет.
  const rejected = [
    ['чувствительное из догадки', [entry({ id: 'guess', sourceType: 'inferred', sensitivity: 'sensitive', text: 'Похоже, депрессия' })]],
    ['битая запись', [entry({ id: 'ok2' }), { id: 'сломано' }]],
    ['не массив', 'записи'],
    ['мусор внутри', [null, 'строка']],
    ['дубль id', [entry({ id: 'dup' }), entry({ id: 'dup', text: 'другое' })]],
  ];
  for (const [why, entries] of rejected) {
    const r = await c('/api/data/profile', { method: 'PUT', body: { text: LEGACY_TEXT, entries } });
    assert.equal(r.status, 400, `${why}: должно быть отклонено`);
    assert.equal(r.data.error, 'invalid_memory_entries', why);
  }

  // Файл после всех попыток остался тем, что записали законно.
  const onDisk = readProfile(rt.dataDir, uid);
  assert.deepEqual(onDisk.entries.map((e) => e.id), ['ok'], 'ни одна отклонённая запись не осела');
  assert.equal(onDisk.text, LEGACY_TEXT);
  assert.equal(JSON.stringify(onDisk).includes('депрессия'), false);

  // И память по-прежнему живая: файл не закрылся на запись.
  const state = await c('/api/ai/memory');
  assert.equal(state.status, 200);
  assert.equal(state.data.partial, false, 'файл читается полностью');
  assert.equal((await c('/api/ai/memory/ok', { method: 'DELETE' })).status, 200, 'человек управляет своими записями');
});

test('🔴 карточка профиля сохраняется поверх памяти, не теряя её', { timeout: 180000 }, async (t) => {
  // Так пишет app.js: { ...prof, text, updatedAt, auto }. Спред обязан пронести
  // entries насквозь — иначе сохранение текста профиля стирало бы память.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const { c, uid } = await signedIn(rt.base, 'spread@example.test');
  writeProfile(rt.dataDir, uid, { text: 'старый текст', updatedAt: T0, auto: true, entries: [entry({ id: 'a' })] });

  const loaded = (await c('/api/data/profile')).data;
  assert.deepEqual(loaded.entries.map((e) => e.id), ['a']);

  const next = Object.assign({}, loaded, { text: 'новый текст', updatedAt: T1, auto: false });
  assert.equal((await c('/api/data/profile', { method: 'PUT', body: next })).status, 200);

  const onDisk = readProfile(rt.dataDir, uid);
  assert.equal(onDisk.text, 'новый текст', 'текст обновился');
  assert.deepEqual(onDisk.entries.map((e) => e.id), ['a'], 'память пережила сохранение карточки');
});
