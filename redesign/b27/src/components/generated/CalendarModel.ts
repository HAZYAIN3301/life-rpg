import { Data, Task, day, shift, newTask, uid, sphereOptions } from './B2Model';
import { PlanData, clockTime, timeValue, validDate, saveTask, taskError } from './PlanModel';
export type Regular={id:string;title:string;days:number[];start:string;minutes:number;primary:string;from:string;until:string;exceptFrom:string;exceptUntil:string;before:number;after:number};
export type CalendarData=PlanData & {regular?:Regular[];intentSpheres?:Record<string,string[]>;demoVersion?:number};
export function validateRegular(r:Regular){
 if(typeof r.title!=='string'||!r.title.trim()||!Array.isArray(r.days)||!r.days.length||r.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(r.days).size!==r.days.length||timeValue(r.start)===null||![r.minutes,r.before,r.after].every(n=>Number.isInteger(n)&&n>=0&&n<=1440)||r.minutes<1||!validDate(r.from)||!validDate(r.until)||r.until<r.from||!sphereOptions.some(s=>s.id===r.primary))throw Error('Проверь название, дни, время, сферу и срок расписания.');
 if((r.exceptFrom||r.exceptUntil)&&(!validDate(r.exceptFrom)||!validDate(r.exceptUntil)||r.exceptUntil<r.exceptFrom))throw Error('Проверь обе даты каникул.');
 if(timeValue(r.start)!-r.before<0||timeValue(r.start)!+r.minutes+r.after>1440)throw Error('Занятие вместе с дорогой выходит за границы дня.');
}
export function parseRegular(raw:string):Regular[]{
 let p:any;try{p=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('Вставь полный блок JSON из ответа ИИ.');}
 if(!Array.isArray(p.regular)||!p.regular.length||p.regular.length>30)throw Error('Ожидается от 1 до 30 занятий в поле regular.');
 const seen=new Set();return p.regular.map((v:any)=>{const r:Regular={...v,id:uid(),before:v.before??0,after:v.after??0,exceptFrom:v.exceptFrom||'',exceptUntil:v.exceptUntil||''};validateRegular(r);r.title=r.title.trim();const key=r.title+'|'+r.days.slice().sort().join(',')+'|'+r.start;if(seen.has(key))throw Error('В расписании повторяется занятие.');seen.add(key);return r;});
}
export function placeTask(data:Data,id:string,date:string,at?:number):Data{
 if(!validDate(date))throw Error('Выбери дату.');
 const task=data.tasks.find(t=>t.id===id);if(!task||task.done)throw Error('Переносить можно незавершённое дело.');
 let next={...task,date,start:at===undefined?'':clockTime(at)};
 if(at!==undefined){
  if(!Number.isInteger(at)||at<0)throw Error('Проверь время.');
  const occupied=data.tasks.filter(t=>t.id!==id&&t.date===date&&!t.done&&t.start).sort((a,b)=>a.start.localeCompare(b.start));
  let cursor=at;
  for(const t of occupied){const s=timeValue(t.start)!;if(cursor<s+t.minutes&&cursor+task.minutes>s)cursor=s+t.minutes;}
  if(cursor+task.minutes>1440)throw Error('До полуночи не осталось места. Выбери другое время или дату.');
  next={...next,start:clockTime(cursor)};
 }
 return saveTask(data,next);
}
export function addRegular(data:CalendarData,r:Regular,week:string[]):CalendarData{
 validateRegular(r);
 let next:CalendarData={...data,regular:[...(data.regular||[]).filter(x=>x.id!==r.id),r]};
 for(const date of week){
  if(date<r.from||date>r.until||!r.days.includes(new Date(date+'T12:00:00').getDay())||(r.exceptFrom&&date>=r.exceptFrom&&date<=r.exceptUntil))continue;
  const base=timeValue(r.start)!;
  const blocks=[{suffix:'main',title:r.title,start:base,minutes:r.minutes},...(r.before?[{suffix:'before',title:'Дорога · '+r.title,start:base-r.before,minutes:r.before}]:[]),...(r.after?[{suffix:'after',title:'Дорога обратно · '+r.title,start:base+r.minutes,minutes:r.after}]:[])];
  for(const b of blocks){if(b.start<0||b.start+b.minutes>1440)throw Error('Занятие вместе с дорогой выходит за границы дня.');const source=`regular:${r.id}:${date}:${b.suffix}`;if(next.tasks.some(t=>t.source===source))continue;next=saveTask(next,{...newTask(b.title,date),start:clockTime(b.start),minutes:b.minutes,primary:[r.primary],source}) as CalendarData;}
 }
 return next;
}
export function applyExistingRegular(data:CalendarData,week:string[]){let next=data;for(const r of data.regular||[])next=addRegular(next,r,week);return next;}

export function parseWeek(raw:string,data:Data,days:string[]):Task[]{
 let payload:any;try{payload=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('Вставь полный блок JSON из ответа ИИ.');}
 if(!Array.isArray(payload.tasks)||!payload.tasks.length||payload.tasks.length>100)throw Error('Ожидается от 1 до 100 дел в поле tasks.');
 const used=new Set();return payload.tasks.map((p:any)=>{const old=p.taskId?data.tasks.find(t=>t.id===p.taskId):undefined;if(p.taskId&&!old)throw Error('В предложении указан неизвестный квест.');if(old?.done)throw Error('Выполненный квест нельзя переносить.');const t:Task={...(old||newTask()),id:old?.id||uid(),title:typeof p.title==='string'?p.title.trim():old?.title||'',date:p.date,start:p.start||'',minutes:p.minutes??old?.minutes??30,primary:p.primary||old?.primary||['work'],goal:p.goal||old?.goal};if(!days.includes(t.date))throw Error('Все предложения должны помещаться в выбранную неделю.');if(!Array.isArray(t.primary)||t.primary.some(id=>!sphereOptions.some(s=>s.id===id)))throw Error('Проверь сферы в предложении.');if(t.goal&&!data.goals.some(g=>g.id===t.goal))throw Error('Не найдена связанная цель.');const error=taskError(t);if(error)throw Error(error);const key=t.title+'|'+t.date+'|'+t.start;if(used.has(key)||used.has(t.id))throw Error('В ответе повторяется один квест.');used.add(key);used.add(t.id);return t;});
}
