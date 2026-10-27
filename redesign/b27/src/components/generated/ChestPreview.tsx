import { useState } from 'react';
import { Data,day } from './B2Model';
import { Icon } from './B2Scene';
import { chestProgress } from './DailyModel';
type ChestData=Data & {chestPreviews?:Record<string,number>};
export function ChestPreview({data,commit}:{data:Data;commit:(f:(d:Data)=>Data)=>boolean}){
 const [reveal,setReveal]=useState(false),p=chestProgress(data);
 return <section className={'b24-chest '+(reveal?'is-open':'')}><div className="b24-chest-art"><Icon id={reveal?'status.gold':'system.rewards'} size={112}/></div><div><h3>{reveal?'Так выглядит находка':p.available?'Твой сундук готов':'Сундук за сегодняшний путь'}</h3><p>{reveal?'Пример: 40 золота. В этой пробе баланс не меняется.':p.next?`${p.count} из ${p.next} действий до следующего сундука`:'Все три сундука дня заработаны'}</p><div className="b24-chest-steps" aria-label="Сундуки за 1, 3 и 5 действий">{[1,3,5].map((n,i)=><span className={p.count>=n?'earned':''} key={n}>{p.count>=n?<Icon id="action.check" size={14}/>:n}<small>{i+1}</small></span>)}</div>{p.available>0&&!reveal&&<button className="wb-primary" onClick={()=>{if(commit(d=>{const progress=chestProgress(d);if(!progress.available)throw Error('Этот сундук уже открыт.');return {...d,chestPreviews:{...(d as ChestData).chestPreviews,[day()]:progress.opened+1}};}))setReveal(true);}}>Открыть · проба</button>}{reveal&&<button onClick={()=>setReveal(false)}>К наградам</button>}<small className="b24-chest-caption">Проба открытия · инвентарь аккаунта подключается отдельно</small></div></section>;
}
