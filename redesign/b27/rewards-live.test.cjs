const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./.checks/live-model.cjs');
const reward={id:'r1',name:'Вечер игры',cost:30,iconId:'reward.game',createdAt:'old',legacy:{keep:1}};
test('catalogue labels follow language without changing edit bases or personal names',()=>{
 assert.equal(typeof M.personalRewardLabel,'function');
 const catalog=[{...reward,catalogNameKey:'Вечер игры',name:'An evening with a game'}],stored={...reward,catalogNameKey:'Вечер игры'};
 assert.equal(M.personalRewardLabel(stored,catalog),'An evening with a game');assert.equal(stored.name,'Вечер игры');assert.equal(M.personalRewardLabel(reward,catalog),'Вечер игры');
 const projected=M.rewardProjection({rewards:[stored],catalog,purchases:[],rewardLife:{}});assert.equal(projected.rewards[0].name,'An evening with a game');assert.equal(stored.name,'Вечер игры');
});
test('optional receipt art round-trips through JSON without invalidating the actual durable receipt',()=>{
 assert.equal(typeof M.rewardReceiptArt,'function');
 const W=require('../../public/economy-write-v1');
 for(const r of [{},reward,{...reward,image:'data:image/webp;base64,YQ=='}]){
  const data={purchases:[{id:'p1',rewardId:'r1',name:'Отдых',cost:30,at:'2026-10-27T10:00:00Z',...M.rewardReceiptArt(r)}]};
  const serialized=JSON.parse(JSON.stringify(data));assert.deepEqual(data,serialized);
  assert.equal(W.receiptValid({ok:true,files:['purchases'],snapshots:{settings:{exists:true,value:{}},tasks:{exists:true,value:[]},purchases:{exists:true,value:serialized.purchases}}},data),true);
 }
});
test('reward edit preserves metadata and receipts; stale edit and forged price are rejected',()=>{
 assert.equal(typeof M.savePersonalReward,'function');
 const all=[reward],next=M.savePersonalReward(all,{...reward,name:'Отдых',cost:40},JSON.stringify(reward),5,'2026-10-27T10:00:00Z');
 assert.equal(next[0].name,'Отдых');assert.deepEqual(next[0].legacy,{keep:1});assert.equal(all[0].name,'Вечер игры');
 assert.throws(()=>M.savePersonalReward(next,{...reward,name:'stale'},JSON.stringify(reward),5,'now'));
 for(const cost of [0,-1,1.5,Infinity,100001])assert.throws(()=>M.savePersonalReward(all,{...reward,cost},JSON.stringify(reward),5,'now'));
});
test('new reward respects limit, stable id retry and image validation',()=>{
 assert.equal(typeof M.savePersonalReward,'function');
 const r={...reward,id:'new'},all=M.savePersonalReward([],r,null,1,'2026-10-27T10:00:00Z');
 assert.deepEqual(M.savePersonalReward(all,r,null,1,'later'),all);
 assert.throws(()=>M.savePersonalReward(all,{...r,id:'second'},null,1,'now'));
 assert.throws(()=>M.savePersonalReward([], {...r,image:'https://evil.test/tracker'},null,5,'now'));
});
test('projection keeps original purchase name/cost after reward edit/deletion and maps real lifecycle',()=>{
 assert.equal(typeof M.rewardProjection,'function');
 const p={id:'p1',rewardId:'r1',name:'Старое имя',cost:30,at:'2026-10-27T10:00:00Z',iconId:'reward.game'};
 const d=M.rewardProjection({rewards:[{...reward,name:'Новое имя',cost:90,image:'data:image/webp;base64,YQ=='}],purchases:[p,{id:'gear',gearId:'g1',cost:1}],rewardLife:{p1:{status:'planned',date:'2026-10-28'}},nextReward:'r1'});
 assert.equal(d.purchases[0].reward.image,undefined);
 assert.equal(d.purchases.length,1);assert.equal(d.purchases[0].reward.name,p.name);assert.equal(d.purchases[0].reward.cost,30);assert.equal(d.purchases[0].status,'planned');assert.equal(d.nextReward,'r1');
 assert.equal(M.rewardProjection({rewards:[],purchases:[p],rewardLife:{},nextReward:'r1'}).purchases[0].reward.name,p.name);
});
test('linked rest quest status shares settings/tasks transaction without changing debit or awards',()=>{
 assert.equal(typeof M.reconcileRewardTasks,'function');
 const purchases=[{id:'p1',rewardId:'r1',cost:30}],old=[{id:'q1',rewardPurchaseId:'p1',date:'2026-10-27',done:false}],settings={other:{inventory:[1]},rewardLifeV1:{p1:{status:'planned',date:'2026-10-27',updatedAt:'2026-10-27T10:00:00Z'}}};
 const done=[{...old[0],done:true,actualMin:8,xpAwarded:50,goldAwarded:21}];
 let next=M.reconcileRewardTasks(settings,done,old,purchases,'2026-10-27T11:00:00Z');assert.equal(next.rewardLifeV1.p1.status,'used');assert.deepEqual(next.other,settings.other);assert.equal(done[0].actualMin,8);
 next=M.reconcileRewardTasks(next,[{...old[0],date:'2026-10-29'}],done,purchases,'2026-10-27T12:00:00Z');assert.equal(next.rewardLifeV1.p1.status,'planned');assert.equal(next.rewardLifeV1.p1.date,'2026-10-29');
 assert.equal(settings.rewardLifeV1.p1.status,'planned');assert.equal(purchases[0].cost,30);
});
