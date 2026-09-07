import {fixture,load,save,mutate,dayTasks,nextTask,duration,conflicts,SPHERES,DEMO_DAY} from './model.js';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,undo=null,loadFailed=false,opener=null,recorder=null,stream=null,audioUrl=null,audioDownloaded=false;
const announcedTimers=new Set();let micEpoch=0;
const currentHabits=()=>state.habitDays?.[state.day]||(state.day===DEMO_DAY?state.habits:{stretch:false,read:false});
const audio=window.SatoruSoundV1?.create({mode:'off'});
const sectionIcons={'Заметки':'notes','Вдохновение':'inspiration','Награды':'rewards','Племя':'tribe','Профиль':'profile'};
function sectionIcon(section){const icon=sectionIcons[section];return icon==='rewards'?'<img class="nav-art nav-art-rewards" src="assets/nav-rewards.png" width="28" height="28" alt="">':'<span class="nav-art nav-art-'+icon+'" aria-hidden="true"></span>';}
try{state=load(localStorage);}catch(e){state=fixture();loadFailed=true;notice(e.message,true);}
function notice(message,error=false,canUndo=false){$('#notice').className='notice'+(error?' error':'');$('#notice').innerHTML=`<span>${esc(message)}</span>${canUndo?'<button id="undo">Отменить</button>':'<button id="notice-close" aria-label="Закрыть уведомление">×</button>'}`;$('#notice').hidden=false;}
function commit(action,message,options={}){
  if(loadFailed){notice('Сохранённый пример не читается. Сначала нажми «Сбросить пример».',true);return false;}
  const previous=structuredClone(state);
  const focused=document.activeElement;const attr=['data-toggle','data-habit','data-day'].find(key=>focused?.hasAttribute(key));const focusSelector=attr?`[${attr}="${CSS.escape(focused.getAttribute(attr))}"]`:null;
  try{const next=mutate(state,action);save(localStorage,next);state=next;undo=previous;render();if(focusSelector)document.querySelector(focusSelector)?.focus({preventScroll:true});if(message)notice(message,false,options.undo!==false);if(options.sound)audio?.play(options.sound);return true;}
  catch(e){notice(e.message||'Не удалось сохранить изменения.',true);return false;}
}
const palette={'Медиа':'#c0a7c5','Учёба':'#a6b8de','Тело':'#a0c5a7','Быт':'#b9b4a4','Отдых':'#a7c9c4'};
function taskHTML(t){
  const active=state.timer?.id===t.id, isNext=nextTask(state)?.id===t.id;
  const conflict=conflicts(t,state.tasks).length;
  return `<article class="task${t.core?' core':''}${t.done?' done':''}" data-task="${esc(t.id)}">
    <button class="task-time${!t.time?' is-empty':''}" data-edit="${esc(t.id)}" data-field="time" aria-label="Время начала: ${esc(t.title)}">${esc(t.time||'＋ Время')}</button>
    <button class="check" data-toggle="${esc(t.id)}" aria-pressed="${t.done}" aria-label="${t.done?'Снять выполнение':'Выполнить'}: ${esc(t.title)}">${t.done?'✓':''}</button>
    <div class="task-main">${t.core?`<div class="core-label"><span aria-hidden="true">◆</span>${t.done?'Ядро дня выполнено':'Ядро дня'}</div>`:''}<button class="task-title" data-edit="${esc(t.id)}" aria-label="Изменить задачу: ${esc(t.title)}">${esc(t.title)}</button>
    <div class="task-meta"><span class="sphere-dot" style="--sphere:${palette[t.sphere]}" aria-hidden="true"></span><span>${esc(t.sphere)}</span>${t.goal?`<span aria-hidden="true">/</span><span>${esc(t.goal)}</span>`:''}</div>
    ${t.core?`<p class="task-outcome">${esc(t.outcome||'Завершить эту задачу.')}</p>`:''}
    ${!t.done&&(isNext||active)?`<div class="task-actions">${active?`<span class="timer-readout" data-timer>${timerText()}</span><button class="primary" data-timer-toggle>${state.timer.running?'Пауза':'Продолжить'}</button><button class="inline-secondary" data-toggle="${esc(t.id)}">Готово ✓</button><button class="inline-secondary" data-timer-stop>Стоп</button>`:`<button class="primary" data-start="${esc(t.id)}"><span class="play" aria-hidden="true">▶</span>Начать · ${duration(t.minutes)}</button>`}</div>`:''}
    ${conflict?'<p class="notice-conflict">Время пересекается с другой задачей</p>':''}</div>
    <div class="task-side"><button class="task-duration" data-edit="${esc(t.id)}" data-field="minutes" aria-label="Длительность: ${esc(t.title)}">${duration(t.minutes)} ↗</button><button class="task-more" data-more="${esc(t.id)}" aria-label="Другие действия: ${esc(t.title)}">Ещё</button></div>
  </article>`;
}
function render(){
  const days=['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
  $('#week').innerHTML=days.map((name,i)=>{const day='2026-09-'+String(7+i).padStart(2,'0');return `<button data-day="${day}" class="${state.day===day?'is-selected':''}" aria-label="${7+i} сентября" aria-pressed="${state.day===day}"><span>${name}</span><b>${7+i}</b></button>`;}).join('');
  $('#date-label').textContent=new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',weekday:'long',timeZone:'UTC'}).format(new Date(state.day+'T12:00:00Z')).replace(',',' · ').toUpperCase();
  $('h1').textContent=state.day===DEMO_DAY?'Сегодня':new Intl.DateTimeFormat('ru',{weekday:'long',timeZone:'UTC'}).format(new Date(state.day+'T12:00:00Z')).replace(/^./,c=>c.toUpperCase());
  const tasks=dayTasks(state),done=tasks.filter(t=>t.done).length;
  $('#day-summary').textContent=tasks.length?`${done} из ${tasks.length} сделано · ${duration(tasks.reduce((s,t)=>s+t.minutes,0))}`:'Без запланированных задач';
  $('#day-progress').innerHTML=tasks.map((_,i)=>`<span class="${i<done?'filled':''}"></span>`).join('');
  const ordered=[...tasks.filter(t=>!t.done),...tasks.filter(t=>t.done)];
  $('#tasks').innerHTML=ordered.length?ordered.map(taskHTML).join(''):`<div class="empty-state"><h3>Есть место для твоих планов.</h3><p>Начни с одного дела. Время можно выбрать сразу — или оставить свободным.</p><button class="primary" id="empty-add">Добавить первое дело</button></div>`;
  $('#habits').innerHTML=[['stretch','Разминка','5 мин'],['read','Чтение','10 мин']].map(([id,label,time])=>`<button class="habit-button" data-habit="${id}" aria-pressed="${currentHabits()[id]}"><span aria-hidden="true">${currentHabits()[id]?'✓':'○'}</span>${label}<span class="habit-time">· ${time}</span></button>`).join('');
  const next=nextTask(state),closed=state.closed.includes(state.day);
  $('#shadow-copy').textContent=closed?'День завершён. Если хочешь что-то добавить, можно просто записать мысль на потом.':next?.id==='video'?'В 19:00 — дзюдо. После дубля оставь время на сборы и дорогу: съёмка не должна занять весь вечер.':next?`Следующим можно сделать «${next.title}». На него запланировано ${duration(next.minutes)}.`:tasks.length?'На сегодня всё выполнено. Можно закончить день и оставить себе вечер.':'День пока свободен. Что одно тебе хочется сегодня сделать?';
  $('#smaller-step').hidden=!next;$('#day-close').textContent=closed?'Открыть день снова ↗':'Завершить день ↗';
  $('#day-end-label').textContent=closed?'День завершён':'';
  $('#notes-feedback').innerHTML=state.notes.length?`<button class="text-button" id="view-notes">Сохранено мыслей: ${state.notes.length} ↗</button>`:'';
}
function restoreComposer(){const form=$('#dialog #composer');if(form)$('#composer-home').append(form);}
function openDialog(title,html){restoreComposer();if(!$('#dialog').open)opener=document.activeElement;$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();audio?.play('open');}
function cleanupMic(){micEpoch++;if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;recorder=null;}
function closeDialog(){if((recorder?.state==='recording'||(audioUrl&&!audioDownloaded))&&!confirm('Запись ещё не скачана. Закрыть и убрать её?'))return;cleanupMic();restoreComposer();$('#dialog').close();opener?.isConnected&&opener.focus();audio?.play('close');}
function compose(){if(matchMedia('(max-width:700px)').matches){openDialog('Добавить задачу','');$('#dialog-body').append($('#composer'));}$('#task-name').focus();}
$('#dialog-close').onclick=closeDialog;$('#dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
function editTask(id,field){const t=state.tasks.find(t=>t.id===id);if(!t)return;
  openDialog('Изменить задачу',`<form id="edit-form"><label>Задача<input name="title" maxlength="160" required value="${esc(t.title)}"></label><div class="form-pair"><label>Начало<input name="time" type="time" value="${esc(t.time)}"></label><label>Минуты<input name="minutes" type="number" min="1" max="1440" value="${t.minutes}" required></label></div><label>Сфера<select name="sphere">${SPHERES.map(s=>`<option${s===t.sphere?' selected':''}>${s}</option>`).join('')}</select></label><div class="dialog-actions"><button class="primary">Сохранить</button><button type="button" class="text-button" id="edit-cancel">Отмена</button></div></form>`);
  $('#edit-form').onsubmit=e=>{e.preventDefault();const patch=Object.fromEntries(new FormData(e.currentTarget));if(commit({type:'edit',id,patch},'Задача сохранена',{sound:'confirm'}))closeDialog();};$('#edit-cancel').onclick=closeDialog;
  if(field)$('#edit-form').elements[field].focus();
}
function smaller(id){const task=state.tasks.find(t=>t.id===id);if(!task)return;const text=task.id==='video'?'Поставить телефон и записать одну фразу. Этот черновик не нужно публиковать.':`Открыть всё необходимое для задачи «${task.title}». На это — две минуты.`;
  openDialog('Сделаем вход проще',`<p>${esc(text)}</p><p>Основная задача останется в плане.</p><div class="dialog-actions"><button class="primary" id="start-small">Начать 2 минуты</button><button class="text-button" id="small-cancel">Не сейчас</button></div>`);
  $('#start-small').onclick=()=>{if(commit({type:'timer',value:{id,started:Date.now(),elapsed:0,running:true,limit:2}},'Начат двухминутный вход',{sound:'confirm'}))closeDialog();};$('#small-cancel').onclick=closeDialog;
}
function timerText(){const t=state.timer;if(!t)return '';const seconds=Math.max(0,Math.floor(((t.elapsed||0)+(t.running?Date.now()-t.started:0))/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
setInterval(()=>{const timer=$('[data-timer]');if(timer)timer.textContent=timerText();const t=state.timer;if(t?.running&&t.limit&&((t.elapsed||0)+Date.now()-t.started)>=t.limit*60000&&!announcedTimers.has(t.id)){announcedTimers.add(t.id);notice('Две минуты прошли. Можно продолжить или остановить фокус.');audio?.play('reminder');}},1000);
document.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;
  if(target.dataset.themeChoice){if(!window.SatoruTheme.set(target.dataset.themeChoice))notice('Тема изменена на этот раз. Браузер не разрешил сохранить выбор.',true);audio?.play('select');}
  else if(target.hasAttribute('data-home')){if($('#dialog').open)closeDialog();window.scrollTo({top:0,behavior:'instant'});}
  else if(target.id==='mobile-more')openDialog('Ещё',`<div class="more-links">${['Заметки','Вдохновение','Награды','Племя','Профиль'].map(s=>`<button data-section="${s}">${sectionIcon(s)}${s} ↗</button>`).join('')}<button id="mobile-sound">${audio?.getMode()==='off'?'Включить звук':'Выключить звук'}</button></div>`);
  else if(target.id==='mobile-sound'){$('#sound').click();target.textContent=audio?.getMode()==='off'?'Включить звук':'Выключить звук';}
  else if(target.id==='shadow-open')openDialog('Тень',`<p>${esc($('#shadow-copy').textContent)}</p><div class="dialog-actions">${nextTask(state)?`<button class="outline" data-small="${esc(nextTask(state).id)}">Нужен шаг поменьше</button>`:''}<button class="text-button" data-support="rest">Хочу отдохнуть</button><button class="text-button" data-support="return">Меня унесло</button></div><p class="scope-note">Здесь пример подсказки, не ответ ИИ. Тень в основном приложении не менялась.</p>`);
  else if(target.dataset.toggle){const id=target.dataset.toggle;const wasDone=state.tasks.find(t=>t.id===id)?.done;if(commit({type:'toggle',id},wasDone?'Выполнение снято':'Готово. Задача выполнена.',{sound:wasDone?'select':'complete'}))document.querySelector(`[data-task="${CSS.escape(id)}"]`)?.classList.add('just-completed');}
  else if(target.dataset.edit)editTask(target.dataset.edit,target.dataset.field);
  else if(target.dataset.start){const id=target.dataset.start;if(state.timer&&state.timer.id!==id){notice('Сначала останови текущий фокус.',true);return;}commit({type:'timer',value:{id,started:Date.now(),elapsed:0,running:true}},'Фокус начат',{sound:'confirm'});}
  else if(target.hasAttribute('data-timer-toggle')){const t=state.timer;if(t)commit({type:'timer',value:{...t,elapsed:(t.elapsed||0)+(t.running?Date.now()-t.started:0),running:!t.running,started:Date.now()}},null);}
  else if(target.hasAttribute('data-timer-stop'))commit({type:'timer',value:null},'Фокус остановлен. Задача не отмечена выполненной.');
  else if(target.dataset.small)smaller(target.dataset.small);
  else if(target.dataset.day){commit({type:'day',day:target.dataset.day},null);audio?.play('navigate');}
  else if(target.dataset.habit)commit({type:'habit',id:target.dataset.habit},'Привычка обновлена',{sound:currentHabits()[target.dataset.habit]?'select':'complete'});
  else if(target.dataset.more){const id=target.dataset.more,t=state.tasks.find(t=>t.id===id);openDialog(t.title,`<div class="dialog-actions"><button id="make-core" class="outline">${t.core?'Убрать из ядра дня':'Выбрать ядром дня'}</button><button id="task-focus" class="outline"${t.done?' disabled':''}>Начать фокус</button></div>`);$('#make-core').onclick=()=>{if(commit({type:'core',id},'Ядро дня обновлено',{sound:'select'}))closeDialog();};$('#task-focus').onclick=()=>{if(state.timer&&state.timer.id!==id){notice('Сначала останови текущий фокус.',true);return;}if(commit({type:'timer',value:{id,started:Date.now(),elapsed:0,running:true}},'Фокус начат'))closeDialog();};}
  else if(target.id==='undo'&&undo){try{save(localStorage,undo);state=undo;undo=null;render();notice('Изменение отменено');}catch(e){notice('Не удалось отменить изменение.',true);}}
  else if(target.id==='notice-close')$('#notice').hidden=true;
  else if(target.id==='empty-add'||target.id==='compose-open')compose();
  else if(target.id==='view-notes'||target.dataset.section==='Заметки')showNotes();
  else if(target.dataset.section==='Привычки'){if($('#dialog').open)closeDialog();$('.habits-strip').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
  else if(target.dataset.section){openDialog(target.dataset.section,`<p>В этом превью работает экран «Сегодня». Раздел «${esc(target.dataset.section)}» пока не переделывали.</p><p>Твои данные и разделы в основном Satoru остаются на месте.</p>`);}
  else if(target.dataset.support){const content={rest:['Отдых без нового списка','Что сейчас больше подойдёт: выйти на короткую прогулку или спокойно почитать?'],return:['Вернуться к одному делу','Не нужно разбирать весь день. Можно начать с двух минут текущей задачи.'],boundary:['Граница входа','Настройка расширения остаётся в основном приложении. Из этого превью нельзя менять блокировки.']}[target.dataset.support];openDialog(content[0],`<p>${content[1]}</p>${target.dataset.support==='return'&&nextTask(state)?'<button class="primary" id="return-small">Выбрать маленький шаг</button>':''}`);if($('#return-small'))$('#return-small').onclick=()=>smaller(nextTask(state).id);}
});
$('#composer').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const id=crypto.randomUUID();if(commit({type:'add',task:{...data,id,date:state.day,done:false,core:!dayTasks(state).length}},'Задача добавлена',{sound:'confirm'})){$('#task-name').value='';if($('#dialog #composer'))closeDialog();else $('#task-name').focus();}};
$('#quick-note').onsubmit=e=>{e.preventDefault();if(commit({type:'note',id:crypto.randomUUID(),text:$('#note').value},'Мысль сохранена',{sound:'confirm'}))$('#note').value='';};
function showNotes(){openDialog('Мысли на потом',state.notes.length?state.notes.map(n=>`<p class="saved-note">${esc(n.text)}</p>`).join(''):'<p>Здесь появятся мысли, которые ты сохранишь в этом превью.</p>');}
$('#smaller-step').onclick=()=>{const t=nextTask(state);if(t)smaller(t.id);};
$('#sound').onclick=()=>{const on=audio?.getMode()==='off';audio?.setMode(on?'full':'off');audio?.setGain(.32);$('#sound').setAttribute('aria-pressed',String(on));$('#sound span').textContent=on?'Звук включён':'Звук выключен';if(on)audio?.play('select');};
function reset(kind){if(!confirm('Заменить только данные этого превью? Основной Satoru не изменится.'))return;try{const next=fixture(kind);save(localStorage,next);state=next;loadFailed=false;undo=null;render();$('#notice').hidden=true;}catch(e){notice('Не удалось сбросить пример.',true);}}
$('#scenario').onchange=e=>reset(e.target.value);$('#reset').onclick=()=>reset($('#scenario').value);
$('#day-close').onclick=()=>{if(state.closed.includes(state.day)){commit({type:'close'},'День снова открыт');return;}const remaining=dayTasks(state).filter(t=>!t.done).length;openDialog('Завершить день?',`<p>${remaining?`Незавершённых задач: ${remaining}. Они останутся на своих датах — ничего не удалится и не перенесётся автоматически.`:'Все задачи выполнены. Можно оставить короткий итог — или просто закончить на сегодня.'}</p><div class="dialog-actions"><button class="primary" id="confirm-close-day">Завершить день</button><button class="text-button" id="close-with-recap">Сначала итог голосом</button></div>`);$('#confirm-close-day').onclick=()=>{if(commit({type:'close'},'День завершён',{sound:'confirm'}))closeDialog();};$('#close-with-recap').onclick=openRecap;};
function openRecap(){openDialog('Итог дня',`<p>Что удалось сделать? Что хочешь оставить на завтра?</p><button class="outline" id="record">● Начать запись</button><div id="mic-status" role="status">Микрофон включится только после разрешения.</div><div id="recording"></div><form id="recap-form"><label>Или запиши словами<textarea name="recap" maxlength="5000" placeholder="Сегодня получилось…">${esc(state.recaps[state.day]||'')}</textarea></label><div class="dialog-actions"><button class="primary">Сохранить текст</button></div></form><p class="scope-note">В превью запись можно скачать, а текст сохраняется в этом браузере. Расшифровка и отправка Тени здесь не подключены.</p>`);
  $('#recap-form').onsubmit=e=>{e.preventDefault();if(commit({type:'recap',text:e.currentTarget.elements.recap.value},'Текст итога сохранён',{sound:'confirm'}))closeDialog();};
  $('#record').onclick=async()=>{
    if(recorder?.state==='recording'){recorder.stop();stream?.getTracks().forEach(t=>t.stop());return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){$('#mic-status').textContent='Запись не поддерживается в этом браузере. Можно написать итог ниже.';return;}
    $('#record').disabled=true;$('#mic-status').textContent='Ожидаю разрешение на микрофон…';
    try{
      const epoch=++micEpoch;const requestedStream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(epoch!==micEpoch||!$('#dialog').open||!$('#record')){requestedStream.getTracks().forEach(t=>t.stop());return;}
      stream=requestedStream;
      const chunks=[];recorder=new MediaRecorder(stream);const recording=recorder;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=()=>{stream?.getTracks().forEach(t=>t.stop());if(!$('#dialog').open||recorder!==recording||!$('#recording'))return;if(audioUrl)URL.revokeObjectURL(audioUrl);audioDownloaded=false;const blob=new Blob(chunks,{type:recording.mimeType});audioUrl=URL.createObjectURL(blob);const ext=recording.mimeType.includes('mp4')?'m4a':'webm';$('#recording').innerHTML=`<audio controls src="${audioUrl}"></audio><a class="record-download" href="${audioUrl}" download="satoru-recap-${state.day}.${ext}">Скачать запись</a>`;$('.record-download').onclick=()=>{audioDownloaded=true;};$('#record').textContent='● Записать заново';$('#record').disabled=false;$('#mic-status').textContent='Запись готова. Скачай её перед закрытием.';$('#mic-status').classList.remove('record-active');};
      recorder.start();$('#record').textContent='■ Остановить запись';$('#record').disabled=false;$('#mic-status').textContent='Идёт запись — микрофон включён';$('#mic-status').classList.add('record-active');
    }catch(e){stream?.getTracks().forEach(t=>t.stop());if($('#record')){$('#record').disabled=false;$('#mic-status').textContent='Микрофон недоступен. Разреши доступ в браузере или напиши итог ниже.';}}
  };
}
$('#recap-open').onclick=openRecap;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder?.state==='recording'){recorder.stop();stream?.getTracks().forEach(t=>t.stop());}});
window.addEventListener('beforeunload',e=>{if(recorder?.state==='recording'||(audioUrl&&!audioDownloaded)){e.preventDefault();e.returnValue='';}});
render();
// Optional read-only bridge. It exposes only the same synthetic preview state.
// No account connection, microphone access, deletion, or hidden mutation.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{Promise.resolve(document.modelContext.registerTool({name:'read_today_design_preview',title:'Read the Today design preview',description:'Read the selected day and synthetic tasks in this isolated design preview, not the real Satoru account.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('Expected an empty object');return {preview:true,day:state.day,tasks:dayTasks(state),closed:state.closed.includes(state.day)};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
