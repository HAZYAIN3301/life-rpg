/* Injected only into the isolated B2.8 engine, before init().
 * State/Store and all domain writers below are the existing app's bindings. */
window.SatoruLiveBridge = (() => {
  let busy = false, bankPromise = null, bankError = '', calendarAttempt=null, calendarUndo=null;
  const scope = () => ({account:String(State.me?.id||''),epoch:Store._writeEpoch});
  const current = expected => expected.account === scope().account && expected.epoch === scope().epoch && State.phase === 'app';
  const snapshot = () => structuredClone({
    ...scope(),...window.SatoruPlanBridge?.snapshot(),navigation:window.SatoruTodayBridge?.navigation(),rewardsData:window.SatoruRewardsBridge?.snapshot(),worldData:window.SatoruWorldBridge?.snapshot(),name:State.me?.name||'',tasks:State.tasks||[],
    skills:(State.settings?.skills||[]).map(s=>({id:s.id,name:s.name,color:s.color,parentId:s.parentId,archived:s.archived})),
    inbox:State.inbox||[],days:State.days||{},habits:State.habits||[],habitlog:State.habitlog||{},weeks:State.weeks||{},
    deadlines:(State.goals||[]).filter(g=>!g.archived&&!g.completedAt&&g.status!=='completed').map(g=>({id:g.id,title:g.title,date:g.targetDate||'',primary:g.skillIds||[g.skillId].filter(Boolean)})),
    timer:State.timer,gold:goldBalance(),xp:overallXp(),streak:currentStreak(),
    shadowForm:Math.min(3,compTierIdx(State.settings?.companion?.bond||0)),
    pendingFocus:focusSessionSync().count(),chestsAvailable:lootChestsAvailable(),
    errors:[State._tasksLoadError&&'Квесты не загрузились. Обнови страницу перед изменениями.',
      State._inboxLoadError&&'Заметки не загрузились. Исходные записи сохранены.',
      State._settingsLoadError&&'Настройки не загрузились.',State._goalsLoadError&&'Цели не загрузились. Изменения заблокированы до восстановления.',State._goalGroupsLoadError&&'Проекты не загрузились.',
      State._accountDataLoadErrors?.days&&'Итоги дня не загрузились.',State._accountDataLoadErrors?.weeks&&'Намерения недели не загрузились.',bankError].filter(Boolean),
  });
  const emit = () => {if(State.phase==='app')window.SatoruLiveView?.render(snapshot());};
  // Same minute accounting as bankTimerProgress, but advance the checkpoint
  // only after Store confirms it. A failed write can be retried without loss.
  async function bank() {
    if(bankPromise)return bankPromise;
    const tm=State.timer, expected=scope();
    if(!tm||tm.ownerId!==expected.account)return true;
    const total=Math.floor(timerElapsedMs()/60000),delta=total-(tm.bankedMin||0);
    if(delta<=0&&!tm.b28Bank)return true;
    if(!tm.b28Bank){
      const from=questById(tm.taskId)?.actualMin??null;
      tm.b28Bank={from,to:(Number(from)||0)+delta,total};
      // Persist the absolute intent before sending it. A lost response/reload
      // cannot turn a retry into another delta against already-updated data.
      try{persistTimer();}catch{delete tm.b28Bank;bankError='Не удалось сохранить таймер на устройстве.';return false;}
    }
    const intent=tm.b28Bank;
    bankPromise=(async()=>{
      const saved=await Store.updateNow('tasks',tasks=>{
        if(!current(expected)||State.timer!==tm||!tasks.some(t=>t.id===tm.taskId))return undefined;
        const task=tasks.find(t=>t.id===tm.taskId),actual=task.actualMin??null;
        if(actual===intent.to)return tasks;
        if(actual!==intent.from)return undefined;
        return tasks.map(t=>t.id===tm.taskId?{...t,actualMin:intent.to}:t);
      },value=>{State.tasks=value;});
      if(!current(expected))return false;
      if(saved&&State.timer===tm){tm.bankedMin=intent.total;delete tm.b28Bank;persistTimer();bankError='';}
      else bankError='Время ещё не сохранено на сервере. Таймер оставлен на месте — повтори сохранение.';
      emit();return saved;
    })();
    try{return await bankPromise;}finally{bankPromise=null;}
  }
  async function endFocus(){
    const tm=State.timer;
    if(tm?.running){tm.accumulatedMs+=Date.now()-tm.startedAt;tm.running=false;persistTimer();}
    do{if(!await bank())return false;}
    while(State.timer===tm&&tm&&(tm.b28Bank||Math.floor(timerElapsedMs()/60000)>(tm.bankedMin||0)));
    stopFocus(true,true);return !State.timer;
  }
  function scheduleContext(settings,before,after){
    if(before.date===after.date)return true;
    const note=window.StuckTaskV1?.notePostpone(before,after.date,todayStr());if(note)Object.assign(after,note);
    return releaseActiveQuestCommitmentCandidate(settings,after).ok;
  }
  async function run(command,input={},expected=scope()) {
    if(!current(expected))return {ok:false,error:'Аккаунт изменился. Обнови страницу.'};
    if(busy)return {ok:false,error:'Предыдущее действие ещё сохраняется.'};
    busy=true;
    let ok=false, notice='', detail='Не удалось подтвердить сохранение. Данные формы оставлены — повтори попытку.';
    try {
      if(window.SatoruRewardsBridge?.accepts(command)){const result=await window.SatoruRewardsBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';detail=result.error||detail;}
      else if(window.SatoruWorldBridge?.accepts(command)){const result=await window.SatoruWorldBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';detail=result.error||detail;}
      else if(window.SatoruTodayBridge?.accepts(command)){const result=await window.SatoruTodayBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';}
      else if(window.SatoruPlanBridge?.accepts(command)){const result=await window.SatoruPlanBridge.run(command,input,expected);ok=result.ok;notice=result.notice||'';}
      else if(command==='task.save') {
        const {task,base}=input;
        // Validate before entering Store, so actionable errors reach the form.
        window.SatoruLiveModel.buildTask(State.tasks,task,base,State.settings.skills,new Date().toISOString());
        const old=questById(task.id);
        if(old&&(old.date!==task.date||old.rewardPurchaseId)){
          ok=await commitmentDataCommit(({settings,tasks})=>{const next=window.SatoruLiveModel.buildTask(tasks,task,base,settings.skills,new Date().toISOString());return scheduleContext(settings,tasks.find(t=>t.id===task.id),next.find(t=>t.id===task.id))?{settings,tasks:next}:null;});
        } else ok=await Store.updateNow('tasks',tasks=>window.SatoruLiveModel.buildTask(tasks,task,base,State.settings.skills,new Date().toISOString()),value=>{State.tasks=value;});
      } else if(command==='calendar.apply') {
        // Validate once for helpful UI errors, then again inside the paired lock.
        window.SatoruLiveModel.moveTasks(State.tasks,input.changes);
        const attemptKey=JSON.stringify([expected,input.changes]);
        if(calendarAttempt?.key!==attemptKey)calendarAttempt={key:attemptKey,before:structuredClone(State.tasks.filter(t=>input.changes.some(c=>c.id===t.id)))};
        const attempt=calendarAttempt;
        ok=await commitmentDataCommit(({settings,tasks})=>{
          const next=window.SatoruLiveModel.moveTasks(tasks,input.changes);
          for(const c of input.changes){if(!scheduleContext(settings,tasks.find(t=>t.id===c.id),next.find(t=>t.id===c.id)))return null;}
          return {settings,tasks:next};
        });
        if(ok&&current(expected)){
          const after=structuredClone(State.tasks.filter(t=>input.changes.some(c=>c.id===t.id)));
          calendarUndo={scope:expected,before:attempt.before,after};
          if(attempt.before.some(t=>t.commitmentId&&!after.find(a=>a.id===t.id)?.commitmentId))notice='Расписание обновлено. Прежняя временная граница снята.';
        }
      } else if(command==='calendar.undo') {
        const receipt=calendarUndo;if(!receipt||!current(receipt.scope))throw Error('Этот перенос уже нельзя отменить. Открой квест и выбери дату.');
        const signature=t=>JSON.stringify([window.SatoruLiveModel.schedule(t),t.postponedCount??null,t.firstDate??null,t.commitmentId??null]);
        const changes=receipt.before.map(before=>({id:before.id,before:window.SatoruLiveModel.schedule(receipt.after.find(t=>t.id===before.id)),after:window.SatoruLiveModel.schedule(before)}));
        ok=await commitmentDataCommit(({settings,tasks})=>{
          for(const after of receipt.after){const t=tasks.find(t=>t.id===after.id);if(!t||signature(t)!==signature(after))return null;}
          const next=window.SatoruLiveModel.moveTasks(tasks,changes);
          for(const before of receipt.before){const t=next.find(t=>t.id===before.id);for(const key of ['postponedCount','firstDate']){if(Object.hasOwn(before,key))t[key]=before[key];else delete t[key];}}
          return {settings,tasks:next};
        });
        if(ok){calendarUndo=null;calendarAttempt=null;if(receipt.before.some(t=>t.commitmentId&&!receipt.after.find(a=>a.id===t.id)?.commitmentId))notice='Дата возвращена. Прежняя временная граница остаётся снятой.';}
      } else if(command==='calendar.intent'||command==='calendar.budget') {
        const kind=command==='calendar.intent'?'intent':'budget';
        window.SatoruLiveModel.saveWeek(State.weeks||{},kind,input,State.settings.skills);
        ok=await Store.updateNow('weeks',weeks=>window.SatoruLiveModel.saveWeek(weeks||{},kind,input,State.settings.skills),value=>{State.weeks=value;});
      } else if(command==='task.complete'||command==='task.undo') {
        const task=questById(input.id);if(!task)throw Error('Квест больше не существует.');
        if(!taskWriteAllowed('B2.8',true))throw Error('Сначала восстанови загрузку квестов.');
        if(command==='task.complete'){
          if(State.timer?.taskId===task.id&&!await endFocus())throw Error(bankError||detail);
          const fresh=questById(input.id);
          ok=!!fresh&&(fresh.done||await completeTask(fresh,input.desire||null));
        } else ok=!task.done||await b28UndoTask(task.id);
      } else if(command==='task.actual') {
        ok=await commitmentDataCommit(({settings,tasks})=>{
          const next=window.TaskActualV1.update(tasks,input.id,input.minutes,input.expected,State.timer?.taskId);
          return next?{settings,tasks:next}:null;
        });
      } else if(command==='note.save') {
        const text=String(input.text||'').trim();if(!text||text.length>1000)throw Error('Напиши заметку до 1000 символов.');
        const old=State.inbox.find(n=>n.id===input.id);
        if(old&&old.text!==input.base&&old.text!==text)throw Error('Заметка изменилась. Открой её заново.');
        ok=await commitInbox(old?State.inbox.map(n=>n.id===input.id?{...n,text}:n):[{id:input.id,kind:'text',text,at:new Date().toISOString()},...State.inbox]);
      } else if(command==='note.quest') {
        await noteToQuest(input.id);
        ok=!State.inbox.some(n=>n.id===input.id)&&State.tasks.some(t=>t.noteSourceId===input.id);
      } else if(command==='day.save') {
        ok=await commitDayClosed(!!State.days[todayStr()]?.closed,{reflection:input.text});
      } else if(command==='habit.toggle') {
        const h=State.habits.find(h=>h.id===input.id);if(!h)throw Error('Привычка больше не существует.');
        const was=!!State.habitlog[habitDayKey()]?.[h.id];
        await transactHabitCompletion(h);
        ok=!!State.habitlog[habitDayKey()]?.[h.id]!==was;
      } else if(command==='focus.start') {
        const task=questById(input.id);if(!task||task.done)throw Error('Выбери незавершённый квест.');
        if(State.timer&&State.timer.taskId!==input.id&&!await endFocus())throw Error(bankError||detail);
        startFocus(input.id);ok=State.timer?.taskId===input.id;
      } else if(command==='focus.pause') {
        const tm=State.timer;if(!tm)throw Error('Таймер уже остановлен.');
        if(tm.running){tm.accumulatedMs+=Date.now()-tm.startedAt;tm.running=false;persistTimer();ok=await bank();}
        else if(await bank()){resumeFocus();ok=true;}
      } else if(command==='focus.stop') ok=await endFocus();
      else if(command==='focus.retry'){await focusSessionSync().flush();ok=focusSessionSync().count()===0;detail='Запись фокуса ещё ожидает отправки. Повтори при появлении сети.';}
      else if(command==='shadow.open'){openHelperChat();ok=true;}
      else throw Error('Это действие пока не подключено.');
      if(!current(expected))return {ok:false,error:'Аккаунт изменился. Обнови страницу.'};
      return {ok:!!ok,error:ok?'':detail,notice,snapshot:snapshot()};
    } catch(error){console.error('B2.8 command failed',command,error?.stack||error);return {ok:false,error:error instanceof Error?error.message:detail};}
    finally{busy=false;emit();}
  }
  return {snapshot,run,bank,emit};
})();
