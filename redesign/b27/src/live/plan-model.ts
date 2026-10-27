import {validDate} from '../components/generated/PlanModel';
export type GoalRecord={id:string;title:string;description?:string;type?:string;skillId?:string;skillIds?:string[];backgroundSkillIds?:string[];parentId?:string|null;groupId?:string|null;targetDate?:string|null;steps:{id:string;title:string;done:boolean;[key:string]:any}[];metric?:any;status?:string;archived?:boolean;completedAt?:string|null;manualComplete?:boolean;[key:string]:any};
export type GoalGroup={id:string;title:string;status:string;[key:string]:any};
export type GoalGraph={goals:GoalRecord[];tasks:any[];groups:GoalGroup[];skills?:{id:string}[]};
export const goalTypes:Record<string,string>={mission:'Миссия',vision:'Видение',path:'Путь',long:'Долгосрочная',mid:'Среднесрочная',short:'Краткосрочная',recurring:'Повторяющаяся'};
export function decodeRoutePart(value:string){try{return decodeURIComponent(value);}catch{return '';}}
export function goalMapContext(goals:GoalRecord[],selected:string[]){const ids=new Set(selected),pending=[...selected];while(pending.length){const id=pending.shift(),g=goals.find(g=>g.id===id);if(g?.parentId&&!ids.has(g.parentId)){ids.add(g.parentId);pending.push(g.parentId);}}return goals.filter(g=>ids.has(g.id));}
function fresh(value:any,base:string|null|undefined){if((value?JSON.stringify(value):null)!==base)throw Error('Запись изменилась. Закрой форму и открой её заново. Твои данные сохранены.');}
function title(value:any,max=160){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`Напиши название до ${max} символов.`);return value.trim();}
function graphCheck(g:GoalGraph,edited:string[]){
  for(const id of edited){const v=g.goals.find(x=>x.id===id);if(!v)continue;
    if(!goalTypes[v.type||''])throw Error('Выбери горизонт цели.');
    if(v.targetDate&&!validDate(v.targetDate))throw Error('Проверь срок цели.');
    const ids=v.skillIds?.length?v.skillIds:v.skillId?[v.skillId]:[];
    if(!ids.length||[...ids,...v.backgroundSkillIds||[]].some(id=>!g.skills?.some(s=>s.id===id))||(v.backgroundSkillIds||[]).length>3)throw Error('Выбери основные и до трёх сопутствующих сфер своего аккаунта.');
    if(v.groupId&&!g.groups.some(p=>p.id===v.groupId))throw Error('Проект больше не существует.');
    let p:GoalRecord|undefined=v;const seen=new Set<string>();
    while(p){if(seen.has(p.id))throw Error('Цели нельзя связать в круг.');seen.add(p.id);if(p.parentId&&!g.goals.some(x=>x.id===p!.parentId))throw Error('Родительская цель больше не существует.');p=p.parentId?g.goals.find(x=>x.id===p!.parentId):undefined;}
  }
}
/** Only explicit editable fields are accepted. Domain refresh/credit remains in app.js. */
export function goalMutation(source:GoalGraph,command:string,input:any,now:string,rewards:Record<string,number>,today=now.slice(0,10)):GoalGraph{
  const g=structuredClone(source),edited:string[]=[];
  const requireGoal=(id:string)=>{const v=g.goals.find(x=>x.id===id);if(!v)throw Error('Цель больше не существует.');return v;};
  if(command==='goal.save'){
    const p=input.goal,old=g.goals.find(x=>x.id===p.id);fresh(old,input.base);
    if(typeof p.id!=='string'||!p.id||p.id.length>120)throw Error('Неверный номер цели.');
    const primary=[...new Set<string>(p.skillIds?.length?p.skillIds:p.skillId?[p.skillId]:[])],background=[...new Set<string>(p.backgroundSkillIds||[])].filter(id=>!primary.includes(id));
    const metric=p.metric==null?null:{...(old?.metric||{}),start:Number(p.metric.start),current:Number(p.metric.current),target:Number(p.metric.target),unit:String(p.metric.unit||'').slice(0,12),lowerBetter:!!p.metric.lowerBetter,maintain:!!p.metric.maintain,log:old?.metric?.log||[]};
    if(metric&&![metric.start,metric.current,metric.target].every(Number.isFinite))throw Error('Проверь числа метрики.');
    const v:GoalRecord={...(old||{id:p.id,createdAt:now,status:'active',completedAt:null,archived:false,steps:[]}),title:title(p.title),description:String(p.description||'').trim().slice(0,800),type:p.type,skillId:primary[0],skillIds:primary,backgroundSkillIds:background,parentId:p.parentId||null,groupId:p.groupId||null,targetDate:p.targetDate||null,metric,progressKind:metric?'metric':'checklist',xpReward:old?.xpReward??rewards[p.type]??0};
    if(!old&&p.firstStep?.trim())v.steps=[{id:p.firstStepId,title:title(p.firstStep),done:false}];
    g.goals=old?g.goals.map(x=>x.id===v.id?v:x):[...g.goals,v];edited.push(v.id);
  }else if(command==='goal.state'||command==='goal.delete'){
    fresh(g.goals,input.base);const ids=new Set<string>(input.ids||[]);if(!ids.size||ids.size>100)throw Error('Выбери от 1 до 100 целей.');for(const id of ids)requireGoal(id);
    if(command==='goal.delete'){
      if(input.children){let count=0;do{count=ids.size;for(const v of g.goals)if(v.parentId&&ids.has(v.parentId))ids.add(v.id);}while(count!==ids.size);}
      g.goals=g.goals.filter(v=>!ids.has(v.id)).map(v=>ids.has(v.parentId||'')?{...v,parentId:null}:v);
      g.tasks=g.tasks.map(t=>{if(!ids.has(t.goalId))return t;const n={...t};delete n.goalId;delete n.stepSourceId;delete n.stepTicked;return n;});
    }else for(const id of ids){const v=requireGoal(id);if(input.field==='completed'){
      if(v.archived)throw Error('Сначала верни цель из архива.');v.completedAt=input.value?now:null;v.manualComplete=!!input.value;
      if(!input.value&&!v.metric&&v.steps.length&&v.steps.every(s=>s.done))v.steps[v.steps.length-1].done=false;
    }else if(input.field==='status'){if(!['active','paused','waiting'].includes(input.value))throw Error('Неизвестное состояние.');v.status=input.value;}else if(input.field==='archived')v.archived=!!input.value;else throw Error('Неизвестное действие.');}
  }else if(command==='goal.step'||command==='goal.metric'){
    const v=requireGoal(input.goalId);fresh(v,input.base);if(v.archived)throw Error('Сначала верни цель из архива.');
    if(command==='goal.metric'){
      if(!v.metric||!Number.isFinite(input.value)||!validDate(today))throw Error('Введи числовое значение метрики.');v.metric.current=input.value;v.metric.log=[{date:today,value:input.value},...v.metric.log||[]].slice(0,50);
    }else{
      if(v.metric)throw Error('У числовой цели прогресс меняется через метрику.');
      const old=v.steps.find(s=>s.id===input.step.id);
      if(input.remove){v.steps=v.steps.filter(s=>s.id!==input.step.id);g.tasks=g.tasks.map(t=>{if(t.goalId!==v.id||t.stepSourceId!==input.step.id)return t;const n={...t};delete n.stepSourceId;delete n.stepTicked;return n;});}
      else if(input.move){const i=v.steps.findIndex(s=>s.id===input.step.id),j=i+input.move;if(i>=0&&j>=0&&j<v.steps.length)[v.steps[i],v.steps[j]]=[v.steps[j],v.steps[i]];}
      else{if(!input.step.id||v.steps.length>=100&&!old)throw Error('У цели может быть до 100 шагов.');const s={...old,id:input.step.id,title:title(input.step.title??old?.title),done:typeof input.step.done==='boolean'?input.step.done:!!old?.done};v.steps=old?v.steps.map(x=>x.id===s.id?s:x):[...v.steps,s];}
    }
  }else if(command==='goal.link'){
    const t=g.tasks.find(t=>t.id===input.taskId);if(!t)throw Error('Квест больше не существует.');fresh(t,input.base);
    if(input.goalId){const v=requireGoal(input.goalId);if(v.archived)throw Error('Цель в архиве.');t.goalId=v.id;}else delete t.goalId;
    delete t.stepSourceId;delete t.stepTicked;
  }else if(command==='group.save'){
    const p=input.group,old=g.groups.find(x=>x.id===p.id);fresh(old,input.base);if(!p.id||!['active','archived'].includes(p.status))throw Error('Проверь проект.');const v={...old,id:p.id,title:title(p.title,80),status:p.status,createdAt:old?.createdAt||now};g.groups=old?g.groups.map(x=>x.id===v.id?v:x):[...g.groups,v];
  }else if(command==='group.delete'){
    const old=g.groups.find(x=>x.id===input.id);fresh(old,input.base);g.groups=g.groups.filter(x=>x.id!==input.id);g.goals=g.goals.map(v=>v.groupId===input.id?{...v,groupId:null}:v);
  }else throw Error('Неизвестное действие с целью.');
  graphCheck(g,edited);return g;
}
