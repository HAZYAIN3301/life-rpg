'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
test('party reward API: durable credit, lost response, restart, lifecycle, XP and protocol boundaries', { timeout: 60000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-reward-v250-'));
  const port = 48100 + process.pid % 500, base = `http://127.0.0.1:${port}`;
  const marker = path.join(dir, 'fail-reward'), preload = path.join(dir, 'fault.cjs'); let child;
  fs.writeFileSync(preload, `const fs=require('fs');const rename=fs.renameSync;fs.renameSync=function(a,b){const fault=b.endsWith('/party-rewards.json')&&fs.existsSync(${JSON.stringify(marker)})?fs.readFileSync(${JSON.stringify(marker)},'utf8'):'';if(fault==='before')throw new Error('EIO');const r=rename.apply(this,arguments);if(fault==='after')throw new Error('ambiguous fsync');return r;};`);
  async function start() {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], { cwd: ROOT, env: { ...process.env, DATA_DIR: dir, PORT: String(port), HOST: '127.0.0.1', PUSH_SCHED: 'off' }, stdio: 'ignore' });
    for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 30)); } throw new Error('Server did not start');
  }
  async function stop() { if (child && child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); }); }
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  async function api(route, user, body, method) {
    const r = await fetch(base + route, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { Cookie: user?.cookie || '', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  }
  await start(); const users = [];
  for (const name of ['a', 'b', 'c']) users.push(await api('/api/auth/register', null, { name, email: `reward-${name}@example.test`, password: 'reward-tests-123' }));
  const [a, b, c] = users; users.forEach((u) => assert.equal(u.status, 200));
  const create = await api('/api/party/create', a, { name: 'Reward QA', shareProgress: true, acknowledgedVisibility: true });
  for (const u of [b, c]) await api('/api/party/join', u, { code: create.data.party.code, shareProgress: true, acknowledgedVisibility: true });
  const cycle = create.data.party.ws, payload = { version: 2, cycle };
  assert.equal((await api('/api/party/claim', a, payload)).data.error, 'not_won');
  const partiesFile = path.join(dir, 'parties.json'), parties = JSON.parse(fs.readFileSync(partiesFile, 'utf8'));
  parties[0].raid.won = true; parties[0].raid.claimed = [c.data.id]; fs.writeFileSync(partiesFile, JSON.stringify(parties));
  const wallet = (u) => path.join(dir, 'users', u.data.id, 'party-rewards.json');
  const lootbox = path.join(dir, 'users', a.data.id, 'lootbox.json'); fs.writeFileSync(lootbox, '{"goldWon":17}');
  await stop(); await start();
  assert.equal((await api('/api/party/claim', c, payload)).data.receipt.kind, 'legacy');
  assert.equal(JSON.parse(fs.readFileSync(wallet(c), 'utf8')).receipts[0].gold, 0);
  assert.equal((await api('/api/party/claim', null, payload)).status, 401);
  assert.equal((await api('/api/party/claim', a, {})).status, 409);
  assert.equal((await api('/api/party/claim', a, { ...payload, userId: b.data.id })).status, 400);
  fs.writeFileSync(marker, 'before');
  assert.equal((await api('/api/party/claim', a, payload)).status, 503); assert.equal(fs.existsSync(wallet(a)), false);
  fs.unlinkSync(marker);
  const attempts = await Promise.all([1, 2, 3].map(() => api('/api/party/claim', a, payload)));
  attempts.forEach((r) => assert.equal(r.status, 200));
  assert.equal(attempts.filter((r) => !r.data.replay).length, 1);
  assert.equal(JSON.parse(fs.readFileSync(wallet(a), 'utf8')).receipts.length, 1);
  assert.equal(fs.readFileSync(lootbox, 'utf8'), '{"goldWon":17}', 'old client wallet remains untouched');
  const receipt = attempts[0].data.receipt;
  assert.equal((await api('/api/auth/me', a)).data.partyRewards.receipts[0].gold, 150);
  // Server social XP uses the same window, without trusting client xpAwarded.
  const tasksFile = path.join(dir, 'users', a.data.id, 'tasks.json');
  const task = { id: 'xp-proof', done: true, estimateMin: 30, difficulty: 'normal', completedAt: new Date(Date.parse(receipt.at) - 1000).toISOString() };
  fs.writeFileSync(tasksFile, JSON.stringify([task]));
  const xpBefore = (await api('/api/party', a)).data.party.members.find((m) => m.me).weekXp;
  task.completedAt = receipt.at; task.xpAwarded = 999999; fs.writeFileSync(tasksFile, JSON.stringify([task]));
  assert.equal((await api('/api/party', a)).data.party.members.find((m) => m.me).weekXp, Math.round(xpBefore * 1.3));
  fs.writeFileSync(marker, 'after'); assert.equal((await api('/api/party/claim', b, payload)).status, 503);
  const persistedB = JSON.parse(fs.readFileSync(wallet(b), 'utf8')).receipts[0]; fs.unlinkSync(marker);
  await stop(); await start();
  assert.deepEqual((await api('/api/party/claim', b, payload)).data.receipt, persistedB);
  await api('/api/party/leave', a, {});
  assert.deepEqual((await api('/api/party/claim', a, payload)).data.receipt, receipt, 'retry works without party');
  await api('/api/party/create', a, { name: 'Second QA', shareProgress: true, acknowledgedVisibility: true });
  assert.equal((await api('/api/party', a)).data.party.raid.iClaimed, true);
  assert.deepEqual((await api('/api/party/claim', a, payload)).data.receipt, receipt);
  for (const method of ['PUT', 'POST', 'DELETE']) assert.equal((await api('/api/data/party-rewards', a, { version: 1, receipts: [] }, method)).status, 403);
  assert.equal((await api('/api/data/party-rewards', a)).status, 403);
  const archive = (await api('/api/account/export', a)).data;
  assert.deepEqual(archive.serverOwned.partyRewards.receipts[0], receipt);
  assert.equal('party-rewards' in archive.data, false);
  assert.equal((await api('/api/account/import', a, { format: 'satoru-account', version: 1, data: { 'party-rewards': archive.serverOwned.partyRewards } })).status, 400);
  const good = fs.readFileSync(wallet(a), 'utf8');
  for (const bad of ['null', '{broken', '{"version":1,"receipts":[{}]}']) {
    fs.writeFileSync(wallet(a), bad);
    assert.equal((await api('/api/party/claim', a, payload)).status, 503);
    assert.equal((await api('/api/party/rewards', a)).status, 503);
    assert.equal(fs.readFileSync(wallet(a), 'utf8'), bad);
  }
  fs.writeFileSync(wallet(a), good);
});
