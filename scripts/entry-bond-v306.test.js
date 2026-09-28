'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const source=app.slice(app.indexOf('async function completeTask('),app.indexOf('\nfunction taskCompletionFocusPlan'));
function fixture(){
const task={id:'entry',entry:true,done:false};let queue=Promise.resolve();
const c={State:{tasks:[task],settings:{companion:{bond:5}}},structuredClone,Date,Math,CSS:{escape:x=>x},window:{},setTimeout:()=>0,questCommitment:()=>false,charLevel:()=>1,todayStr:()=> '2026-09-28',itemXp:()=>0,dayOf:()=> '2026-09-28',syncGoalStepFromQuest:async()=>{},firstValueRecordOutcome:async()=>{},guideV3State:()=>null,guideV3RuntimeAllowed:()=>false,ensureCompanion:s=>s.companion,track:()=>{},skillById:()=>null,t:x=>x,dayPick:()=> 'Done',ENTRY_DONE_LINES:[],systemMode:()=>false,toast:()=>{},sfx:()=>{},checkAchievements:()=>{},render:()=>{},triggerAvatarReaction:()=>{},publishLeaderboard:()=>{},restoreFocusTimerSnapshot:()=>{}};
let disk=structuredClone(c.State);let fail=false,lost=false;
c.commitmentDataCommit=build=>{const job=queue.then(()=>{let next=build(structuredClone(disk));if(fail||!next)return false;disk=structuredClone(next);if(lost)return false;Object.assign(c.State,structuredClone(next));return true;});queue=job;return job;};
vm.createContext(c);vm.runInContext(source,c);
return {c,disk:()=>disk,fail:v=>fail=v,lost:v=>lost=v,complete:()=>c.completeTask(c.State.tasks[0],null)};
}
test('entry failure changes neither task nor bond; retry commits both once',async()=>{const f=fixture();f.fail(true);assert.equal(await f.complete(),false);assert.equal(f.c.State.tasks[0].done,false);assert.equal(f.disk().settings.companion.bond,5);f.fail(false);assert.equal(await f.complete(),true);assert.equal(f.disk().tasks[0].done,true);assert.equal(f.disk().settings.companion.bond,7);assert.equal(await f.complete(),false)});
test('lost response followed by replay does not award bond twice',async()=>{const f=fixture();f.lost(true);assert.equal(await f.complete(),false);assert.equal(f.c.State.tasks[0].done,false);assert.equal(f.disk().settings.companion.bond,7);f.lost(false);assert.equal(await f.complete(),true);assert.equal(f.c.State.settings.companion.bond,7)});
test('parallel completion uses one award and undo/recomplete preserves the marker',async()=>{const f=fixture();await Promise.all([f.complete(),f.complete()]);assert.equal(f.disk().settings.companion.bond,7);f.disk().tasks[0].done=false;f.c.State.tasks[0].done=false;assert.equal(await f.complete(),true);assert.equal(f.disk().settings.companion.bond,7)});
