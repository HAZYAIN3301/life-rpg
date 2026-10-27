import { Data, Task, Reward, day, newTask, uid, KEY } from './B2Model';
import { validDate } from './PlanModel';

export type Focus = {id:string;elapsed:number;since:number;running:boolean};
export type RewardState = 'received'|'planned'|'used'|'deferred';
export type Purchase = Data['purchases'][number] & {status?:RewardState;date?:string;usedAt?:string};
export type DailyData = Data & {focus?:Focus|null;nextReward?:string};
export const statusOf = (p:Purchase):RewardState => p.status || (p.used ? 'used' : 'received');
export const elapsedMs = (f:Focus|null|undefined,now=Date.now()) => f ? Math.max(0,f.elapsed + (f.running ? Math.max(0,now-f.since) : 0)) : 0;
export function startFocus(d:DailyData,id:string,now=Date.now()):DailyData {
  const task=d.tasks.find(t=>t.id===id);
  if(!task||task.done)throw Error('Выбери незавершённый квест.');
  if(d.focus?.id!==id&&d.focus)throw Error('Сначала останови текущий таймер. Накопленное время сохранится.');
  if(d.focus?.running)return d;
  return {...d,focus:{id,elapsed:d.focus?.elapsed || (task.actual||0)*60000,since:now,running:true}};
}
export function pauseFocus(d:DailyData,now=Date.now()):DailyData {
  if(!d.focus)return d;
  return {...d,focus:{...d.focus,elapsed:elapsedMs(d.focus,now),since:now,running:!d.focus.running}};
}
export function stopFocus(d:DailyData,now=Date.now()):DailyData {
  if(!d.focus)return d;
  const actual=Math.min(1440,Math.round(elapsedMs(d.focus,now)/60000));
  return {...d,focus:null,tasks:d.tasks.map(t=>t.id===d.focus!.id?{...t,actual}:t)};
}
export function saveReward(d:DailyData,r:Reward):DailyData {
  if(!r.name.trim()||r.name.length>140)throw Error('Название — от 1 до 140 символов.');
  if(!Number.isInteger(r.cost)||r.cost<1||r.cost>1000000)throw Error('Цена — целое число от 1 до 1 000 000.');
  const reward={...r,name:r.name.trim()};
  return {...d,rewards:d.rewards.some(x=>x.id===r.id)?d.rewards.map(x=>x.id===r.id?reward:x):[...d.rewards,reward]};
}
export function buyReward(d:DailyData,id:string,token:string,expectedCost:number,now=new Date().toISOString()):DailyData {
  if(d.purchases.some(p=>p.id===token))return d;
  const r=d.rewards.find(x=>x.id===id);
  if(!r)throw Error('Награда удалена. Выбери другую.');
  if(r.cost!==expectedCost)throw Error('Цена изменилась. Закрой окно и проверь новую цену.');
  if(!Number.isInteger(r.cost)||r.cost<1||d.gold<r.cost)throw Error('Для этой награды пока не хватает золота.');
  return {...d,gold:d.gold-r.cost,purchases:[...d.purchases,{id:token,reward:{...r},at:now,used:false,status:'received'} as Purchase],history:[{id:uid(),text:`${r.name} · −${r.cost} золота`,at:now},...d.history]};
}
export function rewardState(d:DailyData,id:string,status:RewardState,date='',now=new Date().toISOString()):DailyData {
  const p=d.purchases.find(x=>x.id===id) as Purchase|undefined;
  if(!p)throw Error('Полученная награда не найдена.');
  if(status==='planned'&&!validDate(date))throw Error('Выбери дату отдыха.');
  if(statusOf(p)===status&&(status!=='planned'||p.date===date))return d;
  const titles={received:'Снова доступна',planned:'Отдых запланирован',used:'Использована награда',deferred:'Отложена награда'};
  // Status-only changes never mint/refund gold; a completed linked quest must be undone explicitly.
  const linked=d.tasks.find(t=>t.source==='reward:'+id);
  if(linked?.done&&status!=='used')throw Error('Сначала отмени выполнение связанного квеста в Плане.');
  return {...d,purchases:d.purchases.map(x=>x.id===id?{...x,status,date:status==='planned'?date:undefined,used:status==='used',usedAt:status==='used'?now:undefined}:x),history:[{id:uid(),text:`${titles[status]}: ${p.reward.name}`,at:now},...d.history]};
}
export function rewardTask(d:DailyData,id:string):Task {
  const p=d.purchases.find(x=>x.id===id);if(!p)throw Error('Награда не найдена.');
  return d.tasks.find(t=>t.source==='reward:'+id)||{...newTask(p.reward.name,(p as Purchase).date||day()),minutes:p.reward.iconId==='reward.game'?60:30,primary:['health/1'],difficulty:'easy',source:'reward:'+id};
}
export function reconcileDaily(before:DailyData,next:DailyData):DailyData {
  let purchases=next.purchases as Purchase[];
  for(const task of next.tasks.filter(t=>t.source?.startsWith('reward:'))) {
    const old=before.tasks.find(t=>t.id===task.id), id=task.source!.slice(7);
    if(!old||old.done!==task.done||old.date!==task.date) purchases=purchases.map(p=>p.id!==id?p:{...p,used:task.done,status:task.done?'used':task.date?'planned':'received',date:task.done?undefined:task.date||undefined});
  }
  // Deleting the planned quest releases the voucher, never deletes the purchase.
  for(const old of before.tasks.filter(t=>t.source?.startsWith('reward:')&&!next.tasks.some(x=>x.id===t.id))) purchases=purchases.map(p=>p.id===old.source!.slice(7)&&statusOf(p)==='planned'?{...p,status:'received',date:undefined}:p);
  const focus=next.focus&&next.tasks.some(t=>t.id===next.focus!.id&&!t.done)?next.focus:null;
  return {...next,purchases,focus,nextReward:next.rewards.some(r=>r.id===next.nextReward)?next.nextReward:undefined};
}
export function pendingReward(d:DailyData,today=day()) {
  return (d.purchases as Purchase[]).filter(p=>['received','planned'].includes(statusOf(p))).sort((a,b)=>Number(!!b.date&&b.date<=today)-Number(!!a.date&&a.date<=today)||b.at.localeCompare(a.at))[0];
}
export function persistDaily(d:DailyData,expected:string|null,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){
  if(storage.getItem(KEY)!==expected)throw Error('Макет изменён в другой вкладке. Обнови страницу перед сохранением; черновик формы останется.');
  const raw=JSON.stringify(d);storage.setItem(KEY,raw);
  if(storage.getItem(KEY)!==raw)throw Error('Не удалось подтвердить сохранение. Обнови страницу и проверь последнее действие.');
  return raw;
}

export function chestProgress(data:Data,date=day()){const count=data.tasks.filter(t=>t.date===date&&t.done).length+data.habits.filter(h=>h.logs.includes(date)).length;const earned=[1,3,5].filter(n=>count>=n).length,opened=(data as Data & {chestPreviews?:Record<string,number>}).chestPreviews?.[date]||0;return {count,earned,opened,available:Math.max(0,earned-opened),next:[1,3,5].find(n=>n>count)};}
