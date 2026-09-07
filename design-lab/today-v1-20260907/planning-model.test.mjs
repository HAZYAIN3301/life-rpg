import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate,weekDates,monthDates,shiftDate,goalFixture,goalProgress,validateGoal,calendarICS} from './site/planning-model.js';
import {fixture,mutate,save,load,STORAGE_KEY} from './site/model.js';
test('real dates, leap years and Monday week across year',()=>{
 assert.ok(validDate('2028-02-29'));assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-09-31'),false);
 assert.equal(shiftDate('2026-12-31',1),'2027-01-01');
 assert.deepEqual(weekDates('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
});
test('month cells contain full month and complete weeks',()=>{
 for(const d of ['2026-02-01','2028-02-01','2026-08-01','2027-01-01']){const days=monthDates(d);assert.equal(days.length%7,0);assert.equal(new Date(days[0]+'T12:00Z').getUTCDay(),1);assert.ok(days.includes(d));assert.equal(new Set(days).size,days.length);}
});
test('multiple primary spheres and background survive reload',()=>{
 const state=mutate(fixture(),{type:'edit',id:'video',patch:{spheres:['Медиа','Учёба'],background:['Отдых'],difficulty:'hard'}});
 let value;const storage={setItem:(k,v)=>value=v,getItem:()=>value};save(storage,state);assert.deepEqual(load(storage),state);
 assert.throws(()=>mutate(state,{type:'edit',id:'video',patch:{background:['Медиа']}}));
 assert.throws(()=>mutate(state,{type:'edit',id:'video',patch:{difficulty:'xp-hack'}}));
});
test('moving core respects destination core and keeps linked goal',()=>{
 let s=mutate(fixture(),{type:'add',task:{...fixture().tasks[1],id:'other',date:'2026-09-08'}});
 s=mutate(s,{type:'edit',id:'video',patch:{date:'2026-09-08'}});
 assert.equal(s.tasks.find(t=>t.id==='video').core,false);assert.equal(s.tasks.find(t=>t.id==='video').goalId,'film');
});
test('goal progress follows durable task completion, not scheduling',()=>{
 let s=fixture(),g=s.goals.find(g=>g.id==='film');assert.equal(goalProgress(g,s.tasks).done,0);
 s=mutate(s,{type:'toggle',id:'video'});assert.equal(goalProgress(g,s.tasks).done,1);assert.equal(goalProgress(g,s.tasks).next.id,'cut');
 s=mutate(s,{type:'toggle',id:'video'});assert.equal(goalProgress(g,s.tasks).done,0);
});
test('goal parent cycles, invalid step and invalid date rejected',()=>{
 const goals=goalFixture();assert.throws(()=>validateGoal({...goals[0],parentId:'film'},goals));
 assert.throws(()=>validateGoal({...goals[1],date:'2026-02-31'},goals));
 assert.throws(()=>validateGoal({...goals[1],steps:[{id:'x',text:'',minutes:15}]},goals));
});
test('batch changes exact goals without changing tasks or unrelated parent',()=>{
 const before=fixture(),s=mutate(before,{type:'goal-status',ids:['film','biology'],status:'archived'});
 assert.deepEqual(s.tasks,before.tasks);assert.equal(s.goals.find(g=>g.id==='create').status,'active');
 assert.equal(s.goals.filter(g=>g.status==='archived').length,2);assert.equal(before.goals[1].status,'active');
});
test('legacy Today fixture migrates known step links, preserves custom tasks',()=>{
 const old=fixture();delete old.goals;for(const t of old.tasks){delete t.goalId;delete t.stepId;delete t.spheres;delete t.background;delete t.difficulty;}
 const migrated=load({getItem:key=>key===STORAGE_KEY?JSON.stringify(old):null});assert.equal(migrated.tasks[1].goalId,'film');assert.equal(migrated.tasks.length,5);
});
test('ICS handles midnight, all-day, escaping and UTF-8 folding',()=>{
 const tasks=[{...fixture().tasks[1],time:'23:50',minutes:30,title:'Очень длинное название; с запятой, и переносом\n'.repeat(4)},{...fixture().tasks[0],time:''}];
 const ics=calendarICS(tasks);
 assert.match(ics,/DTEND:20260908T002000/);assert.match(ics,/DTEND;VALUE=DATE:20260908/);
 assert.ok(ics.includes('\\;'));assert.ok(ics.includes('\\,'));assert.ok(ics.includes('\\n'));
 for(const line of ics.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
});
