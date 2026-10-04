const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
function harness(){
 const c={State:{me:{id:'a'},settings:{},tasks:[{id:'task',title:'Synthetic task',date:'2026-10-03',done:false}],_phoneHelp:{mode:'plan',owner:'a',epoch:1,instruction:'plan',context:{start:'2026-09-28',end:'2026-10-04',tasks:[{id:'stale'}]}}},Store:{_writeEpoch:1},todayStr:()=> '2026-10-03',pad2:n=>String(n).padStart(2,'0'),taskDisplayTitle:q=>q.title,Intl,Date};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function freshPhoneHelpContext('),app.indexOf('function chatUserContext(')),c);return c;
}
test('selected week is rebuilt from current task status on every message, with explicit clock',()=>{
 const c=harness();let s=c.freshPhoneHelpContext();assert(s.includes('not_marked_done'));assert(!s.includes('stale'));
 c.State.tasks[0].actualMin=25;s=c.freshPhoneHelpContext();assert(s.includes('"actualMin":25'));assert(s.includes('not_marked_done'));
 c.State.tasks[0].done=true;c.State.tasks[0].completedAt='2026-10-03T12:00:00Z';s=c.freshPhoneHelpContext();
 assert(s.includes('"status":"done"'));assert(s.includes('"date":"2026-10-03"'));assert(s.includes('"timezone":'));assert(s.includes('"time":'));
});
test('a context from another account or write epoch is never reused',()=>{
 const c=harness();c.State.me.id='b';assert.equal(c.freshPhoneHelpContext(),'');c.State.me.id='a';c.Store._writeEpoch=2;assert.equal(c.freshPhoneHelpContext(),'');
});
test('failed retry keeps one question and excludes transport errors from provider history',async()=>{
 const input={value:'',focus(){}},payloads=[];
 let attempt=0;
 const c={State:{me:{id:'a'},chatLog:[]},Store:{_writeEpoch:1},canUseAi:()=>true,guideV3ContextActive:()=>false,
  renderChatMessages(){},document:{getElementById:()=>input},CHAT_TIMEOUT_MS:1000,GOJO_MANUAL:'manual',
  lang:()=> 'ru',aiAnswerLangLine:()=>'',chatUserContext:()=> 'fresh context',aiProvider:()=> 'test',t:s=>s,aiHandleErr:()=>false,
  track(){},parseChatActions:text=>({clean:text,actions:[]}),window:{ShadowPersonaV1:{systemInstruction:()=> 'persona'},AiRequestV1:require('../public/ai-request-v1'),AiMemoryPolicyV1:require('../public/ai-memory-policy-v1')},
  fetch:async(url,options)=>{if(url==='/api/ai/memory')return {ok:true,json:async()=>({entries:[],legacy:{text:''},partial:false})};payloads.push(JSON.parse(options.body));attempt++;if(attempt===1)throw Error('offline');if(attempt===2)return {ok:false,status:502,json:async()=>{throw Error('HTML')}};return {ok:true,json:async()=>({text:'answer'})};}};
 vm.createContext(c);vm.runInContext('let _chatRequest=null;\n'+app.slice(app.indexOf('async function sendChat('),app.indexOf('function captureBar(')),c);
 await c.sendChat('same question');assert.equal(input.value,'same question');
 await c.sendChat('same question');assert(c.State.chatLog.at(-1).content.includes('HTTP 502'));
 await c.sendChat('same question');assert.equal(c.State.chatLog.filter(m=>m.role==='user').length,1);
 assert.equal(c.State.chatLog.filter(m=>m.transient).length,0);assert.equal(payloads[2].messages.length,1);
 assert.equal(c.State.chatLog.at(-1).content,'answer');assert.equal(c.State._chatBusy,false);
});
