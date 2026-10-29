'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../server-inspiration-supply-service-v1.js'),{createDailySupply}=require('../server-inspiration-daily-supply-v1.js'),P=require('../server-inspiration-pexels-v1.js'),Profile=require('../public/inspiration-profile-v1.js'),R=require('../public/inspiration-supply-runtime-v1.js');
test('seven full days get distinct real identities, through the cache, selector and shown history',async()=>{
 let time=new Date('2026-10-29T12:00:00Z'),calls=0,profile=Profile.configure({...Profile.emptyProfile(),interests:[{id:'nature',label:'Nature'}],formats:['image']}),seen=new Set();const files=new Map();
 const provider={configured:true},signer=P.createSigner(()=>'test');
 const cache=createDailySupply({now:()=>time,read:async k=>files.get(k),write:async(k,v)=>{files.set(k,v);return {ok:true};},fetchPage:async({topic,page})=>{calls++;return {hasMore:true,items:Array.from({length:10},(_,i)=>{const id=page*100+i;return P.photoCandidate({id,url:`https://www.pexels.com/photo/forest-${id}/`,photographer:'Ada',alt:'Forest',src:{large:`https://images.pexels.com/photos/${id}/forest.jpeg`}},topic,time.toISOString());})};}});
 const service=createService({provider,cache,signer,now:()=>time});
 for(let i=0;i<7;i++){
  time=new Date(Date.UTC(2026,9,29+i,12));const day=time.toISOString().slice(0,10),supply=await service.daily(profile,day);
  assert.equal(supply.status,'ready');assert.ok(supply.candidates.every(signer.verify));
  const digest=R.ensureDigest({profile,day,now:time.toISOString(),candidates:supply.candidates,locale:'en',ctx:{maxSharePerSource:1}});assert.equal(digest.items.length,3);
  for(const item of digest.items){assert.ok(!seen.has(item.id));seen.add(item.id);}profile=Profile.recordShown(digest.profile,day);
  const reload=await service.daily(profile,day);assert.ok(reload.candidates.every(c=>!digest.items.some(i=>i.id===c.id)));
 }
 assert.equal(seen.size,21);assert.equal(calls,7);
});
test('unconfigured or unsupported formats produce truthful status without requests',async()=>{
 let calls=0;const base={cache:{get:async()=>{calls++;}},signer:{sign:x=>x},now:()=>new Date('2026-10-29T12:00:00Z')};
 assert.equal((await createService({...base,provider:{configured:false}}).daily({},'2026-10-29')).status,'unconfigured');
 assert.equal((await createService({...base,provider:{configured:true}}).daily({interests:[{id:'anime'}],formats:['edit']},'2026-10-29')).status,'unsupported');assert.equal(calls,0);
});
test('connection probe uses only shared public nature inventory and exposes no credentials or profile',async()=>{
 const seen=[],s=createService({provider:{configured:true},cache:{get:async({topic,format})=>{seen.push({topic,format});return {items:[{id:format,imageUrl:'public-image',videoUrl:format==='video'?'public-video':'',delivery:{sourceUrl:'public-source'}}]};}},signer:{}});
 const result=await s.probe();assert.equal(result.ready,true);assert.deepEqual(seen,[{topic:'nature',format:'image'},{topic:'nature',format:'video'}]);assert.equal(result.samples.length,2);assert.ok(!JSON.stringify(result).includes('apiKey'));
});
test('private taste is not sent to provider and failure does not impersonate an empty catalog',async()=>{
 const calls=[],service=createService({provider:{configured:true},cache:{get:async arg=>{calls.push(arg);throw Error('network');}},signer:{},now:()=>new Date('2026-10-29T12:00:00Z')});
 const result=await service.daily({interests:[{id:'nature',label:'private label'}],formats:['image'],visualTaste:'private note',videoReferences:[]},'2026-10-29');
 assert.equal(result.status,'provider_error');assert.deepEqual(calls,[{topic:'nature',format:'image'}]);assert.deepEqual(result.candidates,[]);
});
