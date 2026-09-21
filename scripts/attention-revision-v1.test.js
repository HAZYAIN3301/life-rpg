'use strict';
/* Exact-CAS журнала внимания.
 *
 * Основание — воспроизведённая потеря 14.09: два клиента, прочитавшие одно
 * состояние, сохраняли каждый своё, и запись второго молча стирала правило
 * первого. Оба запроса отвечали 200. Существовавший забор ловил только полное
 * обнуление непустого журнала, но не потерю отдельного правила.
 *
 * Проверяется:
 *  💥 тот самый сценарий теперь отказывает, а не теряет;
 *  🤝 клиент, перечитавший состояние, записывает спокойно;
 *  🕰 клиент прошлой сборки, который базы не шлёт, продолжает работать;
 *  🧮 метка одинакова при любом порядке ключей и не зависит от режима хранения;
 *  🔇 отказ не притворяется успехом.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RevisionV1 = require('../public/attention-revision-v1.js');

const ROOT = path.resolve(__dirname, '..');

const POLICY = (id, name) => ({
  id, name,
  purposes: [{ purpose: 'publish', enabled: true, defaultMinutes: 12, maxMinutes: 12, mode: 'control', extensions: 1, extensionMinutes: 5 }],
  emergency: { passes: 1, perDays: 7, delaySeconds: 90 }, modes: [], sync: false,
});
const envelope = (policies) => ({ version: 1, mode: 'contracts', policies, sessions: [], episodes: [] });

// ============================================================
//  Метка
// ============================================================

test('метка не зависит от порядка ключей', () => {
  const a = { version: 1, mode: 'contracts', policies: [POLICY('tiktok', 'TikTok')], sessions: [], episodes: [] };
  const b = { episodes: [], sessions: [], policies: [POLICY('tiktok', 'TikTok')], mode: 'contracts', version: 1 };
  assert.equal(RevisionV1.of(a), RevisionV1.of(b));
});

test('метка не зависит от режима хранения', () => {
  // Режим — это решение о приватности, а не содержимое журнала. Смена режима
  // не должна выглядеть как чужая запись и блокировать сохранение.
  const a = envelope([POLICY('tiktok', 'TikTok')]);
  assert.equal(RevisionV1.of(a), RevisionV1.of({ ...a, mode: 'local' }));
});

test('разное содержимое даёт разные метки', () => {
  assert.notEqual(RevisionV1.of(envelope([POLICY('tiktok', 'TikTok')])), RevisionV1.of(envelope([POLICY('yt', 'YouTube')])));
  assert.notEqual(RevisionV1.of(envelope([POLICY('tiktok', 'TikTok')])), RevisionV1.of(envelope([POLICY('tiktok', 'Tik Tok')])));
});

test('пустое во всех видах — это одна метка empty', () => {
  assert.equal(RevisionV1.of(null), RevisionV1.EMPTY);
  assert.equal(RevisionV1.of(undefined), RevisionV1.EMPTY);
  assert.equal(RevisionV1.of('строка'), RevisionV1.EMPTY);
  assert.equal(RevisionV1.of(envelope([])), RevisionV1.EMPTY);
  // Первый клиент на новом аккаунте обязан суметь записать поверх пустоты.
  assert.equal(RevisionV1.decide(RevisionV1.EMPTY, RevisionV1.EMPTY), 'ok');
});

test('решение различает отсутствие базы и её несовпадение', () => {
  // Это разные вещи: старый клиент базы не шлёт, а не ошибается.
  assert.equal(RevisionV1.decide(undefined, 'abc'), 'legacy');
  assert.equal(RevisionV1.decide('', 'abc'), 'legacy');
  assert.equal(RevisionV1.decide('empty', 'abc'), 'conflict');
  assert.equal(RevisionV1.decide('мусор', 'abc'), 'invalid');
  assert.equal(RevisionV1.decide(42, 'abc'), 'invalid');
});

test('модуль остаётся чистым', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'attention-revision-v1.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['require(', 'fetch(', 'localStorage', 'Date.now', 'crypto']) {
    assert.equal(code.includes(forbidden), false, `модуль не должен трогать ${forbidden}`);
  }
});

// ============================================================
//  Сервер
// ============================================================

async function startServer(offset) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-rev-'));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if (out.includes('Satoru запущен:') && (await fetch(`${base}/api/auth/profiles`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 30));
  }
  if (child.exitCode != null) throw new Error(`сервер не поднялся: ${out}`);

  let cookie = '';
  const call = async (route, { method = 'GET', body } = {}) => {
    const headers = {}; if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data, revision: r.headers.get('X-Attention-Revision') };
  };
  await call('/api/auth/register', { method: 'POST', body: { name: 'QA', email: `qa${offset}@satoru.local`, password: 'qa-password-1' } });
  return { call, stop: () => child.kill('SIGTERM') };
}

test('🔴 запись второго устройства больше не стирает правило первого', async (t) => {
  const server = await startServer(1);
  t.after(() => server.stop());

  // Оба устройства читают одно и то же состояние.
  const read = await server.call('/api/attention');
  const base = read.revision;
  assert.equal(base, RevisionV1.EMPTY);

  const a = await server.call('/api/attention', { method: 'PUT', body: { base, data: envelope([POLICY('tiktok', 'TikTok')]) } });
  assert.equal(a.status, 200);
  assert.equal(a.data.revision, RevisionV1.of(envelope([POLICY('tiktok', 'TikTok')])));

  // Устройство B всё ещё держит СТАРУЮ базу и ничего не знает про TikTok.
  const b = await server.call('/api/attention', { method: 'PUT', body: { base, data: envelope([POLICY('yt', 'YouTube')]) } });
  assert.equal(b.status, 409, 'устаревшая база обязана получить отказ');
  assert.equal(b.data.error, 'attention_revision_conflict');
  assert.equal(b.data.revision, a.data.revision, 'отказ называет актуальную метку, чтобы клиент перечитал');

  const after = await server.call('/api/attention');
  assert.deepEqual(after.data.policies.map((p) => p.id), ['tiktok'], 'правило первого устройства должно выжить');
});

test('перечитавший клиент записывает спокойно', async (t) => {
  const server = await startServer(2);
  t.after(() => server.stop());
  const first = await server.call('/api/attention', { method: 'PUT', body: { base: 'empty', data: envelope([POLICY('tiktok', 'TikTok')]) } });
  assert.equal(first.status, 200);

  // Отказ — не тупик: клиент читает заново и пересобирает изменение на актуальном.
  const reread = await server.call('/api/attention');
  const merged = envelope([POLICY('tiktok', 'TikTok'), POLICY('yt', 'YouTube')]);
  const second = await server.call('/api/attention', { method: 'PUT', body: { base: reread.revision, data: merged } });
  assert.equal(second.status, 200);
  const after = await server.call('/api/attention');
  assert.deepEqual(after.data.policies.map((p) => p.id).sort(), ['tiktok', 'yt']);
});

test('клиент прошлой сборки без базы продолжает работать', async (t) => {
  // Серверная схема обязана оставаться совместимой со старым PWA: вкладка,
  // открытая до релиза, не должна получить отказ на каждое сохранение.
  const server = await startServer(3);
  t.after(() => server.stop());
  const legacy = await server.call('/api/attention', { method: 'PUT', body: { data: envelope([POLICY('tiktok', 'TikTok')]) } });
  assert.equal(legacy.status, 200);
  assert.equal(typeof legacy.data.revision, 'string');
});

test('испорченная база отклоняется как запрос, а не как конфликт', async (t) => {
  const server = await startServer(4);
  t.after(() => server.stop());
  const bad = await server.call('/api/attention', { method: 'PUT', body: { base: 'не-метка', data: envelope([POLICY('tiktok', 'TikTok')]) } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, 'invalid_attention_base');
  const after = await server.call('/api/attention');
  assert.deepEqual(after.data.policies, [], 'отклонённый запрос ничего не записывает');
});

test('приём одного эпизода возвращает метку, чтобы адаптер знал состояние', async (t) => {
  const server = await startServer(5);
  t.after(() => server.stop());
  await server.call('/api/attention', { method: 'PUT', body: { base: 'empty', data: envelope([POLICY('tiktok', 'TikTok')]) } });
  const stored = await server.call('/api/attention/episode', { method: 'POST', body: { episode: {
    id: 'ep1', sourcePolicyId: 'tiktok', declaredPurpose: 'publish',
    startedAt: '2026-09-14T10:00:00.000Z', endedAt: '2026-09-14T10:12:00.000Z',
    outcome: 'done', actualMinutes: 12, source: 'ios',
  } } });
  assert.equal(stored.status, 200);
  assert.equal(typeof stored.data.revision, 'string');
  const read = await server.call('/api/attention');
  assert.equal(read.revision, stored.data.revision, 'метка после записи совпадает с меткой при чтении');
});

test('GET отдаёт метку заголовком и не меняет форму конверта', async (t) => {
  const server = await startServer(6);
  t.after(() => server.stop());
  const read = await server.call('/api/attention');
  assert.equal(read.revision, RevisionV1.EMPTY);
  // Старый клиент валидирует конверт по форме: лишнее поле его сломало бы.
  assert.deepEqual(Object.keys(read.data).sort(), ['episodes', 'mode', 'policies', 'sessions', 'version']);
});

test('клиент шлёт базу и не выдаёт конфликт за успех', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  assert.match(app, /if \(this\._revision\) body\.base = this\._revision;/);
  assert.match(app, /X-Attention-Revision/);
  const put = app.slice(app.indexOf('async putServer(value'), app.indexOf('async save(bundle'));
  // Ветка конфликта целиком, а не окно фиксированной длины: подгонять число
  // символов под текущий текст — значит ломать тест на следующем комментарии.
  const branch = put.slice(put.indexOf('attention_revision_conflict'), put.indexOf("throw new Error('save 409')"));
  assert.ok(branch.length > 0, 'ветка конфликта должна существовать');
  assert.match(branch, /return false;/,
    'конфликт обязан вернуть false: молчаливый успех — это и есть потеря');
  assert.doesNotMatch(branch, /return true;/);
  assert.match(put, /State\._attentionLoadError = 'conflict'/,
    'после конфликта дальнейшие записи должны быть закрыты забором до перечитывания');
});

test('конфликт объясняет себя, а не советует повторить попытку', () => {
  const app = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  const status = app.slice(app.indexOf('function attentionStatus('), app.indexOf('function attentionBusy('));
  assert.match(status, /State\._attentionConflict/,
    'общее «повтори попытку» при конфликте — неправда: повтор не поможет до перезагрузки');
  assert.match(status, /Обнови страницу/);
  // Пять локалей: строка видима человеку.
  const row = app.match(/'Данные изменились на другом устройстве[^\n]*\n/);
  assert.ok(row, 'строка конфликта должна быть в таблице переводов');
  for (const locale of ['en:', 'de:', 'uk:', 'es:']) {
    assert.ok(row[0].includes(locale), `не хватает локали ${locale}`);
  }
  // Два сообщения об одном отказе — шум. Тост только там, где диалога нет.
  const put = app.slice(app.indexOf('async putServer(value'), app.indexOf('async save(bundle'));
  assert.match(put, /if \(!document\.querySelector\('#attention-dialog-overlay \[data-attention-status\]'\)\)/);
});
