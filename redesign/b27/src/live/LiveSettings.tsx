import {useState} from 'react';
import {Icon} from '../components/generated/B2Scene';
import {OwnedSurface} from './OwnedSurface';
import type {Snapshot} from './model';
import '../components/generated/TimeSettings.css';
export const settingsSections=[
 {id:'life',title:'Сферы, навыки и планирование',description:'Вложенность сфер, цвета, ритм, фокус и стартовый уровень',icon:'nav.skills',words:'сферы навыки подсферы уровни обучение skill sphere focus'},
 {id:'experience',title:'Язык и оформление',description:'Язык, светлая и тёмная тема, акцент, звук и движение',icon:'nav.settings',words:'язык language тема theme accent цвет звук sound'},
 {id:'connections',title:'Тень и подключения',description:'ИИ, локальная модель, память, Senku, Strava и другие сервисы',icon:'nav.shadow',words:'ии ai ключи ollama senku strava интеграции connections'},
 {id:'account',title:'Профиль и безопасность',description:'Профиль, пароль, PIN, устройства и подписка',icon:'nav.hero',words:'пароль password passwort pin почта email аккаунт устройства вход'},
 {id:'progression',title:'Игровые правила',description:'Опыт, золото, уровни и сложность',icon:'nav.progress',words:'xp опыт gold золото награды экономика'},
 {id:'data',title:'Данные и приватность',description:'Резервная копия, импорт, восстановление и диагностика',icon:'action.export',words:'экспорт export импорт import backup приватность privacy'},
];
export function LiveSettings({s,group,choose,back}:{s:Snapshot;group:string;choose:(g:string)=>void;back:()=>void}){
 const [query,setQuery]=useState('');const active=settingsSections.find(x=>x.id===group);
 const list=settingsSections.filter(x=>[x.title,x.description,x.words].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
 return <section className="ts-workspace ts-settings"><div className="ts-breadcrumb"><button onClick={()=>active?choose(''):back()}><Icon id="action.back" size={18}/>{active?'Все настройки':'Назад'}</button></div><div className="wb-section-head"><h2>{active?.title||'Настройки'}</h2></div>
 {active?<><p className="ts-help">{active.description}</p>{group==='experience'&&<button className="ts-setting-row ts-toggle-row" role="switch" aria-label="Движение в Логове" aria-checked={s.preferences.motion} onClick={()=>void window.SatoruPlanBridge.preference('set-motion',s.preferences.motion?'0':'1')}><span><strong>Движение в Логове</strong><small>Жесты героя, питомца и Тени. Уменьшение движения в системе имеет приоритет.</small></span><span className={'ts-switch '+(s.preferences.motion?'on':'')} aria-hidden="true"><i/></span></button>}<OwnedSurface s={s} kind="settings" group={group}/></>:<><label className="ts-search"><Icon id="action.search" size={18}/><input type="search" aria-label="Поиск настроек" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Сферы, пароль, язык, подключения…"/></label><div className="ts-settings-list">{list.map(x=><button className="ts-setting-row" key={x.id} onClick={()=>choose(x.id)}><Icon id={x.icon} size={27}/><span><strong>{x.title}</strong><small>{x.description}</small></span><Icon id="action.expand" size={18}/></button>)}</div>{!list.length&&<div className="ts-empty"><h3>Ничего не найдено</h3><button onClick={()=>setQuery('')}>Показать все настройки</button></div>}<p className="ts-help">Настройки твоего аккаунта. Сферы связаны с квестами, целями, привычками и прогрессом.</p></>}
 </section>;
}
