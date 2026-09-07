// Synthetic preview domain, not the production CAS/WAL/Goals engines.
export const GOAL_TYPES={short:'Ближайшая цель',long:'Долгосрочная',path:'Путь'};
export function validDate(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function shiftDate(value,days) {
  const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export function weekDates(value) {
  const offset=(new Date(value+'T12:00:00Z').getUTCDay()+6)%7;
  return Array.from({length:7},(_,i)=>shiftDate(value,i-offset));
}
export function monthDates(value) {
  const first=value.slice(0,7)+'-01',start=weekDates(first)[0];
  const last=new Date(Number(value.slice(0,4)),Number(value.slice(5,7)),0).getDate();
  const count=Math.ceil((weekDates(first).indexOf(first)+last)/7)*7;
  return Array.from({length:count},(_,i)=>shiftDate(start,i));
}
export function goalFixture() {
  return [
    {id:'create',title:'Рассказывать о том, что создаю',description:'Делиться работой регулярно и своим голосом, не ждать идеального результата.',type:'path',date:'',sphere:'Медиа',status:'active',parentId:'',steps:[]},
    {id:'film',title:'Выпустить первое видео о Satoru',description:'Показать один понятный сценарий: от идеи до выполненного дела. Короткий ролик, который можно отправить друзьям.',type:'short',date:'2026-09-11',sphere:'Медиа',status:'active',parentId:'create',steps:[{id:'take',text:'Записать первый дубль для Satoru',minutes:25},{id:'cut',text:'Вырезать паузы из первого дубля',minutes:30},{id:'publish',text:'Опубликовать видео о Satoru',minutes:15}]},
    {id:'biology',title:'Разобраться в клеточном дыхании',description:'Суметь объяснить процесс своими словами и решить пять заданий без конспекта.',type:'short',date:'2026-09-10',sphere:'Учёба',status:'active',parentId:'',steps:[{id:'paragraph',text:'Повторить параграф по биологии',minutes:30},{id:'practice',text:'Решить пять заданий по клеточному дыханию',minutes:25}]},
    {id:'body',title:'Вернуть устойчивый ритм тренировок',description:'Совмещать дзюдо с восстановлением. Не набирать пропущенные тренировки в один день.',type:'long',date:'2026-10-01',sphere:'Тело',status:'active',parentId:'',steps:[{id:'schedule',text:'Выбрать два удобных дня для тренировок',minutes:10}]},
  ];
}
export function goalProgress(goal,tasks) {
  const done=goal.steps.filter(step=>tasks.some(t=>t.goalId===goal.id&&t.stepId===step.id&&t.done));
  return {done:done.length,total:goal.steps.length,next:goal.steps.find(step=>!done.includes(step))||null};
}
export function validateGoal(value,goals=[]) {
  if(!value||typeof value.id!=='string'||!value.id)throw Error('Проверь идентификатор цели.');
  const title=String(value.title||'').trim(),description=String(value.description||'').trim();
  if(!title||title.length>160)throw Error('Название цели — от 1 до 160 символов.');
  if(description.length>3000)throw Error('Описание — до 3000 символов.');
  if(!Object.hasOwn(GOAL_TYPES,value.type))throw Error('Выбери горизонт.');
  if(value.date&&!validDate(value.date))throw Error('Проверь срок цели.');
  if(!['active','paused','archived','done'].includes(value.status))throw Error('Проверь состояние цели.');
  const parentId=value.parentId||'';
  let ancestor=parentId;const seen=new Set([value.id]);
  while(ancestor){if(seen.has(ancestor))throw Error('Цель не может стать собственным родителем.');seen.add(ancestor);const p=goals.find(g=>g.id===ancestor);if(!p)throw Error('Родительская цель не найдена.');ancestor=p.parentId;}
  if(!['Медиа','Учёба','Тело','Быт','Отдых'].includes(value.sphere))throw Error('Выбери сферу цели.');
  const steps=Array.isArray(value.steps)?value.steps:[];
  const stepIds=new Set();
  for(const step of steps){if(!step||typeof step.id!=='string'||!step.id||stepIds.has(step.id)||!String(step.text||'').trim()||String(step.text).length>160||!Number.isInteger(step.minutes)||step.minutes<1||step.minutes>1440)throw Error('Проверь шаги цели.');stepIds.add(step.id);}
  return {...value,title,description,parentId,date:value.date||'',steps};
}
export function calendarICS(tasks) {
  const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Satoru//Design preview//RU','CALSCALE:GREGORIAN'];
  for(const t of tasks){
    lines.push('BEGIN:VEVENT','UID:'+escape(t.id)+'@satoru-preview','DTSTAMP:20260907T120000Z');
    if(t.time){
      const start=t.date.replaceAll('-','')+'T'+t.time.replace(':','')+'00';
      const end=new Date(t.date+'T'+t.time+':00Z');end.setUTCMinutes(end.getUTCMinutes()+t.minutes);
      // Floating local time: no guessed timezone or UTC conversion for user-entered time.
      lines.push('DTSTART:'+start,'DTEND:'+end.toISOString().replace(/[-:]/g,'').slice(0,15));
    }else lines.push('DTSTART;VALUE=DATE:'+t.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+shiftDate(t.date,1).replaceAll('-',''));
    lines.push('SUMMARY:'+escape(t.title),'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // RFC 5545 folding counts UTF-8 octets, not JS characters.
  return lines.map(line=>{let out='',part='',size=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=ch;size+=n;}return out+part;}).join('\r\n')+'\r\n';
}
