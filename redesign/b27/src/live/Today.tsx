import {useEffect,useRef,useState} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {Icon,Lair} from '../components/generated/B2Scene';
import {Portrait} from './Portrait';
import {TodayDashboard} from '../components/generated/TodayDashboard';
import {FocusDock} from '../components/generated/FocusDock';
import {Field} from './Field';
import {DurationField} from '../components/generated/DurationField';
import {day,label,difficultyNames} from '../components/generated/B2Model';
import type {Task} from '../components/generated/B2Model';
import {duration,monday,validDate} from '../components/generated/PlanModel';
import {project,editable,calendarChanges,calendarPlan,decodeRoutePart,initialAppNavigation} from './model';
import {LiveCalendar} from './LiveCalendar';
import {LiveGoals,LiveSpheres} from './LiveGoals';
import {LiveRoutine} from './LiveRoutine';
import {LiveRewards} from './LiveRewards';
import {LiveWorld,worldViews} from './LiveWorld';
import {OwnedSurface} from './OwnedSurface';
import {OwnedToday} from './OwnedToday';
import {LiveSettings} from './LiveSettings';
import {IntentionForm,BudgetForm,CarryForm} from './CalendarForms';
import type {Snapshot,RawTask} from './model';
import '../components/generated/B2Workbench.css';
import '../components/generated/PlanWorkspace.css';
import '../components/generated/ThreeSections.css';
import '../components/generated/B24.css';
import './live.css';
import './StartScreen';
import './plan-settings.css';
import './today-owned.css';
import './layout-live.css';
import './feedback-live.css';
import {accessibleAccent,accentText} from './theme';
type Result={ok:boolean;error?:string;notice?:string;snapshot?:Snapshot};
declare global{interface Window{SatoruLiveBridge:{snapshot:()=>Snapshot;run:(c:string,p:unknown,scope:{account:string;epoch:number})=>Promise<Result>};SatoruLiveView:{render:(s:Snapshot)=>void;hide:()=>void}}}
const tabs=[['today','Сегодня','nav.today'],['plan','План','nav.plan'],['world','Мир','nav.lair'],['rewards','Награды','nav.rewards'],['tribe','Племя','nav.tribe']];
const countWord=(n:number,one:string,few:string,many:string)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
type Panel={kind:string;title:string;task?:RawTask;id?:string;text?:string;route?:string;key?:string};
function ActualForm({task,save}:{task:RawTask;save:(minutes:number)=>Promise<boolean>}){const [minutes,setMinutes]=useState(task.actualMin||0);return <form onSubmit={e=>{e.preventDefault();void save(minutes);}}><DurationField label="Фактическое время" allowZero value={minutes} onChange={setMinutes}/><p className="pl-help">Уточнение времени не меняет полученную награду.</p><button className="wb-primary wb-wide">Сохранить время</button></form>;}
function TaskForm({s,initial,save}:{s:Snapshot;initial:RawTask;save:(t:RawTask,base:Record<string,unknown>|null)=>Promise<boolean>}){
  const key='satoru.b28.task:'+s.account+':'+initial.id;
  const [base]=useState(()=>s.tasks.some(t=>t.id===initial.id)?editable(initial):null);
  const [task,setTask]=useState(()=>{const normalized={...initial,skillIds:initial.skillIds?.length?initial.skillIds:initial.skillId?[initial.skillId]:[],layers:initial.layers||[]};try{const d=JSON.parse(sessionStorage.getItem(key)||'null');return d&&JSON.stringify(d.base)===JSON.stringify(base)?d.task:normalized;}catch{return normalized;}});
  const patch=(p:Partial<RawTask>)=>{const next={...task,...p};setTask(next);try{sessionStorage.setItem(key,JSON.stringify({base,task:next}));}catch{}};
  const choose=(id:string,background=false)=>{const slot=background?'layers':'skillIds',old=task[slot]||[],next=old.includes(id)?old.filter((x:string)=>x!==id):[...old,id];patch({[slot]:next,...(!background?{skillId:next[0]}:{})});};
  return <form className="pl-form" onSubmit={async e=>{e.preventDefault();if(await save(task,base))sessionStorage.removeItem(key);}}>
    <Field label="Название квеста"><input autoFocus required maxLength={180} value={task.title} onChange={e=>patch({title:e.target.value})}/></Field>
    {(()=>{const suggestion=window.SatoruPlanBridge.suggestSphere?.(task.title);return suggestion&&!(task.skillIds||[]).includes(suggestion.id)?<button type="button" className="sp-suggestion" onClick={()=>patch({skillId:suggestion.id,skillIds:[suggestion.id],layers:(task.layers||[]).filter((id:string)=>id!==suggestion.id)})}><Icon id="nav.shadow" size={26}/><span>Подходит сфера <strong data-noi18n>{suggestion.name}</strong></span><span>Выбрать</span></button>:null;})()}
    <LiveSpheres label="Сферы квеста" skills={s.skills} value={task.skillIds||[]} secondary={task.layers||[]} change={skillIds=>patch({skillIds,skillId:skillIds[0],layers:(task.layers||[]).filter((id:string)=>!skillIds.includes(id))})} changeSecondary={layers=>{const skillIds=(task.skillIds||[]).filter((id:string)=>!layers.includes(id));patch({layers,skillIds,skillId:skillIds[0]});}}/>
    <label className="b24-core"><input type="checkbox" checked={!!task.core} onChange={e=>patch({core:e.target.checked})}/><span><b>Главное на сегодня</b><small>Выделить квест первым в плане дня</small></span></label>
    <div className="pl-form-pair"><Field label="Дата"><input required type="date" value={task.date} onInput={e=>patch({date:e.currentTarget.value})} onChange={e=>patch({date:e.target.value})}/></Field><Field label="Начало"><input type="time" value={task.startTime||''} onInput={e=>patch({startTime:e.currentTarget.value||null})} onChange={e=>patch({startTime:e.target.value||null})}/></Field></div>
    <DurationField value={task.estimateMin||0} onChange={estimateMin=>patch({estimateMin})}/>
    <fieldset className="pl-difficulties"><legend>Сложность</legend>{Object.entries(difficultyNames).map(([id,name])=><button type="button" key={id} aria-pressed={task.difficulty===id} onClick={()=>patch({difficulty:id})}><Icon id={'difficulty.'+id} size={28}/>{name}</button>)}</fieldset>
    {!!initial.goalId&&<p className="pl-help">Связь с целью сохранится. Выполнение обновит её шаг.</p>}
    <button className="wb-primary wb-wide">Сохранить квест</button>
  </form>;
}
function TextForm({initial,account,draftKey,label:textLabel,limit,save}:{initial:string;account:string;draftKey:string;label:string;limit:number;save:(v:string)=>Promise<boolean>}){
  const key='satoru.b28.text:'+account+':'+draftKey;
  const [text,setText]=useState(()=>{try{return sessionStorage.getItem(key)??initial;}catch{return initial;}});
  return <form onSubmit={async e=>{e.preventDefault();if(await save(text.trim()))sessionStorage.removeItem(key);}}><Field label={textLabel}><textarea autoFocus required rows={6} maxLength={limit} value={text} onChange={e=>{setText(e.target.value);try{sessionStorage.setItem(key,e.target.value);}catch{}}}/></Field><button className="wb-primary wb-wide">Сохранить</button></form>;
}
function Today({snapshot:s}:{snapshot:Snapshot}){
  const routeURL=useRef(location.href);
  const initial=initialAppNavigation(location.hash,(s as any).navigation||{view:s.view});
  const [route,setRoute]=useState(initial.route),[mode,setMode]=useState(initial.todayMode);
  const [planMode,setPlanMode]=useState(initial.planMode),[worldMode,setWorldMode]=useState(initial.worldMode);
  const [rewardEntry,setRewardEntry]=useState(''),[goalEntry,setGoalEntry]=useState(initial.goalEntry);
  const [settingsGroup,setSettingsGroup]=useState(initial.settingsGroup);
  const [calendarDate,setCalendarDate]=useState(initial.calendarDate),[calendarScale,setCalendarScale]=useState(initial.calendarScale);
  useEffect(()=>{history.replaceState(null,'',location.pathname+location.search+(route==='world'?'#world/'+worldMode:route==='settings'?'#settings/'+settingsGroup:route==='plan'?planMode==='Календарь'?'#plan/'+encodeURIComponent(calendarScale)+'/'+calendarDate:'#plan/'+({Цели:'goals',Привычки:'habits',Вдохновение:'inspiration'} as Record<string,string>)[planMode]+(goalEntry?'/'+encodeURIComponent(goalEntry):''):route==='rewards'?'#rewards':route==='tribe'?'#tribe':mode==='Заметки'?'#today/notes':mode==='Доска'?'#today/board':''));
    routeURL.current=location.href;
    if(route==='today')window.SatoruTodayBridge.mode(mode);
    if(route==='plan'&&planMode==='Календарь')window.SatoruTodayBridge.calendar(calendarDate,calendarScale);
    window.SatoruPlanBridge.view(route==='world'?worldViews[worldMode]:route==='settings'?'settings':route==='rewards'?'rewards':route==='today'?(mode==='Заметки'?'notes':'today'):route==='tribe'?(['party','leaderboard'].includes(s.view)?s.view:'party'):({Календарь:'calendar',Цели:'goals',Привычки:'habits',Вдохновение:'shelf'} as Record<string,string>)[planMode],settingsGroup);
  },[route,calendarDate,calendarScale,planMode,settingsGroup,goalEntry,worldMode,mode]);
  useEffect(()=>{const legacy=(e:Event)=>{const d=(e as CustomEvent).detail;if(d.view==='settings'){setRoute('settings');setSettingsGroup(d.group==='overview'?'':d.group||'');}else if(['calendar','goals','habits','shelf'].includes(d.view)){setRoute('plan');setPlanMode(({calendar:'Календарь',goals:'Цели',habits:'Привычки',shelf:'Вдохновение'} as Record<string,string>)[d.view]);if(d.navigation?.calendarDate)setCalendarDate(d.navigation.calendarDate);if(d.navigation?.calendarMode)setCalendarScale(({day:'День',week:'Неделя',month:'Месяц'} as Record<string,string>)[d.navigation.calendarMode]||'Неделя');if(d.view==='goals')setGoalEntry(d.navigation?.goalId||'');}else if(Object.values(worldViews).includes(d.view)){setRoute('world');setWorldMode(Object.keys(worldViews).find(k=>worldViews[k]===d.view)||'home');}else if(d.view==='rewards')setRoute('rewards');else if(d.view==='notes'){setRoute('today');setMode('Заметки');}else if(d.view==='today'){setRoute('today');setMode(d.navigation?.todayTab==='board'?'Доска':'День');}else if(['party','leaderboard'].includes(d.view))setRoute('tribe');};addEventListener('satoru:legacy-route',legacy);return()=>removeEventListener('satoru:legacy-route',legacy);},[]);
  const displayBrand=s.preferences?.appName||'Satoru';
  const defaultSkill=s.skills.find(k=>!k.archived);
  const data=project(s),[panel,setPanel]=useState<Panel|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(''),[query,setQuery]=useState(''),[seen,setSeen]=useState(true),[,tick]=useState(0);
  const motion=s.preferences?.motion!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dark=s.preferences?.theme==='dark'||s.preferences?.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
  const customAccent=s.preferences?.accent&&s.preferences.accent!=='#6c8cff'?accessibleAccent(s.preferences.accent,!!dark):'';
  useEffect(()=>{document.documentElement.lang=s.preferences?.language||'ru';document.body.dataset.liveTheme=dark?'dark':'light';document.body.style.setProperty('--live-action',customAccent||(dark?'#c6c9e0':'#424760'));document.body.style.setProperty('--live-on-action',accentText(customAccent||(dark?'#c6c9e0':'#424760')));if(root.current)window.SatoruPlanBridge.translate(root.current);},[s.preferences?.language,s.revision,route,planMode,panel,dark,customAccent]);
  const [bubble,setBubble]=useState<{x:number;y:number}|null>(null);
  const drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null);
  const dialog=useRef<HTMLDialogElement>(null),root=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|null>(null),lock=useRef(false);
  useEffect(()=>{const t=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{root.current?.querySelector('.wb-scroll')?.scrollTo({top:0});},[route,mode,planMode,settingsGroup,worldMode]);
  useEffect(()=>{const el=root.current?.querySelector<HTMLElement>('.wb-scroll');if(!el)return;let frame=0,p=0,last=el.scrollTop;const paint=()=>{frame=0;const delta=el.scrollTop-last;last=el.scrollTop;p=el.scrollTop<=0?0:Math.max(0,Math.min(1,p+delta/Math.max(240,innerHeight*.55)));root.current?.style.setProperty('--lair-progress',String(p));root.current?.classList.toggle('scene-collapsed',p>.7);};const scroll=()=>{if(!frame)frame=requestAnimationFrame(paint);};el.addEventListener('scroll',scroll,{passive:true});paint();return()=>{el.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);};},[route,mode]);
  useEffect(()=>{if(!receipt)return;const t=setTimeout(()=>setReceipt(''),6000);return()=>clearTimeout(t);},[receipt]);
  useEffect(()=>{if(panel){dialog.current?.showModal();dialog.current?.querySelector<HTMLElement>('input:not([type=checkbox]),textarea')?.focus();}else if(dialog.current?.open){dialog.current.close();opener.current?.focus();}},[panel]);
  useEffect(()=>{if(!panel)return;const observer=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n instanceof Element&&n.matches('.modal-overlay')))){dialog.current?.close();setPanel(null);}});observer.observe(document.body,{childList:true});return()=>observer.disconnect();},[panel?.kind]);
  const open=(p:Panel)=>{opener.current=document.activeElement as HTMLElement;setError('');setPanel(p);};
  const close=()=>{if(!lock.current){setPanel(null);setError('');}};
  const preview=(route:string,title:string)=>open({kind:'preview',title,route});
  const edit=(task?:RawTask)=>open({kind:'task',title:task&&s.tasks.some(t=>t.id===task.id)?'Изменить квест':'Новый квест',task:task||{id:crypto.randomUUID(),title:'',date:day(),estimateMin:30,startTime:null,skillId:defaultSkill?.id,skillIds:defaultSkill?[defaultSkill.id]:[],layers:[],difficulty:'normal',core:false}});
  const note=(id?:string)=>{if(!id){open({kind:'capture',title:'Записать мысль'});return;}const n=s.inbox.find(n=>n.id===id);open({kind:'note',title:id?'Изменить заметку':'Записать мысль',id:id||crypto.randomUUID(),text:n?.text||''});};
  async function act(command:string,input:unknown={},success='',dismiss=false){
    if(lock.current)return false;
    lock.current=true;setBusy(true);setError('');
    try{const result=await window.SatoruLiveBridge.run(command,input,{account:s.account,epoch:s.epoch});if(!result.ok){setError(result.error||'Запись не подтверждена. Повтори попытку.');return false;}if(success){const done=command==='task.complete'?result.snapshot?.tasks.find(t=>t.id===(input as {id:string}).id):null;setReceipt(result.notice||(done?'Квест выполнен · +'+(done.xpAwarded||0)+' XP · +'+(done.goldAwarded||0)+' золота':success));}if(dismiss)setPanel(null);return true;}
    catch{setError('Связь прервалась. Содержимое формы сохранено — повтори попытку.');return false;}
    finally{lock.current=false;setBusy(false);}
  }
  useEffect(()=>{const notice=(e:Event)=>setReceipt(String((e as CustomEvent).detail||''));addEventListener('satoru:legacy-toast',notice);return()=>removeEventListener('satoru:legacy-toast',notice);},[]);
  useEffect(()=>{if((s as any).navigation?.entryFocus==='capture'){window.SatoruTodayBridge.consumeCapture();open({kind:'capture',title:'Записать мысль'});}},[s.revision]);
  const shadow=()=>void act('shadow.open');
  const focus=s.timer,elapsed=focus?focus.accumulatedMs+(focus.running?Date.now()-focus.startedAt:0):0;
  const time=String(Math.floor(elapsed/60000)).padStart(2,'0')+':'+String(Math.floor(elapsed/1000)%60).padStart(2,'0');
  const review=()=>open({kind:'review',title:'Итог дня'});
  const complete=(t:Task)=>void act(t.done?'task.undo':'task.complete',{id:t.id},t.done?'Выполнение отменено':'Квест выполнен · награда сохранена');
  const calendarData=calendarPlan({...data,goals:(s.goals||[]).map(g=>({id:g.id,title:g.title,description:g.description||'',project:'',horizon:g.type||'',deadline:g.targetDate||'',primary:g.skillIds||[],steps:g.steps,done:!!g.completedAt,archived:g.archived}))},s.weeks);
  const routineDates=Array.from({length:49},(_,i)=>{const d=new Date(calendarDate.slice(0,7)+'-01T12:00:00');d.setDate(d.getDate()-7+i);return day(d);});
  const routineRows=window.SatoruPlanBridge.occurrences([...new Set([day(),...routineDates])]);
  async function navigate(next:string,section?:string){if(!await window.SatoruPlanBridge.flush()){setError('Настройки ещё не сохранены. Повтори сохранение перед переходом.');return;}setError('');history.pushState(null,'',location.pathname+location.search+(next==='world'?'#world/'+worldMode:next==='settings'?'#settings/'+(section||''):next==='plan'?'#plan':next==='rewards'?'#rewards':next==='tribe'?'#tribe':'#today'));setRoute(next);if(section!==undefined)setSettingsGroup(section);if(next==='today')setMode('День');}
  const goToday=()=>void navigate('today');
  useEffect(()=>{let reading=false;const back=async()=>{if(reading)return;reading=true;const requested=location.hash;if(!await window.SatoruPlanBridge.flush()){history.replaceState(null,'',routeURL.current);setError('Настройки ещё не сохранены. Повтори сохранение перед переходом.');reading=false;return;}reading=false;const next=initialAppNavigation(requested||'#today');setRoute(next.route);setSettingsGroup(next.settingsGroup);setPlanMode(next.planMode);setCalendarDate(next.calendarDate);setCalendarScale(next.calendarScale);setGoalEntry(next.goalEntry);setWorldMode(next.worldMode);setMode(next.todayMode);};addEventListener('popstate',back);addEventListener('hashchange',back);return()=>{removeEventListener('popstate',back);removeEventListener('hashchange',back);};},[]);
  function editCalendar(t?:Task,inbox=false){
    if(inbox){note();return;}
    const existing=t?s.tasks.find(x=>x.id===t.id):undefined;
    if(existing){edit(existing);return;}
    open({kind:'task',title:'Новый квест',task:{id:crypto.randomUUID(),title:t?.title||'',date:t?.date||calendarDate,startTime:t?.start||null,estimateMin:t?.minutes||30,difficulty:'normal',skillId:defaultSkill?.id,skillIds:defaultSkill?[defaultSkill.id]:[],layers:[],core:false}});
  }
  async function applyCalendar(fn:(d:typeof data)=>typeof data,message:string){
    try{const changes=calendarChanges(data,fn(structuredClone(data)));if(!changes.length)return true;return await act('calendar.apply',{changes},message);}
    catch(e){setError(e instanceof Error?e.message:'Перенос не сохранён. Попробуй ещё раз.');return false;}
  }
  function calendarPanel(kind:string,value?:any){
    if(kind==='intention')open({kind:'intention',title:'Намерение недели',key:value.key});
    else if(kind==='budget')open({kind:'budget',title:'Время на дела',key:value.key});
    else if(kind==='inbox')open({kind:'carry',title:'Перенести выбранные дела'});
    else if(kind==='shadowPlan')void act('routine.workshop',{week:monday(calendarDate)});
    else if(kind==='regular')open({kind:'regular',title:'Постоянное расписание'});
    else if(kind==='goalDetail'){setPlanMode('Цели');setGoalEntry(value);}
  }
  const taskRow=(t:Task,core=false)=><article className={'wb-task '+(t.done?'done ':'')+(core?'core':'')} key={t.id}><button disabled={busy} className="wb-check" aria-label={(t.done?'Отменить выполнение: ':'Выполнить: ')+t.title} aria-pressed={t.done} onClick={()=>complete(t)}>{t.done&&<Icon id="action.check" size={18}/>}</button><div className="wb-task-copy"><button className="wb-task-title" onClick={()=>edit(s.tasks.find(x=>x.id===t.id))}>{t.title}</button><div className="wb-task-meta"><Icon id={'difficulty.'+t.difficulty} size={22}/><span className="wb-scopes">{t.primary.slice(0,2).map(id=><span key={id}><i style={{background:s.skills.find(k=>k.id===id)?.color||'#727a92'}}/>{s.skills.find(k=>k.id===id)?.name||'Сфера'}</span>)}{!!t.background.length&&<span>+{t.background.length} сопутств.</span>}</span><span>{t.start?t.start+' · ':''}{t.done&&t.actual!==null?duration(t.actual)+' / ':''}{duration(t.minutes)}</span></div>{core&&<div className="wb-core-action">{focus?.taskId===t.id?<><b className="wb-timer">{time}</b><button disabled={busy} onClick={()=>void act('focus.pause')}><Icon id={focus.running?'media.pause':'media.play'}/>{focus.running?'Пауза':'Продолжить'}</button><button onClick={()=>open({kind:'focus',title:'Фокус'})} aria-label="Завершить фокус"><Icon id="action.check"/></button></>:<button disabled={busy} className="wb-primary" onClick={()=>void act('focus.start',{id:t.id})}><Icon id="media.play" size={18}/>Начать фокус</button>}</div>}</div><button className="b24-edit-task" aria-label={'Изменить квест: '+t.title} onClick={()=>edit(s.tasks.find(x=>x.id===t.id))}><Icon id="action.edit" size={18}/></button>{!core&&!t.done&&<button disabled={busy} className="wb-row-action" aria-label={'Фокус: '+t.title} onClick={()=>void act('focus.start',{id:t.id})}><Icon id="media.play" size={18}/></button>}</article>;
  function body(){
    if(!panel)return null;
    if(panel.kind==='task')return <><TaskForm s={s} initial={panel.task!} save={(task,base)=>act(task.rewardPurchaseId?'reward.rest':'task.save',{task,base},'Квест сохранён',true)}/>{s.tasks.some(t=>t.id===panel.task?.id)&&<button className="wb-wide" disabled={focus?.taskId===panel.task?.id} onClick={()=>open({kind:'actual',title:'Фактическое время',task:s.tasks.find(t=>t.id===panel.task?.id)})}>Уточнить фактическое время</button>}</>;
    if(panel.kind==='actual')return <ActualForm task={panel.task!} save={minutes=>act('task.actual',{id:panel.task!.id,minutes,expected:panel.task!.actualMin??null},'Фактическое время сохранено',true)}/>;
    if(panel.kind==='regular')return <LiveRoutine s={s} week={calendarDate} run={(c,p,m)=>act(c,p,m)}/>;
    if(panel.kind==='intention')return <IntentionForm s={s} week={panel.key!} save={(text,skills)=>act('calendar.intent',{week:panel.key,text,skills},'Намерение недели сохранено',true)}/>;
    if(panel.kind==='budget')return <BudgetForm s={s} date={panel.key!} save={minutes=>act('calendar.budget',{date:panel.key,minutes},'Ориентир дня сохранён',true)}/>;
    if(panel.kind==='carry')return <CarryForm s={s} selected={calendarDate} save={(ids,date)=>act('calendar.apply',{changes:ids.map(id=>{const t=s.tasks.find(t=>t.id===id)!;return{id,before:{date:t.date,startTime:t.startTime||null,core:!!t.core},after:{date,startTime:null,core:!!t.core}};})},'Выбранные квесты перенесены',true)}/>;
    if(panel.kind==='note')return <><TextForm account={s.account} initial={panel.text||''} draftKey={'note:'+panel.id} label="Твоя мысль" limit={1000} save={text=>act('note.save',{id:panel.id,text,base:panel.text},'Заметка сохранена',true)}/></>;
    if(panel.kind==='capture')return <OwnedToday s={s} part="capture"/>;
    if(panel.kind==='review')return <OwnedToday s={s} part="review"/>;
    if(panel.kind==='focus')return <><h3>{s.tasks.find(t=>t.id===focus?.taskId)?.title||'Таймер остановлен'}</h3><p className="live-clock">{time}</p>{focus&&<><button className="wb-primary wb-wide" onClick={()=>void act('focus.pause')}>{focus.running?'Пауза':'Продолжить'}</button><button className="wb-wide" onClick={()=>void act('focus.stop',{},'Фокус остановлен. Квест остался в плане.',true)}>Остановить, не завершая квест</button><button className="wb-wide" onClick={()=>void act('task.complete',{id:focus.taskId},'Квест выполнен · награда сохранена',true)}>Завершить квест</button></>}{!focus&&<div className="b213-focus-choices"><p className="pl-help">Выбери квест для фокуса.</p>{s.tasks.filter(t=>!t.done&&t.date===day()).map(t=><button key={t.id} className="b210-routine-item" onClick={()=>void act('focus.start',{id:t.id},'Фокус начат',true)}><strong data-noi18n>{t.title}</strong><small>{duration(t.estimateMin||0)}</small></button>)}</div>}<button className="wb-wide" onClick={()=>{close();void navigate('settings','life');}}>Настройки фокуса</button><p className="pl-help">Таймер сохраняется на этом устройстве. Накопленные минуты записываются в квест на сервере.</p></>;
    if(panel.kind==='streak')return <><h3>{s.streak} {countWord(s.streak,'день','дня','дней')} в серии</h3><p>Баланс: {s.gold} золота · {s.xp} XP</p><p className="pl-help">Это данные твоего аккаунта.</p></>;
    if(panel.kind==='preview')return <><p>Этот раздел пока открыт для проверки дизайна. Квесты и записи аккаунта останутся в «Сегодня».</p><a className="live-preview-link" href={'/redesign/index.html#'+panel.route}>Открыть макет · {panel.title}</a><button className="wb-wide" onClick={close}>Остаться в «Сегодня»</button></>;
    return null;
  }
  const showScene=route==='today'&&mode==='День';
  return <div ref={root} className={'wb palette-ink '+(dark?'theme-dark ':'')+'route-'+route+(!motion?' reduce-motion':'')} style={customAccent?{'--action':customAccent,'--on-action':accentText(customAccent)} as React.CSSProperties:undefined}><div className="wb-scroll"><header className="wb-header"><button className={'wb-brand '+(displayBrand.toLowerCase()!=='satoru'?'custom-brand':'')} onClick={goToday} aria-label="Satoru — Сегодня"><span>?</span><strong className="b210-brand-name" data-noi18n>{displayBrand}</strong></button><button className="wb-header-tool" onClick={()=>open({kind:'streak',title:'Твой прогресс'})}><Icon id="status.streak" size={31}/><span>{s.streak} {countWord(s.streak,'день','дня','дней')}</span></button><button className="wb-header-tool" aria-label="Палитра и настройки" onClick={()=>void navigate('settings','')}><Icon id="nav.settings"/></button></header>
    {!!s.errors.length&&<div role="alert" className="wb-global-error">{s.errors.join(' ')}</div>}
    {error&&!panel&&<p role="alert" className="wb-global-error">{error}</p>}
    {showScene&&<aside className="wb-scene-column"><div className="wb-date"><h1>{label(day())}</h1><button onClick={review} aria-label="Открыть итог дня"><Icon id="system.day-end"/></button></div><Lair working={!!focus} paused={!focus?.running} motion={motion&&!panel} form={s.shadowForm} onShadow={shadow} onOpen={()=>void navigate('world')} onSeen={setSeen}/></aside>}
    <main className={'wb-main '+(showScene?'with-scene':'full')} aria-busy={busy}>{route==='today'&&<><div className="wb-section-head"><h2 id={mode==='Заметки'?'notes-title':undefined}>{mode==='Заметки'?'Заметки':'Сегодня'}</h2>{mode!=='Заметки'&&<button className="wb-primary" onClick={()=>edit()}><Icon id="action.add" size={18}/>Квест</button>}</div><div className="wb-segments" role="group" aria-label="Раздел Сегодня">{['День','Доска','Заметки'].map(v=><button key={v} aria-pressed={mode===v} onClick={()=>{window.SatoruTodayBridge.mode(v);setMode(v);if(v==='Доска')void act('today.board.enter');}}>{v}</button>)}</div></>}
    {route==='today'&&mode==='День'&&<><TodayDashboard chestsAvailable={s.chestsAvailable} data={calendarData} taskRow={taskRow} habitRow={h=><div className="wb-habit" key={h.id}><button disabled={busy} className="wb-check" aria-label={'Отметить привычку: '+h.title} aria-pressed={h.logs.includes(day())} onClick={()=>void act('habit.toggle',{id:h.id},'Отметка привычки сохранена')}>{h.logs.includes(day())&&<Icon id="action.check" size={18}/>}</button><div><strong>{h.title}</strong><small>{duration(h.minutes)}</small></div></div>} add={()=>edit()} notes={()=>note()} review={review} plan={()=>void navigate('plan')} reward={entry=>{setRewardEntry(entry||'');void navigate('rewards');}}/>{(routineRows[day()]||[]).length>0&&<section className="b210-today-routine"><div className="pl-section-head"><h3>По расписанию</h3><button onClick={()=>{setRoute('plan');setPlanMode('Календарь');setCalendarDate(day());}}>Календарь</button></div>{routineRows[day()].map(o=><button className="b210-routine-item" key={o.key} onClick={()=>void act('routine.open',{key:o.key})}><small>{o.start||'Время любое'}</small><strong data-noi18n>{o.title}</strong><small>{duration(o.minutes)}</small></button>)}</section>}</>}
    {route==='today'&&mode==='Доска'&&<OwnedToday s={s} part="board"/>}
    {route==='today'&&mode==='Заметки'&&<OwnedToday s={s} part="notes"/>}
    {route==='tribe'&&<OwnedToday s={s} part="tribe"/>}
    {route==='world'&&<LiveWorld s={s} failure={error} mode={worldMode} choose={setWorldMode} run={(c,p,m)=>act(c,p,m)} editTask={edit} rewards={()=>void navigate('rewards')} settings={g=>void navigate('settings',g)} shadow={shadow}/>}
    {route==='rewards'&&<LiveRewards s={s} run={(c,p,m)=>act(c,p,m)} editTask={edit} complete={t=>void act('task.complete',{id:t.id},'Отдых отмечен · награда использована')} entry={rewardEntry} handled={()=>setRewardEntry('')}/>}
    {route==='settings'&&<LiveSettings s={s} group={settingsGroup} choose={g=>void navigate('settings',g)} back={goToday}/>}
    {route==='plan'&&<><nav className="pl-tabs live-plan-sections" aria-label="Разделы плана">{['Календарь','Цели','Привычки','Вдохновение'].map((name,i)=><button key={name} aria-current={planMode===name?'page':undefined} onClick={()=>{setPlanMode(name);setGoalEntry('');}}>{name}</button>)}</nav>{planMode==='Цели'&&<LiveGoals s={s} writeError={error} run={(c,p,m)=>act(c,p,m)} editTask={edit} shadow={shadow} entry={goalEntry} handled={()=>setGoalEntry('')}/>}
    {planMode==='Привычки'&&<OwnedSurface s={s} kind="habits"/>}{planMode==='Вдохновение'&&<OwnedSurface s={s} kind="inspiration"/>}
    {planMode==='Календарь'&&<fieldset className="live-fields" disabled={busy}><LiveCalendar routineRows={routineRows} routineOpen={key=>void act('routine.open',{key})} undoMove={()=>act('calendar.undo',{},'Перенос отменён')} data={calendarData} skillChoices={s.skills} date={calendarDate} scale={calendarScale} setDate={setCalendarDate} setScale={setCalendarScale} edit={editCalendar} open={calendarPanel} apply={applyCalendar} complete={complete}/></fieldset>}<button className="tri-link-row" onClick={()=>open({kind:'focus',title:'Время и фокус'})}><Icon id="system.focus"/>Время и фокус<Icon id="action.expand"/></button></>}
    {s.pendingFocus>0&&<div className="wb-status-note" role="status">Записи фокуса без серверного подтверждения: {s.pendingFocus}.<button onClick={()=>void act('focus.retry',{},'Фокус сохранён на сервере')}>Повторить отправку</button></div>}
    {document.documentElement.dataset.satoruMode==='review'&&<footer className="wb-footer">B2.13 · данные аккаунта <b>{s.name}</b> · <a href="/redesign/index.html">Все разделы макета</a></footer>}</main></div>
    {focus&&<FocusDock time={time} title={s.tasks.find(t=>t.id===focus.taskId)?.title||'Фокус'} running={focus.running} open={()=>open({kind:'focus',title:'Фокус'})} pause={()=>void act('focus.pause')} finish={()=>open({kind:'focus',title:'Завершить фокус'})}/>}
    {(!showScene||!seen)&&!panel&&<button className="wb-bubble" style={bubble?{left:bubble.x,top:bubble.y,right:'auto',bottom:'auto'}:undefined} aria-label="Открыть чат с Тенью. Можно перемещать." onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect(),p=root.current!.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:r.left-p.left,top:r.top-p.top,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>6)d.moved=true;if(d.moved)setBubble({x:Math.max(8,Math.min(root.current!.clientWidth-70,d.left+dx)),y:Math.max(8,Math.min(root.current!.clientHeight-150,d.top+dy))});}} onPointerUp={()=>{if(drag.current&&!drag.current.moved)shadow();drag.current=null;}} onPointerCancel={()=>drag.current=null} onClick={e=>{if(e.detail===0)shadow();}}><Portrait form={s.shadowForm}/></button>}
    <nav className="wb-nav" aria-label="Основные разделы">{tabs.map(([id,name,ic])=><button key={id} aria-current={route===id?'page':undefined} onClick={()=>id==='today'?goToday():id==='plan'?void navigate('plan'):id==='rewards'?void navigate('rewards'):id==='world'?void navigate('world'):void navigate('tribe')}><Icon id={ic} size={23}/><span>{name}</span></button>)}</nav>
    {receipt&&<div role="status" className="wb-toast">{receipt}</div>}
    <dialog ref={dialog} className={'wb-dialog palette-ink '+(dark?'theme-dark':'')} style={customAccent?{'--action':customAccent,'--on-action':accentText(customAccent)} as React.CSSProperties:undefined} aria-label={panel?.title||'Satoru'} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}><div className="wb-sheet"><header><h2>{panel?.title}</h2><button disabled={busy} aria-label="Закрыть панель" onClick={close}><Icon id="action.close"/></button></header>{receipt&&<p role="status" className="tri-receipt">{receipt}</p>}{error&&<p role="alert" className="wb-error">{error}</p>}{busy&&<p role="status">Сохраняю…</p>}<fieldset className="live-fields" disabled={busy} key={panel?.kind+':'+(panel?.id||panel?.task?.id||'')}>{body()}</fieldset></div></dialog>
  </div>;
}
let reactRoot:Root|null=null,account='',previousDesign:string|null=null;
window.SatoruLiveView={
  render(s){
    window.SatoruStartView?.hide();
    if(!document.body.classList.contains('b28-live'))previousDesign=document.documentElement.getAttribute('data-design');
    document.documentElement.removeAttribute('data-design');
    document.documentElement.lang=s.preferences?.language||'ru';document.body.classList.add('b28-live');
    const app=document.getElementById('app')!;
    if(!reactRoot||!app.querySelector('#live-root')){reactRoot?.unmount();app.replaceChildren();const host=document.createElement('div');host.id='live-root';const toasts=document.createElement('div');toasts.id='toasts';toasts.hidden=true;app.append(host,toasts);reactRoot=createRoot(host);}
    account=s.account+':'+s.epoch;reactRoot.render(<Today key={account+':'+(s.preferences?.language||'ru')} snapshot={s}/>);
  },
  hide(){reactRoot?.unmount();reactRoot=null;document.body.classList.remove('b28-live');if(previousDesign)document.documentElement.setAttribute('data-design',previousDesign);}
};
