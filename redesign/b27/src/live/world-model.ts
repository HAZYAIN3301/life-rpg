import {validDate} from '../components/generated/PlanModel';
export type WorldNode={id:string;title:string;kind?:string;milestone?:boolean;desc?:string;criterion?:string;nextAction?:string;requires?:string[];cost?:number;perks?:{kind:string;val:number}[];unlocked?:boolean;claimedAt?:string;claimSource?:string;proofNote?:string;x?:number;y?:number;col?:number;row?:number;[key:string]:any};
export type WorldTree={nodes:WorldNode[];[key:string]:any};
export const worldKind=(n:WorldNode)=>n.kind||(n.milestone?'capability':'practice');
const clean=(v:any,max:number)=>String(v??'').trim().slice(0,max);
export function editWorldTree(trees:Record<string,WorldTree>,sid:string,input:any){
 const old=trees[sid];if(!old||input.base!==JSON.stringify(old))throw Error('Путь изменился. Открой редактор заново.');
 const next=structuredClone(trees),tree=next[sid],existing=tree.nodes.find(n=>n.id===(input.node?.id||input.id));
 if(input.op==='move'){
  if(!existing||[input.x,input.y].some(v=>!Number.isFinite(v)||v<0||v>100000))throw Error('Проверь положение узла.');
  existing.x=input.x;existing.y=input.y;return next;
 }
 if(input.op==='remove'){
  if(!existing)throw Error('Узел не найден.');
  if(worldKind(existing)==='capability'&&existing.unlocked)throw Error('Подтверждённая веха остаётся в истории.');
  tree.nodes=tree.nodes.filter(n=>n.id!==existing.id).map(n=>({...n,requires:(n.requires||[]).filter(id=>id!==existing.id)}));return next;
 }
 if(input.op!=='save'||!input.node||typeof input.node.id!=='string'||!input.node.id||input.create&&existing||!input.create&&!existing)throw Error('Узел изменился. Открой редактор заново.');
 const n=input.node,kind=worldKind(n);
 if(!['capability','practice'].includes(kind))throw Error('Выбери тип узла.');
 if(existing?.unlocked&&worldKind(existing)!==kind)throw Error('Тип открытого узла менять нельзя.');
 const title=clean(n.title,180),requires=n.requires||[];if(!title)throw Error('Назови узел.');
 if(!Array.isArray(requires)||new Set(requires).size!==requires.length||requires.some((id:string)=>id===n.id||!tree.nodes.some(o=>o.id===id)))throw Error('Проверь предыдущие узлы.');
 const position={x:Number(n.x??Number(n.col||0)*150),y:Number(n.y??Number(n.row||0)*120)};
 if(Object.values(position).some(v=>!Number.isFinite(v)||v<0||v>100000))throw Error('Положение должно быть от 0 до 100000.');
 const cost=Number(n.cost||0);if(!Number.isSafeInteger(cost)||cost<0||cost>10000)throw Error('Проверь цену бонуса.');
 const perks=kind==='capability'?[]:(n.perks||[]);if(!Array.isArray(perks)||perks.some((p:any)=>!p||typeof p.kind!=='string'||!Number.isFinite(p.val)||p.val<0))throw Error('Проверь эффект бонуса.');
 const titleChanged=!existing||title!==String(input.textBase?.title??existing.title),desc=clean(n.desc,1000),descChanged=!existing||desc!==String(input.textBase?.desc??existing.desc??'');
 const changed:WorldNode={...(existing||{id:n.id,unlocked:false,personal:true}),title:titleChanged?title:existing!.title,kind,milestone:kind==='capability',desc:descChanged?desc:existing?.desc||'',criterion:clean(n.criterion,500),nextAction:clean(n.nextAction,300),requires:[...requires],cost:kind==='capability'?0:cost,perks:structuredClone(perks),...position};
 if(titleChanged){changed.titleCustom=true;delete changed.titleKey;}if(descChanged){changed.descCustom=true;delete changed.descKey;}delete changed.perkXpPct;
 if(existing)tree.nodes=tree.nodes.map(o=>o.id===changed.id?changed:o);else tree.nodes.push(changed);
 const visiting=new Set(),visited=new Set();function visit(id:string){if(visiting.has(id))throw Error('Связи образуют круг. Убери одну из зависимостей.');if(visited.has(id))return;visiting.add(id);for(const req of tree.nodes.find(n=>n.id===id)?.requires||[])visit(req);visiting.delete(id);visited.add(id);}tree.nodes.forEach(n=>visit(n.id));
 return next;
}
export function saveWorldEpisode(episodes:any[],episode:any,base:string|null,skills:string[],today:string,now:string){
 const old=episodes.find(e=>e.id===episode.id);if(old?base!==JSON.stringify(old):base!==null)throw Error('Эпизод изменился. Открой его заново.');
 if(!episode.id||!validDate(episode.from)||!validDate(episode.to)||episode.from>episode.to||episode.to>today)throw Error('Проверь даты: эпизод описывает уже прожитый период.');
 const profile=episode.profile;if(!Array.isArray(profile)||!profile.length||new Set(profile.map(p=>p.skillId)).size!==profile.length||profile.some(p=>!skills.includes(p.skillId)||!Number.isInteger(p.intensity)||p.intensity<1||p.intensity>5))throw Error('Отметь реальные сферы и их интенсивность от 1 до 5.');
 if(!['trip','intensive','camp','vacation','illness','sprint','guests','other'].includes(episode.type))throw Error('Выбери вид эпизода.');
 const next={...(old||{}),id:episode.id,type:episode.type,title:clean(episode.title,60)||'Эпизод',from:episode.from,to:episode.to,story:clean(episode.story,4000),profile:structuredClone(profile),highlights:old?.highlights||episode.highlights||[],social:old?.social||episode.social||null,createdAt:old?.createdAt||now};
 return old?episodes.map(e=>e.id===old.id?next:e):episodes.concat(next);
}
export function worldProgress(events:any[],tasks:any[],habitlog:any,today:string,range:number,habits:any[]=[]){
 const shift=(d:string,n:number)=>{const dt=new Date(d+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);return dt.toISOString().slice(0,10);};
 const days=Array.from({length:range},(_,i)=>({date:shift(today,i-range+1),xp:0})),start=days[0].date,bySphere:Record<string,number>={};
 let xp=0,minutes=0,unknown=0,done=0;
 for(const e of events)if(e.date>=start&&e.date<=today){xp+=Number(e.xp)||0;const day=days.find(d=>d.date===e.date);if(day)day.xp+=Number(e.xp)||0;}
 for(const t of tasks){const date=t.date;if(!t.done||date<start||date>today)continue;done++;if(t.actualMin==null){unknown++;continue;}const min=Math.max(0,Number(t.actualMin)||0);minutes+=min;const ids=t.skillIds?.length?t.skillIds:[t.skillId].filter(Boolean),base=Math.floor(min/ids.length);ids.forEach((id:string,i:number)=>bySphere[id]=(bySphere[id]||0)+base+Math.min(1,Math.max(0,min-base*ids.length-i)));}
 for(const [date,logs]of Object.entries(habitlog||{}))if(date>=start&&date<=today)for(const [id,rec]of Object.entries(logs as any)as [string,any][]){const min=Math.max(0,Number(rec.min)||0);minutes+=min;const sid=habits.find(h=>h.id===id)?.skillId;if(sid)bySphere[sid]=(bySphere[sid]||0)+min;}
 return{days,xp,minutes,unknown,done,bySphere};
}
