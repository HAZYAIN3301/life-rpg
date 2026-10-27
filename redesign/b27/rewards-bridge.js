/* B2.5 presentation; original economy, chest issuer and inventory owners. */
window.SatoruRewardsBridge=(()=>{
 let attempt=null;
 const current=s=>State.phase==='app'&&s.account===String(State.me?.id||'')&&s.epoch===Store._writeEpoch;
 const errors=()=>[...['rewards','purchases','lootbox','achievements'].filter(k=>State._accountDataLoadErrors?.[k]).map(k=>({rewards:'Личные награды',purchases:'История покупок',lootbox:'Сундуки',achievements:'Достижения'}[k])+' не загрузились. Обнови страницу; сохранённые данные не заменены.'),...(!window.RewardLifeV1.valid(State.settings?.rewardLifeV1)?['Статусы наград не читаются. Исходные данные сохранены; открой восстановление в настройках.']:[]),...(State._lootboxReadUnsupported?['Данные сундука не читаются. Открой восстановление в настройках.']:[])];
 const snapshot=()=>({rewards:State.rewards||[],purchases:State.purchases||[],catalog:REWARD_CATALOG.map((r,i)=>({...r,id:'catalog-'+i,name:t(r.name),catalogNameKey:r.name})),life:State.settings?.rewardLifeV1||{},nextReward:State.settings?.personalRewardTargetV1||undefined,limit:isPro()?5000:FREE_REWARDS_MAX,errors:errors()});
 function guard(expected){if(!current(expected))throw Error('Аккаунт изменился. Обнови страницу.');if(errors().length||State._settingsLoadError||!settingsWriteAllowed('B2.11',true)||!['rewards','purchases'].every(k=>accountDataWriteAllowed(k,'B2.11',true)))throw Error('Сначала восстанови загрузку наград и настроек.');}
 async function run(command,input,expected){
  guard(expected);
  if(command==='reward.life'&&input.status==='planned'&&State.tasks.some(t=>t.rewardPurchaseId===input.id)){
   const key=JSON.stringify([expected,command,input]);if(attempt?.key!==key||!attempt.now)attempt={key,now:new Date().toISOString()};
   const now=attempt.now,ok=await commitmentDataCommit(({settings,tasks})=>{
    if(!current(expected))return null;const linked=tasks.find(t=>t.rewardPurchaseId===input.id);if(!linked||linked.done)return null;
    const next=window.RewardLifeV1.change(settings,State.purchases,input.id,'planned',input.date,now);
    if(linked.date!==input.date){const before=structuredClone(linked);linked.date=input.date;const note=window.StuckTaskV1?.notePostpone(before,input.date,todayStr());if(note)Object.assign(linked,note);if(!releaseActiveQuestCommitmentCandidate(next,linked).ok)return null;}
    return{settings:next,tasks};
   });if(ok&&current(expected))attempt=null;return{ok:ok&&current(expected)};
  }
  if(command==='reward.open')return{ok:!!showEconomyConfirm(input.kind,input.id,document.activeElement)};
  if(command==='reward.rest'){
   const task=input.task,p=State.purchases.find(p=>p.id===task.rewardPurchaseId&&p.rewardId);if(!p)throw Error('Полученная награда не найдена.');
   const other=State.tasks.find(t=>t.rewardPurchaseId===p.id);if(other&&other.id!==task.id)throw Error('Этот отдых уже есть в плане. Открой его заново.');
   if(!other&&task.id!=='reward-rest:'+p.id)throw Error('Обнови форму отдыха.');
   const now=new Date().toISOString();
   window.SatoruLiveModel.buildTask(State.tasks,task,input.base,State.settings.skills,now);
   const ok=await commitmentDataCommit(({settings,tasks})=>{
    if(!current(expected))return null;
    const duplicate=tasks.find(t=>t.rewardPurchaseId===p.id&&t.id!==task.id);if(duplicate)return null;
    const next=window.SatoruLiveModel.buildTask(tasks,task,input.base,settings.skills,now),linked=next.find(t=>t.id===task.id);
    linked.rewardPurchaseId=p.id;
    const before=tasks.find(t=>t.id===task.id);if(before&&before.date!==linked.date){const note=window.StuckTaskV1?.notePostpone(before,linked.date,todayStr());if(note)Object.assign(linked,note);if(!releaseActiveQuestCommitmentCandidate(settings,linked).ok)return null;}
    return{settings:window.RewardLifeV1.change(settings,State.purchases,p.id,linked.done?'used':'planned',linked.done?null:linked.date,now),tasks:next};
   });return{ok};
  }
  const key=JSON.stringify([expected,command,input]);
  if(attempt?.key!==key){
   let data;
   if(command==='reward.save')data={rewards:window.SatoruLiveModel.savePersonalReward(State.rewards,input.reward,input.base,isPro()?5000:FREE_REWARDS_MAX,new Date().toISOString())};
   else if(command==='reward.pin'){
    if(input.id&&!State.rewards.some(r=>r.id===input.id))throw Error('Награда больше не существует.');
    data={settings:{...structuredClone(State.settings),personalRewardTargetV1:input.id||null}};
   }else if(command==='reward.life'){
    const linked=State.tasks.find(t=>t.rewardPurchaseId===input.id);
    if(linked?.done&&input.status!=='used')throw Error('Сначала отмени выполнение связанного квеста в Плане.');
    data={settings:window.RewardLifeV1.change(State.settings,State.purchases,input.id,input.status,input.date||null,new Date().toISOString())};
   }else throw Error('Неизвестное действие награды.');
   attempt={key,data};
  }
  const pending=attempt,ok=await economyCommit(pending.data);
  if(!current(expected))return{ok:false};
  if(ok){for(const [k,v]of Object.entries(pending.data))State[k]=v;attempt=null;checkAchievements();}
  return{ok,error:ok?'':economySaveUnconfirmed(pending.data)};
 }
 function mount(host,part){
  const opened=new Set([...host.querySelectorAll('details[open]')].map(e=>e.className));
  const staging=document.createElement('div');
  staging.innerHTML=part==='chest'?lootboxCard():renderRewards();
  if(part!=='chest'){const selected=document.createElement('div');staging.querySelectorAll('.gold-goal,.furniture-collection,.collection-card,.arsenal-disclosure,.achievements-disclosure').forEach(el=>selected.append(el));staging.replaceChildren(selected);}
  staging.querySelectorAll('details').forEach(d=>d.open=opened.has(d.className));
  staging.querySelectorAll('.th-kicker').forEach(e=>e.remove());
  if(lang()!=='ru')translateDOM(staging);
  commitMainView(host,staging,'rewards');
 }
 return{snapshot,run,mount,accepts:c=>c.startsWith('reward.')};
})();
