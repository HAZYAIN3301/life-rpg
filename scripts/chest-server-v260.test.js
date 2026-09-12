'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const C = require('../public/chest-claim-v1'), S = require('../server-chest-rewards-v1');
const ROOT = path.resolve(__dirname, '..'), clone = x => JSON.parse(JSON.stringify(x));
const archive = data => ({ format: 'satoru-account', version: 1, data });
async function runtime(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'satoru-chest-v260-'));
  const port = 47100 + process.pid % 350, base = `http://127.0.0.1:${port}`;
  let child;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null)
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
  };
  t.after(async () => { await stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  const start = async (extra = {}) => {
    child = spawn(process.execPath, ['server.js'], { cwd: ROOT,
      env: { ...process.env, DATA_DIR: dir, HOST: '127.0.0.1', PORT: String(port), PUSH_SCHED: 'off',
        COMMITMENT_CRASH_AT: '', COMMITMENT_FAIL_AFTER_FILE: '', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
    for (let n = 0; n < 300; n++) {
      if (child.exitCode !== null) throw Error(output);
      try { if ((await fetch(base + '/api/auth/profiles')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    throw Error('server start timeout: ' + output);
  };
  const api = async (route, cookie = '', data, method = data === undefined ? 'GET' : 'POST') => {
    const response = await fetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000) });
    let body; try { body = await response.json(); } catch {}
    return { status: response.status, body, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
  };
  await start();
  const register = name => api('/api/auth/register', '', { name, email: name + '@example.test', password: 'synthetic-chest-260' });
  const user = await register('import-owner'); assert.equal(user.status, 200);
  const userDir = path.join(dir, 'users', user.body.id);
  const snapshot = () => Object.fromEntries(fs.readdirSync(userDir).filter(n => n.endsWith('.json'))
    .map(name => [name, fs.readFileSync(path.join(userDir, name), 'utf8')]));
  const read = name => JSON.parse(fs.readFileSync(path.join(userDir, name + '.json'), 'utf8'));
  const seed = values => {
    fs.mkdirSync(userDir, { recursive: true });
    for (const [name, value] of Object.entries(values)) fs.writeFileSync(path.join(userDir, name + '.json'), JSON.stringify(value));
  };
  const prepare = async data => {
    const payload = { ...archive(data), writeVersion: 2, requestId: 'import_' + Math.random().toString(36).slice(2) };
    const result = await api('/api/account/import/preview', user.cookie, payload);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return { ...payload, ticket: result.body.ticket };
  };
  return { api, user, userDir, read, seed, prepare, snapshot, start, stop, register, child: () => child };
}

const today = () => new Date().toISOString().slice(0, 10);
const fixture = () => ({ settings: { marker: 'kept' }, tasks: [1, 2, 3, 4, 5].map(n => ({ id: 'q'+n, title:'Done '+n, done:true, date:today() })),
  habitlog: {}, skilltree: {}, lootbox: { day:today(), carry:0, opened:0, goldWon:7, history:[] } });
function request(r, id = 'chest_' + require('crypto').randomUUID()) {
  return { version:1, requestId:id, timeZone:'UTC', base:Object.fromEntries(C.FILES.map(n => {
    const file=path.join(r.userDir,n+'.json'); return [n,fs.existsSync(file)?{exists:true,value:r.read(n)}:{exists:false,value:null}];
  })) };
}
test('daily chest HTTP: authenticated server prize, durable restart/replay, strict stale/no-prize writes and private ledger', {timeout:30000}, async t => {
  const r=await runtime(t); r.seed(fixture()); const payload=request(r), before=r.snapshot();
  assert.equal((await r.api('/api/rewards/chest','',payload)).status,401);
  for (const bad of [{...payload,prize:{type:'gold',rarity:'legendary',amount:999999}}, {...payload,day:'2099-01-01'}, {...payload,timeZone:'not/a-zone'}]) {
    assert.equal((await r.api('/api/rewards/chest',r.user.cookie,bad)).status,400);
    assert.deepEqual(r.snapshot(),before);
  }
  const got=await r.api('/api/rewards/chest',r.user.cookie,payload);
  assert.equal(got.status,200,JSON.stringify(got.body)); assert.equal(C.receiptValid(got.body,payload),true);
  assert.equal(r.read('lootbox').opened,1); assert.equal(r.read(S.LEDGER_FILE).receipts.length,1);
  const me = await r.api('/api/auth/me', r.user.cookie);
  assert.deepEqual(me.body.dailyChest, { version: 1, cursor: r.read(S.LEDGER_FILE).cursor });
  assert.equal(Object.hasOwn(me.body.dailyChest, 'receipts'), false, 'only ticket counters leave the private ledger');
  const once=r.snapshot(); await r.stop(); await r.start();
  const replay=await r.api('/api/rewards/chest',r.user.cookie,payload);
  assert.equal(replay.status,200); assert.equal(replay.body.replayed,true); assert.equal(C.receiptValid(replay.body,payload),true);
  assert.deepEqual(r.snapshot(),once);
  const stale={...payload,requestId:'chest_' + require('crypto').randomUUID()};
  assert.equal((await r.api('/api/rewards/chest',r.user.cookie,stale)).body.error,'chest_revision_conflict');
  assert.equal((await r.api('/api/rewards/chest',r.user.cookie,{...payload,timeZone:'Europe/Berlin'})).body.error,'chest_request_conflict');
  for (const method of ['GET','PUT','POST']) {
    const denied=await r.api('/api/data/'+S.LEDGER_FILE,r.user.cookie,method==='GET'?undefined:{version:1,cursor:null,receipts:[]},method);
    assert.equal(denied.status,403);
  }
  assert.equal((await r.api('/api/account/import/preview',r.user.cookie,{...archive({[S.LEDGER_FILE]:{}}),writeVersion:2,requestId:'import_private_chest'})).status,400);
  const other=await r.register('chest-other');
  assert.equal((await r.api('/api/rewards/chest',other.cookie,payload)).body.error,'chest_revision_conflict');
  r.seed({settings:{marker:'other-tab'}});
  assert.equal((await r.api('/api/rewards/chest',r.user.cookie,payload)).body.error,'chest_receipt_state_changed');
  assert.deepEqual(r.read('settings'),{marker:'other-tab'});
});
test('daily chest: portable legacy progress survives but cannot reset already issued tickets', {timeout:30000}, async t => {
  const r=await runtime(t), before=fixture(); r.seed(before);
  for(let n=0;n<3;n++) assert.equal((await r.api('/api/rewards/chest',r.user.cookie,request(r))).status,200);
  const ledger=clone(r.read(S.LEDGER_FILE));
  const imported=await r.prepare({lootbox:before.lootbox,settings:{marker:'imported-progress',adminGold:123},purchases:[{id:'historical-item',cost:1}]});
  assert.equal((await r.api('/api/account/import',r.user.cookie,imported)).status,200);
  assert.deepEqual(r.read('lootbox'),before.lootbox); assert.equal(r.read('settings').adminGold,123);
  assert.deepEqual(r.read(S.LEDGER_FILE),ledger);
  assert.deepEqual((await r.api('/api/auth/me',r.user.cookie)).body.dailyChest.cursor,ledger.cursor,
    'reload exposes issued counters despite the imported old lootbox');
  const denied=await r.api('/api/rewards/chest',r.user.cookie,request(r));
  assert.equal(denied.status,409); assert.equal(denied.body.error,'chest_unavailable');
  assert.deepEqual(r.read(S.LEDGER_FILE),ledger);
});
test('daily chest: SIGKILL recovery covers grant and private receipt in the one account WAL', {timeout:45000}, async t => {
  const r=await runtime(t);
  for(const point of ['after_settings_write','after_tasks_write','after_lootbox_write','after_chest_receipts_write','after_committed_journal']) {
    await t.test(point,async () => {
      await r.stop(); r.seed(fixture());
      fs.rmSync(path.join(r.userDir,S.LEDGER_FILE+'.json'),{force:true});
      await r.start(); const payload=request(r), before=r.snapshot();
      await r.stop(); await r.start({COMMITMENT_CRASH_AT:point});
      const died=new Promise(resolve=>r.child().once('exit',(code,signal)=>resolve({code,signal})));
      await assert.rejects(()=>r.api('/api/rewards/chest',r.user.cookie,payload));
      assert.equal((await died).signal,'SIGKILL'); await r.start();
      if(point==='after_committed_journal') {
        assert.equal(r.read('lootbox').opened,1); assert.equal(r.read(S.LEDGER_FILE).receipts.length,1);
      } else assert.deepEqual(Object.fromEntries(Object.entries(r.snapshot()).map(([n,v])=>[n,JSON.parse(v)])),Object.fromEntries(Object.entries(before).map(([n,v])=>[n,JSON.parse(v)])),'prepared write rolls all slots back');
      const retry=await r.api('/api/rewards/chest',r.user.cookie,payload);
      assert.equal(retry.status,200,JSON.stringify(retry.body)); assert.equal(C.receiptValid(retry.body,payload),true);
      assert.equal(r.read('lootbox').opened,1); assert.equal(r.read(S.LEDGER_FILE).receipts.length,1);
    });
  }
});
