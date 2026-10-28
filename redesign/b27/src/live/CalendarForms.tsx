import {useState} from 'react';
import {Field} from './Field';
import {DurationField} from '../components/generated/DurationField';
import {day} from '../components/generated/B2Model';
import {monday,duration} from '../components/generated/PlanModel';
import type {Snapshot} from './model';
import {LiveSpheres} from './SpherePicker';
export function IntentionForm({s,week,save}:{s:Snapshot;week:string;save:(text:string,skills:string[])=>Promise<boolean>}){
 const initial=s.weeks?.[week],[text,setText]=useState(initial?.intention||''),[skills,setSkills]=useState<string[]>(initial?.intentionSkillIdsV1||[]);
 return <form onSubmit={e=>{e.preventDefault();void save(text,skills);}}><Field label="Что главное на этой неделе?"><textarea autoFocus rows={4} maxLength={1000} value={text} onChange={e=>setText(e.target.value)}/></Field><LiveSpheres label="Связанные сферы · по желанию" skills={s.skills} value={skills} change={setSkills}/><button className="wb-primary wb-wide">Сохранить намерение</button></form>;
}
export function BudgetForm({s,date,save}:{s:Snapshot;date:string;save:(n:number|null)=>Promise<boolean>}){
 const [minutes,setMinutes]=useState(s.weeks?.[monday(date)]?.dayBudgetsV1?.[date]??120);
 return <form onSubmit={e=>{e.preventDefault();void save(minutes);}}><p>Сколько времени ты хочешь оставить на дела в этот день? Это ориентир для планирования.</p><DurationField label="Время на дела" allowZero value={minutes} onChange={setMinutes}/><button className="wb-primary wb-wide">Сохранить ориентир</button><button type="button" className="wb-wide" onClick={()=>void save(null)}>Убрать ограничение</button></form>;
}
export function CarryForm({s,selected,save}:{s:Snapshot;selected:string;save:(ids:string[],date:string)=>Promise<boolean>}){
 const pending=s.tasks.filter(t=>!t.done&&t.date<day()),[ids,setIds]=useState<string[]>([]),[date,setDate]=useState(selected<day()?day():selected);
 return <form onSubmit={e=>{e.preventDefault();void save(ids,date);}}><p>Выбери дела, которым нужен новый день.</p>{!!pending.length&&<div className="wb-actions"><button type="button" onClick={()=>setIds(pending.slice(0,50).map(t=>t.id))}>Выбрать все · {Math.min(50,pending.length)}</button><button type="button" disabled={!ids.length} onClick={()=>setIds([])}>Снять выбор</button></div>}<div className="live-carry">{pending.map(t=><label key={t.id}><input type="checkbox" checked={ids.includes(t.id)} onChange={e=>setIds(e.target.checked?[...ids,t.id]:ids.filter(id=>id!==t.id))}/><span><strong>{t.title}</strong><small>{t.date} · {duration(t.estimateMin||0)}</small></span></label>)}</div>{!pending.length&&<p>Дел из прошлых дней пока нет.</p>}<Field label="Новая дата"><input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><button disabled={!ids.length||ids.length>50} className="wb-primary wb-wide">Перенести выбранные · {ids.length}</button></form>;
}
