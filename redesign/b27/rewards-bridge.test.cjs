const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Model=require('./.checks/live-model.cjs'),Life=require('../../public/reward-life-v1');
function harness(){
 const State={phase:'app',me:{id:'qa'},settings:{skills:[{id:'work',name:'Дело'}],other:17},rewards:[],purchases:[],tasks:[],_accountDataLoadErrors:{}};
 let saved=false,callback=null;const payloads=[],opened=[];
 const context={window:{SatoruLiveModel:Model,RewardLifeV1:Life,StuckTaskV1:require('../../public/stuck-task-v1')},State,Store:{_writeEpoch:1},structuredClone,isPro:()=>false,FREE_REWARDS_MAX:5,REWARD_CATALOG:[],t:x=>x,settingsWriteAllowed:()=>true,accountDataWriteAllowed:()=>true,economySaveUnconfirmed:()=> 'Not confirmed',economyCommit:async p=>{payloads.push(p);if(callback)callback();return saved;},commitmentDataCommit:async build=>{const p=build(structuredClone({settings:State.settings,tasks:State.tasks}));payloads.push(p);if(!saved||!p)return false;State.settings=p.settings;State.tasks=p.tasks;return true;},releaseActiveQuestCommitmentCandidate:()=>({ok:true}),showEconomyConfirm:(...args)=>{opened.push(args);return{};},checkAchievements:()=>{},render:()=>{},todayStr:()=> '2026-10-27'};
 vm.runInNewContext(fs.readFileSync(__dirname+'/rewards-bridge.js','utf8'),context);
 return{State,api:context.window.SatoruRewardsBridge,payloads,opened,scope:{account:'qa',epoch:1},save:v=>saved=v,switchOnCommit:()=>callback=()=>State.me.id='other'};
}
test('failed reward creation leaves state untouched and retry reuses the identical payload object',async()=>{
 const h=harness(),input={reward:{id:'r1',name:'Отдых',cost:25,iconId:'reward.game'},base:null};
 assert.equal((await h.api.run('reward.save',input,h.scope)).ok,false);assert.equal(h.State.rewards.length,0);
 h.save(true);assert.equal((await h.api.run('reward.save',input,h.scope)).ok,true);assert.equal(h.payloads[0],h.payloads[1]);assert.equal(h.State.rewards.length,1);
});
test('rest creation is atomic, repeat-safe and uses actual account spheres',async()=>{
 const h=harness();h.State.purchases=[{id:'p1',rewardId:'r1',name:'Отдых',cost:25,at:'2026-10-27T10:00:00Z'}];
 const input={task:{id:'reward-rest:p1',title:'Отдых',date:'2026-10-27',estimateMin:60,startTime:null,core:false,skillId:'work',skillIds:['work'],layers:[],difficulty:'easy',rewardPurchaseId:'p1'},base:null};
 assert.equal((await h.api.run('reward.rest',input,h.scope)).ok,false);assert.equal(h.State.tasks.length,0);assert.equal(h.State.settings.rewardLifeV1,undefined);
 h.save(true);assert.equal((await h.api.run('reward.rest',input,h.scope)).ok,true);assert.equal(h.State.tasks[0].rewardPurchaseId,'p1');
 assert.equal((await h.api.run('reward.rest',input,h.scope)).ok,true);assert.equal(h.State.tasks.length,1);assert.equal(h.State.purchases[0].cost,25);
 const base=JSON.stringify(h.State.tasks);assert.equal((await h.api.run('reward.life',{id:'p1',status:'planned',date:'2026-10-29'},h.scope)).ok,true);assert.equal(h.State.tasks[0].date,'2026-10-29');assert.equal(h.State.settings.rewardLifeV1.p1.date,'2026-10-29');
 const before=h.State.tasks[0],count=before.postponedCount;await h.api.run('reward.rest',{task:{...before,date:'2026-10-30'},base:Model.editable(before)},h.scope);assert.equal(h.State.tasks[0].postponedCount,count,'future planning is not avoidance');
 for(const date of ['2026-10-27','2026-10-30']){const current=h.State.tasks[0];assert.equal((await h.api.run('reward.rest',{task:{...current,date},base:Model.editable(current)},h.scope)).ok,true);}
 assert.equal(h.State.tasks[0].postponedCount,count+1);assert.equal(h.State.tasks[0].firstDate,'2026-10-27');
});
test('load errors and account switch never apply a reward write to another actor',async()=>{
 const h=harness(),input={reward:{id:'r1',name:'Отдых',cost:25,iconId:'reward.game'},base:null};
 h.State._accountDataLoadErrors.rewards='failed';await assert.rejects(h.api.run('reward.save',input,h.scope));assert.equal(h.payloads.length,0);
 delete h.State._accountDataLoadErrors.rewards;h.save(true);h.switchOnCommit();assert.equal((await h.api.run('reward.save',input,h.scope)).ok,false);assert.equal(h.State.rewards.length,0);
});
test('a malformed reward lifecycle is visible as an error and blocks writes instead of resetting it',async()=>{
 const h=harness();h.State.settings.rewardLifeV1={p1:{status:'broken'}};
 assert.ok(h.api.snapshot().errors.length>0);
 await assert.rejects(h.api.run('reward.pin',{id:null},h.scope));assert.equal(h.payloads.length,0);
});
test('lifecycle and pin persist settings only, leaving immutable purchase debit intact',async()=>{
 const h=harness();h.save(true);h.State.purchases=[{id:'p1',rewardId:'r1',name:'Отдых',cost:25,at:'2026-10-27T10:00:00Z'}];h.State.rewards=[{id:'r1',name:'Отдых',cost:25,iconId:'reward.game'}];
 await h.api.run('reward.life',{id:'p1',status:'used',date:null},h.scope);assert.equal(h.State.settings.rewardLifeV1.p1.status,'used');assert.equal(h.State.settings.other,17);assert.deepEqual(Object.keys(h.payloads[0]),['settings']);assert.equal(h.State.purchases[0].cost,25);
 await h.api.run('reward.pin',{id:'r1'},h.scope);assert.equal(h.State.settings.personalRewardTargetV1,'r1');
});
