'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../server-inspiration-pexels-v1.js');
const M=require('../public/inspiration-licensed-media-v1.js');
const photo={id:123,url:'https://www.pexels.com/photo/forest-123/',photographer:'Ada',alt:'Forest trail',width:2000,height:1400,src:{large:'https://images.pexels.com/photos/123/pexels-photo-123.jpeg?auto=compress&w=940'}};
test('adapter sends bounded topic queries, server authorization, never private taste',async()=>{
 let call;const p=P.createProvider({apiKey:'server-test',request:async c=>{call=c;return {status:200,json:{photos:[photo],next_page:'https://api.pexels.com/v1/search?page=2'}};}});
 const r=await p.fetchPage({topic:'nature',format:'image',page:2,privateNote:'private'});
 assert.equal(new URL(call.url).searchParams.get('query'),'nature landscape');assert.equal(call.headers.Authorization,'server-test');assert.ok(!call.url.includes('private'));assert.equal(r.items[0].id,'pexels-photo-123');assert.equal(r.hasMore,true);
 assert.equal(r.items[0].rights.holder,'Ada · Pexels');assert.equal(r.items[0].available,'unknown');
});
test('unknown topics do not trigger provider search or pretend stock is an edit',async()=>{
 let calls=0;const p=P.createProvider({apiKey:'test',request:async()=>{calls++;}});
 await assert.rejects(p.fetchPage({topic:'anime',format:'video',page:1}));await assert.rejects(p.fetchPage({topic:'nature',format:'edit',page:1}));assert.equal(calls,0);
});
test('provider failure is explicit and does not become an empty success',async()=>{
 const p=P.createProvider({apiKey:'test',request:async()=>({status:429,json:{}})});await assert.rejects(p.fetchPage({topic:'nature',format:'image',page:1}),/rate_limited/);
});
test('media rejects arbitrary hosts, credentials, path tricks and forged licensing',()=>{
 const item=P.photoCandidate(photo,'nature',new Date().toISOString());assert.ok(M.normalize(item));
 for(const url of ['http://images.pexels.com/photos/123/a.jpeg','https://images.pexels.com.evil.test/photos/123/a.jpeg','https://a@images.pexels.com/photos/123/a.jpeg','https://images.pexels.com:444/photos/123/a.jpeg'])assert.equal(M.normalize({...item,imageUrl:url}),null);
 assert.equal(M.normalize({...item,rights:{...item.rights,kind:'official-source'}}),null);
});
test('video chooses an actual bounded MP4, retains author credit and never claims playback',()=>{
 const item=P.videoCandidate({id:456,url:'https://www.pexels.com/video/forest-456/',duration:18,width:1920,height:1080,image:'https://images.pexels.com/videos/456/free-video-456.jpg',user:{name:'Ada'},video_files:[{file_type:'video/mp4',width:1920,height:1080,link:'https://videos.pexels.com/video-files/456/456-hd_1920_1080_25fps.mp4'},{file_type:'video/mp4',width:1280,height:720,link:'https://videos.pexels.com/video-files/456/456-hd_1280_720_25fps.mp4'}]},'nature',new Date().toISOString());
 assert.ok(M.normalize(item));assert.match(item.videoUrl,/1280_720/);assert.equal(item.format,'video');assert.equal(item.available,'unknown');
});
test('server proofs bind every canonical field, survive reload and reject tampering',()=>{
 const signer=P.createSigner(()=>'test-secret'),item=P.photoCandidate(photo,'nature',new Date().toISOString()),signed=signer.sign(item);
 assert.ok(signer.verify(JSON.parse(JSON.stringify(signed))));assert.equal(signer.verify({...signed,interestIds:['finance']}),false);assert.equal(P.createSigner(()=>'other').verify(signed),false);
});
