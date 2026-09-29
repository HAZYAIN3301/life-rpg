'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const P = require('../public/party-project-v1');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const now = '2026-09-28T20:00:00Z';
test('projects: real saved sources, two participants, no reuse across projects, stable finish and erasure', () => {
  let state;
  const ctx = { partyId: 'p', actor: hash('a'), now };
  const start = { action: 'start', partyId: 'p', projectId: 'hearth', operationId: 'start-one', revision: 0, share: true, taskId: null };
  const apply = (input, context = ctx) => { const result = P.change(state, input, context); state = result.state; return result; };
  apply(start); assert.equal(apply(start).replay, true);
  assert.throws(() => apply({ ...start, operationId: 'another1', revision: 1, projectId: 'garden' }), { code: 'project_conflict' });
  const contribute = (id, actor = 'a', extra = {}) => ({ input: { ...start, action: 'contribute', taskId: id, operationId: 'contribute-' + id, revision: state.revision },
    context: { ...ctx, actor: hash(actor), source: hash(id), task: { id, done: true, completedAt: now, ...extra } } });
  let c = contribute('old', 'a', { completedAt: '2020-01-01' }); assert.throws(() => apply(c.input, c.context), { code: 'project_task' });
  c = contribute('future', 'a', { completedAt: '2030-01-01' }); assert.throws(() => apply(c.input, c.context), { code: 'project_task' });
  c = contribute('open', 'a', { done: false }); assert.throws(() => apply(c.input, c.context), { code: 'project_task' });
  let first;
  for (let i = 0; i < 5; i++) { c = contribute('a' + i); apply(c.input, c.context); if (!i) first = c; }
  assert.equal(apply(first.input, { ...first.context, task: null }).replay, true, 'lost response can retry after task undo');
  c = contribute('a5'); assert.throws(() => apply(c.input, c.context), { code: 'project_partner' });
  c = contribute('b1', 'b'); apply(c.input, c.context); assert.equal(P.view(state).chapters[0].completedAt, now);
  apply({ ...start, projectId: 'garden', operationId: 'start-two', revision: state.revision });
  assert.equal(P.eligible(state, first.context.task, first.context.source, now), false);
  const publicView = JSON.stringify(P.view(state)); assert.ok(!publicView.includes(hash('a')) && !publicView.includes('a0'));
  state = P.forget(state, hash('a')); assert.equal(P.view(state).chapters[0].progress, 6); assert.equal(JSON.stringify(state).includes(hash('a')), false);
  assert.equal(state.chapters[0].anonymousActors, 1); P.validate(state);
  assert.throws(() => P.validate({ version: 1 }), { code: 'project_storage' });
});

test('projects HTTP: authority, write failure, restart replay, privacy and lifecycle', { timeout: 60000 }, async t => {
  const root = path.resolve(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-project-'));
  const base = 'http://127.0.0.1:52003', partiesFile = path.join(dir, 'parties.json'), fault = path.join(dir, 'fault'), preload = path.join(dir, 'preload.cjs');
  fs.writeFileSync(preload, `const fs=require('node:fs'), rename=fs.renameSync;fs.renameSync=function(a,b){let mode;try{mode=fs.readFileSync(${JSON.stringify(fault)},'utf8')}catch{};if(b===${JSON.stringify(partiesFile)}&&mode==='before')throw Error('fault');const v=rename.apply(this,arguments);if(b===${JSON.stringify(partiesFile)}&&mode==='crash'){fs.unlinkSync(${JSON.stringify(fault)});process.exit(89)}return v;};`);
  let child;
  async function launch() {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, PORT: '52003', HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
    for (let i = 0; i < 200; i++) { if (child.exitCode !== null) throw Error('server stopped'); try { if ((await fetch(base + '/api/version')).ok) return; } catch {} await new Promise(r => setTimeout(r, 20)); }
    throw Error('startup');
  }
  async function stop() { if (child?.exitCode === null) await new Promise(r => { child.once('exit', r); child.kill(); }); }
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  async function api(route, user, body, headers = {}) {
    const r = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  }
  const project = (u, b, h) => api('/api/party/projects', u, b, h);
  await launch(); const users = [], password = 'project-qa-password';
  for (const name of ['Alice', 'Bob', 'Other']) users.push(await api('/api/auth/register', null, { name, email: name + '@example.test', password }));
  const [a,b,out] = users;
  const party = (await api('/api/party/create', a, { name: 'Projects QA', shareProgress: true, acknowledgedVisibility: true })).data.party;
  const join = u => api('/api/party/join', u, { code: party.code, shareProgress: true, acknowledgedVisibility: true }); await join(b);
  const start = { action: 'start', partyId: party.id, projectId: 'hearth', operationId: 'start-first', revision: 0, taskId: null, share: true };
  assert.equal((await project(null)).status, 401); assert.equal((await project(out)).status, 404);
  assert.equal((await project(a, start, { Origin: 'https://outside.test' })).status, 403);
  assert.equal((await project(a, { ...start, actor: b.data.id })).status, 400);
  assert.equal((await project(a, { ...start, share: false })).status, 412);
  assert.equal((await project(a, start)).status, 200);
  const file = u => path.join(dir, 'users', u.data.id, 'tasks.json');
  function tasks(u, prefix, n) { fs.mkdirSync(path.dirname(file(u)), { recursive: true }); fs.writeFileSync(file(u), JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: prefix + i, title: 'PRIVATE_' + prefix + i, done: true, completedAt: new Date().toISOString() })))); }
  tasks(a, 'a', 8); tasks(b, 'b', 8); const initial = fs.readFileSync(file(a), 'utf8');
  const input = async (u, id, projectId = 'hearth') => ({ ...start, action: 'contribute', projectId, operationId: 'contribute-' + projectId + '-' + id, revision: (await project(u)).data.projects.revision, taskId: id });
  assert.equal((await project(a, await input(a, 'b0'))).data.error, 'project_task');
  let command = await input(a, 'a0'); fs.writeFileSync(fault, 'before'); assert.equal((await project(a, command)).status, 503); fs.unlinkSync(fault);
  assert.equal((await project(a)).data.projects.chapters[0].progress, 0);
  fs.writeFileSync(fault, 'crash'); await assert.rejects(project(a, command)); await stop(); await launch();
  assert.equal((await project(a, command)).data.replay, true);
  for (let i = 1; i < 5; i++) assert.equal((await project(a, await input(a, 'a' + i))).status, 200);
  assert.equal((await project(a, await input(a, 'a5'))).data.error, 'project_partner');
  assert.equal((await project(b, await input(b, 'b0'))).status, 200);
  let response = await project(b); assert.ok(response.data.projects.chapters[0].completedAt);
  assert.equal(JSON.stringify(response.data).includes('PRIVATE_a'), false); assert.equal(JSON.stringify(response.data).includes('source'), false);
  assert.equal(fs.readFileSync(file(a), 'utf8'), initial); assert.equal(fs.existsSync(path.join(path.dirname(file(a)), 'purchases.json')), false);
  const rev = response.data.projects.revision;
  await project(b, { ...start, operationId: 'start-garden', projectId: 'garden', revision: rev });
  const habitFile = path.join(path.dirname(file(a)), 'habitlog.json');
  const habitId = 'private-habit', day = new Date().toISOString().slice(0, 10), habitKey = JSON.stringify([day, habitId]);
  fs.writeFileSync(path.join(path.dirname(file(a)), 'habits.json'), JSON.stringify([{ id: habitId, title: 'PRIVATE_habit' }]));
  const habitLog = at => fs.writeFileSync(habitFile, JSON.stringify({ [day]: { [habitId]: { at, min: 2 } } }));
  habitLog('2020-01-01'); assert.equal((await project(a)).data.eligible.some(x => x.kind === 'habit'), false);
  habitLog('2030-01-01'); assert.equal((await project(a)).data.eligible.some(x => x.kind === 'habit'), false);
  habitLog(new Date().toISOString());
  assert.equal((await project(a)).data.eligible.find(x => x.kind === 'habit').id, habitKey);
  command = { ...await input(a, habitKey, 'garden'), operationId: 'habit-contribution', sourceType: 'habit' };
  assert.equal((await project(b, command)).status, 409, 'another account cannot use the habit');
  fs.writeFileSync(fault, 'before'); assert.equal((await project(a, command)).status, 503); fs.unlinkSync(fault);
  assert.equal((await project(a, command)).status, 200);
  fs.writeFileSync(habitFile, '{}'); assert.equal((await project(a, command)).data.replay, true, 'retry survives undo');
  habitLog(new Date().toISOString());
  assert.equal((await project(a, { ...command, operationId: 'habit-remarked', revision: (await project(a)).data.projects.revision })).status, 409);
  assert.equal(JSON.stringify((await project(b)).data).includes('PRIVATE_habit'), false);
  fs.writeFileSync(habitFile, '{'); assert.equal((await project(a)).status, 503); habitLog(new Date().toISOString());
  assert.equal((await project(a, await input(a, 'a0', 'garden'))).status, 409);
  await api('/api/party/leave', a, {}); await join(a);
  assert.equal((await project(a, await input(a, 'a0', 'garden'))).status, 409);
  await api('/api/auth/delete-account', a, { confirm: 'DELETE', password });
  response = await project(b); assert.equal(response.data.projects.chapters[0].progress, 6);
  const raw = JSON.parse(fs.readFileSync(partiesFile, 'utf8')); assert.equal(raw[0].projectWork.chapters[0].anonymousActors, 1);
  const saved = fs.readFileSync(partiesFile, 'utf8'); raw[0].projectWork.chapters[0].steps = 'broken'; fs.writeFileSync(partiesFile, JSON.stringify(raw));
  assert.equal((await project(b)).status, 503); fs.writeFileSync(partiesFile, saved);
});
