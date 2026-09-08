'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
test('duo server: two accounts, durable outcomes, private IDs, rejection, restart and failure', { timeout: 60000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-duo-v249-'));
  const port = 49200 + process.pid % 500, base = `http://127.0.0.1:${port}`;
  let child;
  const marker = path.join(dataDir, 'fail-party-write'), preload = path.join(dataDir, 'failpoint.cjs');
  fs.writeFileSync(preload, `const fs=require('fs');const rename=fs.renameSync;fs.renameSync=function(a,b){if(b===${JSON.stringify(path.join(dataDir, 'parties.json'))}&&fs.existsSync(${JSON.stringify(marker)}))throw Object.assign(new Error('test write failure'),{code:'EIO'});return rename.apply(this,arguments)};`);
  async function start() {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
    for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 30)); }
    throw new Error('Server did not start');
  }
  async function stop() { if (child && child.exitCode === null) await new Promise((resolve) => { child.once('exit', resolve); child.kill(); }); }
  t.after(async () => { await stop(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  async function api(route, user, body) {
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json(), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
  }
  await start();
  const users = [];
  for (const name of ['A', 'B', 'C', 'D']) users.push(await api('/api/auth/register', null, { name: 'Duo ' + name, email: `duo-${name.toLowerCase()}@example.test`, password: 'duo-testing-123' }));
  const [a, b, c, outsider] = users; users.forEach((u) => assert.equal(u.status, 200));
  const created = await api('/api/party/create', a, { name: 'Duo QA', shareProgress: true, acknowledgedVisibility: true });
  for (const u of [b, c]) assert.equal((await api('/api/party/join', u, { code: created.data.party.code, shareProgress: true, acknowledgedVisibility: true })).status, 200);
  const taskFiles = users.map((u, i) => {
    const file = path.join(dataDir, 'users', u.data.id, 'tasks.json'); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([{ id: `task-${i}`, title: `PRIVATE_TITLE_${i}`, date: '2026-09-08', done: false }])); return file;
  });
  const invite = { id: 'session1', to: b.data.id, taskId: 'task-0', publicLabel: 'Only this is shared', minutes: 5, share: true };
  assert.equal((await api('/api/party/sessions', outsider, invite)).status, 404);
  assert.equal((await api('/api/party/sessions', a, { ...invite, actor: b.data.id })).status, 400);
  assert.equal((await api('/api/party/sessions', a, { ...invite, taskId: 'task-1' })).data.error, 'task_unavailable');
  assert.equal((await api('/api/party/sessions', a, { ...invite, share: false })).data.error, 'sharing_required');
  assert.equal((await api('/api/party/session-preferences', b, { enabled: false })).status, 200);
  assert.equal((await api('/api/party/sessions', a, invite)).data.error, 'invites_muted');
  await api('/api/party/session-preferences', b, { enabled: true });
  const beforeFault = fs.readFileSync(path.join(dataDir, 'parties.json'), 'utf8'); fs.writeFileSync(marker, '1');
  assert.equal((await api('/api/party/sessions', a, invite)).status, 503);
  assert.equal(fs.readFileSync(path.join(dataDir, 'parties.json'), 'utf8'), beforeFault, 'failed durable write cannot report success or consume invitation');
  fs.unlinkSync(marker);
  assert.equal((await api('/api/party/sessions', a, invite)).status, 200);
  assert.equal((await api('/api/party/sessions', a, invite)).data.party.sessions.length, 1);
  const bytesBeforePoll = fs.readFileSync(path.join(dataDir, 'parties.json'), 'utf8');
  const poll = await api('/api/party/sessions', b);
  assert.equal(poll.data.sessions.length, 1);
  assert.equal(fs.readFileSync(path.join(dataDir, 'parties.json'), 'utf8'), bytesBeforePoll, 'poll does not recalculate XP or write the global registry');
  assert.deepEqual((await api('/api/party/sessions', c)).data.sessions, []);
  const bview = (await api('/api/party', b)).data.party.sessions[0];
  assert.equal('taskId' in bview.members[0], false); assert.equal(JSON.stringify(bview).includes('PRIVATE_TITLE'), false);
  assert.deepEqual((await api('/api/party', c)).data.party.sessions, []);
  const action = (user, op, extra = {}) => api('/api/party/sessions/session1', user, { eventId: `${user.data.id}_${op}`, op, ...extra });
  assert.equal((await action(c, 'accept')).status, 404);
  assert.equal((await action(b, 'accept', { taskId: 'task-1', publicLabel: 'B PUBLIC', share: true })).status, 200);
  assert.equal((await action(a, 'ready')).data.party.sessions[0].startedAt, null);
  const ready = await action(b, 'ready'); assert.equal(ready.data.party.sessions[0].status, 'running');
  assert.equal((await action(a, 'finish', { outcome: 'done' })).data.error, 'task_not_saved');
  assert.equal((await action(a, 'finish', { outcome: 'done', taskId: 'task-2' })).status, 400);
  const task = JSON.parse(fs.readFileSync(taskFiles[0], 'utf8')); task[0].done = true; task[0].completedAt = new Date().toISOString(); fs.writeFileSync(taskFiles[0], JSON.stringify(task));
  assert.equal((await action(a, 'finish', { outcome: 'done' })).status, 200);
  const saved = await action(b, 'finish', { outcome: 'partial' }); assert.equal(saved.data.party.sessions[0].status, 'finished');
  await stop(); await start();
  assert.equal((await action(a, 'finish', { outcome: 'done' })).data.party.sessions[0].status, 'finished');
  assert.equal((await action(b, 'withdraw')).status, 200);
  const partyFile = path.join(dataDir, 'parties.json');
  assert.equal(fs.readFileSync(partyFile, 'utf8').includes('B PUBLIC'), false);
  const snapshot = fs.readFileSync(partyFile, 'utf8'); fs.writeFileSync(partyFile, '{broken');
  assert.equal((await api('/api/party/session-preferences', a, { enabled: false })).status, 503);
  assert.equal(fs.readFileSync(partyFile, 'utf8'), '{broken', 'never overwrite a broken registry as empty');
  fs.writeFileSync(partyFile, snapshot);
  assert.equal((await api('/api/party/leave', b, {})).status, 200);
  assert.deepEqual((await api('/api/party', a)).data.party.sessions, []);
});
