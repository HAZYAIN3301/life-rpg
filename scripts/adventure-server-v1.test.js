'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const P = require('../server-adventure-policy-v1.js');
const ROOT = path.resolve(__dirname, '..');

test('adventure HTTP: authority, persistence, lifecycle and interrupted transactions', { timeout: 60000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-adventure-api-'));
  const port = 52020 + process.pid % 20, base = `http://127.0.0.1:${port}`;
  const ledger = path.join(dir, 'party-adventures-v1.json'), partiesFile = path.join(dir, 'parties.json');
  const journal = path.join(dir, 'party-adventure-lifecycle-v1.json');
  const fault = path.join(dir, 'fault'), clock = path.join(dir, 'clock'), preload = path.join(dir, 'preload.cjs');
  const password = 'Adventure-testing-123'; let child;
  fs.writeFileSync(clock, '2026-10-01T10:00:00.000Z');
  fs.writeFileSync(preload, `const fs=require('node:fs');const NativeDate=Date;
    const now=()=>NativeDate.parse(fs.readFileSync(${JSON.stringify(clock)},'utf8'));
    global.Date=class extends NativeDate {constructor(...a){super(...(a.length?a:[now()]));} static now(){return now();}};
    const rename=fs.renameSync;fs.renameSync=function(a,b){let f;try{f=JSON.parse(fs.readFileSync(${JSON.stringify(fault)},'utf8'))}catch{}
      const match=f&&b===f.target;if(match&&f.boundary==='before')throw Error('injected write failure');
      const result=rename.apply(this,arguments);if(match&&f.boundary==='after')throw Error('injected response loss');
      if(match&&f.boundary==='crash'){fs.unlinkSync(${JSON.stringify(fault)});process.exit(89);}return result;};`);
  async function start() {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: ROOT,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dir, PUSH_SCHED: 'off' }, stdio: 'ignore' });
    for (let i = 0; i < 200; i++) {
      if (child.exitCode !== null) throw Error('server exited: ' + child.exitCode);
      try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error('server startup timed out');
  }
  async function stop() { if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  async function api(route, user, body, headers = {}) {
    const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST',
      headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { text }; }
    return { status: response.status, data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  }
  const adventure = (op, user, body, headers) => api('/api/party/adventure' + (op ? '/' + op : ''), user, body, headers);
  const join = user => adventure('join', user, { shareProgress: true });
  const view = async user => (await adventure('', user)).data.chapter;
  const contribute = async (user, taskId, revision) => adventure('contribute', user,
    { taskId, revision: revision ?? (await view(user)).revision });
  function task(user, id, extra = {}) {
    const file = path.join(dir, 'users', user.data.id, 'tasks.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([{ id, title: 'PRIVATE_SECRET_TASK', done: true,
      completedAt: fs.readFileSync(clock, 'utf8'), ...extra }]));
  }
  const inject = (target, boundary) => fs.writeFileSync(fault, JSON.stringify({ target, boundary }));
  const clear = () => { if (fs.existsSync(fault)) fs.unlinkSync(fault); };
  const stored = () => P.validate(JSON.parse(fs.readFileSync(ledger, 'utf8')));
  await start();
  const users = [];
  for (const name of ['Alice', 'Bob', 'Cara', 'Outside']) {
    const user = await api('/api/auth/register', null, { name, email: `${name.toLowerCase()}@example.test`, password });
    assert.equal(user.status, 200); users.push(user);
  }
  const [a, b, c, outsider] = users;
  const party = (await api('/api/party/create', a, { name: 'Lighthouse QA', shareProgress: true, acknowledgedVisibility: true })).data.party;
  const partyJoin = user => api('/api/party/join', user, { code: party.code, shareProgress: true, acknowledgedVisibility: true });
  await partyJoin(b); await partyJoin(c);

  await t.test('strict authentication, explicit consent, small JSON, same origin and private projection', async () => {
    assert.equal((await adventure('', null)).status, 401);
    assert.equal((await join(outsider)).status, 404);
    assert.equal(await view(a), null);
    assert.equal((await adventure('join', a, { shareProgress: false })).status, 412);
    assert.equal((await adventure('join', a, { shareProgress: true, actor: b.data.id })).status, 400);
    assert.equal((await adventure('join', a, { shareProgress: true }, { Origin: 'https://elsewhere.test' })).status, 403);
    assert.equal((await adventure('join', a, { shareProgress: true }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await adventure('join', a, { shareProgress: 'x'.repeat(1100) })).status, 413);
    assert.equal((await join(a)).status, 200); await join(b);
    assert.equal(await view(c), null, 'party membership does not enrol a person');
    assert.equal((await contribute(a, 'missing')).data.error, 'task_not_saved');
    task(b, 'b-private'); assert.equal((await contribute(a, 'b-private')).data.error, 'task_not_saved');
    task(a, 'a-one', { completedAt: '2026-09-01T00:00:00.000Z' });
    assert.equal((await contribute(a, 'a-one')).data.error, 'task_not_saved');
    task(a, 'a-one');
    const rev = (await view(a)).revision;
    assert.equal((await contribute(a, 'a-one', rev)).data.chapter.progress, 1);
    assert.equal((await contribute(b, 'b-private', rev)).data.error, 'chapter_conflict');
    const before = fs.readFileSync(ledger, 'utf8'), projection = await view(b);
    assert.equal(fs.readFileSync(ledger, 'utf8'), before, 'ordinary read does not write');
    for (const secret of ['PRIVATE_SECRET_TASK', 'a-one', a.data.id, stored().used[0].source])
      assert.equal(JSON.stringify(projection).includes(secret), false);
    assert.equal(projection.rewardsGranted, false);
  });
  await t.test('refused write, ambiguous success, durable replay, daily limit and restart', async () => {
    const rev = (await view(b)).revision;
    inject(ledger, 'before'); assert.equal((await contribute(b, 'b-private', rev)).status, 503);
    assert.equal(stored().used.length, 1); clear();
    inject(ledger, 'after'); assert.equal((await contribute(b, 'b-private', rev)).status, 503);
    assert.equal(stored().used.length, 2); clear();
    task(b, 'b-private', { done: false });
    assert.equal((await contribute(b, 'b-private', rev)).data.replay, true);
    task(a, 'a-two'); assert.equal((await contribute(a, 'a-two')).data.error, 'daily_limit');
    await stop(); await start();
    assert.equal((await contribute(b, 'b-private', rev)).data.replay, true);
    assert.equal((await view(a)).progress, 2);
  });
  await t.test('chapter withdrawal differs from weekly XP consent; explicit rejoin preserves claims', async () => {
    assert.equal((await api('/api/social/consent', a, { party: false })).status, 200);
    assert.equal((await view(a)).progress, 2, 'independent chapter consent');
    assert.equal((await adventure('withdraw', a, { actor: b.data.id })).status, 400);
    assert.equal((await adventure('withdraw', a, {})).status, 200);
    assert.equal(await view(a), null); assert.equal((await view(b)).progress, 2);
    assert.equal((await adventure('contribute', a, { taskId: 'a-one', revision: 1 })).status, 412);
    await join(a); assert.equal((await contribute(a, 'a-one', 1)).data.replay, true);
  });
  await t.test('interrupted leave recovers membership and consent together before rejoin', async () => {
    const before = fs.readFileSync(ledger, 'utf8');
    inject(journal, 'before');
    assert.equal((await api('/api/party/leave', a, {})).status, 503);
    clear(); assert.equal(fs.readFileSync(ledger, 'utf8'), before);
    assert.equal(fs.existsSync(journal), false); assert.equal((await view(a)).progress, 2);
    fs.writeFileSync(journal, '{broken');
    assert.equal((await adventure('', b)).status, 503);
    assert.equal(fs.readFileSync(journal, 'utf8'), '{broken'); fs.unlinkSync(journal);
    inject(partiesFile, 'before');
    assert.notEqual((await api('/api/party/leave', a, {})).status, 200);
    assert.equal(fs.existsSync(journal), true);
    assert.equal((await adventure('', b)).status, 503, 'pending transaction cannot expose partial data');
    assert.equal((await api('/api/profile/' + a.data.id, b)).status, 503, 'profile relation cannot bypass the pending membership journal');
    clear(); await stop(); await start();
    assert.equal(fs.existsSync(journal), false);
    assert.equal((await adventure('', a)).status, 404);
    assert.equal((await view(b)).progress, 2);
    assert.equal((await partyJoin(a)).status, 200);
    assert.equal(await view(a), null, 'return to party never restores consent automatically');
    await join(a); assert.equal((await contribute(a, 'a-one', 1)).data.replay, true);
    task(a, 'a-two'); assert.equal((await contribute(a, 'a-two')).data.error, 'daily_limit');
  });
  await t.test('four durable contributions reach choice, unchanged by newcomer; corruption fails closed', async () => {
    fs.writeFileSync(clock, '2026-10-02T10:00:00.000Z');
    task(a, 'a-two'); task(b, 'b-two');
    assert.equal((await contribute(a, 'a-two')).status, 200);
    assert.equal((await contribute(b, 'b-two')).data.chapter.phase, 'ready_for_choice');
    await join(c); assert.equal((await view(c)).target, 4);
    task(c, 'c-one'); assert.equal((await contribute(c, 'c-one')).data.error, 'chapter_ready');
    const before = fs.readFileSync(ledger, 'utf8'); fs.writeFileSync(ledger, '{broken');
    assert.equal((await join(c)).status, 503); assert.equal(fs.readFileSync(ledger, 'utf8'), '{broken');
    fs.writeFileSync(ledger, before);
  });
  await t.test('failed account deletion restores source protection; success anonymizes without losing progress', async () => {
    const oldSource = stored().used.find(row => row.actor === a.data.id).source;
    for (const boundary of ['before','after']) {
      inject(ledger, boundary);
      assert.equal((await api('/api/auth/delete-account', a, { confirm: 'DELETE', password })).status, 500);
      clear(); assert.equal((await view(a)).progress, 4);
      assert.equal(stored().used.some(row => row.source === oldSource), true);
      assert.equal(fs.statSync(ledger).mode & 0o777, 0o600);
    }
    assert.equal((await api('/api/auth/delete-account', a, { confirm: 'DELETE', password })).status, 200);
    const data = fs.readFileSync(ledger, 'utf8');
    assert.equal(data.includes(a.data.id), false); assert.equal(data.includes(oldSource), false);
    assert.equal((await view(b)).progress, 4); assert.equal((await adventure('', a)).status, 401);
  });
  await t.test('actual process exit during party deletion recovers archive; former members cannot read it', async () => {
    inject(ledger, 'crash');
    await assert.rejects(api('/api/party/delete', b, { confirmName: party.name }));
    await stop(); await start();
    assert.equal(fs.existsSync(journal), false);
    assert.equal((await adventure('', b)).status, 404);
    assert.equal((await adventure('', c)).status, 404);
    assert.equal(stored().chapters[0].contributions.length + stored().chapters[0].anonymousContributions, 4);
    assert.equal(stored().chapters[0].members.every(member => !member.active), true);
    const next = await api('/api/party/create', b, { name: 'New company', shareProgress: true, acknowledgedVisibility: true });
    assert.equal(next.status, 200); await join(b);
    assert.equal((await contribute(b, 'b-two')).data.error, 'source_already_used');
    assert.equal((await view(b)).progress, 0);
  });
  await t.test('process exit after account registry removal is anonymized on startup without a visitor', async () => {
    await api('/api/party/create', c, { name: 'Cleanup QA', shareProgress: true, acknowledgedVisibility: true });
    await join(c); task(c, 'cleanup-task'); await contribute(c, 'cleanup-task');
    const source = stored().used.find(row => row.actor === c.data.id).source;
    inject(path.join(dir, 'users.json'), 'crash');
    await assert.rejects(api('/api/auth/delete-account', c, { confirm: 'DELETE', password }));
    await stop(); await start();
    const bytes = fs.readFileSync(ledger, 'utf8');
    assert.equal(bytes.includes(c.data.id), false); assert.equal(bytes.includes(source), false);
    assert.equal(stored().chapters.at(-1).anonymousContributions, 1);
  });
});
