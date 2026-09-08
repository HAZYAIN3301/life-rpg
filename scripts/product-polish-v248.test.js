const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const recovery=require('../public/recovery-slug-v1.js');

test('recovery consumer does not turn a missing log or removed energy into distress',()=>{
 const source=app.slice(app.indexOf('function recoverySlugState()'),app.indexOf('function recoverySlugHTML('));
 const context={window:{RecoverySlugV1:recovery},restGapDays:()=>14,dayLoadNow:()=>({state:'unknown'})};
 vm.createContext(context);vm.runInContext(source,context);
 assert.equal(context.recoverySlugState(),'calm');
 context.dayLoadNow=()=>({state:'normal'});assert.equal(context.recoverySlugState(),'calm');
 context.restGapDays=()=>0;assert.equal(context.recoverySlugState(),'restoring');
 context.restGapDays=()=>3;context.dayLoadNow=()=>({state:'heavy'});
 assert.equal(context.recoverySlugState(),'strained');
});

function keyHarness(response){
 const start=app.indexOf("if (f.id === 'ai-keys')",app.indexOf('async function onSubmit('));
 assert.ok(start>0);
 const source=app.slice(start,app.indexOf("if (f.id === 'add-task')",start));
 const msg={textContent:'',setAttribute(name,value){this[name]=value;}},button={disabled:false};
 const state={aiKeys:{openai:false,groq:true,houseAvailable:true,quota:{remaining:10}}};
 const notices=[];
 const context={AI_PROVIDERS:[{id:'openai'},{id:'groq'}],State:state,
  document:{getElementById:()=>msg},fetch:async()=>response,
  t:x=>x,toast:x=>notices.push(x),render(){},handleAccountSessionExpired(){}};
 vm.createContext(context);vm.runInContext('async function save(f){const e={preventDefault(){}};'+source+'}',context);
 const form={id:'ai-keys',openai:{value:'qa-not-a-real-key'},groq:{value:''},dataset:{},querySelector:()=>button};
 return {context,form,state,msg,button,notices};
}
test('AI key UI rejects HTTP and malformed receipts without a success or input loss',async()=>{
 for(const response of [{ok:false,status:503},{ok:true,status:200,json:async()=>({error:'failed'})}]){
  const h=keyHarness(response),before=structuredClone(h.state.aiKeys);
  await h.context.save(h.form);
  assert.deepEqual(h.state.aiKeys,before);assert.equal(h.form.openai.value,'qa-not-a-real-key');
  assert.equal(h.notices.length,0);assert.equal(h.button.disabled,false);assert.equal(h.msg.role,'alert');
 }
});
test('confirmed key save preserves house subscription metadata and releases only that draft',async()=>{
 const h=keyHarness({ok:true,status:200,json:async()=>({ok:true,openai:true,groq:true})});
 await h.context.save(h.form);
 assert.equal(h.state.aiKeys.openai,true);assert.equal(h.state.aiKeys.houseAvailable,true);
 assert.equal(h.state.aiKeys.quota.remaining,10);assert.equal(h.form.dataset.persisted,'true');
 assert.equal(h.notices.length,1);
});
