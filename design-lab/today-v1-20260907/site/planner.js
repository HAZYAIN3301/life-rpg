import {DEMO_DAY,duration,conflicts,SPHERES} from './model.js';
import {weekDates,monthDates,shiftDate,goalProgress,GOAL_TYPES,calendarICS} from './planning-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=(day,options={day:'numeric',month:'long'})=>new Intl.DateTimeFormat('ru',{...options,timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
export function createPlanner(host,api) {
  const query=new URLSearchParams(location.search);
  let mode=['day','week','month'].includes(query.get('mode'))?query.get('mode'):'week';
  let section=query.get('section')==='goals'?'goals':'calendar',filter='focus',selected=new Set(),bulk=false;
  const get=api.getState;
  const goals=()=>get().goals||[];
  const tasksOn=day=>get().tasks.filter(t=>t.date===day).sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
  function syncURL(){const url=new URL(location.href);url.searchParams.set('section',section);url.searchParams.set('mode',mode);history.replaceState(null,'',url);}
  function dayButton(day,extra='') {
    const tasks=tasksOn(day),minutes=tasks.reduce((sum,t)=>sum+t.minutes,0);
    return '<button class="plan-date '+(day===get().day?'selected':'')+'" data-plan-day="'+day+'" aria-pressed="'+(day===get().day)+'" aria-label="'+dateText(day)+'"><span>'+dateText(day,{weekday:'short'})+'</span><b>'+Number(day.slice(-2))+'</b><small>'+ (extra|| (minutes?duration(minutes):'—'))+'</small></button>';
  }
  function row(t,compact=false) {
    const clash=conflicts(t,get().tasks).length>0;
    return '<article class="agenda-item '+(t.done?'done ':'')+(t.core?'agenda-core':'')+'" data-calendar-task="'+esc(t.id)+'" draggable="true" data-drag-task="'+esc(t.id)+'"><button class="check" data-toggle="'+esc(t.id)+'" aria-pressed="'+t.done+'" aria-label="'+(t.done?'Снять выполнение: ':'Выполнить: ')+esc(t.title)+'">'+(t.done?'✓':'')+'</button><div class="agenda-main"><button class="agenda-title" data-edit="'+esc(t.id)+'">'+esc(t.title)+'</button><div class="agenda-meta"><button data-edit="'+esc(t.id)+'" data-field="time">'+(t.time||'Назначить время')+'</button><span>· '+duration(t.minutes)+'</span>'+(!compact?'<span>'+esc(t.spheres.join(' · '))+'</span>':'')+'</div>'+(clash?'<span class="schedule-conflict">Пересечение времени</span>':'')+'</div></article>';
  }
  function agenda(day) {
    const items=tasksOn(day),scheduled=items.filter(t=>t.time&&!t.done),loose=items.filter(t=>!t.time&&!t.done),done=items.filter(t=>t.done);
    return '<section class="agenda" aria-label="Дела выбранного дня"><header class="plan-section-head"><h2>'+dateText(day,{weekday:'long',day:'numeric',month:'long'})+'</h2><button class="outline" data-plan-add="'+day+'">＋ Задача</button></header>'+
      (scheduled.length?scheduled.map(t=>row(t)).join(''):'<div class="plan-empty"><p>Время пока свободно.</p><button class="text-button" data-plan-add="'+day+'">Запланировать дело ↗</button></div>')+
      (loose.length?'<div class="unscheduled"><h3>Без времени <span>'+loose.length+'</span></h3>'+loose.map(t=>row(t)).join('')+'</div>':'')+(done.length?'<details class="completed-agenda"><summary>Выполнено · '+done.length+'</summary>'+done.map(t=>row(t)).join('')+'</details>':'')+'</section>';
  }
  function calendar() {
    const day=get().day,days=weekDates(day);
    const range=mode==='day'?dateText(day):mode==='month'?dateText(day,{month:'long',year:'numeric'}):dateText(days[0],{day:'numeric'})+'–'+dateText(days[6]);
    const tools='<div class="calendar-tools" role="group" aria-label="Инструменты календаря"><button data-plan-tool="export">Экспорт</button><button data-plan-tool="subscribe">Подписка</button><button data-plan-tool="reminders">Напоминания</button></div>';
    const toolbar='<div class="calendar-toolbar"><div class="calendar-period"><button class="icon-button" data-plan-shift="-1" aria-label="Предыдущий период">‹</button><h2>'+range+'</h2><button class="icon-button" data-plan-shift="1" aria-label="Следующий период">›</button></div><div class="calendar-modes" role="group" aria-label="Режим календаря">'+[['day','День'],['week','Неделя'],['month','Месяц']].map(([id,label])=>'<button data-plan-mode="'+id+'" aria-pressed="'+(id===mode)+'">'+label+'</button>').join('')+'</div><button class="text-button" data-plan-day="'+DEMO_DAY+'">Сегодня</button></div>';
    let content='';
    if(mode==='week')content='<div class="week-board">'+days.map(d=>'<section class="week-column '+(d===day?'is-selected':'')+'" data-drop-day="'+d+'"><button class="week-column-head" data-plan-day="'+d+'"><span>'+dateText(d,{weekday:'short'})+'</span><b>'+Number(d.slice(-2))+'</b><small>'+duration(tasksOn(d).reduce((sum,t)=>sum+t.minutes,0))+'</small></button>'+tasksOn(d).map(t=>row(t,true)).join('')+'<button class="week-add" data-plan-add="'+d+'" aria-label="Добавить задачу на '+dateText(d)+'">＋</button></section>').join('')+'</div><div class="week-mobile-detail">'+agenda(day)+'</div>';
    else if(mode==='month')content='<div class="month-board"><div class="month-weekdays">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="month-days">'+monthDates(day).map(d=>{const list=tasksOn(d),deadlines=goals().filter(g=>g.status==='active'&&g.date===d);return '<button data-plan-day="'+d+'" data-month-date="'+d+'" data-drop-day="'+d+'" class="month-cell '+(d===day?'is-selected ':'')+(d.slice(0,7)!==day.slice(0,7)?'outside-month':'')+'" aria-label="'+dateText(d)+', дел: '+list.length+', сроков целей: '+deadlines.length+'"><b>'+Number(d.slice(-2))+'</b><span class="month-task-names">'+list.slice(0,2).map(t=>'<span>'+esc(t.title)+'</span>').join('')+'</span><small>'+(list.length?list.length+' дел':'')+(deadlines.length?' ◆ '+deadlines.length:'')+'</small></button>';}).join('')+'</div></div>'+agenda(day);
    else content=agenda(day);
    const due=goals().filter(g=>g.status==='active'&&g.date&&(mode==='day'?g.date===day:mode==='month'?g.date.slice(0,7)===day.slice(0,7):g.date>=days[0]&&g.date<=days[6])).sort((a,b)=>a.date.localeCompare(b.date));
    return toolbar+'<div class="plan-week-strip '+mode+'-strip">'+days.map(d=>dayButton(d)).join('')+'</div>'+tools+
      content+(due.length?'<div class="deadline-strip"><span>Сроки целей</span>'+due.map(g=>'<button data-goal-open="'+g.id+'">'+dateText(g.date,{day:'numeric',month:'short'})+' · '+esc(g.title)+' ↗</button>').join('')+'</div>':'');
  }
  function goalCard(g) {
    const progress=goalProgress(g,get().tasks),next=progress.next;
    return '<article class="goal-card" data-goal-card="'+g.id+'"><div class="goal-card-top"><span>'+GOAL_TYPES[g.type]+'</span><span>'+ (g.date?dateText(g.date):'Без срока')+'</span></div><div class="goal-card-title">'+(bulk?'<input type="checkbox" data-goal-select="'+g.id+'" aria-label="Выбрать: '+esc(g.title)+'" '+(selected.has(g.id)?'checked':'')+'>':'')+'<button data-goal-open="'+g.id+'">'+esc(g.title)+'</button><button class="goal-check" data-goal-complete="'+g.id+'" aria-label="'+(g.status==='done'?'Вернуть цель: ':'Завершить цель: ')+esc(g.title)+'">'+(g.status==='done'?'✓':'○')+'</button></div><p>'+esc(g.description)+'</p><div class="goal-progress"><progress max="'+(progress.total||1)+'" value="'+progress.done+'" aria-label="Выполнено шагов"></progress><span>'+progress.done+' / '+progress.total+' шагов</span></div>'+
      (g.status==='active'&&next?'<div class="goal-next"><span>Следующий шаг</span><b>'+esc(next.text)+'</b><button class="outline" data-goal-schedule="'+g.id+'">На сегодня · '+duration(next.minutes)+'</button></div>':g.status!=='active'?'<button class="text-button" data-goal-resume="'+g.id+'">Вернуть в активные ↗</button>':'<button class="text-button" data-goal-open="'+g.id+'">Добавить следующий шаг ↗</button>')+'</article>';
  }
  function goalMap(parent='') {
    return goals().filter(g=>g.parentId===parent).map(g=>'<details class="goal-branch" open><summary>'+esc(g.title)+'</summary><button class="text-button" data-goal-open="'+g.id+'">Открыть цель ↗</button>'+goalMap(g.id)+'</details>').join('');
  }
  function goalBoard() {
    const all=goals(),visible=all.filter(g=>filter==='archive'?['archived','done'].includes(g.status):filter==='all'?['active','paused'].includes(g.status):g.status==='active'&&g.type!=='path');
    const filters='<div class="goals-toolbar"><div class="goals-filters" role="group" aria-label="Показать цели">'+[['focus','Сейчас'],['all','Все'],['map','Карта'],['archive','Архив']].map(([id,label])=>'<button data-goal-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join('')+'</div><button class="text-button" data-goal-bulk aria-pressed="'+bulk+'">'+(bulk?'Отменить выбор':'Выбрать несколько')+'</button></div>';
    const selection=bulk?'<div class="bulk-bar"><span>Выбрано: '+selected.size+'</span><button data-goal-bulk-status="archived" '+(!selected.size?'disabled':'')+'>В архив</button><button data-goal-bulk-status="paused" '+(!selected.size?'disabled':'')+'>На паузу</button></div>':'';
    return '<header class="plan-section-head"><h2>'+({focus:'Ближайшие цели',all:'Все цели',map:'Карта целей',archive:'Архив'}[filter])+'</h2><button class="outline" data-goal-create>＋ Цель</button></header>'+filters+selection+(filter==='map'?goalMap():visible.length?'<div class="goal-grid">'+visible.map(goalCard).join('')+'</div>':'<div class="plan-empty"><h3>'+(all.length?'Здесь пока пусто':'К чему хочешь прийти?')+'</h3><p>'+(all.length?'Цели появятся здесь после смены состояния.':'Запиши результат и один шаг, с которого начнёшь.')+'</p></div>');
  }
  function render() {
    const active=document.activeElement,attribute=active&&host.contains(active)?[...active.attributes].find(a=>/^data-(plan|goal)-/.test(a.name)):null;
    host.innerHTML='<header class="plan-header"><div><div class="eyebrow">БЛИЖЕ К ВАЖНОМУ</div><h1 tabindex="-1">План</h1></div><div class="plan-tabs" role="group" aria-label="Раздел плана"><button data-plan-section="calendar" aria-pressed="'+(section==='calendar')+'">Календарь</button><button data-plan-section="goals" aria-pressed="'+(section==='goals')+'">Цели</button></div></header>'+(section==='calendar'?calendar():goalBoard());
    if(attribute)[...host.querySelectorAll('['+attribute.name+'="'+CSS.escape(attribute.value)+'"]')].find(el=>el.getClientRects().length)?.focus({preventScroll:true});
  }
  function goalDetail(id) {
    const g=goals().find(g=>g.id===id);if(!g)return;
    const progress=goalProgress(g,get().tasks);
    api.openDialog(g.title,'<p class="goal-description">'+esc(g.description||'Описание пока не добавлено.')+'</p><div class="goal-detail-meta">'+esc(GOAL_TYPES[g.type])+' · '+esc(g.sphere)+(g.date?' · '+dateText(g.date):'')+'</div><div class="dialog-actions"><button class="outline" data-goal-edit="'+id+'">Изменить</button><button class="text-button" data-goal-complete="'+id+'">'+(g.status==='done'?'Вернуть цель':'Цель достигнута ✓')+'</button><button class="text-button" data-goal-archive="'+id+'">В архив</button></div><h3 class="detail-section-title">Шаги</h3><ol class="goal-steps">'+g.steps.map(step=>{const task=get().tasks.find(t=>t.goalId===id&&t.stepId===step.id);return '<li class="'+(task?.done?'step-done':'')+'"><span>'+esc(step.text)+'</span>'+(task?'<button class="text-button" data-plan-task="'+task.id+'">'+(task.done?'Выполнено ✓':dateText(task.date)+' ↗')+'</button>':step===progress.next?'<button class="text-button" data-goal-schedule="'+id+'">На сегодня ↗</button>':'<span class="step-wait">Далее</span>')+'</li>';}).join('')+'</ol><form id="goal-step-form"><label>Следующий пункт<input name="text" maxlength="160" required placeholder="Одно конкретное действие"></label><button class="outline">Добавить шаг</button></form>');
    document.querySelector('#goal-step-form').onsubmit=e=>{e.preventDefault();const text=e.currentTarget.elements.text.value.trim();if(text&&api.commit({type:'goal-save',goal:{...g,steps:[...g.steps,{id:crypto.randomUUID(),text,minutes:15}]}},'Шаг добавлен'))goalDetail(id);};
  }
  function goalEditor(id) {
    const g=goals().find(g=>g.id===id)||{id:crypto.randomUUID(),title:'',description:'',type:'short',date:'',sphere:'Медиа',parentId:'',status:'active',steps:[]};
    api.openDialog(id?'Изменить цель':'Новая цель','<form id="goal-form"><label>Какой результат нужен?<input name="title" required maxlength="160" value="'+esc(g.title)+'"></label><label>Описание<textarea name="description" maxlength="3000">'+esc(g.description)+'</textarea></label><div class="form-pair"><label>Срок<input name="date" type="date" value="'+g.date+'"></label><label>Горизонт<select name="type">'+Object.entries(GOAL_TYPES).map(([value,label])=>'<option value="'+value+'" '+(g.type===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div><div class="form-pair"><label>Сфера<select name="sphere">'+SPHERES.map(s=>'<option '+(g.sphere===s?'selected':'')+'>'+s+'</option>').join('')+'</select></label><label>Родительская цель<select name="parentId"><option value="">Без родителя</option>'+goals().filter(p=>p.id!==g.id).map(p=>'<option value="'+p.id+'" '+(g.parentId===p.id?'selected':'')+'>'+esc(p.title)+'</option>').join('')+'</select></label></div>'+(!id?'<label>Первый шаг<input name="firstStep" required maxlength="160" placeholder="С чего начнёшь?"></label>':'')+'<button class="primary">Сохранить цель</button></form>');
    document.querySelector('#goal-form').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const first=data.firstStep?.trim();if(api.commit({type:'goal-save',goal:{...g,...data,steps:first?[{id:crypto.randomUUID(),text:first,minutes:15}]:g.steps}},'Цель сохранена'))api.closeDialog();};
  }
  function statusConfirm(ids,status) {
    const labels={done:'Завершить',archived:'Отправить в архив',paused:'Поставить на паузу'};
    const affected=goals().filter(g=>ids.includes(g.id));
    api.openDialog((labels[status]||'Вернуть')+' цели?','<ul class="confirm-list">'+affected.map(g=>'<li>'+esc(g.title)+'</li>').join('')+'</ul><p>Связанные задачи останутся на своих датах. Действие можно отменить.</p><button class="primary" id="confirm-goal-status">'+(labels[status]||'Вернуть')+'</button>');
    document.querySelector('#confirm-goal-status').onclick=()=>{if(api.commit({type:'goal-status',ids,status},'Состояние целей обновлено')){selected.clear();bulk=false;api.closeDialog();render();}};
  }
  function schedule(id) {
    const goal=goals().find(g=>g.id===id),step=goal&&goalProgress(goal,get().tasks).next;if(!step)return;
    const existing=get().tasks.find(t=>t.goalId===id&&t.stepId===step.id&&!t.done);
    if(existing){api.closeDialog();api.goToday(existing.date);api.notice('Этот шаг уже запланирован.');return;}
    if(api.commit({type:'add',task:{id:'step:'+id+':'+step.id,title:step.text,date:DEMO_DAY,time:'',minutes:step.minutes,sphere:goal.sphere,goalId:id,stepId:step.id,goal:goal.title,done:false,core:false}},'Шаг добавлен на сегодня')){api.closeDialog();api.goToday(DEMO_DAY);}
  }
  function handle(button) {
    const d=button.dataset;
    if(d.planSection){section=d.planSection;syncURL();render();api.sound('navigate');}
    else if(d.planMode){mode=d.planMode;syncURL();render();api.sound('select');}
    else if(d.planDay){api.commit({type:'day',day:d.planDay},null);render();}
    else if(d.planShift){const delta=Number(d.planShift);let date=get().day;if(mode==='month'){const v=new Date(date.slice(0,7)+'-01T12:00:00Z');v.setUTCMonth(v.getUTCMonth()+delta);date=v.toISOString().slice(0,10);}else date=shiftDate(date,delta*(mode==='week'?7:1));api.commit({type:'day',day:date},null);}
    else if(d.planAdd){api.commit({type:'day',day:d.planAdd},null);api.compose(true);}
    else if(d.planTool){if(d.planTool==='export'){const dates=mode==='day'?[get().day]:mode==='week'?weekDates(get().day):monthDates(get().day).filter(d=>d.slice(0,7)===get().day.slice(0,7));const blob=new Blob([calendarICS(get().tasks.filter(t=>dates.includes(t.date)))],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='satoru-'+get().day+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);api.notice('Календарь подготовлен для скачивания.');}else api.openDialog(d.planTool==='subscribe'?'Подписка на календарь':'Напоминания','<p>Эта настройка работает с аккаунтом в основном Satoru. Стенд не включает уведомления и не создаёт подписку.</p><a class="outline" href="https://life-rpg-production-416a.up.railway.app/" target="_blank" rel="noopener">Открыть Satoru ↗</a>');}
    else if(d.goalFilter){filter=d.goalFilter;selected.clear();bulk=false;render();}
    else if(button.hasAttribute('data-goal-bulk')){bulk=!bulk;selected.clear();render();}
    else if(d.goalBulkStatus&&selected.size)statusConfirm([...selected],d.goalBulkStatus);
    else if(d.goalOpen)goalDetail(d.goalOpen);
    else if(d.goalEdit)goalEditor(d.goalEdit);
    else if(button.hasAttribute('data-goal-create'))goalEditor();
    else if(d.goalComplete){const g=goals().find(g=>g.id===d.goalComplete);if(g?.status==='done')api.commit({type:'goal-status',ids:[g.id],status:'active'},'Цель снова активна');else statusConfirm([d.goalComplete],'done');}
    else if(d.goalArchive)statusConfirm([d.goalArchive],'archived');
    else if(d.goalResume)api.commit({type:'goal-status',ids:[d.goalResume],status:'active'},'Цель снова активна');
    else if(d.goalSchedule)schedule(d.goalSchedule);
    else if(d.planTask){const task=get().tasks.find(t=>t.id===d.planTask);if(task){api.closeDialog();api.goToday(task.date);api.editTask(task.id);}}
    else return false;
    return true;
  }
  host.addEventListener('change',e=>{const id=e.target.dataset.goalSelect;if(id){e.target.checked?selected.add(id):selected.delete(id);render();host.querySelector('[data-goal-select="'+CSS.escape(id)+'"]')?.focus();}});
  let dragId;
  host.addEventListener('dragstart',e=>{dragId=e.target.closest('[data-drag-task]')?.dataset.dragTask;if(dragId)e.dataTransfer.setData('text/plain',dragId);});
  host.addEventListener('dragover',e=>{if(dragId&&e.target.closest('[data-drop-day]'))e.preventDefault();});
  host.addEventListener('drop',e=>{const day=e.target.closest('[data-drop-day]')?.dataset.dropDay;if(day&&dragId){e.preventDefault();api.commit({type:'edit',id:dragId,patch:{date:day}},'Задача перенесена');}dragId=null;});
  host.addEventListener('dragend',()=>{dragId=null;});
  return {render,handle,openGoal:goalDetail};
}
