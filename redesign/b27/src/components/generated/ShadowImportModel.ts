import {uid,sphereOptions} from './B2Model';
import {PlanGoal,validDate} from './PlanModel';
export function parseGoals(raw:string):PlanGoal[]{
 let payload:any;try{payload=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('Ответ не похож на JSON. Вставь весь блок ответа, включая скобки.');}
 const list=Array.isArray(payload)?payload:payload.goals||payload.proposals;
 if(!Array.isArray(list)||!list.length||list.length>100)throw Error('Ожидается от 1 до 100 целей.');
 const known=new Set<string>(),ids=new Map<string,string>();
 list.forEach((g:any,i:number)=>{if(g.type&&g.type!=='goal')throw Error('В этой форме импортируются цели. Сферы выбери из существующих.');const key=String(g.id||i);if(known.has(key))throw Error('В ответе повторяются идентификаторы целей.');known.add(key);ids.set(key,uid());});
 const result=list.map((g:any,i:number)=>{if(typeof g.title!=='string'||!g.title.trim())throw Error(`У цели ${i+1} нет названия.`);const deadline=String(g.deadline||'');if(deadline&&!validDate(deadline))throw Error(`Проверь срок цели ${i+1}: нужен ГГГГ-ММ-ДД.`);const primary=Array.isArray(g.primary)?g.primary:[g.sphere||'work'];if(primary.some((id:string)=>!sphereOptions.some(s=>s.id===id)))throw Error(`У цели ${i+1} неизвестная сфера.`);if(g.parent&&!ids.has(String(g.parent)))throw Error(`У цели ${i+1} не найдена родительская цель.`);return {id:ids.get(String(g.id||i))!,title:g.title.trim().slice(0,180),description:String(g.description||''),project:String(g.project||''),horizon:String(g.horizon||'Краткосрочная'),deadline,primary,background:[],parent:g.parent?ids.get(String(g.parent)):undefined,steps:(Array.isArray(g.steps)?g.steps:[]).map((s:any)=>({id:uid(),title:String(typeof s==='string'?s:s.title||'').trim(),done:false})).filter((s:any)=>s.title),done:false};});
 for(const g of result){const visited=new Set([g.id]);let p=g.parent;while(p){if(visited.has(p))throw Error('В связях целей получился круг. Попроси исправить родительские связи.');visited.add(p);p=result.find(x=>x.id===p)?.parent;}}
 return result;
}
