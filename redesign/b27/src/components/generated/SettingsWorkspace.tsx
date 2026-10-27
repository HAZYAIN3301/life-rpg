import {useEffect,useState} from 'react';
import {Icon,Portrait} from './B2Scene';
import {Field} from './B2Forms';
import {KEY} from './B2Model';
import {preferences,saveFocusPreferences,searchSettings,settingsGroups} from './TimeModel';
import type {SettingsGroup,TimeData} from './TimeModel';

type Props={data:TimeData;commit:(fn:(d:TimeData)=>TimeData)=>boolean;back:()=>void;time:(mode?:string)=>void;shadow:()=>void;initialGroup?:SettingsGroup|null};
const palettes=[['ink','Чернила'],['forest','Лес'],['stone','Тёплый камень']];
export function SettingsWorkspace({data,commit,back,time,shadow,initialGroup=null}:Props){
  const [group,setGroup]=useState<SettingsGroup|null>(initialGroup),[query,setQuery]=useState(''),[notice,setNotice]=useState('');
  const active=settingsGroups.find(g=>g.id===group);
  useEffect(()=>{setGroup(initialGroup);},[initialGroup]);
  function choose(id:SettingsGroup|null){setGroup(id);setNotice('');requestAnimationFrame(()=>document.querySelector('.ts-settings')?.closest('.wb-scroll')?.scrollTo({top:0}));}
  function change(fn:(d:TimeData)=>TimeData){const saved=commit(fn);if(saved)setNotice('Настройки сохранены на этом устройстве');return saved;}
  function download(){
    try{
      const raw=localStorage.getItem(KEY)||JSON.stringify(data,null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download='satoru-b27-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Копия подготовлена. Медиафайлы хранятся отдельно и не входят в JSON.');
    }catch{setNotice('Не удалось подготовить копию. Проверь разрешение на скачивание и повтори.');}
  }
  return <section className="ts-workspace ts-settings" aria-labelledby="settings-heading">
    <div className="ts-breadcrumb"><button onClick={()=>group?choose(null):back()}><Icon id="action.back" size={18}/>{group?'Все настройки':'Назад'}</button></div>
    <div className="wb-section-head"><h2 id="settings-heading">{active?.title||'Настройки'}</h2></div>
    {notice&&<p className="ts-notice" role="status">{notice}</p>}
    {!group&&<>
      <label className="ts-search"><Icon id="action.search" size={18}/><input aria-label="Поиск настроек" type="search" value={query} placeholder="Что хочешь настроить?" onChange={e=>setQuery(e.target.value)}/></label>
      <div className="ts-settings-list">{searchSettings(query).map(g=><button className="ts-setting-row" onClick={()=>choose(g.id)} key={g.id}><Icon id={g.icon} size={27}/><span><strong>{g.title}</strong><small>{g.description}</small></span><Icon id="action.expand" size={18}/></button>)}</div>
      {!searchSettings(query).length&&<div className="ts-empty"><h3>Такой настройки не найдено</h3><p>Попробуй «звук», «время» или «данные».</p><button onClick={()=>setQuery('')}>Показать все настройки</button></div>}
      <div className="ts-local"><span className="ts-dot"/><span>Локальный просмотр · без входа в аккаунт</span></div>
      <p className="ts-help">Оформление, фокус и черновики сохраняются здесь. Аккаунт, системные разрешения и сервисы пока не подключены.</p>
    </>}
    {group==='appearance'&&<>
      <section className="ts-setting-section"><h3>Палитра Satoru</h3><p className="ts-help">Та же композиция, другой оттенок.</p><div className="ts-palettes">{palettes.map(([id,name])=><button key={id} aria-pressed={data.palette===id} onClick={()=>change(d=>({...d,palette:id}))}><span className={'ts-palette '+id}><i/><i/><i/>{data.palette===id&&<b><Icon id="action.check" size={16}/></b>}</span><strong>{name}</strong></button>)}</div></section>
      <section className="ts-setting-section"><h3>Отклик</h3><Toggle title="Звук действий" text="Короткий отклик после выполненного дела" value={data.sound} change={()=>change(d=>({...d,sound:!d.sound}))}/><Toggle title="Движение в Логове" text="Жесты героя, питомца и Тени" value={data.motion} change={()=>change(d=>({...d,motion:!d.motion}))}/><p className="ts-help">Если в системе включено уменьшение движения, оно имеет приоритет.</p></section>
    </>}
    {group==='focus'&&<>
      <FocusPreferences data={data} save={p=>change(d=>saveFocusPreferences(d,p))}/>
      <section className="ts-setting-section"><h3>Вернуться к делу</h3><button className="ts-setting-row" onClick={()=>time()}><Icon id="system.focus" size={25}/><span><strong>Время и фокус</strong><small>Текущая сессия, дела и история</small></span><Icon id="action.expand" size={18}/></button><button className="ts-setting-row" onClick={()=>time('Внимание')}><Icon id="system.day-end" size={25}/><span><strong>Границы внимания</strong><small>{data.rules.length?`Черновики правил: ${data.rules.length}`:'Сайты, приложения и пауза перед входом'}</small></span><Icon id="action.expand" size={18}/></button></section>
      <p className="ts-help">Остановка таймера сохраняет время. Выполнение квеста — отдельное действие. За сам ход таймера золото не начисляется.</p>
    </>}
    {group==='shadow'&&<>
      <div className="ts-shadow-intro"><Portrait/><div><h3>Тень всегда рядом</h3><p>В Логове или в перемещаемом кружке на других экранах.</p></div></div><button className="wb-primary" onClick={shadow}>Открыть Тень</button>
      <section className="ts-setting-section"><h3>Подключения</h3>{[['Помощник ИИ','Облачная или локальная модель'],['Локальная модель','Ollama на своём компьютере'],['Senku','Учёба и карточки'],['Strava','Тренировки и активность']].map(([title,desc])=><div className="ts-connection-row" key={title}><span><strong>{title}</strong><small>{desc}</small></span><span className="ts-badge">Не подключено</span></div>)}<p className="ts-help">Для подключения сервисов нужен вход в основной Satoru. В локальном макете ключи и пароли не запрашиваются.</p></section>
    </>}
    {group==='account'&&<>
      <div className="ts-empty"><Icon id="nav.hero" size={42}/><h3>Сейчас без аккаунта</h3><p>Ты просматриваешь новую структуру приложения. Изменения в этом макете не попадают в основной аккаунт.</p></div>
      <section className="ts-setting-section"><h3>После подключения аккаунта</h3>{[['Профиль и язык','Личные данные и язык приложения'],['Устройства и синхронизация','Сохранение и доступ на других устройствах'],['Уведомления','Напоминания о делах и итогах дня'],['Разрешения iPhone','Микрофон и системная защита внимания']].map(([title,desc])=><div className="ts-connection-row" key={title}><span><strong>{title}</strong><small>{desc}</small></span><Icon id="action.link" size={18}/></div>)}<p className="ts-help">Эти функции остаются в приложении. Их перенос проверяется отдельно от дизайна; доступ и настройки телефона здесь не меняются.</p></section>
    </>}
    {group==='data'&&<>
      <section className="ts-setting-section"><h3>Твои данные на этом устройстве</h3><dl className="ts-data-list"><div><dt>Квесты</dt><dd>{data.tasks.length}</dd></div><div><dt>Заметки</dt><dd>{data.notes.length}</dd></div><div><dt>Цели</dt><dd>{data.goals.length}</dd></div><div><dt>Сессии фокуса</dt><dd>{data.focusSessions?.length||0}</dd></div></dl><p>Данные макета хранятся в этом браузере. Очистка данных сайта может удалить их.</p><button className="wb-primary" onClick={download}><Icon id="action.export" size={20}/>Скачать резервную копию</button><p className="ts-help">JSON содержит записи и настройки. Голосовые и другие вложения в эту копию не входят.</p></section>
      <details className="ts-details"><summary>Что передаётся в другие сервисы</summary><p>Записи этого макета не отправляются в аккаунт или ИИ. Внешние видео загружаются только при открытии материала. Часть иллюстраций пока загружается с сервера изображений.</p></details>
      <details className="ts-details"><summary>Как удалить данные макета</summary><p>Сначала сохрани резервную копию. Затем можно удалить данные этого сайта в настройках браузера. Это не удаляет основной аккаунт Satoru.</p></details>
    </>}
  </section>;
}
function Toggle({title,text,value,change}:{title:string;text:string;value:boolean;change:()=>void}){
  return <button className="ts-setting-row ts-toggle-row" role="switch" aria-checked={value} aria-label={title} onClick={change}><span><strong>{title}</strong><small>{text}</small></span><span className={'ts-switch '+(value?'on':'')} aria-hidden="true"><i/></span></button>;
}
function FocusPreferences({data,save}:{data:TimeData;save:(p:{targetMinutes:number})=>boolean}){
  const [minutes,setMinutes]=useState(String(preferences(data).targetMinutes));
  return <form onSubmit={e=>{e.preventDefault();save({targetMinutes:Number(minutes)});}} className="ts-setting-section"><h3>Ориентир на одну сессию</h3><p>Таймер считает фактическое время. Ориентир помогает выбрать длину подхода и не останавливает тебя автоматически.</p><div className="ts-presets" role="group" aria-label="Длина сессии">{[25,50,90].map(n=><button type="button" aria-pressed={Number(minutes)===n} key={n} onClick={()=>setMinutes(String(n))}>{n} мин</button>)}</div><Field label="Свой ориентир, минут"><input type="number" min={1} max={240} step={1} required value={minutes} onChange={e=>setMinutes(e.target.value)}/></Field><button className="wb-primary">Сохранить ориентир</button></form>;
}
