const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const P=require('../public/week-planner-v1');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
function harness(saved=true) {
 const task={id:'a',date:'2026-10-05',startTime:null,estimateMin:0,done:false};
 const c={State:{tasks:[task]},questById:()=>task,guideV3ContextActive:()=>false,questCommitment:()=>null,
  window:{},Store:{saveNow:async()=>saved},toast:()=>{},t:x=>x,CSS:{escape:x=>x},render:()=>{},todayStr:()=>task.date,
  CAL_H0:0,CAL_H1:23,fmtHM:n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`};
 vm.createContext(c);
 vm.runInContext(app.slice(app.indexOf('function calendarTimeValue('),app.indexOf('function syncCalendarDayViewport('))+app.slice(app.indexOf('async function moveCalendarTask('),app.indexOf('async function undoCalendarMove(')),c);
 return {c,task};
}
test('five-minute proposal saves exactly after a recurring block ending 09:05',async()=>{
 const {c,task}=harness();task.estimateMin=10;
 const m=P.propose({start:task.date,today:task.date,from:'09:00',to:'10:00',routine:[{day:1,start:'09:00',end:'09:05'}],tasks:[task]}).moves[0];
 assert.equal(m.startTime,'09:05');
 assert(await c.moveCalendarTask(m,{makeUndo:false,exactTime:true}));
 assert.equal(task.startTime,m.startTime);assert.equal(task.estimateMin,10);
});
test('exact editor preserves last minutes of day; drag snapping stays quarter-hour',async()=>{
 const {c,task}=harness();
 assert.equal(c.calendarTimeValue('23:55',true),'23:55');
 assert.equal(c.calendarTimeValue('09:07'),'09:00');
 for(const invalid of ['24:00','99:00','09:60','9:05'])assert.equal(c.calendarTimeValue(invalid,true),null);
 assert(await c.moveCalendarTask({id:'a',date:task.date,startTime:'23:55',estimateMin:5},{makeUndo:false,exactTime:true}));
 assert.equal(task.startTime,'23:55');
});
test('refused scheduling restores unknown duration instead of inventing thirty minutes',async()=>{
 const {c,task}=harness(false),before=JSON.stringify(task);
 assert.equal(await c.moveCalendarTask({id:'a',date:task.date,startTime:'09:05',estimateMin:15},{makeUndo:false,exactTime:true}),false);
 assert.equal(JSON.stringify(task),before);
});
