'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../server-inspiration-edit-supply-v1.js');
const A=require('../server-inspiration-apify-v1.js'),P=require('../public/inspiration-profile-v1.js');
const row=A.fromPost({id:'7111111111111111111',text:'Anime edit #animeedit',webVideoUrl:'https://www.tiktok.com/@sample/video/7111111111111111111',videoMeta:{duration:21},createTimeISO:'2026-10-28T09:00:00.000Z'},['anime'],'2026-10-29T09:00:00.000Z');
const profile=extra=>P.configure({interests:[{id:'anime',label:'Anime'}],formats:['edit'],...extra});
test('only configured edit interests trigger metadata; signed candidates are bound to current account',async()=>{
 const calls=[],signer=A.createSigner(()=> 'synthetic-test-secret');
 const s=createService({inventory:{get:async topics=>{calls.push(topics);return {status:'ready',items:[row]};}},signer,now:()=>new Date('2026-10-29T09:00:00.000Z')});
 assert.equal((await s.daily(profile({formats:['image']}),'2026-10-29','a')).status,'unsupported');assert.equal(calls.length,0);
 const result=await s.daily(profile(),'2026-10-29','a');assert.deepEqual(calls,[['anime']]);assert.equal(result.candidates.length,1);assert.equal(signer.verify(result.candidates[0],'a'),true);assert.equal(signer.verify(result.candidates[0],'b'),false);
 assert.equal((await s.daily(profile({shownHistory:[{id:row.id,day:'2026-10-28'}]}),'2026-10-29','a')).candidates.length,0);
 const fixed=profile();fixed.digest={day:'2026-10-29',ids:[row.id],doneIds:[]};const before=calls.length;
 assert.equal((await s.daily(fixed,'2026-10-29','a')).status,'fixed');assert.equal(calls.length,before);
 await assert.rejects(s.daily(profile(),'2020-01-01','a'),/invalid_supply_day/);
});
test('pending or failed supply has an explicit status, never forged playback or a successful empty day',async()=>{
 for(const status of ['pending','provider_error','budget_limited','unconfigured']){
  const s=createService({inventory:{get:async()=>({status,items:[]})},signer:A.createSigner(()=> 'x'),now:()=>new Date('2026-10-29T09:00:00.000Z')});
  assert.deepEqual(await s.daily(profile(),'2026-10-29','a'),{status,candidates:[]});
 }
});
