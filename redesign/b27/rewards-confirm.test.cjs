const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Model=require('./.checks/live-model.cjs'),Writes=require('../../public/economy-write-v1');
const source=fs.readFileSync(__dirname+'/../../public/redesign/live-engine.js','utf8'),start=source.indexOf('async function commitEconomyConfirmation(overlay) {'),end=source.indexOf('// ============================================================\n//  Wrapped',start),code=source.slice(start,end);
function harness(art={}){
 const State={me:{id:'qa'},rewards:[{id:'r1',name:'Отдых',cost:20,...art}],purchases:[],settings:{unrelated:{keep:true}}},controls={};for(const key of ['confirm','cancel','close','status'])controls[key]={disabled:false,textContent:'',focus(){}};
 const overlay={dataset:{kind:'reward',item:'r1'},isConnected:true,querySelector:s=>s.includes('confirm-economy-action')?controls.confirm:s.includes('close-economy-confirm')?controls.cancel:s==='.modal-x'?controls.close:controls.status};
 const calls=[];let allow=false,hold=null,switchActor=false;
 const context={State,Store:{_writeEpoch:1},window:{SatoruLiveModel:Model,RewardLifeV1:require('../../public/reward-life-v1')},CSS:{escape:x=>x},uid:()=> 'fixed',t:x=>x,goldBalance:()=>50,economyConfirmationData:()=>({kind:'reward',id:'r1',name:'Отдых',cost:20}),guideV3ContextActive:()=>false,closeAccountDialog:()=>overlay.isConnected=false,document:{getElementById:()=>null},toast:()=>{},sfx:()=>{},checkAchievements:()=>{},render:()=>{},economySaveUnconfirmed:()=> 'not confirmed',economyCommit:async data=>{calls.push(data);if(hold)await hold;if(switchActor)State.me.id='other';if(!allow)return false;const json=JSON.parse(JSON.stringify(data));return Writes.receiptValid({ok:true,snapshots:{settings:{exists:true,value:json.settings},tasks:{exists:true,value:[]},purchases:{exists:true,value:json.purchases}}},data);}};
 vm.runInNewContext(code,context);
 return{State,overlay,calls,controls,run:()=>context.commitEconomyConfirmation(overlay),allow:()=>allow=true,hold:p=>hold=p,switchActor:()=>switchActor=true};
}
test('actual live purchase confirmation accepts optional art and applies one debit only after a valid receipt',async()=>{
 for(const art of [{},{iconId:'reward.game'},{iconId:'reward.game',image:'data:image/webp;base64,YQ=='}]){
  const h=harness(art);await h.run();assert.equal(h.State.purchases.length,0);assert.match(h.controls.status.textContent,/not confirmed/);
  h.allow();await h.run();assert.equal(h.calls[0],h.calls[1]);assert.equal(h.State.purchases.length,1);assert.equal(h.State.purchases[0].cost,20);assert.equal(h.overlay.isConnected,false);assert.equal(h.State.settings.rewardLifeV1[h.State.purchases[0].id].status,'received');assert.equal(h.State.settings.unrelated.keep,true);
 }
});
test('actual confirmation ignores a second in-flight tap and an old-account response',async()=>{
 let release;const h=harness();h.allow();h.hold(new Promise(r=>release=r));const first=h.run();await h.run();assert.equal(h.calls.length,1);assert.equal(h.State.purchases.length,0);h.switchActor();release();await first;assert.equal(h.State.purchases.length,0);
});
