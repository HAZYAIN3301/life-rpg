'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-board-v149-'));
  const port = 45700 + (process.pid % 200);
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, PUSH_SCHED: 'off' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 160; i++) {
    if (child.exitCode != null) throw new Error(`server exited ${child.exitCode}: ${output}`);
    try { if ((await fetch(base + '/api/auth/profiles')).ok) return { child, dataDir, base }; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill('SIGTERM'); throw new Error(`server did not start: ${output}`);
}
async function json(base, route, { method = 'GET', cookie = '', body } = {}) {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await response.json(); } catch {}
  return { response, data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}

test('Board v149 commits board state and completion task as one owned unit', { timeout: 30000 }, async (t) => {
  const runtime = await startServer();
  t.after(() => { runtime.child.kill('SIGTERM'); fs.rmSync(runtime.dataDir, { recursive: true, force: true }); });
  const registered = await json(runtime.base, '/api/auth/register', { method: 'POST', body: { name: 'Board owner', email: 'board@example.test', password: 'board-pass-123' } });
  assert.equal(registered.response.status, 200); const cookie = registered.cookie;
  const initialSettings = { appName: 'Satoru', board: { version: 1, active: [], done: [], rested: [] } };
  const initialTasks = [{ id: 'old', title: 'Existing task', date: '2026-08-12', done: false }];
  await json(runtime.base, '/api/data/settings', { method: 'PUT', cookie, body: initialSettings });
  await json(runtime.base, '/api/data/tasks', { method: 'PUT', cookie, body: initialTasks });

  const nextSettings = { ...initialSettings, board: { version: 1, active: [], done: [{ orderId: 'b-place-city', doneAt: '2026-08-12' }], rested: [] } };
  const nextTasks = initialTasks.concat({ id: 'board-done', title: 'Visited somewhere new', date: '2026-08-12', done: true, fromBoard: true });
  const committed = await json(runtime.base, '/api/board/commit', { method: 'POST', cookie, body: { data: { settings: nextSettings, tasks: nextTasks } } });
  assert.equal(committed.response.status, 200); assert.deepEqual(committed.data.files.sort(), ['settings', 'tasks']);
  assert.deepEqual((await json(runtime.base, '/api/data/settings', { cookie })).data, nextSettings);
  assert.deepEqual((await json(runtime.base, '/api/data/tasks', { cookie })).data, nextTasks);

  const nextMedia = { 'b-place-city': { dataUrl: 'data:image/png;base64,AA==' } };
  const withProof = await json(runtime.base, '/api/board/commit', { method: 'POST', cookie, body: { data: { settings: nextSettings, tasks: nextTasks, boardmedia: nextMedia } } });
  assert.equal(withProof.response.status, 200); assert.deepEqual(withProof.data.files.sort(), ['boardmedia', 'settings', 'tasks']);
  assert.deepEqual((await json(runtime.base, '/api/data/boardmedia', { cookie })).data, nextMedia);

  const unsafeMedia = { 'b-place-city': { dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' } };
  assert.equal((await json(runtime.base, '/api/board/commit', { method: 'POST', cookie, body: { data: { settings: nextSettings, tasks: nextTasks, boardmedia: unsafeMedia } } })).response.status, 400);
  assert.equal((await json(runtime.base, '/api/board/commit', { method: 'POST', cookie, body: { data: { settings: nextSettings, tasks: null } } })).response.status, 400, 'an explicit tasks field must remain an array');

  const bad = await json(runtime.base, '/api/board/commit', { method: 'POST', cookie, body: { data: { settings: { board: { active: 'bad', done: [], rested: [] } }, tasks: [] } } });
  assert.equal(bad.response.status, 400);
  assert.deepEqual((await json(runtime.base, '/api/data/settings', { cookie })).data, nextSettings, 'invalid commit changes nothing');
  assert.equal((await json(runtime.base, '/api/board/commit', { method: 'POST', body: { data: { settings: nextSettings } } })).response.status, 401, 'anonymous client cannot commit');
});
