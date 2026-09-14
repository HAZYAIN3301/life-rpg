'use strict';
/* Платформенные association-документы (APPLE-PRE-PAYMENT-PLAN-2026-09.md §B1).
 *
 * Проверяется не «отдаётся ли файл», а четыре обещания:
 *  🚫 неверная конфигурация НЕ превращается в документ — платформенный CDN кэширует
 *     ответ, и сломанный файл со статусом 200 хуже отсутствующего;
 *  🕳 ненастроенный сервер молчит честным 404, а не пустым 200;
 *  📄 Apple получает ровно `application/json` без charset и без редиректа;
 *  🔓 файл доступен без сессии и не зависит от query.
 *
 * Team ID появится только после оплаты Apple Developer Program, поэтому вся
 * конфигурация приходит из environment и здесь подставляется тестом.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const NativeAssociationV1 = require('../public/native-association-v1.js');

const ROOT = path.resolve(__dirname, '..');
const APP_ID = 'ABCDE12345.app.satoru.ios';
const PRINT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

// ============================================================
//  Чистый модуль
// ============================================================

test('apple: без конфигурации документа нет', () => {
  assert.equal(NativeAssociationV1.appleConfig({}).reason, 'not_configured');
  assert.equal(NativeAssociationV1.appleDocument({}), null);
  assert.equal(NativeAssociationV1.serialize(null), '');
});

test('apple: валидный app ID даёт современный applinks + webcredentials', () => {
  const doc = NativeAssociationV1.appleDocument({ appIds: APP_ID });
  assert.deepEqual(doc.applinks.details, [{ appIDs: [APP_ID], components: [{ '/': '/*' }] }]);
  assert.deepEqual(doc.webcredentials, { apps: [APP_ID] });
  // Легаси-ключ `apps` на верхнем уровне applinks не воскрешаем.
  assert.equal('apps' in doc.applinks, false);
});

test('apple: Team ID проверяется отдельно от bundle ID', () => {
  // Десять символов — но bundle ID из одного сегмента.
  assert.equal(NativeAssociationV1.appleConfig({ appIds: 'ABCDE12345.satoru' }).reason, 'invalid_app_id');
  // Правильный bundle ID — но Team ID короче десяти.
  assert.equal(NativeAssociationV1.appleConfig({ appIds: 'ABCDE.app.satoru.ios' }).reason, 'invalid_app_id');
  // Team ID в нижнем регистре: Apple печатает их прописными, тихо апперкейсить нельзя.
  assert.equal(NativeAssociationV1.appleConfig({ appIds: 'abcde12345.app.satoru.ios' }).reason, 'invalid_app_id');
  // Совсем без точки.
  assert.equal(NativeAssociationV1.appleConfig({ appIds: 'ABCDE12345' }).reason, 'invalid_app_id');
});

test('apple: список разделяется пробелами, запятыми и переводами строк', () => {
  const second = 'ZZZZZ99999.app.satoru.ipad';
  const parsed = NativeAssociationV1.appleConfig({ appIds: ` ${APP_ID},\n${second} ` });
  assert.deepEqual(parsed.appIds, [APP_ID, second]);
});

test('apple: повтор одного app ID не удваивает запись', () => {
  const parsed = NativeAssociationV1.appleConfig({ appIds: `${APP_ID} ${APP_ID}` });
  assert.deepEqual(parsed.appIds, [APP_ID]);
});

test('apple: один плохой элемент отменяет весь документ', () => {
  // Частичный документ опаснее отсутствующего: половина ссылок молча не откроется.
  const parsed = NativeAssociationV1.appleConfig({ appIds: `${APP_ID} broken` });
  assert.equal(parsed.ok, false);
  assert.deepEqual(parsed.appIds, []);
});

test('apple: путь без ведущего слэша отменяет документ', () => {
  assert.equal(NativeAssociationV1.appleConfig({ appIds: APP_ID, paths: 'gate' }).reason, 'invalid_path');
  const ok = NativeAssociationV1.appleConfig({ appIds: APP_ID, paths: '/gate/* /return/*' });
  assert.deepEqual(ok.components, [{ '/': '/gate/*' }, { '/': '/return/*' }]);
});

test('apple: слишком длинный список отклоняется целиком', () => {
  const many = Array.from({ length: NativeAssociationV1.MAX_APP_IDS + 1 }, (_, i) => `ABCDE1234${i % 10}.app.satoru.ios`);
  assert.equal(NativeAssociationV1.appleConfig({ appIds: many.join(',') }).reason, 'too_many_app_ids');
});

test('android: пакет без отпечатка отклоняется, а не публикуется пустым', () => {
  // Пустой sha256_cert_fingerprints ничего не доказывает и тихо ломает app link.
  assert.equal(NativeAssociationV1.androidConfig({ packageName: 'app.satoru.android' }).reason, 'missing_fingerprint');
  assert.equal(NativeAssociationV1.androidDocument({ packageName: 'app.satoru.android' }), null);
});

test('android: отпечаток принимается с двоеточиями и без, нормализуется в верхний регистр', () => {
  const lower = PRINT.toLowerCase();
  const bare = PRINT.split(':').join('').toLowerCase();
  assert.equal(NativeAssociationV1.certFingerprint(lower), PRINT);
  assert.equal(NativeAssociationV1.certFingerprint(bare), PRINT);
  // Тридцать один байт вместо тридцати двух.
  assert.equal(NativeAssociationV1.certFingerprint(PRINT.split(':').slice(1).join(':')), null);
});

test('android: валидная конфигурация даёт ровно одно объявление', () => {
  const doc = NativeAssociationV1.androidDocument({ packageName: 'app.satoru.android', fingerprints: PRINT });
  assert.equal(doc.length, 1);
  assert.deepEqual(doc[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(doc[0].target.namespace, 'android_app');
  assert.equal(doc[0].target.package_name, 'app.satoru.android');
  assert.deepEqual(doc[0].target.sha256_cert_fingerprints, [PRINT]);
});

test('android: пакет из одного сегмента и с цифрой в начале сегмента отклоняется', () => {
  assert.equal(NativeAssociationV1.androidPackage('satoru'), null);
  assert.equal(NativeAssociationV1.androidPackage('app.1satoru'), null);
  assert.equal(NativeAssociationV1.androidPackage('app.satoru_android'), 'app.satoru_android');
});

test('модуль ничего не читает из окружения сам', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'native-association-v1.js'), 'utf8');
  assert.equal(/process\.env/.test(source), false);
  assert.equal(/require\(/.test(source), false);
});

// ============================================================
//  Сервер
// ============================================================

async function startServer(extraEnv) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-assoc-'));
  const port = 49200 + (process.pid % 150) + (extraEnv && extraEnv.__offset ? extraEnv.__offset : 0);
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' };
  delete env.APPLE_APP_IDS; delete env.APPLE_APPLINK_PATHS;
  delete env.ANDROID_PACKAGE; delete env.ANDROID_CERT_SHA256;
  for (const [key, value] of Object.entries(extraEnv || {})) { if (key !== '__offset') env[key] = value; }
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode != null) throw new Error(`сервер упал: ${out}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, base, stop: () => child.kill('SIGTERM') }; } catch {}
    await new Promise((r) => setTimeout(r, 30));
  }
  child.kill('SIGTERM'); throw new Error(`сервер не поднялся: ${out}`);
}

test('сервер: без конфигурации оба файла дают 404, а не пустой 200', async (t) => {
  const server = await startServer({ __offset: 0 });
  t.after(() => server.stop());
  for (const route of ['/.well-known/apple-app-site-association', '/.well-known/assetlinks.json']) {
    const r = await fetch(server.base + route, { redirect: 'manual' });
    assert.equal(r.status, 404, route);
  }
});

test('сервер: настроенный AASA отдаётся как application/json без редиректа и без сессии', async (t) => {
  const server = await startServer({ __offset: 1, APPLE_APP_IDS: APP_ID });
  t.after(() => server.stop());
  const r = await fetch(server.base + '/.well-known/apple-app-site-association', { redirect: 'manual' });
  assert.equal(r.status, 200);
  // Apple исторически отказывался читать файл с параметром charset.
  assert.equal(r.headers.get('content-type'), 'application/json');
  const doc = await r.json();
  assert.deepEqual(doc.applinks.details[0].appIDs, [APP_ID]);
  assert.deepEqual(doc.webcredentials.apps, [APP_ID]);
});

test('сервер: query не меняет ответ, HEAD не отдаёт тело', async (t) => {
  const server = await startServer({ __offset: 2, APPLE_APP_IDS: APP_ID });
  t.after(() => server.stop());
  const withQuery = await fetch(server.base + '/.well-known/apple-app-site-association?v=2');
  assert.equal(withQuery.status, 200);
  assert.equal((await withQuery.json()).applinks.details[0].appIDs[0], APP_ID);
  const head = await fetch(server.base + '/.well-known/apple-app-site-association', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.text()).length, 0);
});

test('сервер: сломанная конфигурация даёт 404, а не половину документа', async (t) => {
  // Опечатка в Team ID не должна доехать до CDN Apple ни в каком виде.
  const server = await startServer({ __offset: 3, APPLE_APP_IDS: 'oops.app.satoru.ios' });
  t.after(() => server.stop());
  const r = await fetch(server.base + '/.well-known/apple-app-site-association');
  assert.equal(r.status, 404);
});

test('сервер: assetlinks отдаётся только с отпечатком', async (t) => {
  const half = await startServer({ __offset: 4, ANDROID_PACKAGE: 'app.satoru.android' });
  try {
    assert.equal((await fetch(half.base + '/.well-known/assetlinks.json')).status, 404);
  } finally { half.stop(); }
  const full = await startServer({ __offset: 5, ANDROID_PACKAGE: 'app.satoru.android', ANDROID_CERT_SHA256: PRINT });
  try {
    const r = await fetch(full.base + '/.well-known/assetlinks.json');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/json');
    const doc = await r.json();
    assert.equal(doc[0].target.package_name, 'app.satoru.android');
    assert.deepEqual(doc[0].target.sha256_cert_fingerprints, [PRINT]);
  } finally { full.stop(); }
});

test('сервер: POST в association-маршрут не принимается', async (t) => {
  const server = await startServer({ __offset: 6, APPLE_APP_IDS: APP_ID });
  t.after(() => server.stop());
  const r = await fetch(server.base + '/.well-known/apple-app-site-association', { method: 'POST' });
  assert.equal(r.status, 405);
});

test('сервер: /api/version отвечает без сессии и не выдаёт лишнего', async (t) => {
  const server = await startServer({ __offset: 7, APPLE_APP_IDS: APP_ID });
  t.after(() => server.stop());
  const r = await fetch(server.base + '/api/version');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const body = await r.json();
  assert.equal(body.app, 'satoru');
  // Версия shell читается из sw.js, который и есть единственное место её бампа.
  const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
  assert.equal(body.shellCache, /const CACHE = '([^']+)'/.exec(sw)[1]);
  assert.equal(typeof body.serverTime, 'string');
  assert.equal(Number.isNaN(Date.parse(body.serverTime)), false);
  // Возможности отражают факт, а не намерение: токенов устройства ещё нет.
  assert.equal(body.capabilities.deviceSessions, false);
  assert.equal(body.capabilities.attentionEpisodeIntake, true);
  assert.equal(body.capabilities.appleAppSiteAssociation, true);
  assert.equal(body.capabilities.androidAssetLinks, false);
  // Ни секретов, ни счётчиков пользователей.
  const raw = JSON.stringify(body);
  assert.equal(/users|secret|token|key|email/i.test(raw), false);
});

test('сервер: /api/version честно говорит, что association не настроен', async (t) => {
  const server = await startServer({ __offset: 8 });
  t.after(() => server.stop());
  const body = await (await fetch(server.base + '/api/version')).json();
  assert.equal(body.capabilities.appleAppSiteAssociation, false);
  assert.equal(body.capabilities.androidAssetLinks, false);
});
