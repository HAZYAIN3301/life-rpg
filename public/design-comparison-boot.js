/* global State, Store, DEFAULT_SETTINGS, VIEWS, render, onClick, todayStr, ensureLootbox, ensureTrees, normalizeCoreState */
(() => {
  const params=new URLSearchParams(location.search),day=todayStr();
  const settings=structuredClone(DEFAULT_SETTINGS);
  Object.assign(settings,{lang:['ru','en','de','uk','es'].includes(params.get('lang'))?params.get('lang'):'ru',theme:params.get('theme')==='light'?'light':'dark',sound:false,systemMode:false,imported:{study:{tier:5,xp:24000,label:'Тестовый пример'}},discovered:['den','pets','shelf','teaser:system'],tutorial:{done:true,active:false},guideV3:{enabled:false},prefs:{noMobilityNudge:true}});
  Object.assign(State,{phase:'app',me:{id:'comparison-only',name:'Алекс · пример',avatar:'🌙',isAdmin:false,lang:settings.lang},settings,
    tasks:[['desk','Освободить стол для съёмки','life',10,'16:00',true],['video','Записать первый дубль для Satoru','work',25,'16:30',false],['study','Повторить параграф по биологии','study',30,'17:15',false],['walk','Прогуляться перед тренировкой','health',20,'18:15',false]].map(([id,title,skillId,estimateMin,startTime,done])=>({id,title,skillId,estimateMin,startTime,done,date:day,difficulty:'normal',core:id==='video',createdAt:day+'T10:00:00',completedAt:done?day+'T16:10:00':null,actualMin:done?10:null,xpAwarded:done?20:0,goldAwarded:done?7:0})),
    days:{},habits:[{id:'read',title:'Чтение',skillId:'study',estimateMin:10,difficulty:'easy',days:[0,1,2,3,4,5,6],active:true}],habitlog:{},antihabits:[],
    goals:[{id:'sample-film',title:'Выпустить первое видео',description:'Короткое знакомство с Satoru: один день и одно полезное действие.',type:'short',status:'active',skillId:'work',skillIds:['work'],targetDate:addDays(day,7),createdAt:day+'T09:00:00',steps:[{id:'scene',title:'Снять первый дубль',done:false}]},{id:'sample-study',title:'Разобраться в теме по биологии',description:'Повторить параграф и объяснить его без конспекта.',type:'short',status:'active',skillId:'study',skillIds:['study'],targetDate:addDays(day,3),createdAt:day+'T09:00:00',steps:[]}],goalGroups:[],tree:{},
    rewards:[{id:'sample-book',name:'Новая книга',iconId:'reward.book',cost:100},{id:'sample-movie',name:'Вечер кино вдвоём',iconId:'reward.movie',cost:60}],purchases:[],achievements:[],weeks:{},
    inbox:[{id:'sample-note',kind:'text',text:'Идея для видео: показать, как один маленький шаг превращается в готовое дело.',at:day+'T10:00:00'}],episodes:[],notes:[],lootbox:null,
    attentionPolicies:[],attentionSessions:[],attentionEpisodes:[],secretaryOffer:null,party:false,
    leaderboard:{rows:[]},aiKeys:{},_aiMemoryLoaded:true,aiMemory:{entries:[],legacy:{text:''}},_telemetryConsentLoaded:false,
    _browserCompanionProbeComplete:true,firstValue:null,_firstValueLoaded:true,
    _shelfLoadError:'',shelf:null,boardMedia:[],questionnaire:{status:'deferred'}});
  Store.save=()=>false;Store.saveNow=async()=>false;Store.flush=async()=>false;
  State.view=Object.hasOwn(VIEWS,params.get('view'))?params.get('view'):'today';
  State.treeSkill='study';
  try{normalizeCoreState();ensureLootbox();ensureTrees();}catch(e){console.warn('Comparison initialization',e);}
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action],[data-view]');if(!el)return;
    const action=el.dataset.action||'';
    if(el.dataset.view||/^(go-section|mobile-nav-more|mobile-nav-close|today-tab|set-goal-view|goal-filter-select|set-settings-group|habits-tab|goto-notes|goto-rewards|goto-goal|open-goal|goal-detail-close|toggle-today-companion|open-helper|day-recap|cal-mode|cal-date|week-select-day)$/.test(action)){onClick(e);return;}
    e.preventDefault();e.stopImmediatePropagation();
    if(typeof toast==='function')toast('Архив: изменения отключены. Открой актуальный Satoru для работы.');
  });
  document.addEventListener('change',e=>{
    if(e.target.dataset.action==='goal-filter-select'){
      State.goalFilter=e.target.value;render();
    }
  });
  render();
})();
