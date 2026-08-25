'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
function cookieOf(response) { return String(response.headers.get('set-cookie') || '').split(';')[0]; }
async function api(base, route, options) {
  const input = options || {}, headers = input.cookie ? { Cookie: input.cookie } : {};
  if (input.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method: input.method || 'GET', headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  let data = null; try { data = await response.json(); } catch {}
  return { status: response.status, data, cookie: cookieOf(response) };
}
async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-board-community-'));
  const port = 46300 + (process.pid % 500);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off', BRAVE_SEARCH_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`, deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`server exited: ${output}`);
    try { if ((await fetch(`${base}/api/auth/profiles`)).ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}
function offerState(snapshotId) {
  const snapshot = {
    schema: 'satoru.board-offer-snapshot/2', id: snapshotId, questId: 'quest-local-1', templateId: 'try-specific-local-class',
    title: 'Попробуй конкретную секцию рядом', details: 'Открой страницу занятия и выбери ближайшее время.',
    issuedAt: '2026-08-25', mode: 'standard', kind: 'local', scale: 'medium', tags: ['sport', 'local'],
    primaryAction: { label: 'Открыть занятие', url: 'https://hsp.sport.uni-bielefeld.de/boxing?utm_source=tiktok' }, alternative: null,
    completion: { proofModes: ['result'], proofRequired: false, share: 'none' }, followUp: null, adventure: null,
    reward: { tier: 2, xp: 120, titleEligible: false },
  };
  return { schema: 'satoru.board-offers/2', current: null, snapshots: [snapshot], history: [], pacing: null };
}

test('Board v2 community endpoint accepts only a completed local account snapshot', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  assert.equal((await api(runtime.base, '/api/board-v2/community?snapshotId=local@1')).status, 401);
  assert.equal((await api(runtime.base, '/api/board-v2/community/mark', { method: 'POST', body: {} })).status, 401);

  const registered = await api(runtime.base, '/api/auth/register', {
    method: 'POST', body: { name: 'CommunityOwner', email: 'community-owner@example.test', password: 'community-owner-pass' },
  });
  assert.equal(registered.status, 200);
  const cookie = registered.cookie, snapshotId = 'try-specific-local-class@2026-08-25.abc123';
  const settings = { board: { active: [], done: [], rested: [] }, boardV2Offers: offerState(snapshotId) };
  assert.equal((await api(runtime.base, '/api/data/settings', { method: 'PUT', cookie, body: settings })).status, 200);
  assert.equal((await api(runtime.base, '/api/data/tasks', { method: 'PUT', cookie, body: [] })).status, 200);
  const before = await api(runtime.base, `/api/board-v2/community?snapshotId=${encodeURIComponent(snapshotId)}`, { cookie });
  assert.equal(before.status, 200); assert.equal(before.data.summary, null);
  assert.equal(before.data.canMark, false); assert.equal(before.data.alreadyMarked, false);
  const incomplete = await api(runtime.base, '/api/board-v2/community/mark', {
    method: 'POST', cookie, body: { snapshotId, signal: 'matched' },
  });
  assert.equal(incomplete.status, 400); assert.equal(incomplete.data.reason, 'completed-snapshot-required');
  const forged = await api(runtime.base, '/api/board-v2/community/mark', {
    method: 'POST', cookie, body: { snapshotId, signal: 'matched', url: 'https://attacker.test', userId: 'other' },
  });
  assert.equal(forged.status, 400); assert.equal(forged.data.reason, 'invalid-community-mark');

  const task = {
    id: 'board-task-1', title: 'Попробуй конкретную секцию рядом', done: true, fromBoardV2: true,
    boardSnapshotId: snapshotId, completedAt: '2026-08-25T18:00:00.000Z',
  };
  assert.equal((await api(runtime.base, '/api/board/commit', {
    method: 'POST', cookie, body: { data: { settings, tasks: [task] } },
  })).status, 200);
  const accepted = await api(runtime.base, '/api/board-v2/community/mark', {
    method: 'POST', cookie, body: { snapshotId, signal: 'matched' },
  });
  assert.equal(accepted.status, 200); assert.equal(accepted.data.accepted, 'matched'); assert.equal(accepted.data.summary, null);
  assert.equal(accepted.data.canMark, false); assert.equal(accepted.data.alreadyMarked, true);
  const duplicate = await api(runtime.base, '/api/board-v2/community/mark', {
    method: 'POST', cookie, body: { snapshotId, signal: 'closed' },
  });
  assert.equal(duplicate.status, 409); assert.equal(duplicate.data.reason, 'already-marked');
  assert.equal((await api(runtime.base, '/api/data/board-community', { cookie })).status, 403);
  assert.equal((await api(runtime.base, '/api/data/board-community', { method: 'PUT', cookie, body: {} })).status, 403);

  const aggregate = fs.readFileSync(path.join(runtime.dataDir, 'board-community-aggregate.json'), 'utf8');
  assert.doesNotMatch(aggregate, /CommunityOwner|community-owner|snapshot|hsp\.sport|https|utm_source/);
  const account = fs.readFileSync(path.join(runtime.dataDir, 'users', registered.data.id, 'board-community.json'), 'utf8');
  assert.doesNotMatch(account, /CommunityOwner|community-owner|hsp\.sport|https|utm_source/);
});

test('Board v2 server source keeps community storage server-owned and body identity-free', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(source, /boardV2CommunityService\.mark\(uid, payload\)/);
  assert.match(source, /name === 'board-community'.*server_owned_data/);
  assert.doesNotMatch(source, /boardV2CommunityService\.mark\(payload\.(?:userId|uid)/);
});
