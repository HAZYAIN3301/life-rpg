'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDailySupply}=require('../server-inspiration-daily-supply-v1.js');

function fixture(){
  let time=new Date('2026-10-29T12:00:00Z'),state=null,calls=0,fail=false;
  const service=createDailySupply({now:()=>time,read:async()=>state,write:async(_key,value)=>{if(fail)throw Error('disk');state=structuredClone(value);return {ok:true};},
    fetchPage:async({topic,format,page})=>{calls++;return {items:[{id:topic+'-'+format+'-'+page}],hasMore:page<3};}});
  return {service,setTime:v=>time=new Date(v),setFail:v=>fail=v,get state(){return state;},get calls(){return calls;}};
}
test('same topic/day has one durable supply, including concurrent callers',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:5},()=>f.service.get({topic:'nature',format:'image'})));
 assert.equal(f.calls,1);for(const r of results)assert.deepEqual(r.items,[{id:'nature-image-1'}]);assert.equal(f.state.page,1);
});
test('tomorrow advances provider page and retains today on repeat',async()=>{
 const f=fixture();await f.service.get({topic:'nature',format:'image'});f.setTime('2026-10-30T12:00:00Z');
 assert.deepEqual((await f.service.get({topic:'nature',format:'image'})).items,[{id:'nature-image-2'}]);assert.equal(f.calls,2);
});
test('seven days advance inventory without letting callers mutate cached material',async()=>{
 let state=null,calls=0,time=new Date('2026-10-29T12:00:00Z');
 const s=createDailySupply({now:()=>time,read:async()=>state,write:async(k,v)=>{state=structuredClone(v);return {ok:true};},fetchPage:async({page})=>{calls++;return {items:[{id:'photo-'+page}],hasMore:true};}});
 const seen=[];
 for(let i=0;i<7;i++){
  time=new Date(Date.UTC(2026,9,29+i,12));
  const r=await s.get({topic:'nature',format:'image'});seen.push(r.items[0].id);r.items[0].id='caller-change';
  assert.equal((await s.get({topic:'nature',format:'image'})).items[0].id,seen.at(-1));
 }
 assert.equal(new Set(seen).size,7);assert.equal(calls,7);
});
test('unconfirmed storage never returns new material as committed; retry is same page',async()=>{
 const f=fixture();f.setFail(true);await assert.rejects(f.service.get({topic:'nature',format:'image'}));assert.equal(f.state,null);
 f.setFail(false);assert.equal((await f.service.get({topic:'nature',format:'image'})).items[0].id,'nature-image-1');
});
test('rejected fetch releases single flight so retry can work',async()=>{
 let calls=0,saved=null;const s=createDailySupply({read:async()=>saved,write:async(k,v)=>{saved=v;return {ok:true};},fetchPage:async()=>{if(++calls===1)throw Error('network');return {items:[],hasMore:false};}});
 await assert.rejects(s.get({topic:'nature',format:'video'}));assert.deepEqual((await s.get({topic:'nature',format:'video'})).items,[]);
});
test('corrupt storage is refused rather than reset or overwritten',async()=>{
 let calls=0;const s=createDailySupply({read:async()=>({page:'broken'}),write:async()=>{throw Error('must not write');},fetchPage:async()=>{calls++;}});
 await assert.rejects(s.get({topic:'nature',format:'image'}),/corrupt/);assert.equal(calls,0);
});
test('caller cannot turn a topic into a URL or unsupported format',async()=>{
 const f=fixture();await assert.rejects(f.service.get({topic:'https://private.invalid',format:'image'}));await assert.rejects(f.service.get({topic:'nature',format:'edit'}));assert.equal(f.calls,0);
});
