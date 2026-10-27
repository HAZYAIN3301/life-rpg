import { Data, Goal, Habit, Task, day, shift, newTask, uid, completeTask, undoTask } from './B2Model';

export type PlanGoal = Goal & { paused?: boolean; archived?: boolean; parent?: string };
export type PlanHabit = Habit & { records?: Record<string, {minutes:number; twoMin:boolean}> };
export type Material = Data['inspiration'][number] & { note?: string };
export type PlanData = Data & { plan?: { intents: Record<string,string>; budgets: Record<string,number> } };
export const horizons = ['Миссия','Видение','Путь','Долгосрочная','Среднесрочная','Краткосрочная','Повторяющаяся'];
export const legacyHorizons = ['Неделя','Месяц','Квартал','Год','Когда-нибудь'];
export const monday = (date:string) => shift(date,-((new Date(date+'T12:00:00').getDay()+6)%7));
export const weekOf = (date:string) => Array.from({length:7},(_,i)=>shift(monday(date),i));
export const duration = (n:number) => n < 60 ? `${n} мин` : `${Math.floor(n/60)} ч${n%60 ? ` ${n%60} мин` : ''}`;
export function validDate(date:string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && day(new Date(date+'T12:00:00')) === date; }
export function timeValue(time:string) { if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null; return Number(time.slice(0,2))*60+Number(time.slice(3)); }
export function clockTime(min:number) {return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;}
export function taskError(t:Task) {
  if(!t.title.trim()) return 'Напиши, что хочешь сделать.';
  if(t.date && !validDate(t.date)) return 'Выбери существующую дату.';
  if(!Number.isInteger(t.minutes)||t.minutes<1||t.minutes>1440) return 'Длительность — от 1 до 1440 минут.';
  if(t.actual!==null&&(!Number.isInteger(t.actual)||t.actual<0||t.actual>1440))return 'Проверь фактическое время: от 0 минут до 24 часов.';
  if(t.start && (!t.date || timeValue(t.start)===null)) return 'Для времени нужна дата и корректное начало.';
  if(t.start && timeValue(t.start)!+t.minutes>1440) return 'Дело выходит за полночь. Раздели его на два дня или убери точное время.';
  if(!t.primary.length) return 'Выбери хотя бы одну основную сферу.';
  if(t.background.length>3) return 'Можно выбрать до трёх сопутствующих сфер.';
  return '';
}
export function overlaps(task:Task, tasks:Task[]) {
  const start=timeValue(task.start); if(!task.date||start===null||task.done)return [];
  return tasks.filter(t=>{const at=timeValue(t.start);return t.id!==task.id&&!t.done&&t.date===task.date&&at!==null&&start<at+t.minutes&&at<start+task.minutes;});
}
export function statsFor(data:Data,date:string) {
  const tasks=data.tasks.filter(t=>t.date===date), pending=tasks.filter(t=>!t.done);
  const conflicts=pending.filter(t=>overlaps(t,pending).length);
  return {tasks,pending,minutes:pending.reduce((s,t)=>s+t.minutes,0),done:tasks.length-pending.length,conflicts};
}
export function moveTasks(data:Data, ids:string[], date:string, start=''):Data {
  if(date&&!validDate(date))throw Error('Некорректная дата');
  const tasks=data.tasks.map(t=>ids.includes(t.id)&&!t.done?{...t,date,start:date&&ids.length===1?start:'',core:date?t.core:false}:t);
  for(const t of tasks.filter(t=>ids.includes(t.id))) {const error=taskError(t);if(error)throw Error(error);}
  return {...data,tasks};
}
export function saveTask(data:Data,t:Task):Data {
  const current=data.tasks.find(x=>x.id===t.id);
  if(current)t={...t,done:current.done,xp:current.xp,gold:current.gold};
  const error=taskError(t);if(error)throw Error(error);
  const duplicate=t.source&&data.tasks.find(x=>x.source===t.source&&x.id!==t.id);
  if(duplicate)throw Error('Связанный квест уже существует. Открой его вместо создания копии.');
  const next={...data,tasks:data.tasks.some(x=>x.id===t.id)?data.tasks.map(x=>x.id===t.id?{...t,title:t.title.trim()}:x):[...data.tasks,{...t,title:t.title.trim()}]};
  if(t.goal&&t.source?.startsWith('step:'))next.goals=next.goals.map(g=>g.id===t.goal?{...g,steps:g.steps.map(s=>'step:'+s.id===t.source?{...s,title:t.title.trim(),done:t.done}:s)}:g);
  return next;
}
export function finish(data:Data,id:string,actual:number,completed=true):Data {
  if(!Number.isInteger(actual)||actual<0||actual>1440)throw Error('Укажи фактическое время от 0 до 1440 минут.');
  const old=data.tasks.find(t=>t.id===id); if(!old)return data;
  if(old.done===completed)return data;
  if(!completed&&data.gold<old.gold)throw Error('Золото уже потрачено: баланса недостаточно для отмены начисления. Выполнение сохранено.');
  return syncSteps(completed?completeTask(data,id,actual):undoTask(data,id));
}
export function syncSteps(data:Data):Data {
  return {...data,goals:data.goals.map(g=>({...g,steps:g.steps.map(s=>{
    const task=data.tasks.find(t=>t.goal===g.id&&t.source==='step:'+s.id);
    return task?{...s,done:task.done}:s;
  })}))};
}
export function stepTask(data:Data, goal:Goal, stepId:string, date:string):Task {
  const step=goal.steps.find(s=>s.id===stepId);if(!step)throw Error('Шаг не найден');
  return data.tasks.find(t=>t.source==='step:'+stepId&&t.goal===goal.id)||{...newTask(step.title,date),primary:goal.primary,background:goal.background||[],goal:goal.id,source:'step:'+stepId};
}
export function saveGoal(data:Data,goal:PlanGoal):Data {
  if(!goal.title.trim()||!goal.primary.length)throw Error('Укажи название и основную сферу.');
  if(goal.deadline&&!validDate(goal.deadline))throw Error('Проверь срок цели.');
  const visited=new Set([goal.id]);let parent=goal.parent;
  while(parent){if(visited.has(parent))throw Error('Цели не могут ссылаться друг на друга по кругу.');visited.add(parent);parent=(data.goals.find(g=>g.id===parent) as PlanGoal|undefined)?.parent;}
  const old=data.goals.find(g=>g.id===goal.id);
  const removed=old?.steps.filter(s=>!goal.steps.some(x=>x.id===s.id)).map(s=>'step:'+s.id)||[];
  const tasks=data.tasks.map(t=>{if(t.goal!==goal.id)return t;if(removed.includes(t.source||''))return {...t,source:undefined};const step=goal.steps.find(s=>'step:'+s.id===t.source);return step?{...t,title:step.title}:t;});
  return syncSteps({...data,tasks,goals:old?data.goals.map(g=>g.id===goal.id?goal:g):[...data.goals,goal]});
}
export function deleteGoal(data:Data,id:string):Data {
  return {...data,goals:(data.goals as PlanGoal[]).filter(g=>g.id!==id).map(g=>g.parent===id?{...g,parent:undefined}:g),tasks:data.tasks.map(t=>t.goal===id?{...t,goal:undefined,source:t.source?.startsWith('step:')?undefined:t.source}:t)};
}
export function goalState(data:Data,ids:string[],action:'pause'|'archive'|'restore'|'complete'):Data {
  return {...data,goals:(data.goals as PlanGoal[]).map(g=>ids.includes(g.id)?{...g,paused:action==='pause',archived:action==='archive',done:action==='complete'?true:action==='restore'?false:g.done}:g)};
}
export function habitLog(data:Data,id:string,date:string,small:boolean,today:string):Data {
  if(!validDate(date)||date>today)throw Error('Можно отметить сегодняшний или прошедший день.');
  return {...data,habits:(data.habits as PlanHabit[]).map(h=>{
    if(h.id!==id)return h;if(h.paused)throw Error('Сначала верни привычку с паузы.');
    const records={...h.records};const done=h.logs.includes(date);if(done)delete records[date];else records[date]={minutes:small?2:h.minutes,twoMin:small};
    return {...h,logs:done?h.logs.filter(d=>d!==date):[...h.logs,date],records};
  })};
}
export function savePlanSetting(data:PlanData,kind:'intents'|'budgets',key:string,value:string|number):PlanData {
  const plan={intents:{...data.plan?.intents},budgets:{...data.plan?.budgets}};
  if(kind==='intents')plan.intents[key]=String(value);else if(value==='')delete plan.budgets[key];else{const n=Number(value);if(!Number.isInteger(n)||n<0||n>1440)throw Error('Бюджет дня — от 0 до 1440 минут.');plan.budgets[key]=n;}
  return {...data,plan,...(kind==='intents'&&key===monday(day())?{weekIntent:String(value)}:{})};
}
export function exportICS(tasks:Task[],now:Date) {
  const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Satoru//Plan B2//RU','CALSCALE:GREGORIAN'];
  for(const t of tasks.filter(t=>t.date&&!t.done)) {
    lines.push('BEGIN:VEVENT',`UID:${t.id}@satoru.local`,`DTSTAMP:${stamp}`,`SUMMARY:${escape(t.title)}`);
    if(t.start){const start=t.date.replace(/-/g,'')+'T'+t.start.replace(':','')+'00';const end=timeValue(t.start)!+t.minutes;const endDate=end===1440?shift(t.date,1):t.date;lines.push(`DTSTART:${start}`,`DTEND:${endDate.replace(/-/g,'')}T${clockTime(end%1440).replace(':','')}00`);}
    else lines.push(`DTSTART;VALUE=DATE:${t.date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${shift(t.date,1).replace(/-/g,'')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545: fold on UTF-8 octet boundaries; never split a Cyrillic code point.
  return lines.map(line=>{let out='',bytes=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>74){out+='\r\n ';bytes=1;}out+=ch;bytes+=n;}return out;}).join('\r\n')+'\r\n';
}
