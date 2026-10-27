import {useState} from 'react';
import {Task} from './B2Model';
import {DurationField} from './DurationField';
export function ActualTimeForm({task,save}:{task:Task;save:(actual:number)=>void}){
 const [value,setValue]=useState(task.actual??task.minutes);
 const valid=Number.isInteger(value)&&value>=0&&value<=1440;
 return <form onSubmit={e=>{e.preventDefault();if(valid)save(value);}}><h3>{task.title}</h3><DurationField label="Фактическое время" allowZero value={value} onChange={setValue}/><button className="wb-primary wb-wide" disabled={!valid}>Сохранить время</button></form>;
}
