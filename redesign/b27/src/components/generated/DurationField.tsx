import { Field } from './B2Forms';
export function DurationField({value,onChange,label='Длительность',allowZero=false}:{value:number;onChange:(v:number)=>void;label?:string;allowZero?:boolean}){
 return <fieldset className="b24-duration"><legend>{label}</legend><Field label="Часы"><input aria-label={label+' — часы'} type="number" min="0" max="24" value={Math.floor(value/60)} onChange={e=>onChange(Number(e.target.value)*60+value%60)}/></Field><Field label="Минуты"><input aria-label={label+' — минуты'} type="number" min="0" max="59" value={value%60} onChange={e=>onChange(Math.floor(value/60)*60+Number(e.target.value))}/></Field>{(!allowZero&&value===0||value>1440)&&<small role="alert">От 1 минуты до 24 часов</small>}</fieldset>
}
