const test=require('node:test'),assert=require('node:assert/strict');
global.matchMedia=()=>({matches:false});
const B=require('./.checks/B2Model.cjs'),D=require('./.checks/DailyModel.cjs'),T=require('./.checks/TimeModel.cjs');
function base(){return {...B.seed(),tasks:[{...B.newTask('Тестовый квест','2026-10-26'),id:'a',actual:30}],focus:null};}
const transition=(d,fn,now)=>T.trackFocus(d,fn(d),now);
test('a new session excludes time recorded before starting',()=>{
 let d=base();d=transition(d,x=>D.startFocus(x,'a',1000),1000);
 d=transition(d,x=>D.stopFocus(x,121000),121000);
 assert.equal(d.focusSessions.length,1);assert.equal(d.focusSessions[0].milliseconds,120000);
 assert.equal(d.tasks[0].actual,32);assert.equal(d.tasks[0].done,false);assert.equal(d.gold,180);
});
test('pause, reload and resume exclude the pause and preserve one session',()=>{
 let d=transition(base(),x=>D.startFocus(x,'a',1000),1000);
 d=transition(d,x=>D.pauseFocus(x,61000),61000);d=JSON.parse(JSON.stringify(d));
 d=transition(d,x=>D.pauseFocus(x,601000),601000);
 d=transition(d,x=>D.stopFocus(x,661000),661000);
 assert.equal(d.focusSessions.length,1);assert.equal(d.focusSessions[0].milliseconds,120000);
 const again=T.trackFocus(d,{...d},700000);assert.equal(again.focusSessions.length,1);
});
test('finishing a task closes the same session without changing awards',()=>{
 let d=transition(base(),x=>D.startFocus(x,'a',1000),1000);
 const next={...d,focus:null,tasks:d.tasks.map(t=>({...t,done:true,actual:31})),gold:207,xp:50};
 const result=T.trackFocus(d,next,61000);
 assert.equal(result.focusSessions[0].milliseconds,60000);assert.equal(result.gold,207);assert.equal(result.xp,50);
});
test('legacy timers do not fabricate historical sessions',()=>{
 const d={...base(),focus:{id:'a',elapsed:1800000,since:1000,running:true}};
 assert.equal((T.trackFocus(d,D.stopFocus(d,61000),61000).focusSessions||[]).length,0);
});
test('zero duration and repeated stop do not create history entries',()=>{
 let d=transition(base(),x=>D.startFocus(x,'a',1000),1000);
 d=transition(d,x=>D.stopFocus(x,1000),1000);
 assert.equal(d.focusSessions.length,0);assert.equal(T.trackFocus(d,d,5000).focusSessions.length,0);
});
test('recorded task time ignores estimates and never double counts focus sessions',()=>{
 const d={...base(),tasks:[...base().tasks,{...B.newTask('Пока только план','2026-10-26'),minutes:90}],focusSessions:[{milliseconds:300000}]};
 assert.equal(T.recordedMinutes(d,'2026-10-26'),30);
});
test('focus preferences reject fractional, infinite and out of range values',()=>{
 for(const targetMinutes of [0,-1,1.5,Infinity,241])assert.throws(()=>T.saveFocusPreferences(base(),{targetMinutes}));
 assert.equal(T.saveFocusPreferences(base(),{targetMinutes:50}).focusPreferences.targetMinutes,50);
});
test('attention rule supports editing, avoids duplicates, preserves original on failure',()=>{
 let d=T.saveRule(base(),{id:'r',site:'youtube.com',minutes:20,gate:'Шахматная задача'});
 d=T.saveRule(d,{...d.rules[0],minutes:30});assert.equal(d.rules.length,1);assert.equal(d.rules[0].minutes,30);
 assert.throws(()=>T.saveRule(d,{id:'other',site:'YouTube.com',minutes:10,gate:'Осознанная пауза'}),/уже/);
 for(const site of ['', '   ', 'a'.repeat(121)])assert.throws(()=>T.saveRule(d,{id:'x',site,minutes:10,gate:'Осознанная пауза'}));
 assert.throws(()=>T.saveRule(d,{...d.rules[0],minutes:0}));assert.equal(d.rules[0].minutes,30);
});
test('settings search matches use cases and returns no guessed results',()=>{
 assert.ok(T.searchSettings('пауза').some(g=>g.id==='focus'));
 assert.ok(T.searchSettings('анимация').some(g=>g.id==='appearance'));
 assert.ok(T.searchSettings('резервная').some(g=>g.id==='data'));
 assert.equal(T.searchSettings('фывфывфыв').length,0);
});
