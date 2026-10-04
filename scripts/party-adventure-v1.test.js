'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const A=require('../public/party-adventure-v1'),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),now='2026-10-04T17:00:00Z';
const ctx=(id='a')=>({partyId:'p',userId:id,actor:hash(id),source:hash('source-'+id),now,blocked:[],task:{id:'q',done:true,completedAt:now}});
const command=(state,extra={})=>({action:'start',route:'grove',node:'camp',gender:'male',partyId:'p',revision:state?.revision||0,share:true,sourceType:'task',taskId:null,operationId:crypto.randomUUID(),...extra});
test('map has two complete routes, locked encounters, durable positions and two-person finale',()=>{
 let s=A.change(undefined,command(),ctx()).state;assert.deepEqual(A.openNodes(A.active(s)),['camp','grove']);assert.throws(()=>A.change(s,command(s,{action:'move',node:'ruins'}),ctx()),{code:'adventure_locked'});
 const sources=[];for(const stage of A.spec('grove').stages){s=A.change(s,command(s,{action:'move',node:stage.node}),ctx()).state;for(let i=0;i<stage.target;i++){const source=hash(stage.node+i),c={...ctx(),source};sources.push(source);const cmd=command(s,{action:'contribute',node:stage.node,taskId:stage.node+i});if(stage.node==='ruins'&&i===2){assert.throws(()=>A.change(s,cmd,c),{code:'adventure_partner'});s=A.change(s,command(s,{action:'move',node:'ruins'}),ctx('b')).state;s=A.change(s,{...cmd,revision:s.revision},{...c,...ctx('b'),source}).state;}else s=A.change(s,cmd,c).state;}}
 assert(A.view(s,['a','b']).runs[0].completedAt);assert.equal(A.view(s).runs[0].progress,7);assert.equal(A.view(s).runs[0].contributors,2);assert.equal(A.consumed(s,sources[0]),true);
 const text=JSON.stringify(A.view(s,['a','b']));assert(!text.includes(hash('a')));assert(!text.includes(sources[0]));
 s=A.change(s,command(s,{route:'workshop'}),ctx()).state;assert.equal(s.runs.length,2);assert.equal(A.eligible(s,ctx().task,sources[0],now),false);assert.deepEqual(A.path(A.active(s),'camp','workshop'),['camp','grove','bridge','workshop']);
 const departed=A.depart(s,'a');assert.equal(departed.positions.length,0);assert.equal(departed.runs[0].steps.length,7);
 const forgotten=A.forget(s,'a',hash('a'));assert.equal(forgotten.runs[0].steps.length,7);assert(!JSON.stringify(forgotten).includes(hash('a')));A.validate(forgotten);
});
test('request whitelist, consent, source freshness, no mutation and no duplicate replay',()=>{
 let s=A.change(undefined,command(),ctx()).state;s=A.change(s,command(s,{action:'move',node:'grove'}),ctx()).state;
 const good=command(s,{action:'contribute',node:'grove',taskId:'q'}),before=JSON.stringify(s);
 for(const patch of [{actor:'b'},{share:false},{partyId:'other'},{revision:0},{sourceType:'xp'},{gender:'script'}])assert.throws(()=>A.change(s,{...good,...patch},ctx()));assert.equal(JSON.stringify(s),before);
 for(const task of [{done:false,completedAt:now},{done:true,completedAt:'2020-01-01'},{done:true,completedAt:'2030-01-01'},null])assert.throws(()=>A.change(s,good,{...ctx(),task}),{code:'adventure_source'});
 assert.throws(()=>A.change(s,good,{...ctx(),blocked:[ctx().source]}),{code:'adventure_source'});
 s=A.change(s,good,ctx()).state;assert(A.change(s,good,{...ctx(),task:null}).replay);assert.equal(s.runs[0].steps.length,1);assert.throws(()=>A.change(s,{...good,node:'bridge'},ctx()),{code:'adventure_conflict'});
 assert.throws(()=>A.change(s,command(s,{action:'contribute',node:'grove',taskId:'q'}),ctx()),{code:'adventure_source'});
 for(const bad of [null,{}, {...s,revision:-1},{...s,runs:[...s.runs,...s.runs]},{...s,positions:[{actor:'a',node:'script'}]}])assert.throws(()=>A.validate(bad),{code:'adventure_storage'});
});
test('adventure HTTP: authority, real shared state, private sources, failure/restart/replay and lifecycle',{timeout:60000},async t=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'satoru-adventure-')),base='http://127.0.0.1:52048',partyFile=path.join(dir,'parties.json'),fault=path.join(dir,'fault'),preload=path.join(dir,'preload.cjs');
 fs.writeFileSync(preload,`const fs=require('node:fs'),old=fs.renameSync;fs.renameSync=function(a,b){let mode;try{mode=fs.readFileSync(${JSON.stringify(fault)},'utf8')}catch{};if(b===${JSON.stringify(partyFile)}&&mode==='before')throw Error('qa failure');const r=old.apply(this,arguments);if(b===${JSON.stringify(partyFile)}&&mode==='crash'){fs.unlinkSync(${JSON.stringify(fault)});process.exit(89)}return r;};`);
 let child;const stop=async()=>{if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});};
 async function launch(){child=spawn(process.execPath,['--require',preload,'server.js'],{cwd:root,env:{...process.env,DATA_DIR:dir,PORT:'52048',HOST:'127.0.0.1',PUSH_SCHED:'off'},stdio:'ignore'});for(let i=0;i<200;i++){try{if((await fetch(base+'/api/version')).ok)return;}catch{}await new Promise(r=>setTimeout(r,20));}throw Error('startup');}
 t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
 async function api(route,user,body,headers={}){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{cookie:user?.cookie||'','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:(r.headers.get('set-cookie')||'').split(';')[0]};}
 const adv=(u,b,h)=>api('/api/party/expedition',u,b,h);await launch();const users=[],password='qa-adventure-password';for(const name of ['Alice','Bob','Other'])users.push(await api('/api/auth/register',null,{name,email:name+'@example.test',password}));const[a,b,out]=users;
 const party=(await api('/api/party/create',a,{name:'Adventure QA',shareProgress:true,acknowledgedVisibility:true})).data.party;assert.equal((await api('/api/party/join',b,{code:party.code,shareProgress:true,acknowledgedVisibility:true})).status,200);
 const cmd=async(u,extra={})=>({...command(),partyId:party.id,revision:(await adv(u)).data.adventure.revision,...extra});
 assert.equal((await adv(null)).status,401);assert.equal((await adv(out)).status,404);const start=await cmd(a);assert.equal((await adv(a,start,{Origin:'https://foreign.test'})).status,403);assert.equal((await adv(a,{...start,actor:b.data.id})).status,400);assert.equal((await adv(a,{...start,share:false})).status,412);assert.equal((await adv(a,start)).status,200);
 const taskfile=u=>path.join(dir,'users',u.data.id,'tasks.json');for(const u of[a,b]){fs.mkdirSync(path.dirname(taskfile(u)),{recursive:true});fs.writeFileSync(taskfile(u),JSON.stringify(Array.from({length:12},(_,i)=>({id:u.data.id+i,title:'PRIVATE_'+u.data.id+i,done:true,completedAt:new Date().toISOString(),xpAwarded:17,goldAwarded:7}))));}
 const initial=fs.readFileSync(taskfile(a),'utf8');assert.equal((await adv(a,await cmd(a,{action:'move',node:'ruins'}))).data.error,'adventure_locked');assert.equal((await adv(a,await cmd(a,{action:'move',node:'grove'}))).status,200);
 assert.equal((await adv(a,await cmd(a,{action:'contribute',node:'grove',taskId:b.data.id+'0'}))).status,409);
 const first=await cmd(a,{action:'contribute',node:'grove',taskId:a.data.id+'0'});fs.writeFileSync(fault,'before');assert.equal((await adv(a,first)).status,503);fs.unlinkSync(fault);assert.equal((await adv(a)).data.adventure.runs[0].progress,0);
 fs.writeFileSync(fault,'crash');await assert.rejects(adv(a,first));await stop();await launch();assert.equal((await adv(a,first)).data.replay,true);assert.equal((await adv(a)).data.adventure.runs[0].progress,1);
 assert.equal((await adv(a,await cmd(a,{action:'contribute',node:'grove',taskId:a.data.id+'0'}))).data.error,'adventure_source');
 let index=1;for(const node of['grove','bridge','ruins']){await adv(a,await cmd(a,{action:'move',node}));let current=(await adv(a)).data.adventure.runs[0];while(current.stage?.node===node){const c=await cmd(a,{action:'contribute',node,taskId:a.data.id+index++});if(current.progress===6){assert.equal((await adv(a,c)).data.error,'adventure_partner');await adv(b,await cmd(b,{action:'move',node}));assert.equal((await adv(b,await cmd(b,{action:'contribute',node,taskId:b.data.id+'0'}))).status,200);break;}assert.equal((await adv(a,c)).status,200);current=(await adv(a)).data.adventure.runs[0];}}
 let response=(await adv(b)).data;assert(response.adventure.runs[0].completedAt);assert(!JSON.stringify(response).includes('PRIVATE_'+a.data.id));assert(!JSON.stringify(response).includes('receipts'));assert.equal(fs.readFileSync(taskfile(a),'utf8'),initial);assert(!fs.existsSync(path.join(path.dirname(taskfile(a)),'purchases.json')));
 // A source spent on the adventure cannot also advance the room project.
 const projectStart={action:'start',operationId:crypto.randomUUID(),partyId:party.id,projectId:'hearth',revision:0,share:true,sourceType:'task',taskId:null};await api('/api/party/projects',a,projectStart);const tasks=JSON.parse(fs.readFileSync(taskfile(a)));tasks[0].completedAt=new Date().toISOString();fs.writeFileSync(taskfile(a),JSON.stringify(tasks));
 assert.equal((await api('/api/party/projects',a,{...projectStart,action:'contribute',operationId:crypto.randomUUID(),revision:1,taskId:a.data.id+'0'})).data.error,'project_task');
 // The reverse direction is protected too, including stale movement revisions.
 assert.equal((await adv(a,await cmd(a,{route:'workshop'}))).status,200);
 tasks[11].completedAt=new Date().toISOString();fs.writeFileSync(taskfile(a),JSON.stringify(tasks));
 assert.equal((await api('/api/party/projects',a,{...projectStart,action:'contribute',operationId:crypto.randomUUID(),revision:1,taskId:a.data.id+'11'})).status,200);
 const stale=await cmd(a,{route:'workshop',action:'move',node:'workshop'});
 assert.equal((await adv(b,await cmd(b,{route:'workshop',action:'move',node:'workshop'}))).status,200);
 assert.equal((await adv(a,stale)).status,409);
 assert.equal((await adv(a,await cmd(a,{route:'workshop',action:'move',node:'workshop'}))).status,200);
 assert.equal((await adv(a,await cmd(a,{route:'workshop',action:'contribute',node:'workshop',taskId:a.data.id+'11'}))).data.error,'adventure_source');
 await api('/api/party/leave',a,{});assert.equal((await adv(a)).status,404);assert(!(await adv(b)).data.adventure.positions.some(p=>p.actor===a.data.id));await api('/api/party/join',a,{code:party.code,shareProgress:true,acknowledgedVisibility:true});assert.equal((await adv(a)).data.adventure.runs[0].progress,7);
 await api('/api/auth/delete-account',a,{confirm:'DELETE',password});response=(await adv(b)).data;assert.equal(response.adventure.runs[0].progress,7);assert.equal(response.adventure.runs[0].contributors,2);
 const rows=JSON.parse(fs.readFileSync(partyFile));rows[0].adventureWork.version=99;fs.writeFileSync(partyFile,JSON.stringify(rows));assert.equal((await adv(b)).status,503);
});
