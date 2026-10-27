window.SatoruTodayBridge=(()=>{
 const navigation=()=>({view:State.view,settingsGroup:State.settingsSection||'',calendarDate:State.calDate,calendarMode:State.calMode,goalId:State._goalOpenId||'',todayTab:State._todayTab||'day',entryFocus:State._liveEntryFocus||''});
 function mode(value){State.view=value==='Заметки'?'notes':'today';State._todayTab=value==='Доска'?'board':'day';if(value==='День')ensureSenkuDay();}
 function calendar(date,scale){State.calDate=date;State.calMode=({День:'day',Неделя:'week',Месяц:'month'})[scale]||'week';State.weekStart=weekStart(date);}
 async function run(command,input,expected){
  if(State.phase!=='app'||String(State.me?.id||'')!==expected.account||Store._writeEpoch!==expected.epoch)return{ok:false};
  if(command==='today.board.enter'){mode('Доска');if(await boardV2IssueStandardOffers())render();await boardV2LoadLocalStatus();return{ok:true};}
  if(command==='today.note.delete'){openNoteDeleteDialog(input.id,document.activeElement);return{ok:true};}
  if(command==='today.dayrec'){openDayRecap();return{ok:true};}
  throw Error('Неизвестное действие рабочего экрана.');
 }
 function mount(host,part){
  const draftAccount=String(State.me?.id||''),draftDay=todayStr();
  const draftKey=id=>'satoru.b213.draft:'+draftAccount+':'+(id==='capture'?'capture':draftDay+':'+id);
  const readDraft=id=>{try{return JSON.parse(sessionStorage.getItem(draftKey(id))||'null');}catch{return null;}};
  const forget=id=>{try{sessionStorage.removeItem(draftKey(id));}catch{}};
  const captureSaved=host.querySelector('#capture-form')?.dataset.persisted==='true';
  if(captureSaved)forget('capture');
  const staging=document.createElement('div');let view='today';
  if(part==='board')staging.innerHTML=boardScreenHTML();
  else if(part==='notes'){staging.innerHTML=renderNotes();staging.querySelector('.notes-header')?.remove();view='notes';}
  else if(part==='capture')staging.innerHTML=captureBar({expanded:true});
  else if(part==='review'){staging.innerHTML=renderToday();const review=staging.querySelector('.shutdown');staging.replaceChildren(...(review?[review]:[]));if(review)review.open=true;}
  else if(part==='tribe'){view=['party','leaderboard'].includes(State.view)?State.view:'party';staging.innerHTML=safeViewMarkup(view);}
  staging.querySelectorAll('.th-kicker,.route-kicker').forEach(e=>e.remove());
  // Only unsent drafts live here. Existing handlers still own every confirmed write.
  const savedFields={};for(const id of ['reflection','first-line']){const field=staging.querySelector('#'+id);if(field)savedFields[id]=field.value;}
  if(lang()!=='ru')translateDOM(staging);commitMainView(host,staging,view);
  for(const id of ['reflection','first-line','capture-text']){
   const field=host.querySelector('#'+id);if(!field)continue;const key=id==='capture-text'?'capture':id,base=savedFields[id]||'',draft=readDraft(key);
   if(draft&&(key==='capture'||draft.base===base))field.value=draft.value;else if(draft)forget(key);
   if(!field.dataset.b213Draft){field.dataset.b213Draft='1';field.addEventListener('input',()=>{try{sessionStorage.setItem(draftKey(key),JSON.stringify({base:field.dataset.b213Base||'',value:field.value}));}catch{}});}
   field.dataset.b213Base=base;
  }
  host.querySelectorAll('form').forEach(f=>{f.method='post';if(!f.dataset.b213Guard){f.dataset.b213Guard='1';f.addEventListener('submit',e=>e.preventDefault());}});
 }
 return{mount,run,navigation,mode,calendar,consumeCapture:()=>{State._liveEntryFocus='';},accepts:c=>c.startsWith('today.')};
})();
