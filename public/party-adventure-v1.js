/* Durable cooperative expeditions. No gold/XP writer; saved effort is the only contribution. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PartyAdventureV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const nodes=Object.freeze([{id:'camp',x:19,y:74},{id:'grove',x:25,y:29},{id:'bridge',x:49,y:51},{id:'workshop',x:79,y:75},{id:'ruins',x:79,y:28}]);
 const routes=Object.freeze([{id:'grove',stages:[{node:'grove',target:2},{node:'bridge',target:2},{node:'ruins',target:3}]},{id:'workshop',stages:[{node:'workshop',target:2},{node:'bridge',target:3},{node:'ruins',target:4}]}]);
 const fail=code=>{throw Object.assign(Error(code),{code});},record=x=>x&&typeof x==='object'&&!Array.isArray(x),stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x)),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const empty=()=>({version:1,revision:0,runs:[],positions:[],receipts:[]});
 const spec=id=>routes.find(r=>r.id===id),node=id=>nodes.find(n=>n.id===id);
 function validate(raw){
  if(raw===undefined)return empty();
  if(!record(raw)||raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.runs)||raw.runs.length>2||new Set(raw.runs.map(r=>r?.id)).size!==raw.runs.length||raw.runs.filter(r=>!r.completedAt).length>1||!Array.isArray(raw.positions)||raw.positions.length>6||!Array.isArray(raw.receipts)||raw.receipts.length>128)fail('adventure_storage');
  const sources=[];
  for(const r of raw.runs){
   const route=spec(r?.id);if(!route||!stamp(r.startedAt)||!Array.isArray(r.steps)||r.steps.length>route.stages.reduce((a,s)=>a+s.target,0)||!Number.isInteger(r.anonymousActors)||r.anonymousActors<0||r.anonymousActors>16||r.completedAt!==null&&!stamp(r.completedAt))fail('adventure_storage');
   let offset=0;for(const stage of route.stages){for(const s of r.steps.slice(offset,offset+stage.target)){if(!record(s)||s.node!==stage.node||!stamp(s.at)||Date.parse(s.at)<Date.parse(r.startedAt)||!(s.actor===null&&s.source===null||hash(s.actor)&&hash(s.source)))fail('adventure_storage');if(s.source)sources.push(s.source);}offset+=stage.target;}
   if((r.steps.length===offset)!==!!r.completedAt)fail('adventure_storage');
  }
  if(new Set(sources).size!==sources.length||new Set(raw.positions.map(p=>p?.actor)).size!==raw.positions.length||raw.positions.some(p=>!record(p)||typeof p.actor!=='string'||!p.actor||p.actor.length>100||!node(p.node)||!['male','female'].includes(p.gender)||!stamp(p.at))||raw.receipts.some(r=>!record(r)||typeof r.id!=='string'||!hash(r.actor)||typeof r.fingerprint!=='string'))fail('adventure_storage');
  return raw;
 }
 const active=raw=>validate(raw).runs.find(r=>!r.completedAt)||null;
 function stage(run){let n=run.steps.length;for(const s of spec(run.id).stages){if(n<s.target)return {...s,progress:n};n-=s.target;}return null;}
 function openNodes(run){if(!run)return ['camp'];const current=stage(run),stages=spec(run.id).stages;return ['camp',...stages.slice(0,current?stages.findIndex(s=>s.node===current.node)+1:3).map(s=>s.node)];}
 function path(run,from,to){const open=openNodes(run);if(!open.includes(from))from='camp';if(!open.includes(to))return [];
  // Physical footpaths are independent of encounter locks; only the destination is selectable.
  const links={camp:['grove'],grove:['camp','bridge'],bridge:['grove','workshop','ruins'],workshop:['bridge'],ruins:['bridge']},queue=[[from]];
  while(queue.length){const route=queue.shift(),last=route.at(-1);if(last===to)return route;for(const next of links[last])if(!route.includes(next))queue.push([...route,next]);}return [];
 }
 function consumed(raw,source){return validate(raw).runs.some(r=>r.steps.some(s=>s.source===source));}
 function eligible(raw,task,source,now,blocked=[]){const run=active(raw);return !!(run&&task?.done===true&&stamp(task.completedAt)&&Date.parse(task.completedAt)>=Date.parse(run.startedAt)&&Date.parse(task.completedAt)<=Date.parse(now)&&hash(source)&&!consumed(raw,source)&&!blocked.includes(source));}
 function view(raw,members=[]){const s=validate(raw);return {version:1,revision:s.revision,runs:s.runs.map(r=>({id:r.id,startedAt:r.startedAt,completedAt:r.completedAt,progress:r.steps.length,target:spec(r.id).stages.reduce((a,b)=>a+b.target,0),contributors:new Set(r.steps.map(x=>x.actor).filter(Boolean)).size+r.anonymousActors,stage:stage(r),open:openNodes(r)})),positions:s.positions.filter(p=>members.includes(p.actor)).map(p=>({...p}))};}
 function change(raw,input,ctx){
  if(!record(input)||Object.keys(input).sort().join('|')!=='action|gender|node|operationId|partyId|revision|route|share|sourceType|taskId'||!['start','move','contribute'].includes(input.action)||!spec(input.route)||!node(input.node)||!['male','female'].includes(input.gender)||!['task','habit','focus'].includes(input.sourceType)||typeof input.operationId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(input.operationId)||!Number.isSafeInteger(input.revision)||input.revision<0||(input.action==='contribute'?typeof input.taskId!=='string'||!input.taskId||input.taskId.length>200:input.taskId!==null))fail('adventure_request');
  if(input.share!==true)fail('adventure_consent');if(input.partyId!==ctx.partyId)fail('adventure_conflict');
  const state=structuredClone(validate(raw)),fp=JSON.stringify([input.action,input.route,input.node,input.gender,input.taskId,input.sourceType,input.revision,input.partyId]),prior=state.receipts.find(r=>r.id===input.operationId&&r.actor===ctx.actor);
  if(prior){if(prior.fingerprint!==fp)fail('adventure_conflict');return {state,replay:true};}
  if(input.revision!==state.revision)fail('adventure_conflict');
  let run=state.runs.find(r=>r.id===input.route);
  if(input.action==='start'){
   if(run||active(state)||input.node!=='camp')fail('adventure_conflict');
   run={id:input.route,startedAt:ctx.now,completedAt:null,anonymousActors:0,steps:[]};state.runs.push(run);state.positions=[];
  }else{
   if(!run||active(state)&&active(state).id!==run.id)fail('adventure_conflict');
   if(!openNodes(run).includes(input.node))fail('adventure_locked');
   if(input.action==='contribute'){
    const step=stage(run),position=state.positions.find(p=>p.actor===ctx.userId);
    if(!step||step.node!==input.node||position?.node!==input.node)fail('adventure_locked');
    if(!eligible(state,ctx.task,ctx.source,ctx.now,ctx.blocked))fail('adventure_source');
    const target=spec(run.id).stages.reduce((a,s)=>a+s.target,0),actors=new Set([...run.steps.map(s=>s.actor).filter(Boolean),ctx.actor]);
    if(run.steps.length+1===target&&actors.size+run.anonymousActors<2)fail('adventure_partner');
    run.steps.push({node:input.node,actor:ctx.actor,source:ctx.source,at:ctx.now});if(run.steps.length===target)run.completedAt=ctx.now;
   }
  }
  if(input.action!=='contribute')state.positions=[...state.positions.filter(p=>p.actor!==ctx.userId),{actor:ctx.userId,node:input.node,gender:input.gender,at:ctx.now}];
  state.revision++;state.receipts.push({id:input.operationId,actor:ctx.actor,fingerprint:fp});state.receipts=state.receipts.slice(-128);validate(state);return {state,replay:false};
 }
 function depart(raw,userId){if(raw===undefined)return undefined;const s=structuredClone(validate(raw));s.positions=s.positions.filter(p=>p.actor!==userId);s.revision++;return s;}
 function forget(raw,userId,actor){if(raw===undefined)return undefined;const s=depart(raw,userId);for(const r of s.runs)if(r.steps.some(x=>x.actor===actor)){r.anonymousActors++;r.steps=r.steps.map(x=>x.actor===actor?{node:x.node,at:x.at,actor:null,source:null}:x);}s.receipts=s.receipts.filter(x=>x.actor!==actor);return s;}
 return Object.freeze({nodes,routes,spec,node,empty,validate,active,stage,openNodes,path,consumed,eligible,view,change,depart,forget});
});
