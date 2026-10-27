import type {Task,Data} from '../components/generated/B2Model';
import type {DailyData} from '../components/generated/DailyModel';
import {validDate,monday} from '../components/generated/PlanModel';
import type {CalendarData} from '../components/generated/CalendarModel';
export * from './plan-model';
export * from './theme';
export * from './rewards-model';
export * from './world-model';
export * from './app-navigation';
import {rewardProjection} from './rewards-model';
import type {RewardsData} from './rewards-model';
import type {GoalRecord,GoalGroup} from './plan-model';
export type Skill={id:string;name:string;color?:string;parentId?:string|null;archived?:boolean};
export type RawTask={id:string;title:string;date:string;startTime?:string|null;estimateMin?:number;actualMin?:number|null;skillId?:string;skillIds?:string[];layers?:string[];done?:boolean;core?:boolean;difficulty?:string;xpAwarded?:number;goldAwarded?:number;[key:string]:unknown};
export type Snapshot={rewardsData:RewardsData;revision:number;view:string;settingsGroup?:string;goals:GoalRecord[];groups:GoalGroup[];goalProgress:Record<string,number>;routine:any;routineDraft:any;preferences:{appName:string;language:string;theme:string;accent:string;sound:boolean;motion:boolean};account:string;epoch:number;name:string;deadlines?:{id:string;title:string;date:string;primary:string[]}[];weeks?:Record<string,Week>;tasks:RawTask[];skills:Skill[];inbox:{id:string;text:string;kind:string;at:string;file?:string}[];habits:{id:string;title:string;estimateMin?:number;skillId:string;days:number[];archived?:boolean;paused?:boolean}[];habitlog:Record<string,Record<string,unknown>>;days:Record<string,{reflection?:string;closed?:boolean}>;timer:null|{taskId:string;running:boolean;startedAt:number;accumulatedMs:number;phase?:string};gold:number;xp:number;streak:number;shadowForm:number;pendingFocus:number;chestsAvailable:number;errors:string[]};
export const fields=['title','date','startTime','estimateMin','difficulty','skillId','skillIds','layers','core'] as const;
export type Move={id:string;before:{date:string;startTime:string|null;core:boolean};after:{date:string;startTime:string|null;core:boolean}};
export type Week={intention?:string;review?:string;dayBudgetsV1?:Record<string,number>;intentionSkillIdsV1?:string[]};
export function schedule(t:RawTask){return{date:t.date,startTime:t.startTime||null,core:!!t.core};}
export function moveTasks(tasks:RawTask[],changes:Move[]):RawTask[]{
  if(!Array.isArray(changes)||!changes.length||changes.length>50||new Set(changes.map(c=>c.id)).size!==changes.length)throw Error('Выбери от 1 до 50 разных квестов.');
  const next=tasks.map(t=>({...t}));
  for(const command of changes){
    const t=next.find(t=>t.id===command.id),after=command.after;
    if(!t||t.done)throw Error('Квест уже изменился или выполнен. Обнови календарь.');
    if(!after||!validDate(after.date)||(after.startTime!=null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(after.startTime))||typeof after.core!=='boolean')throw Error('Проверь дату и время переноса.');
    if(after.startTime&&Number(after.startTime.slice(0,2))*60+Number(after.startTime.slice(3))+Number(t.estimateMin||0)>1440)throw Error('Дело выходит за полночь. Выбери другое время или дату.');
    const current=schedule(t);
    if(JSON.stringify(current)===JSON.stringify(after))continue;
    if(JSON.stringify(current)!==JSON.stringify(command.before))throw Error('Расписание квеста уже изменилось. Обнови календарь.');
    Object.assign(t,{date:after.date,startTime:after.startTime,core:after.core});
  }
  for(const c of changes){if(c.after.core&&(c.before.date!==c.after.date||!c.before.core)&&next.filter(t=>t.date===c.after.date&&t.core).length>3)throw Error('В ядре дня максимум три квеста. Сначала освободи место.');}
  return next;
}
export function calendarChanges(before:Pick<Data,'tasks'>,after:Pick<Data,'tasks'>):Move[]{
  if(before.tasks.length!==after.tasks.length)throw Error('Создавай и удаляй квесты через форму.');
  const allowed=new Set(['date','start','core']),changes:Move[]=[];
  for(const t of before.tasks){const next=after.tasks.find(n=>n.id===t.id);if(!next)throw Error('Квест исчез из календаря.');
    for(const key of new Set([...Object.keys(t),...Object.keys(next)])){if(!allowed.has(key)&&JSON.stringify(t[key as keyof Task])!==JSON.stringify(next[key as keyof Task]))throw Error('Перенос может менять только дату и время квеста.');}
    const old={date:t.date,startTime:t.start||null,core:!!t.core},value={date:next.date,startTime:next.start||null,core:!!next.core};
    if(JSON.stringify(old)!==JSON.stringify(value))changes.push({id:t.id,before:old,after:value});
  }
  return changes;
}
export function calendarPlan(data:DailyData,weeks:Record<string,Week>={}):CalendarData{return{...data,plan:{intents:Object.fromEntries(Object.entries(weeks).map(([key,w])=>[key,w.intention||''])),budgets:Object.assign({},...Object.values(weeks).map(w=>w.dayBudgetsV1||{}))},intentSpheres:Object.fromEntries(Object.entries(weeks).map(([key,w])=>[key,w.intentionSkillIdsV1||[]]))};}
export function saveWeek(weeks:Record<string,Week>,command:'intent'|'budget',input:{week?:string;date?:string;text?:string;skills?:string[];minutes?:number|null},skills:Skill[]){
  if(command==='intent'){
    const week=input.week||'',ids=[...new Set(input.skills||[])];
    if(!validDate(week)||monday(week)!==week||typeof input.text!=='string'||input.text.length>1000||ids.some(id=>!skills.some(s=>s.id===id)))throw Error('Проверь неделю, текст и выбранные сферы.');
    return{...weeks,[week]:{...weeks[week],intention:input.text.trim(),intentionSkillIdsV1:ids}};
  }
  const date=input.date||'',minutes=input.minutes;if(!validDate(date)||(minutes!==null&&(!Number.isInteger(minutes)||minutes!<0||minutes!>1440)))throw Error('Выбери дату и от 0 до 1440 минут.');
  const week=monday(date),budgets={...weeks[week]?.dayBudgetsV1};if(minutes===null)delete budgets[date];else budgets[date]=minutes!;
  return{...weeks,[week]:{...weeks[week],dayBudgetsV1:budgets}};
}
export function editable(t:RawTask){return Object.fromEntries(fields.map(k=>[k,t[k]??null]));}
export function projectTask(t:RawTask):Task{return{id:t.id,title:t.title,date:t.date,goal:typeof t.goalId==='string'?t.goalId:undefined,start:t.startTime||'',minutes:Number(t.estimateMin)||0,actual:t.actualMin??null,difficulty:t.difficulty||'normal',primary:t.skillIds?.length?t.skillIds:t.skillId?[t.skillId]:[],background:t.layers||[],done:!!t.done,core:!!t.core,xp:t.xpAwarded||0,gold:t.goldAwarded||0};}
export function project(s:Snapshot):DailyData{return{version:3,tasks:s.tasks.map(projectTask),goals:[],habits:s.habits.map(h=>({id:h.id,title:h.title,minutes:h.estimateMin||0,days:h.days||[],sphere:h.skillId,identity:'',cue:'',twoMin:'',reward:'',logs:Object.keys(s.habitlog).filter(d=>!!s.habitlog[d]?.[h.id]),paused:!!(h.paused||h.archived)})),notes:s.inbox.map(n=>({id:n.id,text:n.text,kind:n.kind,created:n.at,media:n.file?'/api/inbox/media/'+encodeURIComponent(n.file):undefined})),...rewardProjection({...s.rewardsData,rewards:s.rewardsData?.rewards||[],purchases:s.rewardsData?.purchases||[],rewardLife:s.rewardsData?.life||{}}),gold:s.gold,xp:s.xp,reviews:Object.fromEntries(Object.entries(s.days).map(([k,v])=>[k,v.reflection||''])),palette:'ink',sound:true,motion:true,identity:'',lapses:[],rules:[],inspiration:[],history:[],care:'',weekIntent:'',boardHidden:[]};}
export function buildTask(tasks:RawTask[],input:RawTask,base:Record<string,unknown>|null,skills:Skill[],now:string){
  const current=tasks.find(t=>t.id===input.id);
  // Same ID after a lost response is a retry, never another quest.
  if(!base&&current){if(JSON.stringify(editable(current))===JSON.stringify(editable(input)))return tasks;throw Error('Квест с таким номером уже существует. Открой его заново.');}
  if(base&&(!current||JSON.stringify(editable(current))!==JSON.stringify(base)))throw Error('Квест изменился. Закрой панель и открой его заново — свежие данные сохранены.');
  const title=String(input.title||'').trim();
  if(!title||title.length>180)throw Error('Напиши название до 180 символов.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||new Date(input.date+'T12:00:00Z').toISOString().slice(0,10)!==input.date)throw Error('Выбери существующую дату.');
  if(input.startTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime))throw Error('Проверь время начала.');
  if(!Number.isInteger(input.estimateMin)||input.estimateMin!<1||input.estimateMin!>1440)throw Error('Длительность — от 1 до 1440 минут.');
  if(input.startTime&&Number(input.startTime.slice(0,2))*60+Number(input.startTime.slice(3))+input.estimateMin!>1440)throw Error('Дело выходит за полночь. Раздели его на два дня или убери точное время.');
  if(!['easy','normal','hard'].includes(input.difficulty||''))throw Error('Выбери сложность.');
  const primary=[...new Set(input.skillIds?.length?input.skillIds:input.skillId?[input.skillId]:[])];
  const background=[...new Set(input.layers||[])].filter(id=>!primary.includes(id));
  if(!primary.length||[...primary,...background].some(id=>!skills.some(s=>s.id===id)))throw Error('Выбери сферы из своего аккаунта.');
  if(background.length>3)throw Error('Можно выбрать до трёх сопутствующих сфер.');
  if(input.core&&(!current?.core||current.date!==input.date)&&tasks.filter(t=>t.id!==input.id&&t.core&&t.date===input.date).length>=3)throw Error('В ядре дня максимум три квеста. Сначала освободи место.');
  const next={...(current||{id:input.id,done:false,completedAt:null,xpAwarded:0,goldAwarded:0,actualMin:null,createdAt:now}),title,date:input.date,startTime:input.startTime||null,estimateMin:input.estimateMin,difficulty:input.difficulty,skillId:primary[0],skillIds:primary,layers:background,core:!!input.core} as RawTask;
  // All unedited domain fields (goals, commitment, entry, rewards, actual time) survive.
  return current?tasks.map(t=>t.id===next.id?next:t):[...tasks,next];
}
