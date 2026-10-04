const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../public/assistant-actions-v1'),UI=require('../public/actionable-settings-ui-v1');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
test('memory card is read-only and strips model-supplied edits, consent and permissions',()=>{
 const result=A.validate({kind:'memory_open',text:'overwrite',delete:true,consent:true,storageMode:'sync'},{});
 assert.deepEqual(result,{ok:true,action:{kind:'memory_open',tier:'open'}});
});
test('memory destination opens the existing settings screen without a writer',()=>{
 const calls=[],c={State:{view:'today',me:{id:'qa'}},Store:{_writeEpoch:3},document:{getElementById:()=>({value:'draft'})},closeHelperChat:o=>calls.push(['close',o]),render:()=>calls.push(['render'])};vm.createContext(c);
 vm.runInContext(app.slice(app.indexOf('function openAssistantDestination('),app.indexOf('async function applyChatActions(')),c);
 assert.equal(c.openAssistantDestination({kind:'memory_open',tier:'open'}),true);
 assert.equal(c.State.view,'settings');assert.equal(c.State.settingsSection,'connections');assert.equal(c.State._settingsFocusAfterCommit,'#ai-memory-title');assert.equal(calls.length,2);
 assert.equal(c.openAssistantDestination({kind:'memory_open',tier:'modify'}),false);
 assert.equal(c.State._chatMemoryReturn.text,'draft');assert.equal(c.State._chatMemoryReturn.owner,'qa');assert.equal(c.State._chatMemoryReturn.epoch,3);
});
test('memory focus target exists exactly once while loading, failed, empty and populated',()=>{
 for(const [payload,ctx] of [[null,{loading:true}],[null,{error:'offline'}],[{entries:[]},{}],[{entries:[{id:'x',text:'Example',origin:'user',usage:'assistant'}]},{}]]){
  const html=UI.renderMemory(payload,ctx);assert.equal((html.match(/id="ai-memory-title"/g)||[]).length,1);
 }
});
