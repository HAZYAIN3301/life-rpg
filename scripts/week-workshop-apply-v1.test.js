const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('../public/week-planner-v1');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
function harness(change, fail=false) {
 const tasks=[{id:'a',date:'2030-01-07',startTime:null,estimateMin:30},{id:'b',date:'2030-01-07',startTime:null,estimateMin:30}];
 const w={owner:'qa',epoch:1,blocks:[],from:'09:00',to:'12:00',moves:P.propose({start:'2030-01-07',today:'2030-01-07',tasks,from:'09:00',to:'12:00'}).moves,snapshot:JSON.stringify(tasks),constraints:JSON.stringify([[],'09:00','12:00'])};
 const calls=[];
 const c={_weekWorkshop:w,State:{tasks},window:{WeekPlannerV1:P},weekWorkshopRead:()=>w,weekWorkshopCurrent:x=>x===w,paintWeekWorkshop:()=>{},render:()=>{},phoneCopy:x=>x,t:x=>x,todayStr:()=>'2029-12-31',pad2:x=>String(x).padStart(2,'0'),questById:id=>tasks.find(q=>q.id===id),
 moveCalendarTask:async move=>{calls.push(move.id);if(!fail)Object.assign(tasks.find(q=>q.id===move.id),{date:move.date,startTime:move.startTime,estimateMin:move.estimateMin});if(calls.length===1&&change)change(tasks);return !fail;}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('async function weekWorkshopAction('),app.indexOf('async function readRoutinePhoto(')),c);
 return {c,w,tasks,calls};
}
test('week apply stops if another task changes while a move is being saved',async()=>{
 const h=harness(tasks=>{tasks[1].startTime='11:00';});
 await h.c.weekWorkshopAction('routine-apply',{});
 assert.deepEqual(h.calls,['a']);assert.equal(h.tasks[1].startTime,'11:00');assert.equal(h.w.notice,'changed');assert.equal(h.w.moves.length,0);
});
test('failed write with concurrent change cannot bless a stale preview for retry',async()=>{
 const h=harness(tasks=>{tasks[1].estimateMin=90;},true);
 await h.c.weekWorkshopAction('routine-apply',{});
 assert.equal(h.w.moves.length,0);assert.equal(h.w.notice,'changed');assert.equal(h.tasks[0].startTime,null);
});
test('an unchanged failed write retains the same remaining proposal for retry',async()=>{
 const h=harness(null,true);await h.c.weekWorkshopAction('routine-apply',{});
 assert.equal(h.w.moves.length,2);assert.equal(h.w.busy,false);assert.deepEqual(h.calls,['a']);
});
test('successful moves complete normally; edits to the moved task also invalidate the rest',async()=>{
 const normal=harness();await normal.c.weekWorkshopAction('routine-apply',{});assert.deepEqual(normal.calls,['a','b']);assert.equal(normal.w.moves.length,0);
 const changed=harness(tasks=>{tasks[0].done=true;});await changed.c.weekWorkshopAction('routine-apply',{});assert.deepEqual(changed.calls,['a']);assert.equal(changed.w.notice,'changed');
});
