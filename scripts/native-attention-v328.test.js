const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const fn=src.slice(src.indexOf('function openNativeAttention()'),src.indexOf('function eveningCoachLine()'));
test('native attention handoff is opt-in, bounded, and never sends policies or starts a session',()=>{
 const sent=[],c={window:{},document:{querySelector:()=>({value:' x '.repeat(300)})},State:{settings:{lang:'ru'}}};vm.createContext(c);vm.runInContext(fn,c);
 assert.equal(c.openNativeAttention(),false);c.window.satoruNativeAttention=true;assert.equal(c.openNativeAttention(),false);
 c.window.webkit={messageHandlers:{satoruShell:{postMessage:m=>sent.push(m)}}};assert.equal(c.openNativeAttention(),true);
 assert.equal(sent.length,1);assert.deepEqual(Object.keys(sent[0]),['action','purpose','language']);assert.equal(sent[0].purpose.length,160);assert.equal(sent[0].action,'attention-open');
 c.window.webkit.messageHandlers.satoruShell.postMessage=()=>{throw Error('unavailable');};assert.equal(c.openNativeAttention(),false);
});
