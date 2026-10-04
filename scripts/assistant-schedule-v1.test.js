'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const S=require('../public/assistant-schedule-v1'),A=require('../public/assistant-actions-v1');
const task={id:'bio',title:'Biology',date:'2026-10-05',startTime:null,estimateMin:30,done:false,xpAwarded:0,goldAwarded:0};
const command={kind:'quest_schedule',targetId:'bio',date:'2026-10-05',startTime:'10:07',estimateMin:30};
const input=(extra={})=>({command:{...command},tasks:[{...task}],today:'2026-10-04',nowTime:'17:00',expected:S.snapshot(task),...extra});
test('exact proposal preserves minutes, validates owned existing task and strips injected fields',()=>{
 const c={today:'2026-10-04',quests:[task]};
 const r=A.validate({...command,goldAwarded:9000,_scheduleBefore:'forged'},c);assert(r.ok);assert.equal(r.action.startTime,'10:07');assert.equal(r.action.estimateMin,30);assert.equal(r.action.goldAwarded,undefined);assert.equal(r.action._scheduleBefore,undefined);
 assert(!A.validate({...command,targetId:'foreign'},c).ok);assert(!A.validate(command,{...c,quests:[{...task,done:true}]}).ok);
 assert(!A.validate({kind:'quest',title:'New',startTime:'10:07'},c).ok);
});
test('rejects malformed or past dates, ambiguous time and duration, without silent coercion',()=>{
 for(const patch of [{date:'2026-02-30'},{date:'2026-10-03'},{date:'no'},{startTime:'24:00'},{startTime:'9:00'},{estimateMin:0},{estimateMin:1081},{estimateMin:3.5},{estimateMin:'30'},{estimateMin:null},{endTime:'11:00'}])assert.equal(S.check(input({command:{...command,...patch}})).ok,false,JSON.stringify(patch));
 assert.equal(S.check(input({command:{...command,date:'2026-10-04',startTime:'16:59'}})).reason,'past');
});
test('calculation is pure and reports exact end date across midnight',()=>{
 const args=input({command:{...command,startTime:'23:47',estimateMin:30}}),before=JSON.stringify(args);
 assert.deepEqual(S.check(args),{ok:true,noop:false,endDate:'2026-10-06',endTime:'00:17'});assert.equal(JSON.stringify(args),before);
});
test('stale, missing, completed, running and committed tasks cannot be moved',()=>{
 for(const [patch,reason] of [[{tasks:[]},'missing'],[{tasks:[{...task,done:true}]},'done'],[{timerTaskId:'bio'},'timer'],[{lockedIds:['bio']},'boundary'],[{tasks:[{...task,title:'Changed'}]},'stale'],[{expected:null},'stale']])assert.equal(S.check(input(patch)).reason,reason);
 assert.equal(S.snapshot({...task}),S.snapshot(Object.fromEntries(Object.entries(task).reverse())));
});
test('checks overlap including previous-day tails and next-day tasks; edges are free',()=>{
 for(const other of [{date:'2026-10-05',startTime:'10:06',estimateMin:2},{date:'2026-10-04',startTime:'23:00',estimateMin:720}])assert.equal(S.check(input({tasks:[task,{...other,id:'busy'}]})).reason,'overlap');
 for(const other of [{startTime:'09:37',estimateMin:30},{startTime:'10:37',estimateMin:30}])assert(S.check(input({tasks:[task,{...other,id:'edge',date:command.date}]})).ok);
 assert.equal(S.check(input({command:{...command,startTime:'23:50'},tasks:[task,{id:'next',date:'2026-10-06',startTime:'00:10',estimateMin:30}]})).reason,'overlap');
});
test('unknown occupied duration is not guessed, malformed calendar refuses writes',()=>{
 assert.equal(S.check(input({tasks:[task,{id:'unknown',date:command.date,startTime:'09:00',estimateMin:0}]})).reason,'overlap');
 assert.equal(S.check(input({tasks:[task,{id:'bad',date:command.date,startTime:'25:00'}]})).reason,'calendar');
});
test('recurring appointments block actual weekdays including next-day overflow',()=>{
 assert.equal(S.check(input({routine:[{day:1,start:'10:00',end:'11:00',title:'Class'}]})).reason,'routine');
 assert(S.check(input({routine:[{day:2,start:'10:00',end:'11:00'}]})).ok);
 assert.equal(S.check(input({command:{...command,startTime:'23:50'},routine:[{day:2,start:'00:00',end:'01:00'}]})).reason,'routine');
 assert.equal(S.check(input({routine:[{day:7,start:'00:00',end:'01:00'}]})).reason,'calendar');
});
test('identical saved schedule is a no-op',()=>{
 const current={...task,date:command.date,startTime:command.startTime,estimateMin:command.estimateMin};
 assert.equal(S.check(input({tasks:[current],expected:S.snapshot(current)})).noop,true);
});
const app=fs.readFileSync(require.resolve('../public/app.js'),'utf8');
test('every chat receives fresh local today, tomorrow and clock independent of selected week',()=>{
 let today='2026-10-04';const c={Date,Intl,todayStr:()=>today,addDays:(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),pad2:x=>String(x).padStart(2,'0')};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function assistantClockContext('),app.indexOf('function chatUserContext(')),c);
 assert(c.assistantClockContext().includes('"tomorrow":"2026-10-05"'));today='2026-12-31';assert(c.assistantClockContext().includes('"tomorrow":"2027-01-01"'));assert(c.assistantClockContext().includes('"timezone":'));
});
function harness(){
 const c={structuredClone,Date,State:{tasks:[{...task}],settings:{},me:{id:'a'},timer:null,chatLog:[]},Store:{_writeEpoch:1},window:{AssistantScheduleV1:S,StuckTaskV1:require('../public/stuck-task-v1')},todayStr:()=> '2026-10-04',pad2:x=>String(x).padStart(2,'0'),questCommitment:()=>null};
 c.commitmentDataCommit=async build=>{const result=build(structuredClone({tasks:c.State.tasks,settings:c.State.settings}));if(!result)return false;c.writes++;c.State.tasks=result.tasks;return true;};c.writes=0;
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function captureChatSchedule('),app.indexOf('function chatActionLabel(')),c);
 c.action={...command};c.captureChatSchedule(c.action);return c;
}
test('writer saves once; repeat observes receipt and preserves rewards',async()=>{
 const c=harness();assert.equal((await c.applyChatSchedule(c.action)).status,'done');assert.equal((await c.applyChatSchedule(c.action)).status,'done');assert.equal(c.writes,1);assert.equal(c.State.tasks[0].goldAwarded,0);assert.equal(c.State.tasks[0].startTime,'10:07');
});
test('write refusal does not mutate, retry retains proposal and succeeds once',async()=>{
 const c=harness(),writer=c.commitmentDataCommit;c.commitmentDataCommit=async build=>{build(structuredClone({tasks:c.State.tasks,settings:{}}));return false;};
 assert.equal((await c.applyChatSchedule(c.action)).status,'failed');assert.equal(c.State.tasks[0].startTime,null);c.commitmentDataCommit=writer;assert.equal((await c.applyChatSchedule(c.action)).status,'done');assert.equal(c.writes,1);
});
test('CAS refresh refuses a changed task or newly occupied interval before second write',async()=>{
 for(const conflict of ['target','calendar']){const c=harness();c.commitmentDataCommit=async build=>{assert(build(structuredClone({tasks:c.State.tasks,settings:{}})));if(conflict==='target')c.State.tasks[0].title='Elsewhere';else c.State.tasks.push({id:'busy',date:command.date,startTime:'10:00',estimateMin:60});assert.equal(build(structuredClone({tasks:c.State.tasks,settings:{}})),null);return false;};
 assert.equal((await c.applyChatSchedule(c.action)).reason,conflict==='target'?'stale':'overlap');assert.equal(c.State.tasks[0].startTime,null);}
});
test('lost success response can be observed after revision refresh without a second mutation',async()=>{
 const c=harness();c.commitmentDataCommit=async build=>{const first=build(structuredClone({tasks:c.State.tasks,settings:{}}));c.State.tasks=first.tasks;c.writes++;assert.equal(build(structuredClone({tasks:c.State.tasks,settings:{}})),null);return false;};
 assert.equal((await c.applyChatSchedule(c.action)).status,'done');assert.equal(c.writes,1);
});
test('account switch before queued builder blocks old proposal',async()=>{
 const c=harness();c.commitmentDataCommit=async build=>{c.State.me.id='b';assert.equal(build(structuredClone({tasks:c.State.tasks,settings:{}})),null);return false;};assert.equal((await c.applyChatSchedule(c.action)).reason,'stale');assert.equal(c.writes,0);
});
test('proposal baseline comes from the request, not changed state when response arrives',()=>{
 const c=harness(),requestTasks=structuredClone(c.State.tasks);c.State.tasks[0].title='Newer';c.captureChatSchedule(c.action,requestTasks);assert.equal(c.checkChatSchedule(c.action).reason,'stale');
});
test('editing after an uncertain receipt cannot claim the older schedule as the edited result',()=>{
 const c=harness();c.lang=()=> 'en';c.dmShort=x=>x;c.State.chatLog=[{actions:[c.action]}];c.action._scheduleExpectedResult='old';const status={textContent:''};const row={dataset:{scheduleIndex:'0'},querySelector:()=>status},wrap={dataset:{mi:'0'}};
 c.editChatSchedule({dataset:{chatSchedule:'startTime'},value:'11:00',closest:s=>s==='.chat-actions'?wrap:row});assert.equal(c.action._scheduleExpectedResult,undefined);assert.equal(c.action.startTime,'11:00');
});
