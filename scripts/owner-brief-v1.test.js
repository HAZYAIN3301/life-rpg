'use strict';
/* Сводка для владельца (OWNER-BRIEF-V1.md): утренний брифинг Jarvis забирает её по токену.
 *
 * Главное, что проверяется: наружу уходят только числа. Сводка идёт в Telegram без сквозного
 * шифрования, поэтому текст отзыва, почта или id в ней — утечка, а не мелочь.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const OwnerBriefV1 = require('../server-owner-brief-v1.js');

const ROOT = path.resolve(__dirname, '..');
const DAY = 86400000;
const TOKEN = 'jarvis-brief-token-for-tests-0123456789';
const HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');

test('сводка: люди, новые, тарифы и отзывы по видам — одни числа', () => {
  const now = Date.parse('2026-10-20T08:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();
  const users = [
    { id: 'albert', isAdmin: true, createdAt: ago(300 * DAY), email: 'a@example.test' },
    { id: 'u1', createdAt: ago(2 * 3600e3), plan: 'pro', email: 'secret-person@example.test' },
    { id: 'u2', createdAt: ago(3 * DAY), trialStartedAt: ago(DAY) },
    { id: 'u3', createdAt: ago(30 * DAY) },
    { id: 'u4', createdAt: 'не дата' },
  ];
  const tier = (u) => (u.plan === 'pro' ? { tier: 'pro' } : u.trialStartedAt ? { tier: 'trial' } : { tier: 'free' });
  const feedback = [
    { at: ago(3600e3), kind: 'bug', text: 'Секретный текст отзыва', userId: 'u1' },
    { at: ago(5 * 3600e3), kind: 'idea', text: 'идея' },
    { at: ago(2 * DAY), kind: 'bug', text: 'старый баг' },
    { at: ago(9 * DAY), kind: 'bug', text: 'совсем старый' },
    { at: ago(600e3), kind: 'странный', text: '?' },
  ];
  const b = OwnerBriefV1.brief({ users, feedback, entitlement: tier, now });
  assert.deepEqual(b.users, { total: 5, new24h: 1, new7d: 2 });
  assert.deepEqual(b.plans, { pro: 1, trial: 1 }, 'админ — создатель, а не подписчик');
  assert.deepEqual(b.feedback, { day: { bug: 1, idea: 1, praise: 0, other: 1 }, bugs7d: 2 });
  const raw = JSON.stringify(b);
  for (const leak of ['Секретный', 'secret-person', 'u1', 'albert']) assert.ok(!raw.includes(leak), `в сводке нет «${leak}»`);
});

test('токен: только верный; хэш не задан или кривой — никого', () => {
  assert.equal(OwnerBriefV1.tokenOk(`Bearer ${TOKEN}`, HASH), true);
  assert.equal(OwnerBriefV1.tokenOk(`Bearer ${TOKEN}x`, HASH), false);
  assert.equal(OwnerBriefV1.tokenOk('', HASH), false);
  assert.equal(OwnerBriefV1.tokenOk(`Bearer ${TOKEN}`, ''), false);
  assert.equal(OwnerBriefV1.tokenOk(`Bearer ${TOKEN}`, 'abc'), false);
});

async function startServer(env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-owner-brief-'));
  const port = 48400 + (process.pid % 150) + (env.OWNER_BRIEF_TOKEN_SHA256 ? 0 : 160);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', GITHUB_TOKEN: '', ...env },
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
  return async (route, { method = 'GET', body, headers = {} } = {}) => {
    const h = { ...headers }; if (cookie) h.Cookie = cookie;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const r = await fetch(base + route, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    const text = await r.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    return { status: r.status, data, text };
  };
}

test('маршрут: по токену — числа без текстов; без токена, с чужим и без настройки — отказ', { timeout: 40000 }, async (t) => {
  const rt = await startServer({ OWNER_BRIEF_TOKEN_SHA256: HASH });
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  const admin = client(rt.base);
  await admin('/api/auth/register', { method: 'POST', body: { name: 'Админ', email: 'brief-admin@example.test', password: 'brief-pass-11' } });
  const user = client(rt.base);
  await user('/api/auth/register', { method: 'POST', body: { name: 'Б', email: 'brief-user@example.test', password: 'brief-pass-11' } });
  assert.equal((await user('/api/feedback', { method: 'POST', body: { kind: 'bug', text: 'Секретный текст бага' } })).status, 200);

  const jarvis = client(rt.base);
  assert.equal((await jarvis('/api/owner/brief')).status, 401);
  assert.equal((await jarvis('/api/owner/brief', { headers: { Authorization: 'Bearer someone-elses-token' } })).status, 401);
  const ok = await jarvis('/api/owner/brief', { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.users.total, 2);
  assert.equal(ok.data.users.new24h, 2);
  assert.equal(ok.data.feedback.day.bug, 1);
  for (const leak of ['Секретный', 'brief-user', 'brief-admin']) assert.ok(!ok.text.includes(leak), `в ответе нет «${leak}»`);
  assert.equal((await admin('/api/owner/brief')).status, 401, 'кука админа — не токен');
});

test('без OWNER_BRIEF_TOKEN_SHA256 маршрута нет', { timeout: 40000 }, async (t) => {
  const rt = await startServer({ OWNER_BRIEF_TOKEN_SHA256: '' });
  t.after(() => { rt.child.kill('SIGTERM'); fs.rmSync(rt.dataDir, { recursive: true, force: true }); });
  assert.equal((await client(rt.base)('/api/owner/brief', { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 404);
});
