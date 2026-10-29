'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Frame=require('../public/inspiration-tiktok-frame-v1.js');
const Media=require('../public/inspiration-media-v1.js');
const url='https://www.tiktok.com/@example/video/7647936071673629973';
test('only an explicitly personal exact post can use the isolated frame',()=>{
 const item={personalMedia:true,url,embedUrl:Media.buildEmbed(url)};
 assert.equal(Frame.personalSource(item).url,url);
 for(const bad of [{...item,personalMedia:false},{...item,catalogId:'old'},{...item,url:'https://www.tiktok.com/@example'},{...item,embedUrl:Media.buildEmbed('https://www.tiktok.com/@example/video/7647936071673629974')}])assert.equal(Frame.personalSource(bad),null);
 assert.equal(Media.externalOnly(item),true,'shared source policy stays closed');
 assert.equal(Frame.wrapperUrl(item),'inspiration-tiktok-player.html?id=7647936071673629973');
});
test('CSP contains exactly one allowed player path and denies invalid or duplicate IDs',()=>{
 const csp=Frame.headers('/inspiration-tiktok-player.html?id=7647936071673629973');
 assert.match(csp['Content-Security-Policy'],/frame-src https:\/\/www.tiktok.com\/player\/v1\/7647936071673629973;/);
 assert.match(csp['Content-Security-Policy'],/connect-src 'none'/);
 assert.match(csp['Content-Security-Policy'],/sandbox allow-scripts allow-same-origin allow-presentation/);
 for(const q of ['?id=1','?id=7647936071673629973&id=7647936071673629974','?id=https://evil.invalid'])assert.match(Frame.headers('/inspiration-tiktok-player.html'+q)['Content-Security-Policy'],/frame-src 'none'/);
});
test('wrapper messages bind origin, frame window, post ID and bounded payload',()=>{
 const source={},event={origin:'https://satoru.example',source,data:{satoruInspirationPlayer:true,id:'7647936071673629973',event:{type:'time',currentTime:4,duration:20}}};
 const parse=e=>Frame.parseMessage(e,source,'7647936071673629973','https://satoru.example');
 assert.equal(parse(event).currentTime,4);
 for(const bad of [{...event,origin:'https://evil.invalid'},{...event,source:{}},{...event,data:{...event.data,id:'7647936071673629974'}},{...event,data:{...event.data,event:{type:'time',currentTime:300,duration:20}}},{...event,data:{...event.data,event:{type:'open',url:'https://evil.invalid'}}}])assert.equal(parse(bad),null);
});
test('wrapper relays only its selected provider frame and removes it before reporting end',()=>{
 const events={},docEvents={},messages=[],host={children:[],appendChild(f){this.children.push(f);f.remove=()=>{this.children=this.children.filter(c=>c!==f)};}};
 const frame={contentWindow:{},setAttribute(){},removeAttribute(){}};
 const doc={getElementById:()=>host,createElement:()=>frame,addEventListener:(k,f)=>docEvents[k]=f};
 const win={location:{href:'https://satoru.example/inspiration-tiktok-player.html?id=7647936071673629973',origin:'https://satoru.example'},parent:{postMessage:(m,o)=>messages.push({m,o,frames:host.children.length})},addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
 Frame.mount(doc,win);assert.equal(host.children.length,1);assert.match(frame.src,/tiktok.com\/player\/v1\/7647936071673629973/);
 const ended={origin:'https://www.tiktok.com',source:frame.contentWindow,data:{'x-tiktok-player':true,type:'onStateChange',value:0}};
 events.message({...ended,source:{}});assert.equal(messages.length,0);
 events.message(ended);assert.equal(host.children.length,0);assert.equal(messages[0].frames,0);assert.equal(messages[0].o,'https://satoru.example');assert.equal(messages[0].m.event.type,'ended');
 assert.equal(events.message,undefined);
});
