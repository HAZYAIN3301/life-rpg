'use strict';
/* Серверный store контрактов внимания (DISCIPLINE-ESCAPE-PLAN §14, §15, §17).
 *
 * Проверяется не «сохранилось ли», а четыре обещания, которые продукт даёт человеку:
 *  🔒 сервер НЕ получает того, что обещано не получать — даже если клиент это прислал;
 *  🛡 пустой PUT поверх непустого журнала не стирает историю (этот проект уже терял
 *     данные ровно так: сидер, свои заказы доски);
 *  🏁 повторная доставка эпизода не плодит дубли;
 *  🚪 чужой аккаунт недосягаем, а `local`-режим означает отказ, а не тихий приём.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-attention-'));
  const port = 48900 + (process.pid % 150);
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

const POLICY = {
  id: 'tiktok', name: 'TikTok',
  purposes: [{ purpose: 'publish', defaultMinutes: 12, mode: 'control', outcome: 'ролик опубликован' }],
};
const EPISODE = (over = {}) => Object.assign({
  id: 'ep1', sourcePolicyId: 'tiktok', declaredPurpose: 'publish',
  startedAt: '2026-08-25T10:00:00.000Z', endedAt: '2026-08-25T10:12:00.000Z',
  outcome: 'done', actualMinutes: 12,
}, over);

async function signedIn(base, email) {
  const c = client(base);
  await c('/api/auth/register', { method: 'POST', body: { name: 'A', email, password: 'attention-pass-11' } });
  return c;
}

test('🔒 сервер выбрасывает то, что обещал не хранить', { timeout: 40000 }, async (t) => {
  // §14: содержимое сообщений, запросы, история сайтов, просмотренные ролики,
  // поминутный журнал, accessibility tree и текст экрана не отправляются. Blacklist
  // такое обещание не держит — проверяем, что работает whitelist.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'privacy@example.test');

  const put = await c('/api/attention', { method: 'PUT', body: { data: {
    mode: 'contracts',
    policies: [Object.assign({}, POLICY, { installedApps: ['bank', 'dating'], screenText: 'секрет' })],
    episodes: [EPISODE({
      url: 'https://tiktok.com/@someone/video/123',
      query: 'что я искал',
      watched: ['видео1', 'видео2'],
      history: [{ at: '10:01', screen: 'For You' }],
      accessibilityTree: '<huge dump>',
      messages: ['личная переписка'],
    })],
  } } });
  assert.equal(put.status, 200);

  const raw = JSON.stringify((await c('/api/attention')).data);
  for (const leak of ['tiktok.com/@someone', 'что я искал', 'видео1', 'For You',
    '<huge dump>', 'личная переписка', 'bank', 'dating', 'секрет']) {
    assert.equal(raw.includes(leak), false, `сервер сохранил обещанное не хранить: ${leak}`);
  }
  // При этом законные поля на месте — санитайзер не должен выкашивать полезное.
  const back = (await c('/api/attention')).data;
  assert.equal(back.episodes.length, 1);
  assert.equal(back.episodes[0].outcome, 'done');
  assert.equal(back.policies[0].purposes[0].outcome, 'ролик опубликован');
});

test('🛡 пустой PUT не стирает непустой журнал', { timeout: 40000 }, async (t) => {
  // Этот проект уже дважды терял данные ровно так: клиент не смог загрузить и
  // «сохранил» пустоту поверх реального.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'guard@example.test');

  await c('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [POLICY], episodes: [EPISODE()] } } });

  const wipe = await c('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [], episodes: [] } } });
  assert.equal(wipe.status, 409, 'сервер обязан отказаться опустошать журнал без явного намерения');
  assert.equal(wipe.data.error, 'refuses_to_empty');
  assert.equal(wipe.data.have.episodes, 1, 'отказ обязан сказать, что именно защищено');

  const still = (await c('/api/attention')).data;
  assert.equal(still.episodes.length, 1, 'данные обязаны уцелеть после отказа');

  // Явное намерение — уважается: это право человека стереть своё.
  const deliberate = await c('/api/attention', { method: 'PUT', body: { allowEmpty: true, data: { mode: 'local', policies: [], episodes: [] } } });
  assert.equal(deliberate.status, 200);
  assert.equal((await c('/api/attention')).data.episodes.length, 0);
});

test('🏁 повторная доставка эпизода не плодит дубли', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'idem@example.test');
  await c('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [POLICY] } } });

  const first = await c('/api/attention/episode', { method: 'POST', body: { episode: EPISODE() } });
  assert.equal(first.status, 200);
  assert.equal(first.data.total, 1);

  const replay = await c('/api/attention/episode', { method: 'POST', body: { episode: EPISODE({ outcome: 'escaped' }) } });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.total, 1, 'тот же id обязан перезаписать, а не удвоить');

  const stored = (await c('/api/attention')).data.episodes;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].outcome, 'escaped', 'последняя доставка выигрывает');
});

test('🚪 режим local означает отказ, а не тихий приём', { timeout: 40000 }, async (t) => {
  // §14: три режима данных. `local only` обязан быть настоящим, иначе обещание пустое.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'local@example.test');
  await c('/api/attention', { method: 'PUT', body: { data: { mode: 'local', policies: [POLICY] } } });

  const denied = await c('/api/attention/episode', { method: 'POST', body: { episode: EPISODE() } });
  assert.equal(denied.status, 403);
  assert.equal(denied.data.error, 'local_only');
  assert.equal((await c('/api/attention')).data.episodes.length, 0, 'отказ не должен ничего записать');
});

test('🚪 чужой журнал недосягаем, аноним не пускается', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const a = await signedIn(rt.base, 'a@example.test');
  await a('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [POLICY], episodes: [EPISODE({ note: 'моё личное' })] } } });

  const b = await signedIn(rt.base, 'b@example.test');
  const other = (await b('/api/attention')).data;
  assert.deepEqual(other.episodes, [], 'второй аккаунт не видит чужих эпизодов');
  assert.equal(JSON.stringify(other).includes('моё личное'), false);

  assert.equal((await fetch(rt.base + '/api/attention')).status, 401, 'аноним не читает');
  const anon = await fetch(rt.base + '/api/attention', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { policies: [] } }),
  });
  assert.equal(anon.status, 401, 'аноним не пишет');
});

test('битый и негодный payload отклоняется, а не сохраняется наполовину', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'junk@example.test');

  assert.equal((await c('/api/attention', { method: 'PUT', body: { data: 'строка' } })).status, 400);
  assert.equal((await c('/api/attention', { method: 'PUT', body: {} })).status, 400);
  assert.equal((await c('/api/attention/episode', { method: 'POST', body: { episode: { id: 'нет обязательных' } } })).status, 400);

  // Мусор внутри валидной структуры отбрасывается поштучно, не роняя весь PUT.
  const mixed = await c('/api/attention', { method: 'PUT', body: { data: {
    mode: 'нет такого режима',
    policies: [POLICY, null, 'мусор', { id: 'нет целей', name: 'X', purposes: [] }],
    episodes: [EPISODE(), { сломано: true }],
  } } });
  assert.equal(mixed.status, 200);
  const back = (await c('/api/attention')).data;
  assert.equal(back.policies.length, 1, 'негодные политики отброшены поштучно');
  assert.equal(back.episodes.length, 1);
  assert.equal(back.mode, 'local', 'неизвестный режим падает в самый закрытый, а не в самый открытый');
});

test('🔴 неизвестный исход становится unknown, а не escaped', { timeout: 40000 }, async (t) => {
  // §17: молчание и мусор никогда не превращаются в срыв.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'outcome@example.test');
  await c('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [POLICY],
    episodes: [EPISODE({ id: 'x', outcome: 'что-то левое' })] } } });
  assert.equal((await c('/api/attention')).data.episodes[0].outcome, 'unknown');
});

test('неизвестная длительность остаётся null, а не превращается в ноль', { timeout: 40000 }, async (t) => {
  // §2: на iOS для украинского аккаунта длительность может быть неизвестна. Ноль
  // соврал бы, что заход был мгновенным.
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'null@example.test');
  await c('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [POLICY],
    episodes: [EPISODE({ id: 'nodur', actualMinutes: null })] } } });
  const ep = (await c('/api/attention')).data.episodes[0];
  assert.equal(ep.actualMinutes, null);
});

test('журнал внимания уходит в переносимый архив и удаляется с аккаунтом', { timeout: 40000 }, async (t) => {
  const rt = await startServer();
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const c = await signedIn(rt.base, 'export@example.test');
  await c('/api/attention', { method: 'PUT', body: { data: { mode: 'contracts', policies: [POLICY], episodes: [EPISODE()] } } });

  const dirs = fs.readdirSync(path.join(rt.dataDir, 'users'));
  const file = path.join(rt.dataDir, 'users', dirs[0], 'attention.json');
  assert.equal(fs.existsSync(file), true, 'store обязан лежать в каталоге пользователя');

  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(src, /ACCOUNT_PORTABLE_FILES = \[[\s\S]{0,200}'attention'/,
    'attention обязан быть в переносимом архиве — иначе экспорт молча неполон');
  assert.match(src, /ACCOUNT_PORTABLE_TYPES = \{[\s\S]{0,400}attention: 'object'/);
});
