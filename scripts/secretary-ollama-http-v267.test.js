'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('real HTTP boundary isolates local inference by account, ignores client destinations and never accepts cloud aliases', { timeout: 30000 }, async t => {
  const seen = []; let cloud = false;
  const provider = http.createServer(async (req,res) => {
    let raw='';for await(const chunk of req)raw+=chunk;
    seen.push({path:req.url,body:JSON.parse(raw)});
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url === '/api/show'
      ? {details:{format:'gguf'},capabilities:['completion'],...(cloud?{remote_host:'https://ollama.com'}:{})}
      : {done:true,done_reason:'stop',message:{content:'Встреча назначена на вторник в 18:30.'},prompt_eval_count:10,eval_count:10}));
  });
  await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
  t.after(()=>provider.close());
  const probe = http.createServer(); await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'satoru-ollama-'));
  const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dir,PUSH_SCHED:'off',SATORU_OLLAMA_ENABLED:'1',SATORU_OLLAMA_USERS:'owner',OLLAMA_MODEL:'fixture:9b',OLLAMA_BASE_URL:`http://127.0.0.1:${provider.address().port}`},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill();await ended;}fs.rmSync(dir,{recursive:true,force:true});});
  let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  const base=`http://127.0.0.1:${port}`;
  for(let n=0;n<200;n++){if(child.exitCode!==null)throw Error(output);try{if(output.includes('Satoru запущен:')&&(await fetch(base+'/api/auth/profiles')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
  async function request(route,body,cookie='') {const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  assert.equal((await request('/api/ai/chat',{provider:'ollama',messages:[{content:'Привет'}]})).status,401);
  const owner=await request('/api/auth/register',{name:'Owner',email:'owner@example.test',password:'synthetic-ollama-pass'});
  const outsider=await request('/api/auth/register',{name:'Other',email:'other@example.test',password:'synthetic-ollama-pass'});
  assert.equal(owner.data.id,'owner');
  assert.equal((await request('/api/ai/keys',undefined,owner.cookie)).data.ollama,true);
  const otherStatus=(await request('/api/ai/keys',undefined,outsider.cookie)).data;
  assert.equal(otherStatus.ollama,false);assert.equal(otherStatus.ollamaStatus.model,null);
  const payload={provider:'ollama',host:'https://evil.invalid',model:'fake:cloud',system:'Use supplied facts.',messages:[{role:'user',content:'Когда встреча?'}]};
  assert.equal((await request('/api/ai/chat',payload,outsider.cookie)).status,502);assert.equal(seen.length,0);
  const answer=await request('/api/ai/chat',payload,owner.cookie);
  assert.equal(answer.status,200,JSON.stringify(answer.data));assert.equal(answer.data.source,'local');
  assert.ok(seen.some(row=>row.path==='/api/chat'&&row.body.model==='fixture:9b'));
  assert.equal((await request('/api/ai/keys',{ollama:'forged'},outsider.cookie)).data.ollama,false);
  cloud=true;seen.length=0;
  const denied=await request('/api/ai/chat',payload,owner.cookie);
  assert.equal(denied.status,502);assert.equal(seen.length,1);assert.equal(seen[0].path,'/api/show');
});
