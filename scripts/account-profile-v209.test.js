'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const Profile = require('../public/account-profile-v1.js');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

function cookieOf(response) { return String(response.headers.get('set-cookie') || '').split(';')[0]; }
let sequence = 0;
async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-profile-v209-'));
  const port = 47200 + ((process.pid % 80) * 3) + sequence++;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 220; index += 1) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { base, child, dataDir }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}
async function api(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: cookieOf(response) };
}
function profile(overrides = {}) {
  return { ...Profile.empty(), handle: 'traveller', bio: 'Делаю Satoru', layout: 'creator', cover: 'aurora',
    links: [{ platform: 'github', url: 'https://github.com/example' }], ...overrides };
}

test('Account profile v209: handle, links and allowlist normalize fail closed', () => {
  assert.equal(Profile.validHandle('albert'), true);
  assert.equal(Profile.validHandle('@al.bert_7'), true);
  assert.equal(Profile.validHandle('ab'), false);
  assert.equal(Profile.validHandle('имя'), false);
  assert.deepEqual(Profile.normalizeLink({ platform: 'instagram', url: '@albert' }), {
    platform: 'instagram', url: 'https://instagram.com/albert',
  });
  assert.equal(Profile.normalizeLink({ platform: 'instagram', url: 'https://evil.example/albert' }), null);
  assert.equal(Profile.normalizeLink({ platform: 'website', url: 'javascript:alert(1)' }), null);
  assert.equal(Profile.normalizeLink({ platform: 'website', url: 'https://localhost/private' }), null);
  assert.equal(Profile.normalizeLink({ platform: 'website', url: 'https://192.168.1.2/private' }), null);
  assert.equal(Profile.validate({ ...profile(), goals: ['must not leak'] }).error, 'unknown_profile_field');
  assert.equal(Profile.validate({ ...profile(), links: [{ platform: 'website', url: 'http://example.com' }] }).error, 'bad_link');
  assert.equal(Profile.normalize({ ...profile(), links: Array.from({ length: 20 }, (_, index) => ({ platform: 'website', url: `https://example.com/${index}` })) }).links.length, Profile.MAX_LINKS);
});

test('Account profile v209: visibility is explicit and relation-aware', () => {
  assert.equal(Profile.visibleTo(profile({ audience: 'private' }), 'self'), true);
  assert.equal(Profile.visibleTo(profile({ audience: 'private' }), 'tribe'), false);
  assert.equal(Profile.visibleTo(profile({ audience: 'tribe' }), 'tribe'), true);
  assert.equal(Profile.visibleTo(profile({ audience: 'tribe' }), 'member'), false);
  assert.equal(Profile.visibleTo(profile({ audience: 'satoru' }), 'member'), true);
});

test('Account profile v209 server: save, uniqueness, privacy and tribe scope are server-owned', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base } = runtime;
  const alpha = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Alpha', email: 'profile-alpha@example.test', password: 'profile-alpha-123' } });
  const beta = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Beta', email: 'profile-beta@example.test', password: 'profile-beta-123' } });
  const gamma = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Gamma', email: 'profile-gamma@example.test', password: 'profile-gamma-123' } });
  assert.equal(alpha.response.status, 200); assert.equal(beta.response.status, 200); assert.equal(gamma.response.status, 200);

  const savedPrivate = await api(base, '/api/auth/update-profile', { method: 'POST', cookie: alpha.cookie, body: { name: 'Alpha Creator', profile: profile({ audience: 'private' }) } });
  assert.equal(savedPrivate.response.status, 200); assert.equal(savedPrivate.data.profile.handle, 'traveller');
  assert.equal((await api(base, `/api/profile/${alpha.data.id}`, { cookie: alpha.cookie })).response.status, 200);
  assert.equal((await api(base, '/api/profile/traveller', { cookie: beta.cookie })).response.status, 404, 'private profile must not reveal existence');
  assert.equal((await api(base, '/api/profile/traveller')).response.status, 401, 'profile is not an unauthenticated public page');

  const duplicate = await api(base, '/api/auth/update-profile', { method: 'POST', cookie: beta.cookie, body: { profile: profile({ audience: 'satoru' }) } });
  assert.equal(duplicate.response.status, 409); assert.equal(duplicate.data.error, 'handle_taken');
  assert.equal((await api(base, '/api/auth/update-profile', { method: 'POST', cookie: alpha.cookie, body: { profile: { ...profile(), tasks: [] } } })).response.status, 400);
  assert.equal((await api(base, '/api/auth/update-profile', { method: 'POST', cookie: alpha.cookie, body: { profile: { ...profile(), links: [{ platform: 'website', url: 'http://unsafe.example' }] } } })).response.status, 400);

  await api(base, '/api/auth/update-profile', { method: 'POST', cookie: alpha.cookie, body: { profile: profile({ audience: 'satoru' }) } });
  const visible = await api(base, '/api/profile/traveller', { cookie: gamma.cookie });
  assert.equal(visible.response.status, 200);
  assert.deepEqual(Object.keys(visible.data).sort(), ['avatar', 'id', 'name', 'profile', 'summary']);
  assert.equal(JSON.stringify(visible.data).includes('email'), false);
  for (const forbidden of ['tasks', 'goals', 'habits', 'notes', 'cleanDays', 'profile-memory']) assert.equal(forbidden in visible.data, false);

  await api(base, '/api/auth/update-profile', { method: 'POST', cookie: alpha.cookie, body: { profile: profile({ audience: 'tribe' }) } });
  const created = await api(base, '/api/party/create', { method: 'POST', cookie: alpha.cookie, body: { name: 'Profile Tribe', shareProgress: true, acknowledgedVisibility: true } });
  assert.equal(created.response.status, 200);
  const joined = await api(base, '/api/party/join', { method: 'POST', cookie: beta.cookie, body: { code: created.data.party.code, shareProgress: true, acknowledgedVisibility: true } });
  assert.equal(joined.response.status, 200);
  assert.equal((await api(base, '/api/profile/traveller', { cookie: beta.cookie })).response.status, 200);
  assert.equal((await api(base, '/api/profile/traveller', { cookie: gamma.cookie })).response.status, 404);
});

test('Account profile v209 client: preview, layouts, privacy and social entry points are wired', () => {
  assert.match(HTML, /account-profile-v1\.js\?v=20260830-account-profile-v209-1[^]*app\.js\?v=20260903-write-fence-v215-4/);
  assert.match(HTML, /styles\.css\?v=20260903-write-fence-v215-4/);
  assert.match(SW, /const CACHE = 'satoru-v228'/); assert.match(SW, /account-profile-v1\.js/);
  assert.match(APP, /id="account-profile-form"/); assert.match(APP, /data-profile-preview/);
  for (const layout of ['journey', 'character', 'creator']) assert.match(APP, new RegExp(`['"]${layout}['"]`));
  for (const audience of ['private', 'tribe', 'satoru']) assert.match(APP, new RegExp(`['"]${audience}['"]`));
  assert.match(APP, /data-action="open-member-profile"/); assert.match(APP, /data-action="open-account-profile"/);
  assert.match(APP, /rel="noopener noreferrer nofollow"/);
  assert.match(APP, /Цели, привычки, заметки и профиль Тени всегда остаются закрытыми/);
  assert.match(CSS, /Account identity profile v209/); assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[^]*account-profile-settings/);
  assert.match(CSS, /@media \(pointer: coarse\)[^]*account-profile-dialog/);
});

test('Account profile v209 authored copy has all five locales', () => {
  for (const key of [
    'Как тебя видят в Satoru', 'Кто увидит профиль', 'Только я', 'Моё племя', 'Пользователи Satoru',
    'Проверь ссылки: нужен HTTPS-адрес или корректное @имя выбранной сети.', 'Профиль закрыт или недоступен.',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = APP.match(new RegExp(`['"]${escaped}['"]: \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`), `${key}: ${locale}`);
  }
});
