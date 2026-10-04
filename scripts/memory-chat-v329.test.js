const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const M=require('../public/ai-memory-policy-v1'),R=require('../public/ai-request-v1');
const src=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const entry=(id,text,extra={})=>({id,text,sourceType:'explicit',category:'preference',status:'active',sensitivity:'normal',scopes:['assistant_prompt'],createdAt:'2026-10-04T00:00:00Z',...extra});
const view=(entries=[],text='legacy')=>({entries,legacy:{text},partial:false});
test('chat memory filters scopes, sensitive and dismissed records, preserves provenance and bounded legacy',()=>{
 const raw=view([entry('a','confirmed'),entry('b','hypothesis',{sourceType:'inferred'}),entry('c','private',{sensitivity:'sensitive'}),entry('d','dismissed',{status:'dismissed'}),entry('e','voice-only',{scopes:['shadow_voice']})],'x'.repeat(4000));
 const before=JSON.stringify(raw),out=M.chatPromptMemory(raw);
 assert.equal(out.legacyText.length,3000);assert(out.structuredText.includes('confirmed'));assert(out.structuredText.includes('"source":"inferred"'));
 for(const s of ['private','dismissed','voice-only'])assert(!out.structuredText.includes(s));assert.equal(JSON.stringify(raw),before);
 for(const bad of [null,{},view([{}]),{...raw,partial:true}])assert.throws(()=>M.chatPromptMemory(bad));
});
function harness(read){
 const payloads=[],input={value:'',focus(){}},c={State:{me:{id:'a'},chatLog:[],profile:{text:'STALE'}},Store:{_writeEpoch:1},canUseAi:()=>true,guideV3ContextActive:()=>false,
 renderChatMessages(){},document:{getElementById:()=>input},CHAT_TIMEOUT_MS:1000,GOJO_MANUAL:'manual',lang:()=> 'ru',aiAnswerLangLine:()=>'',chatUserContext:(_,m)=>m.legacyText+m.structuredText,aiProvider:()=> 'test',t:s=>s,aiHandleErr:()=>false,track(){},parseChatActions:text=>({clean:text,actions:[]}),
 window:{ShadowPersonaV1:{systemInstruction:()=> 'persona'},AiRequestV1:R,AiMemoryPolicyV1:M},
 fetch:async(url,options)=>{if(url==='/api/ai/memory')return read(options);payloads.push(JSON.parse(options.body));return {ok:true,json:async()=>({text:'answer'})};}};
 vm.createContext(c);vm.runInContext(src.slice(src.indexOf('let _chatRequest = null;'),src.indexOf('function captureBar(')),c);return {c,payloads,input};
}
test('each chat uses freshly read corrections and never the stale profile cache',async()=>{
 let current=view([entry('a','before')],'fresh');const h=harness(async()=>({ok:true,json:async()=>current}));
 await h.c.sendChat('one');current=view([entry('a','corrected')],'fresh2');await h.c.sendChat('two');current=view([entry('a','corrected',{status:'dismissed'})],'fresh3');await h.c.sendChat('three');
 assert(h.payloads[0].system.includes('before'));assert(h.payloads[1].system.includes('corrected'));assert(!h.payloads[1].system.includes('before'));assert(!h.payloads[2].system.includes('corrected'));assert(h.payloads.every(p=>!p.system.includes('STALE')));
});
test('failed or partial memory prevents AI transmission and retains question for retry',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>({...view(),partial:true})}]){
  const h=harness(async()=>response);await h.c.sendChat('keep me');assert.equal(h.payloads.length,0);assert.equal(h.input.value,'keep me');assert.equal(h.c.State._chatBusy,false);
 }
});
test('late memory after account switch or cancellation is never transmitted',async()=>{
 for(const action of ['account','epoch','cancel']){
  let release;const h=harness(()=>new Promise(resolve=>release=resolve));const pending=h.c.sendChat('old account');
  if(action==='account')h.c.State.me.id='b';else if(action==='epoch')h.c.Store._writeEpoch++;else h.c.stopChatRequest();
  release({ok:true,json:async()=>view([entry('a','old private context')])});await pending;assert.equal(h.payloads.length,0);
 }
});
test('settings memory fetch and mutation do not overwrite the next account UI',async()=>{
 for(const mutation of [false,true]){
  let release;const c={State:{me:{id:'a'},phase:'app'},Store:{_writeEpoch:1},render(){},console,fetch:()=>new Promise(resolve=>release=resolve)};
  vm.createContext(c);vm.runInContext(src.slice(src.indexOf('async function ensureAiMemory('),src.indexOf('async function downloadAiMemory(')),c);
  const pending=mutation?c.mutateAiMemory('a','dismiss'):c.ensureAiMemory();c.State={me:{id:'b'},marker:'new'};release({ok:true,json:async()=>view([entry('a','old')])});await pending;assert.deepEqual(c.State,{me:{id:'b'},marker:'new'});
 }
});
