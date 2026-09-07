export const STORAGE_KEY='satoru:today-design:20260907:v1';
export const DEMO_DAY='2026-09-07';
export const SPHERES=['Медиа','Учёба','Тело','Быт','Отдых'];
export function fixture(kind='regular'){
  const tasks=kind==='empty'?[]:[
    {id:'desk',title:'Освободить стол для съёмки',date:DEMO_DAY,time:'16:00',minutes:10,sphere:'Быт',done:true,core:false},
    {id:'video',title:'Записать первый дубль для Satoru',date:DEMO_DAY,time:'16:30',minutes:25,sphere:'Медиа',done:false,core:true,goal:'Видео о Satoru',outcome:'Один черновой дубль, 30–60 секунд. Без монтажа.'},
    {id:'study',title:'Повторить параграф по биологии',date:DEMO_DAY,time:'17:15',minutes:30,sphere:'Учёба',done:false,core:false},
    {id:'walk',title:'Прогуляться перед тренировкой',date:DEMO_DAY,time:'18:15',minutes:20,sphere:'Отдых',done:false,core:false},
    {id:'judo',title:'Тренировка по дзюдо',date:DEMO_DAY,time:'19:00',minutes:90,sphere:'Тело',done:false,core:false}
  ];
  if(kind==='dense'){
    tasks[1].title='Записать первый черновой дубль для видео о Satoru: показать создание задачи, время начала и голосовой итог дня — без монтажа и подбора идеального света';
    tasks.push(...Array.from({length:9},(_,i)=>({id:'dense-'+i,title:['Заказать материалы для костюма','Дополнить конспект','Позвонить близким'][i%3],date:DEMO_DAY,time:'',minutes:15,sphere:['Медиа','Учёба','Отдых'][i%3],done:false,core:false})));
  }
  return {schema:1,day:DEMO_DAY,tasks,habits:{stretch:false,read:false},notes:[],recaps:{},closed:[],timer:null};
}
export function validateTask(input){
  const title=String(input.title??'').trim();
  if(!title||title.length>160)throw new Error('Напиши название задачи — до 160 символов.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(Date.parse(input.date)))throw new Error('Проверь дату.');
  const time=String(input.time||'');
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Проверь время начала.');
  const minutes=Number(input.minutes);
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw new Error('Длительность — от 1 до 1440 минут.');
  if(!SPHERES.includes(input.sphere))throw new Error('Выбери сферу.');
  return {id:input.id,title,date:input.date,time,minutes,sphere:input.sphere,done:!!input.done,core:!!input.core,...(input.goal?{goal:String(input.goal)}:{}),...(input.outcome?{outcome:String(input.outcome)}:{})};
}
export function dayTasks(state){return state.tasks.filter(t=>t.date===state.day).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));}
export function nextTask(state){const tasks=dayTasks(state);return tasks.find(t=>t.core&&!t.done)||tasks.find(t=>!t.done);}
export function duration(minutes){return minutes>=60?`${Math.floor(minutes/60)} ч${minutes%60?' '+minutes%60+' мин':''}`:`${minutes} мин`;}
export function conflicts(task,tasks){
  if(!task.time||task.done)return [];
  const min=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const start=min(task.time),end=start+task.minutes;
  return tasks.filter(t=>t.id!==task.id&&t.date===task.date&&t.time&&!t.done&&min(t.time)<end&&min(t.time)+t.minutes>start).map(t=>t.id);
}
export function mutate(state,action){
  const next=structuredClone(state),task=next.tasks.find(t=>t.id===action.id);
  if(action.type==='add'){if(next.tasks.some(t=>t.id===action.task.id))return next;next.tasks.push(validateTask(action.task));}
  else if(action.type==='edit'&&task)Object.assign(task,validateTask({...task,...action.patch,id:task.id}));
  else if(action.type==='toggle'&&task){task.done=!task.done;if(task.done&&next.timer?.id===task.id)next.timer=null;}
  else if(action.type==='core'&&task){const chosen=!task.core;for(const t of next.tasks)if(t.date===task.date)t.core=t.id===task.id&&chosen;}
  else if(action.type==='day')next.day=action.day;
  else if(action.type==='habit'&&Object.hasOwn(next.habits,action.id)){
    next.habitDays||={};
    next.habitDays[next.day]||=next.day===DEMO_DAY?{...next.habits}:{stretch:false,read:false};
    next.habitDays[next.day][action.id]=!next.habitDays[next.day][action.id];
  }
  else if(action.type==='note'){const text=String(action.text||'').trim();if(!text||text.length>1000)throw new Error('Мысль — от 1 до 1000 символов.');next.notes.push({id:action.id,text});}
  else if(action.type==='recap')next.recaps[next.day]=String(action.text||'').slice(0,5000);
  else if(action.type==='close'){next.closed=next.closed.includes(next.day)?next.closed.filter(d=>d!==next.day):[...next.closed,next.day];}
  else if(action.type==='timer'){next.timer=action.value;}
  return next;
}
export function save(storage,state){
  const serialized=JSON.stringify(state);storage.setItem(STORAGE_KEY,serialized);
  if(storage.getItem(STORAGE_KEY)!==serialized)throw new Error('Не удалось сохранить изменения. Попробуй ещё раз.');
  return state;
}
export function load(storage){
  const raw=storage.getItem(STORAGE_KEY);if(!raw)return fixture();
  const state=JSON.parse(raw);
  if(state.schema!==1||!Array.isArray(state.tasks)||!Array.isArray(state.notes)||!state.habits||!state.recaps||!Array.isArray(state.closed))throw new Error('Пример не читается. Нажми «Сбросить пример», чтобы начать заново.');
  state.tasks=state.tasks.map(validateTask);return state;
}
