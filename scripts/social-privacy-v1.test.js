'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

function cookieOf(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }
let serverSequence = 0;
async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-social-v125-'));
  const port = 45800 + ((process.pid % 50) * 2) + serverSequence++;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 200; index += 1) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
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

test('Social v125: consent is separate, aggregates are server-computed and retained data is minimal', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base, dataDir } = runtime;
  const alpha = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Alpha', email: 'social-alpha@example.test', password: 'alpha-social-123' } });
  const beta = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Beta', email: 'social-beta@example.test', password: 'beta-social-123' } });
  const gamma = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Gamma', email: 'social-gamma@example.test', password: 'gamma-social-123' } });
  assert.equal(alpha.response.status, 200); assert.equal(beta.response.status, 200); assert.equal(gamma.response.status, 200);

  assert.equal((await api(base, '/api/users', { cookie: alpha.cookie })).response.status, 200, 'admin can use the user picker');
  assert.equal((await api(base, '/api/users', { cookie: beta.cookie })).response.status, 403, 'ordinary users cannot enumerate accounts');
  const initial = await api(base, '/api/leaderboard', { cookie: beta.cookie });
  assert.deepEqual(initial.data.consent, { leaderboard: false, party: false }); assert.deepEqual(initial.data.rows, []);

  const now = new Date(); const date = now.toISOString().slice(0, 10);
  const task = [{ id: 'beta-owned-task', title: 'Never publish this title', date, done: true, completedAt: now.toISOString(), estimateMin: 30, difficulty: 'normal' }];
  assert.equal((await api(base, '/api/data/tasks', { method: 'PUT', cookie: beta.cookie, body: task })).response.status, 200);
  assert.equal((await api(base, '/api/leaderboard/publish', { method: 'POST', cookie: beta.cookie, body: { totalXp: 999999999, cleanDays: 999, habits: ['private'] } })).response.status, 403);
  assert.equal((await api(base, '/api/social/consent', { method: 'POST', cookie: beta.cookie, body: { leaderboard: true, userId: alpha.data.id } })).response.status, 400);
  const consented = await api(base, '/api/social/consent', { method: 'POST', cookie: beta.cookie, body: { leaderboard: true } });
  assert.equal(consented.response.status, 200); assert.deepEqual(consented.data.consent, { leaderboard: true, party: false });
  const published = await api(base, '/api/leaderboard/publish', { method: 'POST', cookie: beta.cookie, body: { totalXp: 999999999, cleanDays: 999, habits: ['private'], userId: alpha.data.id } });
  assert.equal(published.response.status, 200); assert.ok(published.data.totalXp > 0 && published.data.totalXp < 10000, 'forged XP is ignored');
  const board = await api(base, '/api/leaderboard', { cookie: gamma.cookie });
  assert.equal(board.data.metric, 'lifetime_xp'); assert.equal(board.data.rows.length, 1); assert.equal(board.data.rows[0].name, 'Beta');
  assert.equal(board.data.rows[0].totalXp, published.data.totalXp); assert.equal('cleanDays' in board.data.rows[0], false); assert.equal('habits' in board.data.rows[0], false);
  assert.equal('weekXp' in board.data.rows[0], false); assert.equal('weekQuests' in board.data.rows[0], false);
  assert.equal(JSON.stringify(board.data).includes('Never publish this title'), false);
  const usersAfter = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
  const betaStored = usersAfter.find((entry) => entry.id === beta.data.id);
  assert.deepEqual(betaStored.socialConsent, { leaderboard: true, party: false }); assert.equal('pub' in betaStored, false); assert.equal(JSON.stringify(betaStored).includes('cleanDays'), false);
  assert.equal((await api(base, '/api/social/consent', { method: 'POST', cookie: beta.cookie, body: { leaderboard: false } })).response.status, 200);
  const revoked = await api(base, '/api/leaderboard', { cookie: gamma.cookie }); assert.deepEqual(revoked.data.rows, [], 'revocation is immediate');
});

test('Social v125: party membership, permissions, leave/delete and identifier spoofing are server-owned', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const { base } = runtime;
  const owner = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Owner', email: 'party-owner@example.test', password: 'owner-social-123' } });
  const member = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Member', email: 'party-member@example.test', password: 'member-social-123' } });
  const outsider = await api(base, '/api/auth/register', { method: 'POST', body: { name: 'Outsider', email: 'party-outsider@example.test', password: 'outsider-social-123' } });

  assert.equal((await api(base, '/api/party/create', { method: 'POST', cookie: owner.cookie, body: { name: 'Safe Party' } })).response.status, 412);
  const created = await api(base, '/api/party/create', { method: 'POST', cookie: owner.cookie, body: { name: 'Safe Party', shareProgress: true, acknowledgedVisibility: true } });
  assert.equal(created.response.status, 200); assert.equal(created.data.party.permissions.role, 'owner'); assert.equal(created.data.party.permissions.canDelete, true);
  const code = created.data.party.code;
  assert.equal((await api(base, '/api/party/join', { method: 'POST', cookie: member.cookie, body: { code, shareProgress: true, acknowledgedVisibility: true, partyId: created.data.party.id } })).response.status, 400);
  const joined = await api(base, '/api/party/join', { method: 'POST', cookie: member.cookie, body: { code, shareProgress: true, acknowledgedVisibility: true } });
  assert.equal(joined.response.status, 200); assert.equal(joined.data.party.permissions.role, 'member'); assert.equal(joined.data.party.permissions.canDelete, false);
  assert.equal((await api(base, '/api/party/delete', { method: 'POST', cookie: outsider.cookie, body: { confirmName: 'Safe Party' } })).response.status, 404);
  assert.equal((await api(base, '/api/party/delete', { method: 'POST', cookie: member.cookie, body: { confirmName: 'Safe Party' } })).response.status, 403);
  assert.equal((await api(base, '/api/party/cheer', { method: 'POST', cookie: member.cookie, body: { to: outsider.data.id } })).response.status, 400);
  assert.equal((await api(base, '/api/party/cheer', { method: 'POST', cookie: member.cookie, body: { to: owner.data.id, actorId: outsider.data.id } })).response.status, 400);
  assert.equal((await api(base, '/api/party/cheer', { method: 'POST', cookie: member.cookie, body: { to: owner.data.id } })).response.status, 200);

  const party = (await api(base, '/api/party', { cookie: owner.cookie })).data.party;
  assert.equal(party.members.length, 2); assert.equal(party.visibility.progress, 'explicit_weekly_xp_and_quest_count');
  assert.equal('cleanDays' in party.members[0], false); assert.equal('habits' in party.members[0], false); assert.equal('rank' in party.members[0], false);
  assert.equal((await api(base, '/api/social/consent', { method: 'POST', cookie: member.cookie, body: { party: false } })).response.status, 200);
  const hidden = (await api(base, '/api/party', { cookie: owner.cookie })).data.party.members.find((entry) => entry.name === 'Member');
  assert.equal(hidden.shared, false); assert.equal('weekXp' in hidden, false); assert.equal('weekQuests' in hidden, false);
  assert.equal((await api(base, '/api/party/leave', { method: 'POST', cookie: member.cookie, body: { partyId: party.id } })).response.status, 400);
  assert.equal((await api(base, '/api/party', { cookie: member.cookie })).data.party.members.length, 2, 'spoof attempt cannot mutate membership');
  assert.equal((await api(base, '/api/party/leave', { method: 'POST', cookie: member.cookie, body: {} })).response.status, 200);
  assert.equal((await api(base, '/api/party', { cookie: member.cookie })).data.party, null);
  assert.equal((await api(base, '/api/party/join', { method: 'POST', cookie: member.cookie, body: { code, shareProgress: true, acknowledgedVisibility: true } })).response.status, 200);
  const ownerLeaves = await api(base, '/api/party/leave', { method: 'POST', cookie: owner.cookie, body: {} });
  assert.equal(ownerLeaves.response.status, 200); assert.equal(ownerLeaves.data.transferredTo, member.data.id);
  const transferred = (await api(base, '/api/party', { cookie: member.cookie })).data.party;
  assert.equal(transferred.permissions.role, 'owner'); assert.equal(transferred.createdBy, member.data.id);
  assert.equal((await api(base, '/api/party/delete', { method: 'POST', cookie: member.cookie, body: { confirmName: 'wrong' } })).response.status, 400);
  assert.equal((await api(base, '/api/party/delete', { method: 'POST', cookie: member.cookie, body: { confirmName: 'Safe Party' } })).response.status, 200);
  assert.equal((await api(base, '/api/party', { cookie: member.cookie })).data.party, null);
});

test('Social v125 client has explicit consent, distinct states, accessible destructive flow and no derived-data payload', () => {
  assert.match(APP, /social: \{ leaderboard: false, party: false \}/);
  assert.match(APP, /function socialConsentValue\(/); assert.match(APP, /function socialErrorCard\(/);
  assert.match(APP, /role="dialog" aria-modal="true" aria-labelledby="social-party-dialog-title"/);
  assert.match(APP, /data-action="set-leaderboard-consent"/); assert.match(APP, /data-action="set-party-consent"/);
  assert.ok(APP.includes('Публичных участников пока нет. Это настоящее пустое состояние, а не ошибка загрузки.'));
  assert.match(APP, /Суммарный lifetime XP[^]+Это не рейтинг навыка/);
  const publishStart = APP.indexOf('function publishLeaderboard()'); const publishEnd = APP.indexOf('\n}', publishStart) + 2;
  const publishBody = APP.slice(publishStart, publishEnd);
  assert.doesNotMatch(publishBody, /cleanDays|antihabits|habits|overallXp|weekXp|totalXp|userId/);
  assert.match(publishBody, /fetch\('\/api\/leaderboard\/publish', \{ method: 'POST' \}\)/);
  assert.match(SERVER, /socialPayloadHasForeignIdentity/); assert.match(SERVER, /computeUserXp\(entry\.id\)/);
  assert.doesNotMatch(SERVER.slice(SERVER.indexOf("if \(u === '/api/leaderboard/publish'"), SERVER.indexOf('// GET /api/leaderboard')), /cleanDays|b\.totalXp|b\.weekXp/);
  assert.match(APP, /if \(State\._partyLoading \|\| State\._lbLoading\) return;/, 'focus plan survives transient social loading DOM');
  assert.equal((APP.match(/^  'Ещё': \{/gm) || []).length, 0, 'reward copy must not override the navigation translation');
  assert.match(APP, /'Ещё': 'Más'/, 'Spanish More remains a labelled destination');
});

test('Social v125 five-locale, touch, theme and reduced-motion contract is present', () => {
  for (const key of [
    'Рейтинг участия',
    'Отдельное согласие на публикацию',
    'Видимость внутри пати',
    'Удалить пати для всех?',
    'Не удалось загрузить социальный раздел',
    'Я понимаю, что после вступления участники увидят моё имя и аватар, и отдельно разрешаю им видеть недельный XP и число завершённых квестов. Названия задач, привычки, cleanDays и личные данные не публикуются.',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = APP.match(new RegExp(`['\"]${escaped}['\"]: \\{([^}]+)\\}`));
    assert.ok(row, `missing locale row: ${key}`);
    for (const locale of ['en', 'de', 'uk', 'es']) assert.match(row[1], new RegExp(`\\b${locale}:`));
  }
  assert.match(CSS, /Party, leaderboard & social privacy v125/);
  assert.match(CSS, /@media \(pointer: coarse\)[^]*social-confirm-box/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[^]*party-shell/);
  assert.match(CSS, /social-privacy-card\.is-consented/);
  assert.match(SW, /const CACHE = 'satoru-v125'/);
});
