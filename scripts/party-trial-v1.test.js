'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const T=require('../public/party-trial-v1'),A=require('../public/party-adventure-v1'),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),now='2026-10-04T19:00:00Z';
const ctx=(id='a',source='x')=>({partyId:'p',actor:hash(id),now,unlocked:true,source:hash(source),task:{done:true,completedAt:now},blocked:[]});
const cmd=(s,extra={})=>({action:'start',operationId:crypto.randomUUID(),partyId:'p',revision:s?.revision||0,role:'spark',share:true,sourceType:'task',taskId:null,trialId:'sprout',...extra});
test('roles have distinct tactics, phases forecast danger and a breather preserves progress and spent effort',()=>{
 let s=T.change(undefined,cmd(),ctx()).state;
 assert.throws(()=>T.change(s,cmd(s,{action:'strike',taskId:'q'}),{...ctx(),task:null}),{code:'trial_source'});
 const base=s.trials[0];assert.equal(T.preview(base,'spark','strike').damage,3);assert.equal(T.preview(base,'stone','ward').shield,5);assert.equal(T.preview(base,'leaf','inspire').boost,3);
 s=T.change(s,cmd(s,{action:'role',role:'stone'}),ctx('b')).state;
 s=T.change(s,cmd(s,{action:'ward',role:'stone',taskId:'q'}),ctx('b','ward')).state;
 const hit=T.change(s,cmd(s,{action:'strike',taskId:'q'}),ctx('a','hit'));s=hit.state;assert.equal(s.trials[0].steps[1].received,0);assert.equal(s.trials[0].steps[1].blocked,2);assert.equal(s.trials[0].shield,3);
 assert.throws(()=>T.change(s,cmd(s,{action:'role',role:'leaf'}),ctx()),{code:'trial_role_locked'});
 assert.equal(T.phase(s.trials[0]),1);
 let solo=T.change(undefined,cmd(),ctx()).state;for(let i=0;i<5;i++){solo=T.change(solo,cmd(solo,{action:'ward',taskId:'q'+i}),ctx('a','s'+i)).state;}
 // Explicitly test low stamina at a legal checkpoint; guards and support remain different.
 const r={...base,health:1,turn:1,shield:0};assert.equal(T.preview(r,'spark','strike').health,0);assert.equal(T.preview(r,'stone','ward').health,1);assert.equal(T.preview(r,'leaf','inspire').health,1);
});
test('all three trials finish with two contributors, receipt replay and no repeated source across tiers',()=>{
 let s;let count=0;
 for(const spec of T.trials){
  s=T.change(s,cmd(s,{trialId:spec.id}),ctx()).state;s=T.change(s,cmd(s,{trialId:spec.id,action:'role',role:'leaf'}),ctx('b')).state;
  while(T.active(s)){
   const run=T.active(s);if(run.resting){const hp=run.hp;s=T.change(s,cmd(s,{trialId:spec.id,action:'rest'}),ctx()).state;assert.equal(T.active(s).hp,hp);assert.equal(T.active(s).health,8);continue;}
   const who=count++%2?'b':'a',input=cmd(s,{trialId:spec.id,action:who==='b'?'inspire':'strike',role:who==='b'?'leaf':'spark',taskId:'q'+count}),context=ctx(who,'source'+count);
   const result=T.change(s,input,context);s=result.state;assert.equal(T.change(s,input,{...context,task:null}).replay,true);
   assert.throws(()=>T.change(s,{...input,action:'ward'},context),{code:'trial_conflict'});
  }
 }
 assert.equal(s.trials.filter(r=>r.completedAt).length,3);assert.throws(()=>T.change(s,cmd(s),ctx()),{code:'trial_locked'});
 const view=T.view(s,[{id:'public-a',actor:hash('a')},{id:'public-b',actor:hash('b')}],hash('a'));
 assert(!JSON.stringify(view).includes(hash('a')));assert(!JSON.stringify(view).includes(hash('source1')));assert(!JSON.stringify(view).includes('receipts'));assert(view.trials.every(r=>r.contributors===2));
 const forgotten=T.forget(s,hash('a'));assert(!JSON.stringify(forgotten).includes(hash('a')));assert(T.view(forgotten).trials.every(r=>r.contributors===2));assert(T.consumed(forgotten,hash('source2')));T.validate(forgotten);
});
test('solo final, stale revisions, privacy fields, corrupted storage and unearned effort fail without changes',()=>{
 let s=T.change(undefined,cmd(),ctx()).state;
 for(let i=0;i<3;i++)s=T.change(s,cmd(s,{action:'strike',taskId:'q'+i}),ctx('a','q'+i)).state;
 const input=cmd(s,{action:'strike',taskId:'final'}),before=JSON.stringify(s);
 assert.throws(()=>T.change(s,input,ctx('a','final')),{code:'trial_partner'});
 for(const patch of[{actor:'b'},{share:false},{partyId:'else'},{revision:0},{role:'god'},{sourceType:'xp'}])assert.throws(()=>T.change(s,{...input,...patch},ctx()));
 for(const task of[null,{done:false,completedAt:now},{done:true,completedAt:'2020-01-01'},{done:true,completedAt:'2030-01-01'}])assert.throws(()=>T.change(s,input,{...ctx(),task}),{code:'trial_source'});
 assert.throws(()=>T.change(s,input,{...ctx(),blocked:[hash('x')]}),{code:'trial_source'});assert.equal(JSON.stringify(s),before);
 for(const bad of[null,{}, {...s,revision:-1},{...s,trials:[{...s.trials[0],hp:12}]},{...s,trials:[{...s.trials[0],resting:true}]},{...s,roles:[...s.roles,...s.roles]}])assert.throws(()=>T.validate(bad),{code:'trial_storage'});
});
test('trial HTTP: real auth, unlock, atomic failure/replay, shared-source exclusions, role lifecycle and erasure',{timeout:30000},async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'satoru-trial-')),base='http://127.0.0.1:52047',file=path.join(dir,'parties.json'),fault=path.join(dir,'fault'),preload=path.join(dir,'preload.cjs');let child;
 fs.writeFileSync(preload,`const fs=require('node:fs'),rename=fs.renameSync;fs.renameSync=function(a,b){let mode;try{mode=fs.readFileSync(${JSON.stringify(fault)},'utf8')}catch{}if(b===${JSON.stringify(file)}&&mode==='before')throw Error('fault');const r=rename.apply(this,arguments);if(b===${JSON.stringify(file)}&&mode==='crash'){fs.unlinkSync(${JSON.stringify(fault)});process.exit(89);}return r;};`);
 const stop=async()=>{if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});};
 async function launch(){child=spawn(process.execPath,['--require',preload,'server.js'],{cwd:root,env:{...process.env,DATA_DIR:dir,PORT:'52047',HOST:'127.0.0.1',PUSH_SCHED:'off'},stdio:'ignore'});for(let i=0;i<200;i++){if(child.exitCode!==null)throw Error('server exited');try{if((await fetch(base+'/api/version')).ok)return;}catch{}await new Promise(r=>setTimeout(r,20));}throw Error('startup');}
 t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
 async function api(route,user,body,headers={}){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{cookie:user?.cookie||'','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:(r.headers.get('set-cookie')||'').split(';')[0]};}
 await launch();const users=[];for(const name of['Alice','Bob','Outside'])users.push(await api('/api/auth/register',null,{name,email:name+'@example.test',password:'trial-test-password'}));const[a,b,out]=users;
 const p=(await api('/api/party/create',a,{name:'Trial party',shareProgress:true,acknowledgedVisibility:true})).data.party;await api('/api/party/join',b,{code:p.code,shareProgress:true,acknowledgedVisibility:true});
 const trial=(u,input,headers)=>api('/api/party/trial',u,input,headers),command=async(u,extra={})=>({...cmd(),partyId:p.id,revision:(await trial(u)).data.trial.revision,...extra});
 assert.equal((await trial(null)).status,401);assert.equal((await trial(out)).status,404);assert.equal((await trial(a,await command(a))).data.error,'trial_locked');
 // Isolated fixture: existing completed expedition, validated by its actual pure contract.
 let expedition;for(let i=0;i<7;i++){
  const c={partyId:p.id,userId:'fixture'+(i%2),actor:hash('fixture'+i%2),now:new Date().toISOString(),source:hash('old'+i),task:{done:true,completedAt:new Date().toISOString()},blocked:[]};
  const req=(action,node,taskId=null)=>({action,node,taskId,route:'grove',partyId:p.id,revision:expedition?.revision||0,gender:'male',operationId:crypto.randomUUID(),share:true,sourceType:'task'});
  if(!expedition)expedition=A.change(expedition,req('start','camp'),c).state;
  const node=A.stage(A.active(expedition)).node;expedition=A.change(expedition,req('move',node),c).state;expedition=A.change(expedition,req('contribute',node,'q'+i),{...c,now:new Date().toISOString()}).state;
 }
 const rows=JSON.parse(fs.readFileSync(file));rows[0].adventureWork=expedition;fs.writeFileSync(file,JSON.stringify(rows));
 const start=await command(a);assert.equal((await trial(a,{...start,share:false})).status,412);assert.equal((await trial(a,start,{Origin:'https://foreign.test'})).status,403);assert.equal((await trial(a,{...start,damage:99})).status,400);assert.equal((await trial(a,start)).status,200);
 const tf=u=>path.join(dir,'users',u.data.id,'tasks.json');for(const u of[a,b]){fs.mkdirSync(path.dirname(tf(u)),{recursive:true});fs.writeFileSync(tf(u),JSON.stringify(Array.from({length:20},(_,i)=>({id:'q'+i,title:'PRIVATE_'+u.data.id,done:true,completedAt:new Date().toISOString(),xpAwarded:10,goldAwarded:3}))));}
 assert(!(JSON.stringify((await trial(b)).data).includes('PRIVATE_'+a.data.id)));const initial=fs.readFileSync(tf(a),'utf8');
 const strike=await command(a,{action:'strike',taskId:'q0'});fs.writeFileSync(fault,'before');assert.equal((await trial(a,strike)).status,503);fs.unlinkSync(fault);assert.equal((await trial(a)).data.trial.trials[0].turn,0);
 fs.writeFileSync(fault,'crash');await assert.rejects(trial(a,strike));await stop();await launch();assert.equal((await trial(a,strike)).data.replay,true);assert.equal((await trial(a)).data.trial.trials[0].turn,1);
 assert.equal((await trial(a,await command(a,{action:'role',role:'leaf'}))).data.error,'trial_role_locked');assert.equal((await trial(a,await command(a,{action:'strike',taskId:'q0'}))).data.error,'trial_source');assert.equal(fs.readFileSync(tf(a),'utf8'),initial);
 const project={action:'start',operationId:crypto.randomUUID(),partyId:p.id,projectId:'hearth',revision:0,share:true,sourceType:'task',taskId:null};await api('/api/party/projects',a,project);
 const tasks=JSON.parse(fs.readFileSync(tf(a)));tasks[0].completedAt=tasks[1].completedAt=new Date().toISOString();fs.writeFileSync(tf(a),JSON.stringify(tasks));
 assert.equal((await api('/api/party/projects',a,{...project,action:'contribute',revision:1,operationId:crypto.randomUUID(),taskId:'q0'})).data.error,'project_task');
 assert.equal((await api('/api/party/projects',a,{...project,action:'contribute',revision:1,operationId:crypto.randomUUID(),taskId:'q1'})).status,200);
 assert.equal((await trial(a,await command(a,{action:'strike',taskId:'q1'}))).data.error,'trial_source');
 await api('/api/party/leave',a,{});assert.equal((await trial(a)).status,404);assert.equal((await trial(b)).data.trial.roles.length,0);await api('/api/party/join',a,{code:p.code,shareProgress:true,acknowledgedVisibility:true});assert((await trial(a)).data.trial.trials[0].myRoleLocked);
 await api('/api/auth/delete-account',a,{confirm:'DELETE',password:'trial-test-password'});const view=(await trial(b)).data.trial;assert.equal(view.trials[0].contributors,1);assert.equal(view.trials[0].log[0].memberId,null);assert.equal((await trial(a)).status,401);
 const damaged=JSON.parse(fs.readFileSync(file));damaged[0].trialWork.trials[0].hp=999;fs.writeFileSync(file,JSON.stringify(damaged));assert.equal((await trial(b)).status,503);
});
