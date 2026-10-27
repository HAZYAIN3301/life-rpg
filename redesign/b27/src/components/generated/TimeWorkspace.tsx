import {useState} from 'react';
import {day,label,shift,uid,sphere} from './B2Model';
import type {Task} from './B2Model';
import {Icon} from './B2Scene';
import {Field} from './B2Forms';
import {duration} from './PlanModel';
import {elapsedMs,stopFocus} from './DailyModel';
import {clock,preferences,recordedMinutes,saveRule,sessionDay,sessionElapsed} from './TimeModel';
import type {TimeData,AttentionRule} from './TimeModel';

type Props={data:TimeData;commit:(fn:(d:TimeData)=>TimeData)=>boolean;start:(t:Task)=>void;pause:()=>void;finish:(t:Task)=>void;edit:(t:Task)=>void;back:()=>void;settings:()=>void;rewards:()=>void;add:()=>void;initialMode?:string};
export function TimeWorkspace({data,commit,start,pause,finish,edit,back,settings,rewards,add,initialMode='Фокус'}:Props){
  const [mode,setMode]=useState(initialMode),[period,setPeriod]=useState('Сегодня'),[query,setQuery]=useState(''),[rule,setRule]=useState<AttentionRule|null>(null),[deleting,setDeleting]=useState(''),[notice,setNotice]=useState('');
  const today=day(),focus=data.focus,task=data.tasks.find(t=>t.id===focus?.id),target=preferences(data).targetMinutes,elapsed=sessionElapsed(data),reached=elapsed>=target*60000;
  const dates=Array.from({length:period==='Сегодня'?1:7},(_,i)=>shift(today,-i));
  const sessions=(data.focusSessions||[]).filter(s=>dates.includes(sessionDay(s)));
  const tasks=data.tasks.filter(t=>!t.done&&t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>Number(b.date===today)-Number(a.date===today)||Number(b.core)-Number(a.core));
  const recorded=dates.reduce((sum,date)=>sum+recordedMinutes(data,date),0);
  return <section className="ts-workspace" aria-labelledby="time-heading">
    <div className="ts-breadcrumb"><button onClick={back}><Icon id="action.back" size={18}/>Назад</button></div>
    <div className="wb-section-head"><h2 id="time-heading">Время</h2><button aria-label="Настройки фокуса" onClick={settings}><Icon id="nav.settings"/></button></div>
    <nav className="wb-segments" aria-label="Разделы времени">{['Фокус','История','Внимание'].map(v=><button key={v} aria-pressed={v===mode} onClick={()=>{setMode(v);setNotice('');setRule(null);}}>{v}</button>)}</nav>
    {notice&&<p className="ts-notice" role="status">{notice}</p>}
    {mode==='Фокус'&&<>
      {focus&&task?<section className="ts-focus" aria-label="Текущая сессия">
        <div className="ts-focus-state"><span className={'ts-dot '+(focus.running?'running':'')}/>{focus.running?'В фокусе':'На паузе'}<span>{sphere(task.primary[0]).name}</span></div>
        <h3>{task.title}</h3><output className="ts-clock" aria-label="Время текущей сессии">{clock(elapsed)}</output>
        <div className="ts-track" role="progressbar" aria-label="Ориентир сессии" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(target,Math.floor(elapsed/60000))}><span style={{width:Math.min(100,elapsed/(target*600))+'%'}}/></div>
        <p>{reached?'Ориентир достигнут. Можно закончить или продолжить.':`Ориентир — ${duration(target)}. В своём темпе.`}</p>
        <div className="ts-focus-controls"><button className="wb-primary" onClick={pause}><Icon id={focus.running?'media.pause':'media.play'} size={18}/>{focus.running?'Пауза':'Продолжить'}</button><button onClick={()=>{if(commit(d=>stopFocus(d))){setNotice('Время сохранено. Квест можно продолжить позже.');}}}>Сохранить и выйти</button></div>
        <button className="ts-text-action" onClick={()=>finish(task)}><Icon id="action.check" size={18}/>Квест выполнен</button>
        <small>Всего в этом квесте: {duration(Math.round(elapsedMs(focus)/60000))}. Пауза не учитывается.</small>
      </section>:<section className="ts-intro"><h3>Одно дело на ближайшие {target} минут</h3><p>Выбери, чему уделить внимание. Герой и питомец займутся своим делом вместе с тобой.</p><button className="ts-text-action" onClick={settings}>Изменить ориентир</button></section>}
      <div className="ts-section-heading"><h3>{focus?'Продолжить после сессии':'С чего начнём'}</h3><button aria-label="Создать квест для фокуса" onClick={add}><Icon id="action.add" size={18}/>Квест</button></div>
      <label className="ts-search"><Icon id="action.search" size={18}/><input type="search" aria-label="Найти квест для фокуса" placeholder="Найти квест" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="ts-task-list">{tasks.filter(t=>t.id!==focus?.id).map(t=><div key={t.id} className="ts-task"><button className="ts-task-copy" onClick={()=>edit(t)}><strong>{t.title}</strong><span>{t.core?'Главное дело · ':''}{t.date===today?'Сегодня':t.date?label(t.date,true):'Без даты'} · {duration(t.minutes)}</span></button><button aria-label={'Начать фокус: '+t.title} disabled={!!focus} onClick={()=>start(t)}><Icon id="media.play"/></button></div>)}</div>
      {!tasks.filter(t=>t.id!==focus?.id).length&&<div className="ts-empty"><h3>{query?'Квест не найден':'Пока нет других дел'}</h3><p>{query?'Попробуй другие слова.':'Можно добавить квест или выбрать отдых.'}</p>{!query&&<button className="wb-primary" onClick={add}>Добавить квест</button>}</div>}
      {focus&&<small className="ts-help">Останови текущую сессию, чтобы переключиться на другое дело.</small>}
      <button className="ts-recovery" onClick={rewards}><Icon id="reward.coffee" size={34}/><span><strong>Время для себя</strong><small>Выбрать отдых в личных наградах</small></span><Icon id="action.expand" size={18}/></button>
    </>}
    {mode==='История'&&<>
      <div className="ts-section-heading"><h3>Твоё время</h3><div className="ts-period" role="group" aria-label="Период истории">{['Сегодня','7 дней'].map(v=><button key={v} aria-pressed={period===v} onClick={()=>setPeriod(v)}>{v}</button>)}</div></div>
      <div className="ts-summary"><div><strong>{duration(recorded)}</strong><span>учтено в делах</span></div><div><strong>{sessions.length}</strong><span>{sessions.length===1?'сессия фокуса':'сессий фокуса'}</span></div></div>
      <p className="ts-help">В делах — фактическое время по дате квеста. Ниже — отдельные подходы к ним.</p>
      {!sessions.length?<div className="ts-empty"><Icon id="media.play" size={34}/><h3>Здесь появятся твои сессии</h3><p>После остановки таймера сохраним дело, время начала и длительность без пауз.</p><button className="wb-primary" onClick={()=>setMode('Фокус')}>Начать фокус</button></div>:dates.filter(date=>sessions.some(s=>sessionDay(s)===date)).map(date=><section className="ts-session-day" key={date}><h3>{date===today?'Сегодня':label(date,true)}</h3>{sessions.filter(s=>sessionDay(s)===date).map(s=><article className="ts-session" key={s.id}><span className="ts-session-mark"><Icon id="action.check" size={17}/></span><div><strong>{s.title}</strong><small>{new Date(s.startedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} — {new Date(s.endedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</small></div><b>{s.milliseconds<60000?Math.floor(s.milliseconds/1000)+' сек':duration(Math.round(s.milliseconds/60000))}</b></article>)}</section>)}
      {data.tasks.some(t=>dates.includes(t.date)&&t.actual!==null)&&<section className="ts-recorded"><h3>Учтено в квестах</h3>{data.tasks.filter(t=>dates.includes(t.date)&&t.actual!==null).map(t=><button className="ts-setting-row" onClick={()=>edit(t)} key={t.id}><span><strong>{t.title}</strong><small>{t.done?'Завершён':'В работе'} · {t.date===today?'Сегодня':label(t.date,true)}</small></span><b>{duration(t.actual||0)}</b></button>)}</section>}
    </>}
    {mode==='Внимание'&&<>
      <section className="ts-intro"><h3>Между импульсом и действием</h3><p>Выбери, где нужна пауза. Лимит и короткий вопрос или шахматная задача помогут вернуться к своему намерению.</p></section>
      <div className="ts-connection"><Icon id="nav.settings" size={25}/><div><strong>Защита ещё не подключена</strong><p>В этом макете можно настроить правила. Они не блокируют сайты и приложения.</p></div></div>
      <div className="ts-section-heading"><h3>Мои правила</h3><button onClick={()=>{setRule({id:uid(),site:'',minutes:20,gate:'Осознанная пауза'});setDeleting('');}}><Icon id="action.add" size={18}/>Правило</button></div>
      {rule?<RuleEditor key={rule.id} initial={rule} onCancel={()=>setRule(null)} save={r=>{if(commit(d=>saveRule(d,r))){setRule(null);setNotice('Правило сохранено как черновик. Защита пока не подключена.');}}}/>:<>
      {!data.rules.length&&<div className="ts-empty"><h3>Где ты чаще теряешь время?</h3><p>Добавь сайт или приложение и выбери подходящую паузу перед входом.</p><button className="wb-primary" onClick={()=>setRule({id:uid(),site:'',minutes:20,gate:'Осознанная пауза'})}>Добавить первое правило</button></div>}
      {data.rules.map(r=><article className="ts-rule" key={r.id}><div className="ts-rule-top"><strong>{r.site}</strong><span className="ts-badge">Черновик</span></div><p>{duration(r.minutes)} в день · {r.gate}</p>{deleting===r.id?<div className="ts-inline-confirm"><p>Удалить правило для {r.site}?</p><button className="wb-danger" onClick={()=>{if(commit(d=>({...d,rules:d.rules.filter(x=>x.id!==r.id)}))){setDeleting('');setNotice('Правило удалено');}}}>Удалить</button><button onClick={()=>setDeleting('')}>Оставить</button></div>:<div className="ts-rule-actions"><button onClick={()=>setRule(r)}>Изменить</button><button aria-label={'Удалить правило: '+r.site} onClick={()=>setDeleting(r.id)}><Icon id="action.delete" size={18}/></button></div>}</article>)}
      </>}
      <details className="ts-details"><summary>Как это работает на устройствах</summary><p>На iPhone системные разрешения и выбор приложений задаются в Satoru. На компьютере сайты ограничивает расширение браузера. Сохранённый здесь черновик сам по себе ничего не включает.</p></details>
    </>}
  </section>;
}

function RuleEditor({initial,save,onCancel}:{initial:AttentionRule;save:(r:AttentionRule)=>void;onCancel:()=>void}){
  const [r,setR]=useState(initial);
  return <form className="ts-rule-editor" onSubmit={e=>{e.preventDefault();save(r);}}><h3>{initial.site?'Изменить правило':'Новое правило'}</h3><Field label="Сайт или приложение"><input autoFocus required maxLength={120} value={r.site} onChange={e=>setR({...r,site:e.target.value})} placeholder="Например, youtube.com"/></Field><Field label="Время в день, минут"><input type="number" min={1} max={1440} step={1} required value={r.minutes||''} onChange={e=>setR({...r,minutes:Number(e.target.value)})}/></Field><Field label="Пауза перед входом"><select value={r.gate} onChange={e=>setR({...r,gate:e.target.value})}><option>Осознанная пауза</option><option>Шахматная задача</option></select></Field><div className="ts-form-actions"><button className="wb-primary">Сохранить правило</button><button type="button" onClick={onCancel}>Отмена</button></div></form>;
}
