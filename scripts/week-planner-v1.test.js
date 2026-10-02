const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../public/week-planner-v1');
const base={start:'2026-10-05',today:'2026-10-05',from:'09:00',to:'11:00',routine:[],tasks:[]};
test('planner avoids recurring appointments and timed tasks without changing the originals',()=>{
 const tasks=[{id:'fixed',date:base.start,startTime:'10:00',estimateMin:30},{id:'a',date:base.start,estimateMin:30},{id:'b',date:base.start,estimateMin:45}];
 const before=JSON.stringify(tasks);
 const result=P.propose({...base,tasks,routine:[{day:1,start:'09:00',end:'10:00'}]});
 assert.deepEqual(result.moves.map(m=>[m.id,m.date,m.startTime]),[['a','2026-10-05','10:30'],['b','2026-10-06','09:00']]);
 assert.equal(JSON.stringify(tasks),before);
});
test('unknown durations and full schedules are reported, never squeezed or silently guessed',()=>{
 const tasks=[{id:'unknown',date:base.start},{id:'long',date:base.start,estimateMin:180}];
 assert.deepEqual(P.propose({...base,tasks}).unplaced,[{id:'unknown',reason:'duration'},{id:'long',reason:'capacity'}]);
});
test('no scheduling in the past, completed work unchanged, duplicate fixed slots respected',()=>{
 const tasks=[{id:'a',date:base.start,estimateMin:30},{id:'done',date:base.start,done:true,estimateMin:30}];
 const result=P.propose({...base,today:'2026-10-11',nowTime:'10:45',tasks});
 assert.equal(result.moves.length,0);assert.equal(result.unplaced.length,1);
});
test('invalid schedules and impossible dates fail closed',()=>{
 assert.throws(()=>P.blocks([{day:1,start:'25:00',end:'26:00'}]));
 assert.throws(()=>P.blocks([{day:1,start:'10:00',end:'09:00'}]));
 assert.throws(()=>P.dates('2026-02-30'));
 assert.throws(()=>P.propose({...base,from:'20:00',to:'09:00'}));
});
test('an existing appointment with unknown duration does not invent free time after thirty minutes',()=>{
 const result=P.propose({...base,tasks:[{id:'fixed',date:base.start,startTime:'09:00'},{id:'a',date:base.start,estimateMin:30}]});
 assert.equal(result.moves[0].date,'2026-10-06');
});
