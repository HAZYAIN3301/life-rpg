'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Touch = require('../public/sphere-touch-v1'), F = require('../public/sphere-frequency-v1'), L = require('../public/sphere-load-v1');
const app = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
const today = '2026-10-04', skills = [{id:'health'}, {id:'body',parentId:'health'}, {id:'gym',parentId:'body'}, {id:'learn'}, {id:'paused',paused:true}, {id:'archived',archived:true}, {id:'project',noBalance:true}];
function runtime(tasks = []) {
  const c = { State:{tasks,settings:{skills},habitlog:{},goals:[],episodes:[]}, window:{SphereTouchV1:Touch,SphereFrequencyV1:F},
    todayStr:()=>today, addDays:L.addDays, fmtDate:d=>d.toISOString().slice(0,10),
    isProjectSkill:s=>!!s.noBalance, skillById:id=>skills.find(s=>s.id===id)||{missing:true}, habitById:()=>({skillId:'gym'}),
    LAYER_MAX:3,LAYER_SHARE:.2,BALANCE_WINDOW_DAYS:21, lang:()=> 'ru' };
  vm.createContext(c);
  for (const name of ['taskSkills','taskLayers','shareInt','dayOf','xpEvents','boardNeglectedSpheres','windowMinMap','skillLastActive','nudgeVoiceGet','nudgeVoiceStale']) {
    const start=app.indexOf('function '+name+'('), end=app.indexOf('\nfunction ',start+10);
    vm.runInContext(app.slice(start,end),c);
  }
  return c;
}
const quest = extra=>({id:'task',skillId:'gym',date:today,done:true,xpAwarded:60,goldAwarded:20,estimateMin:30,...extra});
test('Board uses completion rather than planned date and includes all main ancestors',()=>{
  const c=runtime([quest({date:'2026-09-01',completedAt:today+'T10:00:00Z'})]);
  for(const id of ['health','body','gym'])assert(!c.boardNeglectedSpheres().includes(id));
  assert.deepEqual([...c.boardNeglectedSpheres()],['learn']);
  c.State.tasks[0].date='2026-11-01';assert(!c.boardNeglectedSpheres().includes('health'));
  c.State.tasks[0].done=false;assert(c.boardNeglectedSpheres().includes('health'));
});
test('planned, future and background activity do not satisfy deliberate practice',()=>{
  const c=runtime([quest({done:false}),quest({id:'future',completedAt:'2026-10-05T10:00:00Z'}),quest({id:'bg',skillId:'learn',layers:['gym']})]);
  assert(c.boardNeglectedSpheres().includes('health'));assert(!c.boardNeglectedSpheres().includes('learn'));
  assert.equal(c.windowMinMap().gym,0); // background retains zero minutes
  assert.equal(c.skillLastActive('gym'),today); // background still keeps form, as before
  c.State.tasks.pop();assert.equal(c.skillLastActive('gym'),null);
});
test('multiple main skills, parent+child and duplicate events count one day; own frequency is respected',()=>{
  const c=runtime([quest({skillIds:['health','gym','learn']})]);
  let index=Touch.touchDaysByNode(c.xpEvents(),skills);
  assert.deepEqual(Touch.daysFor(index,'health'),[today]);assert.equal(c.xpEvents().reduce((n,e)=>n+e.min,0),30);
  assert.equal(F.sphereRhythm({id:'health',targetPerWeek:3},Touch.daysFor(index,'health'),today).actual,1);
  c.State.settings={skills:skills.map(s=>s.id==='health'?{...s,targetPerWeek:3}:s)};
  assert(c.boardNeglectedSpheres().includes('health'));
  c.State.tasks.push(quest({id:'yesterday',date:'2026-10-03'}));assert(!c.boardNeglectedSpheres().includes('health'));
});
test('saved habit records count and removal removes their contribution',()=>{
  const c=runtime();c.State.habitlog[today]={h:{xp:10,min:5}};
  assert(!c.boardNeglectedSpheres().includes('health'));
  delete c.State.habitlog[today].h;assert(c.boardNeglectedSpheres().includes('health'));
});
test('arbitrary depth, cycles and orphans terminate without counting a node twice',()=>{
  const deep=Array.from({length:20},(_,i)=>({id:'s'+i,...(i?{parentId:'s'+(i-1)}:{})}));
  const events=[{date:today,skillId:'s19'},{date:today,skillId:'s19'}];
  assert.deepEqual(Touch.daysFor(Touch.touchDaysByNode(events,deep),'s0'),[today]);
  assert.deepEqual(Touch.daysFor(Touch.touchDaysBySphere(events,deep),'s0'),[today]);
  const cycle=[{id:'a',parentId:'b'},{id:'b',parentId:'a'}];
  assert.equal(Touch.touchDaysByNode([{date:today,skillId:'a'}],cycle).size,2);
  assert.deepEqual(Touch.daysFor(Touch.touchDaysByNode([{date:today,skillId:'x'}],[{id:'x',parentId:'gone'}]),'x'),[today]);
});
test('support derives recency from the same descendant events, including zero-XP records',()=>{
  const events=[];
  for(let i=-34;i<0;i++)events.push({date:L.addDays(today,i),skillId:'hot',xp:i<-6?10:50});
  events.push({date:today,skillId:'gym',xp:0,min:10});
  const spheres=[{id:'hot',memberIds:['hot'],lifetimeXp:100},{id:'health',memberIds:['health','body','gym','gym'],lastActive:'2026-01-01',lifetimeXp:100}];
  let result=L.compute({events,spheres,today});assert.equal(result.rows[1].quietDays,0);assert(!L.insight(result).quiet.some(s=>s.id==='health'));
  events.push({date:today,skillId:'gym',xp:10});result=L.compute({events,spheres,today});assert.equal(result.rows[1].recentXp,10);
  events.splice(-2);events.push({date:'2026-10-05',skillId:'gym',xp:10});result=L.compute({events,spheres,today});assert.equal(result.rows[1].quietDays,null);assert(L.insight(result).quiet.some(s=>s.id==='health'));
});
test('cached generated sphere facts cannot replace the live support statement',()=>{
  const c=runtime();c.State.settings.nudgeVoice={sig:'load',lang:'ru',text:'Нет записей: здоровье'};
  assert.equal(c.nudgeVoiceGet('load'),null);assert.equal(c.nudgeVoiceStale('load'),false);
});
