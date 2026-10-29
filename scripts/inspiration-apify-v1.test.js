'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../server-inspiration-apify-v1.js');
const row={id:'7111111111111111111',webVideoUrl:'https://www.tiktok.com/@sample/video/7111111111111111111',text:'Anime motivation edit #animeedit',videoMeta:{duration:21},authorMeta:{name:'sample'},createTimeISO:'2026-10-28T08:00:00.000Z'};
function fixture(extra={}){
 let state=null,time=new Date('2026-10-29T09:00:00.000Z'),calls=[],status='RUNNING';
 const options={apiKey:'synthetic-key',read:async()=>structuredClone(state),write:async s=>{state=structuredClone(s);return {ok:true};},now:()=>time,
 request:async input=>{calls.push(structuredClone(input));if(input.method==='POST')return {status:201,json:{data:{id:'run1',status:'RUNNING',defaultDatasetId:'dataset1'}}};
 if(input.url.includes('/actor-runs/'))return {status:200,json:{data:{id:'run1',status,defaultDatasetId:'dataset1',usageTotalUsd:0.005}}};
 if(input.url.includes('/datasets/'))return {status:200,json:[row]};throw Error('unexpected');},...extra};
 return {options,calls,setStatus:s=>status=s,setDay:d=>time=new Date(d+'T09:00:00.000Z'),state:()=>state,setState:s=>state=s};
}
test('one bounded metadata run is persisted, resumed after restart and shared by concurrent requests',async()=>{
 const f=fixture(),p=A.createInventory(f.options);
 const [a,b]=await Promise.all([p.get(['anime']),p.get(['anime'])]);assert.equal(a.status,'pending');assert.equal(b.status,'pending');assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 const call=f.calls[0],u=new URL(call.url);assert.equal(u.hostname,'api.apify.com');assert.equal(u.searchParams.get('maxTotalChargeUsd'),'0.1');assert.equal(u.searchParams.get('restartOnError'),'false');assert.equal(u.searchParams.has('token'),false);
 assert.equal(u.pathname,'/v2/acts/clockworks~free-tiktok-scraper/runs');
 assert.deepEqual(call.body.searchQueries,['anime motivation edit']);assert.equal(call.body.videoSearchSorting,'LATEST');assert.equal(call.body.shouldDownloadVideos,false);assert.equal(call.body.shouldDownloadCovers,false);assert.equal(call.body.commentsPerPost,0);
 assert.equal(f.state().runs[0].runId,'run1');assert.equal(f.state().runs[0].reservedUsd,0.1);
 f.setStatus('SUCCEEDED');const restarted=A.createInventory(f.options),ready=await restarted.get(['anime']);assert.equal(ready.status,'ready');assert.equal(ready.items.length,1);
 await restarted.get(['anime']);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
});
test('unknown POST outcome reserves its cost and is never blindly resubmitted, including after restart',async()=>{
 const f=fixture({request:async input=>{if(input.method==='POST')throw Error('lost reply');throw Error('unexpected');}});
 assert.equal((await A.createInventory(f.options).get(['anime'])).status,'provider_error');
 assert.equal(f.state().runs.length,1);assert.equal(f.state().runs[0].state,'uncertain');
 await A.createInventory(f.options).get(['anime']);assert.equal(f.state().runs.length,1);
});
test('no token, unsupported topic, corrupt state and failed durable reservation cannot start a run',async()=>{
 const f=fixture();assert.equal((await A.createInventory({...f.options,apiKey:''}).get(['anime'])).status,'unconfigured');
 assert.equal((await A.createInventory(f.options).get(['private-project-name'])).status,'unsupported');assert.equal(f.calls.length,0);
 f.setState({version:999});await assert.rejects(A.createInventory(f.options).get(['anime']),/corrupt/);assert.equal(f.calls.length,0);
 f.setState(0);await assert.rejects(A.createInventory(f.options).get(['anime']),/corrupt/);assert.equal(f.calls.length,0);
 await assert.rejects(A.createInventory({...f.options,read:async()=>null,write:async()=>({ok:false})}).get(['anime']),/save_unconfirmed/);assert.equal(f.calls.length,0);
});
test('durable daily and monthly reservation limits survive process restart',async()=>{
 const f=fixture({monthlyUsd:0.2,dailyUsd:0.1});let p=A.createInventory(f.options);
 await p.get(['anime']);assert.equal((await p.get(['fitness'])).status,'budget_limited');
 f.setDay('2026-10-30');p=A.createInventory(f.options);await p.get(['fitness']);
 f.setDay('2026-10-31');assert.equal((await A.createInventory(f.options).get(['nature'])).status,'budget_limited');
 assert.equal(f.calls.filter(c=>c.method==='POST').length,2);
});
