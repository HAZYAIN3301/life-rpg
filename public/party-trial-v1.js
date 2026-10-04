/* Cooperative, untimed tactical trials. Saved effort pays for a turn, never XP or gold. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PartyTrialV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const roles=['spark','stone','leaf'],actions=['strike','ward','inspire'];
 const trials=[{id:'sprout',hp:12,power:2},{id:'sentinel',hp:18,power:3},{id:'ancient',hp:24,power:4}];
 const spec=id=>trials.find(t=>t.id===id),fail=code=>{throw Object.assign(Error(code),{code});};
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 const empty=()=>({version:1,revision:0,roles:[],trials:[],receipts:[]});
 function validate(raw){
  if(raw===undefined)return empty();
  if(!object(raw)||raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.roles)||raw.roles.length>100||raw.roles.some(r=>!hash(r.actor)||!roles.includes(r.role))||new Set(raw.roles.map(r=>r.actor)).size!==raw.roles.length||!Array.isArray(raw.trials)||raw.trials.length>3||!Array.isArray(raw.receipts)||raw.receipts.length>128)fail('trial_storage');
  const sources=[];
  raw.trials.forEach((run,index)=>{
   const s=trials[index];
   if(!object(run)||run.id!==s.id||!stamp(run.startedAt)||run.completedAt!==null&&!stamp(run.completedAt)||!integer(run.hp,0,s.hp)||!integer(run.health,0,8)||!integer(run.shield,0,6)||!integer(run.boost,0,3)||!integer(run.turn,0,s.hp)||!integer(run.rests,0,s.hp)||typeof run.resting!=='boolean'||!Array.isArray(run.steps)||run.steps.length!==run.turn||!integer(run.anonymousActors,0,s.hp)||!Array.isArray(run.log)||run.log.length>64)fail('trial_storage');
   if((run.hp===0)!==!!run.completedAt||run.resting!==(run.health===0)||run.completedAt&&run.resting||index<raw.trials.length-1&&!run.completedAt)fail('trial_storage');
   for(const step of run.steps){if(!object(step)||!(hash(step.actor)&&hash(step.source)||step.actor===null&&step.source===null)||!actions.includes(step.action)||!roles.includes(step.role)||!stamp(step.at)||Date.parse(step.at)<Date.parse(run.startedAt)||!integer(step.damage,1,6)||!integer(step.received,0,6)||!integer(step.blocked,0,6))fail('trial_storage');if(step.source)sources.push(step.source);}
   if(run.hp!==Math.max(0,s.hp-run.steps.reduce((sum,step)=>sum+step.damage,0)))fail('trial_storage');
   if(run.log.some(e=>!object(e)||!['strike','ward','inspire','rest','win'].includes(e.action)||!(e.actor===null||hash(e.actor))||!stamp(e.at)))fail('trial_storage');
  });
  if(new Set(sources).size!==sources.length||raw.receipts.some(r=>!object(r)||typeof r.id!=='string'||!hash(r.actor)||typeof r.fingerprint!=='string'))fail('trial_storage');
  return raw;
 }
 const active=s=>validate(s).trials.find(r=>!r.completedAt)||null;
 const consumed=(raw,source)=>validate(raw).trials.some(r=>r.steps.some(s=>s.source===source));
 function eligible(raw,task,source,now,blocked=[]){const run=active(raw);return !!(run&&!run.resting&&task?.done===true&&stamp(task.completedAt)&&Date.parse(task.completedAt)>=Date.parse(run.startedAt)&&Date.parse(task.completedAt)<=Date.parse(now)&&hash(source)&&!consumed(raw,source)&&!blocked.includes(source));}
 const phase=run=>Math.min(2,Math.floor((spec(run.id).hp-run.hp)*3/spec(run.id).hp));
 const intent=run=>({in:2-run.turn%2,power:Math.min(6,spec(run.id).power+phase(run))});
 function preview(run,role,action){
  if(!run||!roles.includes(role)||!actions.includes(action))return null;
  const out={damage:action==='strike'?2+(role==='spark'?1:0)+run.boost:1,shield:action==='ward'?Math.min(6,run.shield+(role==='stone'?5:3)):run.shield,boost:action==='strike'?0:action==='inspire'?(role==='leaf'?3:2):run.boost,health:action==='inspire'?Math.min(8,run.health+(role==='leaf'?2:1)):run.health,received:0,blocked:0};
  if(run.turn%2===1&&run.hp>out.damage){const power=intent(run).power;out.blocked=Math.min(out.shield,power);out.received=power-out.blocked;out.shield-=out.blocked;out.health=Math.max(0,out.health-out.received);}return out;
 }
 function change(raw,input,ctx){
  if(!object(input)||Object.keys(input).sort().join('|')!=='action|operationId|partyId|revision|role|share|sourceType|taskId|trialId'||!['start','role','rest',...actions].includes(input.action)||!spec(input.trialId)||!roles.includes(input.role)||!['task','habit','focus'].includes(input.sourceType)||typeof input.operationId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(input.operationId)||!Number.isSafeInteger(input.revision)||input.revision<0||(actions.includes(input.action)?typeof input.taskId!=='string'||!input.taskId||input.taskId.length>200:input.taskId!==null))fail('trial_request');
  if(input.share!==true)fail('trial_consent');if(input.partyId!==ctx.partyId)fail('trial_conflict');
  const state=structuredClone(validate(raw)),fingerprint=JSON.stringify([input.action,input.partyId,input.revision,input.role,input.sourceType,input.taskId,input.trialId]),old=state.receipts.find(r=>r.id===input.operationId&&r.actor===ctx.actor);
  if(old){if(old.fingerprint!==fingerprint)fail('trial_conflict');return {state,replay:true};}
  if(input.revision!==state.revision)fail('trial_conflict');
  let run=active(state),role=state.roles.find(r=>r.actor===ctx.actor);
  if(input.action==='start'){
   if(!ctx.unlocked||run||trials[state.trials.length]?.id!==input.trialId)fail('trial_locked');
   run={id:input.trialId,startedAt:ctx.now,completedAt:null,hp:spec(input.trialId).hp,health:8,shield:0,boost:0,turn:0,rests:0,resting:false,anonymousActors:0,steps:[],log:[]};state.trials.push(run);
  }else if(!run||run.id!==input.trialId)fail('trial_conflict');
  if(['start','role'].includes(input.action)){
   if(run.steps.some(s=>s.actor===ctx.actor))fail('trial_role_locked');
   if(role)role.role=input.role;else{if(state.roles.length>=100)fail('trial_roster');state.roles.push({actor:ctx.actor,role:input.role});}
  }else if(input.action==='rest'){
   if(!run.resting)fail('trial_conflict');run.resting=false;run.health=8;run.shield=0;run.boost=0;run.rests++;run.log.push({actor:ctx.actor,action:'rest',at:ctx.now});
  }else{
   if(!role||role.role!==input.role)fail('trial_role');
   if(!eligible(state,ctx.task,ctx.source,ctx.now,ctx.blocked))fail('trial_source');
   const result=preview(run,role.role,input.action),actors=new Set([...run.steps.map(s=>s.actor).filter(Boolean),ctx.actor]);
   if(result.damage>=run.hp&&actors.size+run.anonymousActors<2)fail('trial_partner');
   run.hp=Math.max(0,run.hp-result.damage);run.health=result.health;run.shield=result.shield;run.boost=result.boost;run.turn++;run.resting=run.health===0;
   run.steps.push({actor:ctx.actor,source:ctx.source,role:role.role,action:input.action,damage:result.damage,received:result.received,blocked:result.blocked,at:ctx.now});run.log.push({actor:ctx.actor,action:input.action,at:ctx.now});
   if(!run.hp){run.completedAt=ctx.now;run.log.push({actor:null,action:'win',at:ctx.now});}
  }
  state.revision++;state.receipts.push({id:input.operationId,actor:ctx.actor,fingerprint});state.receipts=state.receipts.slice(-128);validate(state);return {state,replay:false};
 }
 function view(raw,members=[],actor=null){const state=validate(raw),member=hash=>members.find(m=>m.actor===hash)?.id||null;return {version:1,revision:state.revision,roles:state.roles.filter(r=>member(r.actor)).map(r=>({memberId:member(r.actor),role:r.role})),trials:state.trials.map(r=>({id:r.id,startedAt:r.startedAt,completedAt:r.completedAt,hp:r.hp,maxHp:spec(r.id).hp,health:r.health,shield:r.shield,boost:r.boost,turn:r.turn,rests:r.rests,resting:r.resting,phase:phase(r),intent:intent(r),contributors:new Set(r.steps.map(s=>s.actor).filter(Boolean)).size+r.anonymousActors,myRoleLocked:r.steps.some(s=>s.actor===actor),log:r.log.map(e=>({memberId:member(e.actor),action:e.action,at:e.at}))}))};}
 function forget(raw,actor){if(raw===undefined)return undefined;const s=structuredClone(validate(raw));s.roles=s.roles.filter(r=>r.actor!==actor);s.receipts=s.receipts.filter(r=>r.actor!==actor);for(const r of s.trials){if(r.steps.some(x=>x.actor===actor))r.anonymousActors++;r.steps=r.steps.map(x=>x.actor===actor?{...x,actor:null,source:null}:x);r.log=r.log.map(x=>x.actor===actor?{...x,actor:null}:x);}s.revision++;return s;}
 function depart(raw,actor){if(raw===undefined)return undefined;const s=structuredClone(validate(raw));if(!s.trials.some(r=>r.steps.some(step=>step.actor===actor)))s.roles=s.roles.filter(r=>r.actor!==actor);s.revision++;return s;}
 return Object.freeze({roles,actions,trials,spec,empty,validate,active,consumed,eligible,phase,intent,preview,change,view,forget,depart});
});
