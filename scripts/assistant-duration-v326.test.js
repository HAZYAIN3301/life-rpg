const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../public/assistant-actions-v1');
test('date-only move refuses time fields instead of silently dropping promised changes',()=>{
 const ctx={today:'2026-10-04',quests:[{id:'q',title:'Биология'}]};
 const base={kind:'quest_reschedule',targetId:'q',date:'2026-10-05'};
 assert.equal(A.validate(base,ctx).ok,true);
 for(const field of [{startTime:'11:30'},{estimateMin:25},{endTime:'12:00'}])assert.equal(A.validate({...base,...field},ctx).ok,false);
});
test('unknown assistant quest duration stays unknown through preview revalidation',()=>{
 for(const estimateMin of [undefined,null,0,'',-10,'invalid',Infinity]){
  const context={today:'2026-10-04',spheres:[]};
  const first=A.validate({kind:'quest',title:'Черновик',estimateMin},context);
  assert.equal(first.ok,true);assert.equal(first.action.estimateMin,0);
  assert.equal(A.validate(first.action,context).action.estimateMin,0);
 }
});
test('explicit assistant quest duration remains bounded and preserved',()=>{
 for(const [estimateMin,expected] of [[15,15],['45',45],[1000,600]]){
  assert.equal(A.validate({kind:'quest',title:'Черновик',estimateMin},{today:'2026-10-04'}).action.estimateMin,expected);
 }
});
