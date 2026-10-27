/* Actual domain owners only. This adapter is injected into the isolated live engine. */
window.SatoruWorldBridge=(()=>{
 let attempt=null;
 const scope=()=>({account:String(State.me?.id||''),epoch:Store._writeEpoch});
 const current=s=>State.phase==='app'&&s.account===scope().account&&s.epoch===scope().epoch;
 const errors=()=>[State._treeLoadError&&'Путь не загрузился. Сохранённая карта не заменена; повтори загрузку.',State._settingsLoadError&&'Настройки Мира не загрузились.',State._accountDataLoadErrors?.episodes&&'Эпизоды не загрузились. История не заменена.'].filter(Boolean);
 function snapshot(){
  const c=State.settings?.companion||{},curve=State.settings.curve,level=levelInfo(overallXp(),curve.base,curve.growth),rank=charRank();
  return{errors:errors(),level,rank:{name:t(rank.name),color:rank.color},title:equippedTitle()||'',archetype:t(archetype().name),visuals:Object.fromEntries(['avatarAppearance','avatarCoreGender','avatar','body','wear','gear','cosmetics','petNames','petSpecies','fortuneSkins','fortuneProps'].map(k=>[k,State.settings[k]??null])),
   companion:{name:c.name||'Тень',bond:c.bond||0,tier:t(COMP_TIERS[compTierIdx(c.bond||0)].name),next:compNextTier(c.bond||0),pet:c.pet||'',check:c.check?.[todayStr()]||{},journal:c.journal||[]},
   pets:topSkills().map(s=>{const traits=petTraits(s.id),stats=petStats(s.id);return{id:s.id,name:petName(s.id),sphere:sphereNameText(s.name),color:s.color,species:petSpeciesForSphere(s.id,traits),level:skillLevelOf(s.id),xp:skillXp(s.id),stats,hint:t(traits[0]?.hint||''),kind:t(traits[0]?.kind||'Спутник')};}),
   trees:State._treeLoadError?{}:State.tree||{},nodes:Object.fromEntries(Object.entries(State.tree||{}).map(([id,tree])=>[id,(tree.nodes||[]).map(n=>({...n,title:treeNodeCopy(n,'title'),desc:treeNodeCopy(n,'desc'),criterion:treeNodeCriterion(n),nextAction:treeNodeNextAction(n),state:treeNodeState(id,n),reason:treeNodeLockReason(id,n),perks:nodePerks(n),effects:nodePerks(n).map(p=>PERK_KINDS[p.kind]?t(PERK_KINDS[p.kind].fmt(p.val)):'').filter(Boolean)}))])),
   points:Object.fromEntries(Object.keys(State.tree||{}).map(id=>[id,{earned:treePointsEarned(id),spent:treePointsSpent(id),available:treePointsAvailable(id)}])),
   progressTasks:State.tasks.map(task=>({id:task.id,done:task.done,date:dayOf(task),actualMin:task.actualMin,skillIds:taskSkills(task),skillId:task.skillId})),perks:Object.entries(PERK_KINDS).map(([id,p])=>({id,label:t(p.label),cap:p.cap})),events:xpEvents(),episodes:(State.episodes||[]).map(e=>({...e,xp:episodeTotalXp(e),days:episodeDays(e).length})),rawEpisodes:State.episodes||[],episodeTypes:EPISODE_TYPES.map(e=>({id:e.id,name:t(e.name)})),intensities:EPISODE_INTENSITY.map(v=>t(v)),record:longestStreak(),den:structuredClone(State.settings.den||{})};
 }
 function guard(expected,command){
  if(!current(expected))throw Error('Аккаунт изменился. Обнови страницу.');
  if(State._settingsLoadError||!settingsWriteAllowed('B2.12',true))throw Error('Сначала восстанови загрузку настроек.');
  if(command.startsWith('world.tree')&&(State._treeLoadError||State._treeLoadBusy))throw Error('Путь не загрузился. Повтори загрузку.');
  if(command.startsWith('world.episode')&&!accountDataWriteAllowed('episodes','B2.12',true))throw Error('Сначала восстанови загрузку эпизодов.');
 }
 async function run(command,input={},expected=scope()){
  if(command==='world.retry'){if(!current(expected))return{ok:false};await retrySkillTreeLoad();return{ok:!State._treeLoadError&&current(expected)};}
  guard(expected,command);
  if(command==='world.care'){
   const c=State.settings.companion||{},already=input.kind==='pet'?c.pet===todayStr():c.check?.[todayStr()]?.[input.kind];
   if(already)return{ok:true,notice:'Сегодня это уже записано.'};
   const ok=await saveCompanionCare(input.kind,input.text);if(ok&&current(expected))try{window.ShadowRig?.setTransient('happy',1000);}catch{}return{ok:ok&&current(expected)};
  }
  if(command==='world.shadowName')return{ok:await saveCompanionName(input.name)&&current(expected)};
  if(command==='world.aiMap'){if(!State.tree[input.skillId])throw Error('Сначала выбери загруженную сферу.');State.treeSkill=input.skillId;openTreeMapAI();return{ok:true};}
  if(command==='world.episode.open'){openEpisode();return{ok:true};}
  if(command==='world.episode.save'||command==='world.episode.remove'){
   const key=JSON.stringify([expected,command,input]);
   if(attempt?.key!==key){
    const episodes=State.episodes||[];
    if(command==='world.episode.remove'){
     const ep=episodes.find(e=>e.id===input.id);if(!ep||JSON.stringify(ep)!==input.base)throw Error('Эпизод изменился. Открой его заново.');
     attempt={key,episodes:episodes.filter(e=>e.id!==input.id),before:JSON.stringify(episodes)};
    }else attempt={key,episodes:window.SatoruLiveModel.saveWorldEpisode(episodes,input.episode,input.base,State.settings.skills.map(s=>s.id),todayStr(),new Date().toISOString()),before:JSON.stringify(episodes)};
   }
   const pending=attempt,ok=await Store.updateNow('episodes',stored=>{
    if(!current(expected))return null;
    if(JSON.stringify(stored)!==pending.before&&JSON.stringify(stored)!==JSON.stringify(pending.episodes))throw Error('История изменилась. Открой эпизод заново.');
    return pending.episodes;
   },committed=>{if(!current(expected))return false;State.episodes=committed;return true;});
   if(ok&&current(expected)){attempt=null;checkAchievements();}return{ok:ok&&current(expected)};
  }
  if(command==='world.tree.plan'){
   if(!accountDataWriteAllowed('tasks','B2.12',true)||State._tasksLoadError)throw Error('Квесты не загрузились.');
   const n=State.tree[input.skillId]?.nodes.find(n=>n.id===input.id);if(!n||!treeNodeNextAction(n))throw Error('Укажи следующий шаг в редакторе вехи.');
   const existing=State.tasks.find(t=>t.treeNodeId===n.id&&(!t.treeSkillId||t.treeSkillId===input.skillId));if(existing)return{ok:true,notice:'Этот шаг уже есть в Плане.'};
   const task={id:'tree-step:'+input.skillId+':'+n.id,title:treeNodeNextAction(n),date:todayStr(),estimateMin:30,startTime:null,difficulty:'normal',skillId:input.skillId,skillIds:[input.skillId],layers:[],core:false,treeNodeId:n.id,treeSkillId:input.skillId};
   const ok=await Store.updateNow('tasks',tasks=>{if(tasks.some(t=>t.id===task.id||t.treeNodeId===n.id&&(!t.treeSkillId||t.treeSkillId===input.skillId)))return tasks;const next=window.SatoruLiveModel.buildTask(tasks,task,null,State.settings.skills,new Date().toISOString());Object.assign(next.find(t=>t.id===task.id),{treeNodeId:n.id,treeSkillId:input.skillId});return next;},value=>{if(!current(expected))return false;State.tasks=value;return true;});return{ok:ok&&current(expected)};
  }
  const key=JSON.stringify([expected,command,input]);
  if(attempt?.key!==key){
   let data;
   if(command==='world.tree.import'){
    if(input.base!==JSON.stringify(State.tree[input.skillId]))throw Error('Путь изменился. Проверь предложения ещё раз.');
    if(!Array.isArray(input.items)||!input.items.length||input.items.length>6||input.items.some(n=>!n||typeof n.title!=='string'||!n.title.trim()||n.title.length>180||typeof n.criterion!=='string'||n.criterion.length>500||typeof n.nextAction!=='string'||n.nextAction.length>300))throw Error('Проверь выбранные вехи, критерии и шаги.');
    const live=State.tree,tree=structuredClone(live);
    try{State.tree=tree;applyPersonalMap(input.skillId,input.items);}finally{State.tree=live;}
    if(tree[input.skillId].nodes.some(n=>(n.requires||[]).some(id=>!tree[input.skillId].nodes.some(o=>o.id===id))))throw Error('Игровой бонус связан с заменяемой вехой. Сначала измени эту зависимость в редакторе.');
    if(!validateSkillTreePayload(tree))throw Error('Формат пути не прошёл проверку.');data={skilltree:tree};
   }else if(command==='world.tree.edit'){
    const tree=window.SatoruLiveModel.editWorldTree(State.tree,input.skillId,input);if(!validateSkillTreePayload(tree))throw Error('Формат пути не прошёл проверку.');
    data={skilltree:tree};
   }else if(command==='world.tree.arrange'){
    if(input.base!==JSON.stringify(State.tree[input.skillId]))throw Error('Путь изменился. Открой его заново.');
    const tree=structuredClone(State.tree);arrangeTreeOverlaps(tree[input.skillId]);data={skilltree:tree};
   }else if(command==='world.tree.unlock'){
    const n=State.tree[input.skillId]?.nodes.find(n=>n.id===input.id);if(!n)throw Error('Узел не найден.');
    if(n.unlocked)return{ok:true,notice:'Узел уже открыт.'};
    if(!nodeUnlockable(input.skillId,n))throw Error(treeNodeLockReason(input.skillId,n)||'Этот узел пока недоступен.');
    const tree=structuredClone(State.tree),node=tree[input.skillId].nodes.find(n=>n.id===input.id);node.unlocked=true;
    data={skilltree:tree};
    if(treeNodeKind(n)==='capability'){
     if(!input.confirm)throw Error('Подтверди, что результат достигнут.');
     node.claimedAt=new Date().toISOString();node.claimSource='self';const proof=String(input.proof||'').trim().slice(0,500);if(proof)node.proofNote=proof;
     const settings=structuredClone(State.settings),c=ensureCompanion(settings);c.journal=c.journal.concat({date:todayStr(),kind:'ms',skillId:input.skillId,nodeId:n.id,title:n.title,titleKey:n.titleKey||null,text:treeNodeCopy(n,'title')}).slice(-120);data.settings=settings;
    }
   }else if(command==='world.pet.name'){
    if(!topSkills().some(s=>s.id===input.id))throw Error('Сфера не найдена.');
    const settings=structuredClone(State.settings);settings.petNames={...settings.petNames,[input.id]:String(input.name||'').trim().slice(0,20)};data={settings};
   }else if(command==='world.pet.look'){
    const id=input.id;if(!topSkills().some(s=>s.id===id))throw Error('Сфера не найдена.');
    const settings=structuredClone(State.settings),value=input.value||'';
    if(input.part==='species'){
     const species=petSpeciesForSphere(id,petTraits(id));if(['bodyToad','resourcesPenguin'].includes(species))throw Error('Облик канонического хранителя пока фиксирован.');
     if(value&&(!PET_SPECIES[value]||PET_SPECIES[value].guardianV1))throw Error('Этот облик недоступен.');
     settings.petSpecies={...settings.petSpecies};if(value)settings.petSpecies[id]=value;else delete settings.petSpecies[id];
    }else if(['skin','prop'].includes(input.part)){
     const catalog=input.part==='skin'?FORTUNE_SKINS:FORTUNE_PROPS,key=input.part==='skin'?'fortuneSkins':'fortuneProps';if(value&&!catalog[value])throw Error('Облик не найден.');settings[key]={...settings[key]};if(value)settings[key][id]=value;else delete settings[key][id];
    }else{
     if(!['head','neck','back'].includes(input.part))throw Error('Слот не найден.');const item=wearableById(value);if(value&&(!item||item.species!=='fortune'||item.slot!==input.part||!item.png))throw Error('Предмет не подходит этому слоту.');
     settings.wear=structuredClone(settings.wear||{owned:[],pet:{},avatar:{}});settings.wear.pet||={};settings.wear.pet[id]||={};if(value)settings.wear.pet[id][input.part]=value;else delete settings.wear.pet[id][input.part];
    }data={settings};
   }else throw Error('Неизвестное действие Мира.');
   attempt={key,data};
  }
  const pending=attempt,ok=await economyCommit(pending.data);
  if(!current(expected))return{ok:false};
  if(ok){for(const[k,v]of Object.entries(pending.data))State[Store._liveSlot(k)]=v;attempt=null;checkAchievements();}
  return{ok,error:ok?'':economySaveUnconfirmed(pending.data)};
 }
 // The scene contract is independent of its renderer. 3D must use the same room,
 // ownership, focus and care owners; never create another room/account store.
 function mount(host,part,id){
  if(part==='den'&&!host.firstElementChild)State._denEdit=true;
  const opened=new Set([...host.querySelectorAll('details[open]')].map(e=>e.id||e.className));
  const staging=document.createElement('div');let view='character';
  if(part==='scene'||part==='den'){staging.innerHTML=renderDen();view='den';if(part==='scene'){const shell=staging.querySelector('.den-shell'),scene=staging.querySelector('.den-scene');if(shell&&scene){shell.replaceChildren(scene);staging.replaceChildren(shell);}}}
  else if(part==='heroArt')staging.innerHTML=avatarFigureHTML({appearance:avatarAppearance()});
  else if(part==='wardrobe'||part==='heroExtras'){staging.innerHTML=renderCharacter();const selected=staging.querySelector(part==='wardrobe'?'.character-wardrobe-layout':'.character-secondary');staging.replaceChildren(...(selected?[selected]:[]));}
  else if(part==='profile'){staging.innerHTML=identityProfileCard();view='settings';}
  else if(part==='petArt'){const traits=petTraits(id);staging.innerHTML=petSVG(skillById(id).color||'#6c8cff',petStats(id).state,traits,id);view='pets';}
  else if(part==='petControls'||part==='recovery'){
   staging.innerHTML=renderPets();view='pets';const selected=part==='recovery'?staging.querySelector('.pet-card-recovery-slug'):staging.querySelector('#pet-summary-'+CSS.escape(id));staging.replaceChildren(...(selected?[selected]:[]));if(selected)selected.open=true;
  }else if(part==='stats'){staging.innerHTML=renderStats();staging.querySelector('.stats-route-head')?.remove();view='stats';}
  else if(part==='collection'){window.SatoruRewardsBridge.mount(host,'collection');return;}
  staging.querySelectorAll('.th-kicker,.character-kicker,.settings-eyebrow').forEach(e=>e.remove());
  staging.querySelectorAll('details').forEach(d=>{if(opened.has(d.id||d.className))d.open=true;});
  if(part==='scene')host.dataset.sceneRenderer='den-'+(staging.querySelector('.den-scene')?.dataset.denRenderer||'source');
  if(lang()!=='ru')translateDOM(staging);commitMainView(host,staging,view);
  host.querySelectorAll('form').forEach(form=>{form.method='post';if(!form.dataset.b212Guard){form.dataset.b212Guard='1';form.addEventListener('submit',e=>e.preventDefault());}});
 }
 return{snapshot,run,mount,accepts:c=>c.startsWith('world.')};
})();
// Keep the original AI/manual episode composer, with confirmed persistence.
epSave=async function(){
 const dialog=document.getElementById('ep-modal')||document.getElementById('ep-title')?.closest('[role="dialog"],dialog,.modal');
 let status=document.getElementById('b212-ep-status');if(!status){status=document.createElement('p');status.id='b212-ep-status';status.setAttribute('role','status');document.getElementById('ep-title')?.parentElement.append(status);}
 const episode={id:dialog?.dataset.b212EpisodeId||('ep_'+crypto.randomUUID()),type:document.querySelector('.ep-type.on')?.dataset.id||'trip',title:document.getElementById('ep-title')?.value||'',from:document.getElementById('ep-from')?.value,to:document.getElementById('ep-to')?.value,story:document.getElementById('ep-text')?.value||'',profile:_epRows.filter(r=>r.intensity>0).map(r=>({skillId:r.skillId,intensity:r.intensity})),highlights:_epExtra.highlights||[],social:_epExtra.social||null};
 if(!episode.title.trim())episode.title=t(episodeType(episode.type).name);
 if(dialog)dialog.dataset.b212EpisodeId=episode.id;
 const controls=[...(dialog?.querySelectorAll('button,input,textarea')||[])];controls.forEach(c=>c.disabled=true);if(status)status.textContent=t('Сохраняю…');
 const result=await window.SatoruLiveBridge.run('world.episode.save',{episode,base:null});
 if(result.ok){closeAiSurfaceModal('episode');render();}else{controls.forEach(c=>c.disabled=false);if(status)status.textContent=result.error||t('Не удалось сохранить. Повтори попытку.');}
};
// Original pet look controls occur both inline and in a document-level editor.
for(const event of ['click','change'])document.addEventListener(event,async e=>{
 const el=e.target.closest?.('[data-action]');if(!el)return;const a=el.dataset.action;
 if(event==='click'&&a==='treemap-apply'){
  e.preventDefault();e.stopImmediatePropagation();const id=State.treeSkill,items=[...document.querySelectorAll('#treemap-result [data-treemap]:checked')].map(c=>_treeMapItems[Number(c.dataset.treemap)]).filter(Boolean);
  const controls=[...document.querySelectorAll('#treemap-modal button,#treemap-modal input,#treemap-modal textarea')];controls.forEach(c=>c.disabled=true);
  let status=document.getElementById('treemap-save-status');if(!status){status=document.createElement('p');status.id='treemap-save-status';status.setAttribute('role','status');document.getElementById('treemap-result')?.append(status);}status.textContent=t('Сохраняю…');
  const result=await window.SatoruLiveBridge.run('world.tree.import',{skillId:id,items,base:JSON.stringify(State.tree[id])});if(result.ok)closeTreeDialog('treemap-modal');else{controls.forEach(c=>c.disabled=false);status.textContent=result.error;}return;
 }
 if(event==='click'&&a==='ep-del'&&el.closest('.b212-owned')){
  e.preventDefault();e.stopImmediatePropagation();const ep=State.episodes.find(ep=>ep.id===el.dataset.id);if(!ep||!confirm(t('Удалить эпизод')+' «'+ep.title+'»? '+t('Опыт за него тоже уйдёт.')))return;
  const result=await window.SatoruLiveBridge.run('world.episode.remove',{id:ep.id,base:JSON.stringify(ep)});if(!result.ok)alert(result.error);return;
 }
 const select={'set-pet-species':'species','set-fortune-skin':'skin','set-fortune-prop':'prop','set-pet-wear-slot':el.dataset.slot};
 const pick={'pick-fortune-skin':'skin','pick-fortune-prop':'prop','pick-fortune-wear':el.dataset.slot};
 const part=event==='change'?select[a]:pick[a];if(!part)return;
 e.preventDefault();e.stopImmediatePropagation();el.disabled=true;
 const result=await window.SatoruLiveBridge.run('world.pet.look',{id:el.dataset.id,part,value:event==='change'?el.value:el.dataset.value||''});el.disabled=false;
 let status=el.parentElement?.querySelector('.b212-save-status');if(!status){status=document.createElement('p');status.className='b212-save-status';status.setAttribute('role','status');el.parentElement?.append(status);}status.textContent=result.ok?t('Сохранено'):result.error;
 if(result.ok&&a.startsWith('pick-'))showFortuneEditor(el.dataset.id,part);
},true);
