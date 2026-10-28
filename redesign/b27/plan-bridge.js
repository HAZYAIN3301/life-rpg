/* Existing domain owners, mounted inside the approved B2.5 shell. No new storage. */
window.SatoruPlanBridge=(()=>{
  let revision=0,attempt=null,preferenceBusy=false;
  const scope=()=>({account:String(State.me?.id||''),epoch:Store._writeEpoch});
  const current=s=>s.account===scope().account&&s.epoch===scope().epoch&&State.phase==='app';
  const graph=()=>({goals:State.goals||[],tasks:State.tasks||[],groups:State.goalGroups||[],skills:State.settings?.skills||[]});
  const snapshot=()=>({revision,view:State.view,settingsGroup:State.settingsSection,
    goals:State.goals||[],groups:State.goalGroups||[],routine:State.settings?.weeklyRoutineV1||null,routineDraft:window.RoutineV2.normalize(State.settings?.weeklyRoutineV1),
    preferences:{appName:State.settings?.appName||'Satoru',language:lang(),theme:State.settings?.theme||'dark',accent:State.settings?.accent||'',sound:State.settings?.sound!==false,motion:State.settings?.motion!==false},
    goalProgress:Object.fromEntries((State.goals||[]).map(g=>[g.id,goalProgress(g)])),
  });
  function originalRender(){revision++;window.dispatchEvent(new CustomEvent('satoru:legacy-route',{detail:{view:State.view,group:State.settingsSection,navigation:window.SatoruTodayBridge?.navigation()}}));}
  function view(view,group){if(State.view!==view)sfx('navigate');State.view=view;if(group!==undefined)State.settingsSection=group;}
  function commitOwned(host,staging,view){
    // The source renderer had one #main. The new shell has several independent
    // owners (including nested dialogs); their presentation history is per host.
    const previous=_renderedMainView;_renderedMainView=host.dataset.ownerView||'';
    try{commitMainView(host,staging,view);host.dataset.ownerView=view;}
    finally{_renderedMainView=previous;}
  }
  async function flush(){
    if(!document.getElementById('skills-list'))return true;
    const owner=scope(),deadline=Date.now()+15000;
    // An in-flight autosave is pending, not a failed receipt. Wait for its owner,
    // then flush the final captured revision before unmounting any controls.
    while(SettingsAutosave.saving&&current(owner)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    if(!current(owner)||SettingsAutosave.saving)return false;
    const pending=SettingsAutosave.failed||SettingsAutosave.revision>SettingsAutosave.durableRevision||Store._timers?.settings||Store._timers?.skilltree||Store._timers?.habits;
    if(!pending)return true;
    const saved=await flushSettingsForm();
    if(saved&&current(owner))window.SatoruLiveBridge?.emit();
    return saved&&current(owner);
  }
  async function preference(action,value){
    if(preferenceBusy)return false;preferenceBusy=true;const owner=scope();let ok=false;
    try{
      if(!await flush()||!current(owner))return false;
      if(action==='set-theme')ok=await persistThemeChoice(value);
      else{
        if(action==='set-lang'&&!APP_LANGS.includes(value)||action==='set-accent'&&!ACCENTS.includes(value))return false;
        if(!['set-lang','set-accent','set-motion'].includes(action)||action==='set-motion'&&!['0','1'].includes(value))return false;
        ok=await Store.updateNow('settings',settings=>current(owner)?{...settings,...(action==='set-lang'?{lang:value}:action==='set-motion'?{motion:value==='1'}:{accent:value,systemMode:false})}:undefined,settings=>{if(!current(owner))return false;State.settings=settings;return true;});
      }
      if(current(owner)){if(ok){applyTheme();render();}else{const status=document.querySelector?.('.settings-save-state');if(status){status.textContent=t('Не удалось сохранить изменения.');status.setAttribute('role','alert');}toast(t('Не удалось сохранить изменения.'));}}
      return ok&&current(owner);
    }finally{preferenceBusy=false;}
  }
  function mount(host,kind,group){
    const viewName=kind==='settings'?'settings':kind==='habits'?'habits':'shelf';
    State.view=viewName;if(group)State.settingsSection=group;
    const openedSkills=new Set([...host.querySelectorAll('.b210-skill-row[open]')].map(el=>el.dataset.skill));
    const sameGroup=host.dataset.settingsGroup===group;
    const disclosureKey=el=>(el.closest('[data-settings-group]')?.dataset.settingsGroup||group||'')+'|'+(el.dataset.section||el.dataset.skill||el.querySelector(':scope > summary')?.textContent.trim()||'');
    const disclosureState=new Map(sameGroup?[...host.querySelectorAll('details')].map(el=>[disclosureKey(el),el.open]):[]);
    const active=document.activeElement;
    const drafts=sameGroup?[...host.querySelectorAll('input[id],textarea[id],.skill-edit input[data-field]')].filter(el=>!['file','checkbox','radio','hidden','color'].includes(el.type)&&(el===active||el.value!==el.defaultValue)):[];
    const openedSections=new Set([...host.querySelectorAll('.b210-owned-section[open]')].map(el=>el.dataset.section));
    const staging=document.createElement('div');staging.innerHTML=safeViewMarkup(viewName);
    staging.querySelectorAll('.b26-settings').forEach(el=>el.classList.remove('b26-settings'));
    if(viewName==='settings'){
      // The controls stay in the source form for its capture/save contract, but
      // unused product modes are not exposed as normal account configuration.
      staging.querySelector('.path-card-settings')?.setAttribute('hidden','');
      staging.querySelector('[data-action="toggle-system"]')?.closest('.theme-row')?.setAttribute('hidden','');
      staging.querySelectorAll('details:has(.prog-grid)').forEach(el=>el.hidden=true);
      staging.querySelectorAll('.settings-group').forEach(el=>{el.hidden=el.dataset.settingsGroup!==group;});
      staging.querySelectorAll('.settings-hub h2,.settings-hub>div>p,.settings-hub-nav,.b26-settings-back,.settings-group-head').forEach(el=>el.hidden=true);
      // Spheres are the main task here; keep all hidden controls for the original capture owner.
      if(group==='life'){const skills=staging.querySelector('#skills-list')?.closest('.card');const section=staging.querySelector('section.settings-group[data-settings-group="life"]');if(skills&&section)section.prepend(skills);}
      const wrap=(node,key,caption,defaultOpen=false)=>{
        if(!node)return;const details=document.createElement('details'),summary=document.createElement('summary');
        details.className='b210-owned-section settings-disclosure';details.dataset.section=key;summary.textContent=caption;details.append(summary);node.before(details);details.append(node);details.open=sameGroup?openedSections.has(key):defaultOpen;
        node.querySelector('h3,h4')?.setAttribute('hidden','');
      };
      const account=staging.querySelector('section.settings-group[data-settings-group="account"]');
      if(account){const security=account.querySelector('#change-password,#add-email')?.closest('.card');if(security)account.prepend(security);[...account.children].filter(el=>el.classList.contains('card')).forEach((node,i)=>wrap(node,'account-'+i,node===security?t('Вход и восстановление'):node.querySelector('h3,h4')?.textContent.trim()||t('Профиль'),node===security&&group==='account'));}
      const connections=staging.querySelector('section.settings-group[data-settings-group="connections"]');
      if(connections){
        const ai=connections.querySelector('.connections-ai'),local=connections.querySelector('.connections-local-ai'),memory=connections.querySelector('.ai-memory-card'),context=connections.querySelector('.connections-memory');
        if(local)connections.prepend(local);if(ai)connections.prepend(ai);if(memory)connections.append(memory);if(context)connections.append(context);
        if(ai)ai.open=group==='connections'&&(!sameGroup||!!host.querySelector('.connections-ai[open]'));
        [...connections.children].filter(el=>el.classList.contains('card')&&el.tagName!=='DETAILS').forEach((node,i)=>wrap(node,'connection-'+i,node.querySelector('h3,h4')?.textContent.trim()||t('Подключения')));
      }
    }
    if(lang()!=='ru')translateDOM(staging);
    // Keep the source owner's actual input nodes. A receipt can repaint the
    // surrounding controls while someone types; it must not reset that draft.
    for(const input of drafts){const row=input.closest('.skill-edit'),selector=input.id?'#'+CSS.escape(input.id):'.skill-edit[data-id="'+CSS.escape(row.dataset.id)+'"] [data-field="'+CSS.escape(input.dataset.field)+'"]';const next=staging.querySelector(selector);if(next){if(next.value===input.value)input.defaultValue=next.defaultValue;next.replaceWith(input);}}
    commitOwned(host,staging,viewName);
    host.dataset.settingsGroup=group||'';
    host.querySelectorAll('form').forEach(form=>{form.method='post';if(!form.dataset.b210Guard){form.dataset.b210Guard='1';form.addEventListener('submit',e=>e.preventDefault());}});
    host.querySelectorAll('.skill-edit').forEach(row=>{
      row.querySelectorAll('input,select').forEach(control=>control.setAttribute('data-noi18n',''));
      const skill=State.settings.skills.find(s=>s.id===row.dataset.id),details=document.createElement('details'),summary=document.createElement('summary'),name=document.createElement('span'),meta=document.createElement('small');
      if(skill&&!skill.parentId){const input=row.querySelector('[data-field="color"]'),palette=document.createElement('div');palette.className='sphere-root-palette';palette.setAttribute('role','group');palette.setAttribute('aria-label',t('Цвет сферы'));for(const color of ['#6c8cff','#d2ad69','#7ebc7a','#a878d6','#d17089']){const button=document.createElement('button');button.type='button';button.style.background=color;button.setAttribute('aria-label',color);button.setAttribute('aria-pressed',String(input?.value.toLowerCase()===color));button.addEventListener('click',()=>{input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));});palette.append(button);}input?.parentElement.append(palette);}
      details.className='b210-skill-row';details.dataset.skill=row.dataset.id;details.style.setProperty('--skill-depth',row.style.getPropertyValue('--d')||'0');
      const swatch=document.createElement('i');swatch.className='settings-sphere-color';swatch.style.background=skill?.color||'#777';swatch.setAttribute('aria-hidden','true');
      name.textContent=skill?.name||'Сфера';name.dataset.noi18n='';meta.textContent=skill?.parentId?skillLabel(skill.parentId):skill?.archived?t('Архив'):t('Самостоятельная сфера');meta.dataset.noi18n='';summary.append(swatch,name,meta);details.append(summary);row.before(details);details.append(row);details.open=openedSkills.has(row.dataset.id)||skill?.name==='Новая сфера';
    });
    const branches=new Map([...host.querySelectorAll('.b210-skill-row')].map(el=>[el.dataset.skill,el]));
    for(const skill of State.settings.skills){const child=branches.get(skill.id),parent=branches.get(skill.parentId);if(child&&parent&&!child.contains(parent))parent.append(child);}
    if(sameGroup)host.querySelectorAll('details').forEach(el=>{const key=disclosureKey(el);if(disclosureState.has(key))el.open=disclosureState.get(key);});
    if(drafts.includes(active))requestAnimationFrame(()=>{if(active.isConnected)active.focus({preventScroll:true});});
  }
  const occurrences=dates=>Object.fromEntries(routineForDates(dates));
  function suggestSphere(title){
    if(typeof title!=='string'||title.trim().length<2)return null;
    const named=State.settings.skills.filter(s=>!s.archived&&String(s.name).trim().length>2).sort((a,b)=>b.name.length-a.name.length).find(s=>title.toLocaleLowerCase().includes(s.name.trim().toLocaleLowerCase()));
    const match=guessCategoryFromHistory(title.trim())||(named?{skillId:named.id}:null)||guessFromDictionary(title.trim());
    const skill=State.settings.skills.find(s=>s.id===match?.skillId&&!s.archived);
    return skill?{id:skill.id,name:skillLabel(skill.id)}:null;
  }
  async function run(command,input,expected){
    if(!current(expected))throw Error('Аккаунт изменился. Обнови страницу.');
    if(command==='routine.workshop'){State.weekStart=input.week||weekStart(todayStr());openWeekWorkshop();return {ok:true};}
    if(command==='routine.open'){openRoutineOccurrence(input.key);return {ok:true};}
    if(command==='routine.save'){
      if(!settingsWriteAllowed('B2.10',true))return {ok:false};
      const api=window.RoutineV2,blocks=api.blocks(input.value.blocks);
      if(blocks.some(b=>!b.title||b.skillId&&!State.settings.skills.some(s=>s.id===b.skillId)))throw Error('Проверь названия занятий и сферы аккаунта.');
      const from=api.minutes(input.value.from),to=api.minutes(input.value.to);
      if(from===null||to===null||from>=to||input.value.cycleStart&&!api.isDate(input.value.cycleStart))throw Error('Проверь часы и начало чередования.');
      const value={blocks,from:input.value.from,to:input.value.to,cycleStart:input.value.cycleStart||null,text:String(input.value.text||'').slice(0,6000)};
      const saved=await Store.updateNow('settings',settings=>{
        if(!current(expected))return undefined;
        if(blocks.some(b=>b.skillId&&!settings.skills.some(s=>s.id===b.skillId)))return undefined;
        const old=settings.weeklyRoutineV1||null;
        const next={...(old||{}),...value};
        if(JSON.stringify(old)!==input.base&&JSON.stringify(old)!==JSON.stringify(next))return undefined;
        return {...settings,weeklyRoutineV1:next};
      },settings=>{if(!current(expected))return false;State.settings=settings;return true;});
      return {ok:saved,notice:saved?'Расписание сохранено. Занятия не создают долг.':''};
    }
    if(command==='routine.restore'){
      const saved=await Store.updateNow('settings',settings=>{if(!current(expected))return undefined;const r=settings.weeklyRoutineV1||{};return {...settings,weeklyRoutineV1:{...r,skips:(r.skips||[]).filter(k=>k!==input.key)}};},settings=>{if(!current(expected))return false;State.settings=settings;return true;});return {ok:saved};
    }
    if(!goalWriteAllowed('B2.10',true))return {ok:false};
    const key=JSON.stringify([expected,command,input]);
    if(attempt?.key!==key){
      let candidate;
      if(command==='goal.quest'){
        const goal=goalById(input.goalId);if(!goal||JSON.stringify(goal)!==input.base)throw Error('Цель изменилась. Открой её заново.');
        const result=window.GoalStepQuestV1.planStepQuest({goal,stepId:input.stepId,tasks:State.tasks,today:input.date||todayStr(),id:input.id,createdAt:new Date().toISOString(),skillId:goal.skillId,skillIds:goalSkillIds(goal),layers:goalBackgroundSkillIds(goal)});
        if(result.status==='exists')return {ok:true,notice:'Этот шаг уже есть среди квестов.'};
        if(result.status!=='create')throw Error('Этот шаг больше нельзя добавить в день.');
        candidate={...structuredClone(graph()),tasks:[...structuredClone(State.tasks),result.task]};
      }else candidate=window.SatoruLiveModel.goalMutation(graph(),command,input,new Date().toISOString(),GOAL_XP,todayStr());
      for(const g of candidate.goals){const old=goalById(g.id);if(command!=='goal.state'&&command!=='goal.link'&&JSON.stringify(old)!==JSON.stringify(g))refreshGoalCompletion(g,{announce:false});}
      attempt={key,candidate};
    }
    const data=attempt.candidate,ok=await goalDataCommit(data.goals,data.tasks,data.groups);
    if(!current(expected))return {ok:false};
    if(ok){State.goals=data.goals;State.tasks=data.tasks;State.goalGroups=data.groups;attempt=null;}
    return {ok};
  }
  return {snapshot,originalRender,view,flush,preference,mount,commitOwned,occurrences,suggestSphere,run,translate:translateDOM,accepts:c=>/^(goal\.|group\.|routine\.)/.test(c)};
})();
