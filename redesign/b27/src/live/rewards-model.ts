import type {Reward} from '../components/generated/B2Model';
import type {Purchase} from '../components/generated/DailyModel';
export type PersonalReward=Reward&{catalogNameKey?:string;createdAt?:string;[key:string]:unknown};
export type RewardReceipt={id:string;rewardId?:string;name:string;cost:number;at:string;iconId?:string;image?:string;[key:string]:unknown};
export type RewardLife={status:'received'|'planned'|'used'|'deferred';date:string|null;updatedAt?:string};
export type RewardsData={rewards:PersonalReward[];purchases:RewardReceipt[];catalog:PersonalReward[];life:Record<string,RewardLife>;nextReward?:string;limit:number;errors:string[]};
export function rewardReceiptArt(r:Partial<PersonalReward>={}){return{...(r.iconId?{iconId:r.iconId}:{}),...(r.image?{image:r.image}:{})};}
export function personalRewardLabel(r:PersonalReward,catalog:PersonalReward[]=[]){return r.catalogNameKey?catalog.find(c=>c.catalogNameKey===r.catalogNameKey)?.name||r.name:r.name;}
export function savePersonalReward(all:PersonalReward[],input:PersonalReward,base:string|null,limit:number,now:string){
 const old=all.find(r=>r.id===input.id),name=String(input.name||'').trim();
 if(!input.id||!name||name.length>120)throw Error('Название — от 1 до 120 символов.');
 if(!Number.isInteger(input.cost)||input.cost<1||input.cost>100000)throw Error('Цена — целое число от 1 до 100 000.');
 if(!/^reward\.[a-z-]+$/.test(input.iconId||''))throw Error('Выбери значок награды.');
 if(input.image&&(!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(input.image)||input.image.length>600000))throw Error('Выбери небольшое изображение PNG, JPEG или WebP.');
 const r={...(old||{}),id:input.id,name,cost:input.cost,iconId:input.iconId,createdAt:old?.createdAt||now} as PersonalReward;
 if(!old&&typeof input.catalogNameKey==='string')r.catalogNameKey=input.catalogNameKey;
 if(input.image)r.image=input.image;else delete r.image;
 if(old?.catalogNameKey&&name!==old.name)delete r.catalogNameKey;
 if(!base&&old){if(['name','cost','iconId','image'].every(k=>old[k]===r[k]))return all;throw Error('Награда с таким номером уже существует. Обнови список.');}
 if(base&&(!old||JSON.stringify(old)!==base))throw Error('Награда изменилась. Открой её заново.');
 if(!old&&all.length>=limit)throw Error('Достигнут лимит личных наград. Удали ненужную или открой настройки подписки.');
 return old?all.map(x=>x.id===r.id?r:x):[...all,r];
}
export function rewardProjection(d:Pick<RewardsData,'rewards'|'purchases'|'nextReward'>&{rewardLife:Record<string,RewardLife>;catalog?:PersonalReward[]}){
 const purchases:Purchase[]=d.purchases.filter(p=>typeof p.rewardId==='string'&&!!p.rewardId).map(p=>{
  const r=d.rewards.find(r=>r.id===p.rewardId),life=d.rewardLife?.[p.id],status=life?.status||'received';
  return{id:p.id,at:p.at||'',used:status==='used',status,date:life?.date||undefined,reward:{id:p.rewardId!,name:p.name||r?.name||'Личная награда',cost:Number(p.cost)||0,iconId:p.iconId||'reward.wishlist',image:p.image}};
 });
 return{rewards:d.rewards.map(r=>({...r,name:personalRewardLabel(r,d.catalog)})),purchases,nextReward:d.rewards.some(r=>r.id===d.nextReward)?d.nextReward:undefined};
}
export function reconcileRewardTasks(settings:any,tasks:any[],before:any[],purchases:RewardReceipt[],now:string){
 let next=settings;
 for(const old of before.filter(t=>t.rewardPurchaseId)){
  const task=tasks.find(t=>t.id===old.id),id=old.rewardPurchaseId;
  if(!purchases.some(p=>p.id===id&&p.rewardId))continue;
  if(task&&old.done===task.done&&old.date===task.date)continue;
  if(next===settings)next=structuredClone(settings);
  next.rewardLifeV1={...next.rewardLifeV1,[id]:{status:task?.done?'used':task?'planned':'received',date:task&&!task.done?task.date:null,updatedAt:now}};
 }
 return next;
}
