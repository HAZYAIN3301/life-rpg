import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Icon} from '../components/generated/B2Scene';
import {day} from '../components/generated/B2Model';
import type {Reward} from '../components/generated/B2Model';
import {statusOf} from '../components/generated/DailyModel';
import type {Purchase} from '../components/generated/DailyModel';
import {RewardArt,readRewardImage} from '../components/generated/RewardArt';
import {Field} from './Field';
import {rewardProjection,personalRewardLabel} from './rewards-model';
import type {PersonalReward,RewardReceipt} from './rewards-model';
import type {Snapshot,RawTask} from './model';
import './rewards-live.css';
declare global{interface Window{SatoruRewardsBridge:{mount:(host:HTMLElement,part:string)=>void}}}
type Run=(command:string,input:unknown,message?:string)=>Promise<boolean>;
type Layer={kind:'edit';reward:PersonalReward}|{kind:'use';id:string};
const states={received:'Получено',planned:'Запланировано',used:'Использовано',deferred:'Отложено'};
function RewardOwners({s,part}:{s:Snapshot;part:'chest'|'collection'}){
 const host=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(host.current)window.SatoruRewardsBridge.mount(host.current,part);},[s.revision,part]);
 return <div className={'b210-owned b211-owned owned-rewards reward-owner-'+part} ref={host}/>;
}
export function LiveRewards({s,run,editTask,complete,entry,handled}:{s:Snapshot;run:Run;editTask:(t:RawTask)=>void;complete:(t:RawTask)=>void;entry:string;handled:()=>void}){
 const workspace=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{if(workspace.current)window.SatoruPlanBridge.translate(workspace.current);});
 const d=s.rewardsData,projection=rewardProjection({...d,rewardLife:d.life}),purchases=projection.purchases.slice().reverse();
 const [mode,setMode]=useState('Личные'),[query,setQuery]=useState(''),[filter,setFilter]=useState('Все'),[owned,setOwned]=useState('Ждут меня');
 const [layer,setLayer]=useState<Layer|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState<RewardReceipt|null>(null);
 const dateLabel=(key:string)=>new Date(key+'T12:00:00').toLocaleDateString(s.preferences.language,{day:'numeric',month:'short'});
 const receiptsSeen=useRef(new Set(d.purchases.map(p=>p.id)));
 useEffect(()=>{const fresh=d.purchases.filter(p=>!receiptsSeen.current.has(p.id));receiptsSeen.current=new Set(d.purchases.map(p=>p.id));if(fresh.length)setMessage(fresh.at(-1)!);},[s.revision]);
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),lock=useRef(false),catalogIds=useRef(new Map<string,string>());
 const blocked=d.errors.length>0;
 function open(l:Layer){opener.current=document.activeElement as HTMLElement;setError('');setLayer(l);}
 function close(){if(lock.current)return;setLayer(null);requestAnimationFrame(()=>opener.current?.isConnected&&opener.current.focus());}
 useEffect(()=>{if(layer){dialog.current?.showModal();if(layer.kind==='edit')dialog.current?.querySelector<HTMLInputElement>('input:not([type=file])')?.focus();}else dialog.current?.close();},[layer]);
 useEffect(()=>{if(!entry)return;const [kind,...parts]=entry.split(':'),id=parts.join(':');if(kind==='use'){setMode('Полученные');open({kind:'use',id});}else if(kind==='buy'){void run('reward.open',{kind:'reward',id});}handled();},[entry]);
 async function write(command:string,input:unknown,message:string,dismiss=false){
  if(lock.current)return false;lock.current=true;setPending(true);setError('');
  try{const ok=await run(command,input,message);if(!ok)setError('Сохранение не подтверждено. Повтори то же действие или обнови страницу.');else if(dismiss)setLayer(null);return ok;}
  finally{lock.current=false;setPending(false);}
 }
 const changeMode=(m:string)=>{setMode(m);setQuery('');setFilter('Все');setError('');};
 const buy=(r:Reward)=>void write('reward.open',{kind:'reward',id:r.id},'');
 const selected=d.rewards.find(r=>r.id===d.nextReward),waiting=purchases.filter(p=>!p.historical&&['received','planned'].includes(statusOf(p)));
 const list=d.rewards.filter(r=>personalRewardLabel(r,d.catalog).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(filter!=='Доступные'||r.cost<=s.gold));
 const added=(r:PersonalReward)=>d.rewards.some(x=>x.catalogNameKey===r.catalogNameKey||x.name===r.catalogNameKey);
 const catalog=d.catalog.filter(r=>personalRewardLabel(r,d.catalog).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(filter!=='Доступные'||r.cost<=s.gold)&&(filter!=='Не добавлены'||!added(r)));
 const purchase=layer?.kind==='use'?purchases.find(p=>p.id===layer.id):undefined;
 const linked=purchase?s.tasks.find(t=>t.rewardPurchaseId===purchase.id):undefined;
 const visible=purchases.filter(p=>owned==='Все'||owned==='Куплены ранее'&&p.historical||owned==='Ждут меня'&&!p.historical&&['received','planned'].includes(statusOf(p))||owned==='Использованы'&&statusOf(p)==='used'||owned==='Отложены'&&statusOf(p)==='deferred');
 const purchaseState=(p:typeof purchases[number])=>p.historical?'Куплено ранее':states[statusOf(p)];
 const empty=(title:string,body:string)=><div className="tri-empty"><h3>{title}</h3><p>{body}</p></div>;
 const create=()=>open({kind:'edit',reward:{id:'r_'+crypto.randomUUID(),name:query,cost:100,iconId:'reward.game'}});
 const addCatalog=(r:PersonalReward)=>{let id=catalogIds.current.get(r.id);if(!id){id='r_'+crypto.randomUUID();catalogIds.current.set(r.id,id);}return write('reward.save',{reward:{...r,id},base:null},'Добавлено в личные. Название и цену можно изменить.');};
 function rest(p:Purchase){
  dialog.current?.close();setLayer(null);
  editTask(linked||{id:'reward-rest:'+p.id,title:p.reward.name,date:p.date||day(),startTime:null,estimateMin:p.reward.iconId==='reward.game'?60:30,difficulty:'easy',skillId:s.skills.find(k=>!k.archived)?.id,skillIds:[s.skills.find(k=>!k.archived)?.id].filter(Boolean),layers:[],core:false,rewardPurchaseId:p.id});
 }
 return <section ref={workspace} className="rw-workspace b211-rewards">
  <div className="tri-heading"><div><h2>Награды</h2><p>То, ради чего приятно стараться.</p></div><span className="rw-wallet" aria-label={'Баланс '+s.gold+' золота'}><Icon id="status.gold" size={34}/><b>{s.gold.toLocaleString(s.preferences.language)}</b></span></div>
  <div className="wb-segments rw-tabs" role="group" aria-label="Раздел наград">{['Личные','Каталог','Полученные'].map(m=><button key={m} aria-pressed={mode===m} onClick={()=>changeMode(m)}>{m}{m==='Полученные'&&waiting.length>0&&<span className="rw-count">{waiting.length}</span>}</button>)}</div>
  {d.errors.map(e=><p className="pl-error" role="alert" key={e}>{e}</p>)}
  {message&&<p className="tri-receipt" role="status"><span>Покупка сохранена:</span> <span data-noi18n>{message.name}</span> · −{message.cost} <span>золота</span>.</p>}
  {error&&!layer&&<p className="pl-error" role="alert">{error}</p>}
  {mode==='Личные'&&<>
   {!blocked&&<RewardOwners s={s} part="chest"/>}
   <div className="rw-lead">{selected?<RewardArt reward={selected} size={86}/>:<Icon id="reward.game" size={86}/>}<div><h3 data-noi18n={selected?'':undefined}>{selected?personalRewardLabel(selected,d.catalog):'Выбери, чего ждёшь'}</h3><p>{selected?<><span>{s.gold>=selected.cost?'Уже доступна':'Осталось накопить'}</span> {s.gold>=selected.cost?selected.cost:selected.cost-s.gold} <span>золота</span></>:'Закрепи одну личную награду — она появится на главной.'}</p>{selected&&<div className="rw-lead-actions"><button className="wb-primary" disabled={blocked||pending||s.gold<selected.cost} onClick={()=>buy(selected)}>Получить</button><button disabled={pending} onClick={()=>void write('reward.pin',{id:null},'Выбор снят')}>Открепить</button></div>}</div></div>
   {waiting.length>0&&<button className="tri-link-row" onClick={()=>changeMode('Полученные')}><Icon id="action.check"/><span><strong>{waiting.length===1?'Награда ждёт тебя':'Награды ждут тебя'}{waiting.length>1&&<span> · {waiting.length}</span>}</strong><small data-noi18n>{waiting[0].reward.name}</small></span><Icon id="action.expand"/></button>}
   <div className="tri-section-head"><h3>Мой список <small>{d.rewards.length}{d.limit<5000?'/'+d.limit:''}</small></h3><button disabled={blocked||pending} onClick={create}><Icon id="action.add"/>Своя награда</button></div>
   <div className="rw-search"><input aria-label="Поиск личной награды" placeholder="Найти в моих наградах" value={query} onChange={e=>setQuery(e.target.value)}/><button aria-pressed={filter==='Доступные'} onClick={()=>setFilter(filter==='Все'?'Доступные':'Все')}>Доступные</button></div>
   <div className="rw-personal-list">{list.map(r=><article className="rw-personal" key={r.id}><RewardArt reward={r} size={64}/><div><button className="rw-name" data-noi18n onClick={()=>open({kind:'edit',reward:r})}>{personalRewardLabel(r,d.catalog)}</button><small>{r.cost} <span>золота</span> · <span>{r.cost>s.gold?'не хватает':'доступна'}</span>{r.cost>s.gold?' '+(r.cost-s.gold):''}</small><div className="rw-row-actions"><button disabled={blocked||pending} aria-pressed={d.nextReward===r.id} onClick={()=>void write('reward.pin',{id:d.nextReward===r.id?null:r.id},'Выбор награды сохранён')}>{d.nextReward===r.id?'Выбрана на главной':'Хочу следующей'}</button><button disabled={blocked||pending||r.cost>s.gold} onClick={()=>buy(r)}>Получить</button></div></div><button className="rw-edit" aria-label={'Изменить награду: '+personalRewardLabel(r,d.catalog)} onClick={()=>open({kind:'edit',reward:r})}><Icon id="action.edit" size={18}/></button></article>)}</div>
   {!blocked&&!list.length&&empty(query||filter!=='Все'?'Ничего не найдено':'Твой список пока пуст',query||filter!=='Все'?'Измени поиск или фильтр.':'Добавь личную награду или выбери готовую из каталога.')}
   <button className="tri-link-row" onClick={()=>changeMode('Каталог')}><Icon id="nav.rewards"/><span><span>Каталог наград</span> · {d.catalog.length}</span><Icon id="action.expand"/></button>
   <p className="rw-note">Отдых не нужно заслуживать. Золото — способ отметить усилия и не забыть о том, что радует.</p>
  </>}
  {mode==='Каталог'&&<>
   <div className="rw-search"><input aria-label="Поиск в каталоге" placeholder="Кино, игры, прогулка…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <div className="tri-filters">{['Все','Доступные','Не добавлены'].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
   <div className="rw-catalog">{catalog.map(r=><article key={r.id}><Icon id={r.iconId} size={78}/><h3>{r.name}</h3><p>{r.cost} золота</p><button disabled={blocked||pending||added(r)} onClick={()=>void addCatalog(r)}>{added(r)?'В моём списке':'Добавить себе'}</button></article>)}</div>
   {!catalog.length&&empty('Таких наград нет','Попробуй другой запрос или создай свою награду.')}
   <button className="wb-primary wb-wide" disabled={blocked||pending} onClick={create}>Создать свою награду</button>
  </>}
  {mode==='Полученные'&&<>
   <p className="rw-note">Золото уже списано. Планирование и отметки использования не меняют баланс.</p>
   <div className="tri-filters">{['Ждут меня','Куплены ранее','Использованы','Отложены','Все'].map(f=><button key={f} aria-pressed={owned===f} onClick={()=>setOwned(f)}>{f}</button>)}</div>
   {purchases.some(p=>p.historical)&&<p className="rw-note">Прежние покупки сохранены в «Куплены ранее». Если отметки использования нет, они не считаются ожидающими.</p>}
   {visible.map(p=><article className="rw-owned" key={p.id}><RewardArt reward={p.reward} size={60}/><div><h3 data-noi18n>{p.reward.name}</h3><p>{purchaseState(p)}{p.date?' · '+dateLabel(p.date):''}</p><small>{dateLabel(p.at.slice(0,10))} · {p.reward.cost} золота</small></div><button aria-label={'Открыть полученную награду: '+p.reward.name} onClick={()=>open({kind:'use',id:p.id})}><Icon id="action.expand"/></button></article>)}
   {!blocked&&!visible.length&&empty('Здесь пока пусто','Получи награду из своего списка. Здесь она останется до использования.')}
   <details className="wb-details"><summary>История золота и действий · {d.purchases.length}</summary>{d.purchases.length?d.purchases.slice().reverse().map((p,i)=><p key={p.id||i}><small>{dateLabel((p.at||'').slice(0,10))}</small><br/><span data-noi18n>{p.name||'Списание'}</span> · −{p.cost} золота</p>):<p>Операций пока нет.</p>}</details>
  </>}
  <details className="rw-collection"><summary><Icon id="nav.rewards" size={40}/><span>Коллекция и снаряжение<small>Логово, гардероб, арсенал и достижения</small></span><Icon id="action.expand"/></summary>{!blocked&&<RewardOwners s={s} part="collection"/>}</details>
  <dialog ref={dialog} className="wb-dialog rw-dialog" aria-label={layer?.kind==='edit'?'Личная награда':'Полученная награда'} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}><div className="wb-sheet"><header><h2>{layer?.kind==='edit'?'Личная награда':'Время для себя'}</h2><button aria-label="Закрыть награду" disabled={pending} onClick={close}><Icon id="action.close"/></button></header>{error&&<p className="pl-error" role="alert">{error}</p>}{pending&&<p role="status">Сохраняю…</p>}
   <fieldset className="live-fields" disabled={pending||blocked}>
    {layer?.kind==='edit'&&<RewardEditor key={layer.reward.id} s={s} initial={layer.reward} save={(reward,base)=>write('reward.save',{reward,base},'Личная награда сохранена',true)} remove={d.rewards.some(r=>r.id===layer.reward.id)?()=>{dialog.current?.close();setLayer(null);void run('reward.open',{kind:'delete-reward',id:layer.reward.id});}:undefined}/>}
    {purchase&&<><div className="rw-buy"><RewardArt reward={purchase.reward} size={92}/><h3 data-noi18n>{purchase.reward.name}</h3><p>{purchaseState(purchase)}{purchase.date?' · '+dateLabel(purchase.date):''}</p></div>
     {['received','planned'].includes(statusOf(purchase))?<>
      <button className="wb-primary wb-wide" onClick={()=>{if(linked&&!linked.done){dialog.current?.close();setLayer(null);complete(linked);}else void write('reward.life',{id:purchase.id,status:'used'},'Использование сохранено · без повторного списания',true);}}>Я воспользовался</button>
      <RewardDate initial={purchase.date||day()} save={date=>write('reward.life',{id:purchase.id,status:'planned',date},'Дата награды сохранена',true)}/>
      <button className="wb-wide" onClick={()=>rest(purchase)}><Icon id="period.day"/>{linked?'Открыть отдых в плане':'Запланировать отдых как квест'}</button><p className="rw-note">Квест отдыха появится в Сегодня и Плане. Его завершение отметит награду использованной.</p>
      <button className="wb-wide" onClick={()=>void write('reward.life',{id:purchase.id,status:'deferred'},'Награда отложена',true)}>Отложить награду</button>
     </>:<><button className="wb-primary wb-wide" onClick={()=>linked?.done?rest(purchase):void write('reward.life',{id:purchase.id,status:'received'},'Награда снова в полученных · баланс не изменился',true)}>{linked?.done?'Открыть завершённый квест':'Вернуть в полученные'}</button><p className="rw-note">Это изменение отметки. Потраченное золото не возвращается.</p></>}
    </>}
   </fieldset>
  </div></dialog>
 </section>;
}
function RewardDate({initial,save}:{initial:string;save:(date:string)=>Promise<boolean>}){
 const [date,setDate]=useState(initial);
 return <form onSubmit={e=>{e.preventDefault();void save(date);}}><Field label="Дата для себя"><input type="date" required value={date} onInput={e=>setDate(e.currentTarget.value)} onChange={e=>setDate(e.target.value)}/></Field><button className="wb-wide">Запланировать награду</button></form>;
}
function RewardEditor({s,initial,save,remove}:{s:Snapshot;initial:PersonalReward;save:(r:PersonalReward,base:string|null)=>Promise<boolean>;remove?:()=>void}){
 const [base]=useState(()=>s.rewardsData.rewards.some(r=>r.id===initial.id)?JSON.stringify(initial):null);
 const key='satoru.b211.reward:'+s.account+':'+(base?initial.id:'new');
 const [r,setR]=useState<PersonalReward>(()=>{try{const d=JSON.parse(sessionStorage.getItem(key)||'null');return d&&d.base===base?d.reward:initial;}catch{return initial;}}),[error,setError]=useState('');
 const patch=(p:Partial<PersonalReward>)=>{const reward={...r,...p};setR(reward);try{sessionStorage.setItem(key,JSON.stringify({base,reward}));}catch{}};
 return <form onSubmit={async e=>{e.preventDefault();if(await save(r,base))sessionStorage.removeItem(key);}}>
  <Field label="Что тебя порадует"><input autoFocus required maxLength={120} value={r.catalogNameKey&&r.name===initial.name?personalRewardLabel(r,s.rewardsData.catalog):r.name} placeholder="Например, вечер с любимой игрой" onChange={e=>patch({name:e.target.value})}/></Field>
  <Field label="Цена в золоте"><input required type="number" min={1} max={100000} step={1} value={r.cost} onChange={e=>patch({cost:Number(e.target.value)})}/></Field>
  <p className="rw-note">Цену выбираешь ты. Изменение не затронет уже полученные награды.</p>
  <details className="wb-details"><summary>Выбрать значок</summary><div className="rw-icon-picker">{s.rewardsData.catalog.map(x=><button key={x.id} type="button" aria-label={'Иллюстрация: '+x.name} aria-pressed={r.iconId===x.iconId} onClick={()=>patch({iconId:x.iconId,image:undefined})}><Icon id={x.iconId} size={42}/></button>)}</div></details>
  <label className="b24-upload"><span>Своя картинка</span>{r.image&&<RewardArt reward={r} size={100}/>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{patch({image:await readRewardImage(file)});setError('');}catch(err){setError((err as Error).message);}}}/><small>PNG, JPEG или WebP · до 5 МБ</small></label>
  {r.image&&<button type="button" onClick={()=>patch({image:undefined})}>Убрать картинку</button>}{error&&<p role="alert">{error}</p>}
  <button className="wb-primary wb-wide">Сохранить награду</button>{remove&&<button type="button" className="wb-danger wb-wide" onClick={remove}>Удалить из моего списка</button>}
 </form>;
}
