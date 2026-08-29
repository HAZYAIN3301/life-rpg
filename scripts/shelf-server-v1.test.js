'use strict';
/* Серверный store Полки возвращения (DISCIPLINE-ESCAPE-PLAN §13).
 *
 * Специфичное для Полки обещание, которого нет у других хранилищ: **чужое медиа сюда
 * не заливается**. Разрешены ссылка, preview и своя заметка — и только. Поэтому
 * `data:`-URI отбрасывается не как «неподдерживаемый формат», а как попытка положить
 * на сервер чужой файл без правового основания.
 *
 * Остальное — те же четыре обещания, что у контрактов внимания: whitelist, write
 * guard против тихой потери, идемпотентность, недосягаемость чужого.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-shelf-'));
  const port = 49100 + (process.pid % 150);
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

const ENERGY = (over = {}) => Object.assign({
  id: 'e1', kind: 'energy', title: 'Эдит про горы', why: 'поднимает перед тренировкой',
}, over);
const PRACTICAL = (over = {}) => Object.assign({
  id: 'p1', kind: 'practical', title: 'Гайд по монтажу', why: 'переходы',
  expect: 'склейка под бит',
}, over);

async function signedIn(base, email) {
  const c = client(base);
  await c('/api/auth/register', { method: 'POST', body: { name: 'A', email, password: 'shelf-pass-11' } });
  return c;
}

test('🔴 чужое медиа не попадает на сервер', { timeout: 40000 }, async (t) => {
  // §13: хранится ссылка, preview и своя заметка. Не файл.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'media@example.test');

  await c('/api/shelf', { method: 'PUT', body: { data: { items: [
    ENERGY({ id: 'a', url: 'data:video/mp4;base64,AAAAIGZ0eXBpc29t' }),
    ENERGY({ id: 'b', url: 'javascript:alert(1)' }),
    ENERGY({ id: 'c', url: 'https://youtube.com/watch?v=ok' }),
    ENERGY({ id: 'd', url: 'https://ok.test', videoBlob: 'AAAAIGZ0eXBpc29t', audioData: 'x'.repeat(500) }),
  ] } } });

  const items = (await c('/api/shelf')).data.items;
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.a.url, undefined, 'data:-URI обязан быть отброшен');
  assert.equal(byId.b.url, undefined, 'javascript: обязан быть отброшен');
  assert.equal(byId.c.url, 'https://youtube.com/watch?v=ok', 'обычная ссылка обязана уцелеть');
  assert.equal('videoBlob' in byId.d, false, 'бинарь не имеет права сохраниться');
  assert.equal('audioData' in byId.d, false);
});

test('🔴 практический без ожидаемого вывода не принимается сервером', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'expect@example.test');
  const bad = PRACTICAL(); delete bad.expect;
  assert.equal((await c('/api/shelf/item', { method: 'POST', body: { item: bad } })).status, 400);
  assert.equal((await c('/api/shelf/item', { method: 'POST', body: { item: PRACTICAL() } })).status, 200);
});

test('🔴 материал без «что я отсюда беру» не принимается', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'why@example.test');
  const bad = ENERGY(); delete bad.why;
  assert.equal((await c('/api/shelf/item', { method: 'POST', body: { item: bad } })).status, 400);
});

test('🛡 пустой PUT не стирает непустую Полку', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'guard@example.test');
  await c('/api/shelf', { method: 'PUT', body: { data: { items: [ENERGY()] } } });

  const wipe = await c('/api/shelf', { method: 'PUT', body: { data: { items: [] } } });
  assert.equal(wipe.status, 409);
  assert.equal(wipe.data.have, 1);
  assert.equal((await c('/api/shelf')).data.items.length, 1, 'материал обязан уцелеть');

  const deliberate = await c('/api/shelf', { method: 'PUT', body: { allowEmpty: true, data: { items: [] } } });
  assert.equal(deliberate.status, 200, 'явное намерение стереть своё — право человека');
});

test('🏁 повторное сохранение того же материала не плодит дубли', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'idem@example.test');
  const first = await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY() } });
  assert.equal(first.data.count, 1);
  const again = await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY({ why: 'уточнил зачем' }) } });
  assert.equal(again.data.count, 1, 'тот же id обязан перезаписать, а не удвоить');
  assert.equal((await c('/api/shelf')).data.items[0].why, 'уточнил зачем');
});

test('🔴 переполнение — честный отказ, а не тихое вытеснение', { timeout: 40000 }, async (t) => {
  // Молча выбросить чужой сохранённый материал хуже, чем сказать «убери лишнее».
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'full@example.test');
  const items = Array.from({ length: 40 }, (_, i) => ENERGY({ id: 'x' + i }));
  await c('/api/shelf', { method: 'PUT', body: { data: { items } } });

  const over = await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY({ id: 'ещё' }) } });
  assert.equal(over.status, 409);
  assert.equal(over.data.error, 'shelf_full');
  assert.equal((await c('/api/shelf')).data.items.length, 40, 'ничего не должно было вытесниться');
});

test('🔴 архивировать один из 40 → добавить новый → GET остаётся валидным', { timeout: 40000 }, async (t) => {
  // Регрессия старого общего лимита: сервер сохранял 41 строку, а sanitizer читал
  // только 40 и объявлял собственный файл повреждённым. Активный лимит и история
  // обязаны быть независимы.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'archive-add-get@example.test');
  const initial = Array.from({ length: 40 }, (_, i) => ENERGY({ id: `slot-${i}`, format: 'edit' }));
  assert.equal((await c('/api/shelf', { method: 'PUT', body: { data: { version: 1, items: initial } } })).status, 200);

  const archived = initial.map((item, index) => (index === 0 ? { ...item, archivedOn: '2026-08-29' } : item));
  assert.equal((await c('/api/shelf', { method: 'PUT', body: { data: { version: 1, items: archived } } })).status, 200);

  const add = await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY({
    id: 'replacement', format: 'video', catalogId: 'blender-spring',
    attribution: 'Blender Foundation', rightsKind: 'cc-by-4.0', interestIds: ['animation', 'creative'],
  }) } });
  assert.equal(add.status, 200);
  assert.equal(add.data.count, 41);

  const loaded = await c('/api/shelf');
  assert.equal(loaded.status, 200, 'сервер обязан прочитать только что записанный им файл');
  assert.equal(loaded.data.items.length, 41);
  assert.equal(loaded.data.items.filter((item) => !item.archivedOn).length, 40);
  assert.equal(loaded.data.items.filter((item) => item.archivedOn).length, 1);
  assert.deepEqual(loaded.data.items.find((item) => item.id === 'replacement').interestIds, ['animation', 'creative']);

  const boundedHistory = Array.from({ length: 160 }, (_, i) => ENERGY({ id: `history-${i}`, archivedOn: '2026-08-29' }));
  assert.equal((await c('/api/shelf', { method: 'PUT', body: { data: { version: 1, items: boundedHistory } } })).status, 200);
  const beyondHistory = await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY({ id: 'history-160' }) } });
  assert.equal(beyondHistory.status, 409);
  assert.equal(beyondHistory.data.error, 'shelf_history_full');
  assert.equal((await c('/api/shelf')).data.items.length, 160);
});

test('🔴 восстановление архивного материала не может создать 41 active', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'restore-cap@example.test');
  const active = Array.from({ length: 40 }, (_, i) => ENERGY({ id: `active-${i}` }));
  const archived = ENERGY({ id: 'archived-catalog', catalogId: 'blender-spring', archivedOn: '2026-08-28' });
  assert.equal((await c('/api/shelf', {
    method: 'PUT', body: { data: { version: 1, items: active.concat(archived) } },
  })).status, 200);

  const restored = active.concat([{ ...archived, archivedOn: undefined }]);
  const rejected = await c('/api/shelf', {
    method: 'PUT', body: { data: { version: 1, items: restored } },
  });
  assert.equal(rejected.status, 409, 'full PUT обязан держать тот же active limit, что POST');
  assert.equal(rejected.data.error, 'shelf_full');

  const unchanged = await c('/api/shelf');
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.data.items.filter((item) => !item.archivedOn).length, 40);
  assert.equal(unchanged.data.items.filter((item) => item.archivedOn).length, 1,
    'отклонённое восстановление не должно перезаписать архив');
});

test('🚪 чужая Полка недосягаема, аноним не пускается', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const a = await signedIn(rt.base, 'a@example.test');
  await a('/api/shelf', { method: 'PUT', body: { data: { items: [ENERGY({ note: 'моё личное' })] } } });

  const b = await signedIn(rt.base, 'b@example.test');
  const other = (await b('/api/shelf')).data;
  assert.deepEqual(other.items, []);
  assert.equal(JSON.stringify(other).includes('моё личное'), false);

  assert.equal((await fetch(rt.base + '/api/shelf')).status, 401);
});

test('мусор внутри валидной структуры отбрасывается поштучно', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'junk@example.test');
  const mixed = await c('/api/shelf', { method: 'PUT', body: { data: { items: [
    ENERGY(), null, 'мусор', { id: 'нет вида', title: 'X', why: 'Y' }, ENERGY({ id: 'e1' }),
  ] } } });
  assert.equal(mixed.status, 200);
  const items = (await c('/api/shelf')).data.items;
  assert.equal(items.length, 1, 'негодное и дубли отброшены, валидное сохранено');
  assert.equal((await c('/api/shelf', { method: 'PUT', body: { data: 'строка' } })).status, 400);
});

test('🔴 повреждённый shelf.json не становится пустой Полкой и блокирует запись до восстановления', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'broken@example.test');
  await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY() } });
  const dirs = fs.readdirSync(path.join(rt.dataDir, 'users'));
  const file = path.join(rt.dataDir, 'users', dirs[0], 'shelf.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, items: [{}] }));
  const structural = await c('/api/shelf');
  assert.equal(structural.status, 422, 'структурно битый JSON тоже не является пустой Полкой');
  assert.equal(structural.data.error, 'invalid_shelf');
  assert.equal((await c('/api/shelf', { method: 'PUT', body: { data: { version: 1, items: [] }, allowEmpty: true } })).status, 409);
  assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify({ version: 1, items: [{}] }));
  fs.writeFileSync(file, '{broken json');
  const load = await c('/api/shelf');
  assert.equal(load.status, 422);
  assert.equal(load.data.error, 'invalid_shelf');
  const put = await c('/api/shelf', { method: 'PUT', body: { data: { version: 1, items: [] }, allowEmpty: true } });
  assert.equal(put.status, 409, 'даже allowEmpty не должен перезаписывать повреждённый источник');
  assert.equal(put.data.error, 'shelf_unavailable');
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken json');
});

test('🔴 сервер не принимает начисления за материал', { timeout: 40000 }, async (t) => {
  // §13: просмотр не даёт XP и золота. Клиент может прислать что угодно — сервер
  // не имеет права это сохранить, иначе обещание держится вежливостью клиента.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'reward@example.test');
  await c('/api/shelf/item', { method: 'POST', body: { item: ENERGY({ xp: 50, gold: 20, likes: 999, views: 12345 }) } });
  const item = (await c('/api/shelf')).data.items[0];
  for (const leak of ['xp', 'gold', 'likes', 'views']) {
    assert.equal(leak in item, false, `в материал просочилось «${leak}»`);
  }
});

test('Полка уходит в переносимый архив и удаляется с аккаунтом', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'export@example.test');
  await c('/api/shelf', { method: 'PUT', body: { data: { items: [ENERGY()] } } });

  const dirs = fs.readdirSync(path.join(rt.dataDir, 'users'));
  assert.equal(fs.existsSync(path.join(rt.dataDir, 'users', dirs[0], 'shelf.json')), true);

  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(src, /ACCOUNT_PORTABLE_FILES = \[[\s\S]{0,240}'shelf'/,
    'shelf обязан быть в переносимом архиве — иначе экспорт молча неполон');
  assert.match(src, /ACCOUNT_PORTABLE_TYPES = \{[\s\S]{0,460}shelf: 'object'/);
});
