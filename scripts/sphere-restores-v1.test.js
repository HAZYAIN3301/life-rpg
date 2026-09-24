const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const source=app.slice(app.indexOf('async function persistSphereRestores('),app.indexOf('function sphereLoads()'));
function harness(write){
 const State={me:{id:'A'},settings:{skills:[{id:'s',restores:false}],gold:17}},effects=[];
 const Store={_writeEpoch:1,updateNow:write};
 const ctx=vm.createContext({State,Store,render:()=>effects.push('render'),toast:x=>effects.push(x),t:x=>x,CSS:{escape:x=>x},document:{querySelector:()=>({focus(){}})},sphereRestores:id=>!!State.settings.skills.find(s=>s.id===id)?.restores});
 vm.runInContext(source,ctx);return{State,Store,effects,run:()=>ctx.persistSphereRestores('s')};
}
test('recovery switch waits for durable receipt and changes only its flag',async()=>{
 let release,calls=0;const gate=new Promise(r=>release=r);const h=harness(async(name,build,apply)=>{calls++;await gate;const next=build(h.State.settings);apply(next);return true});
 const pending=h.run();await h.run();assert.equal(calls,1);assert.equal(h.State.settings.skills[0].restores,false);assert.equal(h.State._sphereRestoreBusy,true);
 release();await pending;assert.equal(h.State.settings.skills[0].restores,true);assert.equal(h.State.settings.gold,17);assert.ok(h.effects.includes('Сохранено'));
});
test('rejected recovery write retains old state and can be retried',async()=>{
 const h=harness(async()=>false);await h.run();assert.equal(h.State.settings.skills[0].restores,false);assert.equal(h.State._sphereRestoreBusy,false);assert.ok(!h.effects.includes('Сохранено'));
 h.Store.updateNow=async(name,build,apply)=>{apply(build(h.State.settings));return true};await h.run();assert.equal(h.State.settings.skills[0].restores,true);
});
test('late recovery completion cannot replace the next account or its busy state',async()=>{
 let apply,release;const gate=new Promise(r=>release=r);const h=harness(async(name,build,commit)=>{const next=build(h.State.settings);apply=()=>commit(next);await gate;return apply()});
 const pending=h.run();h.Store._writeEpoch++;h.State.me={id:'B'};h.State.settings={skills:[{id:'b'}],gold:99};h.State._sphereRestoreBusy=false;const effects=h.effects.length;
 release();await pending;assert.equal(h.State.settings.gold,99);assert.equal(h.State.settings.skills[0].id,'b');assert.equal(h.effects.length,effects);
});
