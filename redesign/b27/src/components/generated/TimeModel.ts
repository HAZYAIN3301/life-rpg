import {day,uid} from './B2Model';
import type {Data} from './B2Model';
import {elapsedMs} from './DailyModel';
import type {DailyData} from './DailyModel';

export type FocusSession={id:string;taskId:string;title:string;startedAt:string;endedAt:string;milliseconds:number};
export type TimeData=DailyData & {
  focusSessions?:FocusSession[];
  focusSession?:{id:string;taskId:string;startedAt:string;baseline:number}|null;
  focusPreferences?:{targetMinutes:number};
};
export type AttentionRule=Data['rules'][number];
export function preferences(d:TimeData){return d.focusPreferences||{targetMinutes:25};}
export function saveFocusPreferences(d:TimeData,p:{targetMinutes:number}):TimeData {
  if(!Number.isInteger(p.targetMinutes)||p.targetMinutes<1||p.targetMinutes>240)throw Error('Выбери целое число от 1 до 240 минут.');
  return {...d,focusPreferences:{targetMinutes:p.targetMinutes}};
}
// Observe the shared timer; never start a second timer or change quest rewards.
// Its elapsed time includes older work on the quest. Session baseline excludes it.
export function trackFocus(before:TimeData,next:TimeData,now=Date.now()):TimeData {
  const old=before.focus,current=next.focus;
  let sessions=before.focusSessions||[],session=before.focusSession||null;
  if(old&&(!current||old.id!==current.id)){
    if(session?.taskId===old.id){
      const milliseconds=Math.max(0,elapsedMs(old,now)-session.baseline);
      if(milliseconds>0&&!sessions.some(s=>s.id===session!.id))sessions=[{
        id:session.id,taskId:old.id,title:before.tasks.find(t=>t.id===old.id)?.title||'Квест',
        startedAt:session.startedAt,endedAt:new Date(now).toISOString(),milliseconds
      },...sessions];
    }
    session=null;
  }
  if(current&&(!old||old.id!==current.id))session={id:uid(),taskId:current.id,startedAt:new Date(now).toISOString(),baseline:current.elapsed};
  return {...next,focusSessions:sessions,focusSession:session};
}
export function sessionElapsed(d:TimeData,now=Date.now()){
  if(!d.focus)return 0;
  return Math.max(0,elapsedMs(d.focus,now)-(d.focusSession?.taskId===d.focus.id?d.focusSession.baseline:0));
}
export function recordedMinutes(d:Data,date:string){
  return d.tasks.filter(t=>t.date===date).reduce((sum,t)=>sum+(typeof t.actual==='number'&&Number.isFinite(t.actual)?Math.max(0,t.actual):0),0);
}
export function sessionDay(s:FocusSession){return day(new Date(s.endedAt));}
export function clock(ms:number){
  const seconds=Math.max(0,Math.floor(ms/1000));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
export function saveRule(d:TimeData,rule:AttentionRule):TimeData {
  const site=rule.site.trim();
  if(!site||site.length>120)throw Error('Укажи сайт или приложение: от 1 до 120 символов.');
  if(!Number.isInteger(rule.minutes)||rule.minutes<1||rule.minutes>1440)throw Error('Лимит — целое число от 1 до 1440 минут.');
  if(!['Осознанная пауза','Шахматная задача'].includes(rule.gate))throw Error('Выбери способ остановиться перед входом.');
  if(d.rules.some(r=>r.id!==rule.id&&r.site.trim().toLocaleLowerCase()===site.toLocaleLowerCase()))throw Error('Правило для этого сайта или приложения уже есть. Открой его для изменения.');
  const normalized={...rule,site};
  return {...d,rules:d.rules.some(r=>r.id===rule.id)?d.rules.map(r=>r.id===rule.id?normalized:r):[...d.rules,normalized]};
}
export const settingsGroups=[
  {id:'appearance',title:'Оформление и звук',description:'Палитра, движение, отклик',icon:'nav.lair',words:'цвет тема анимация движение звук уменьшить'},
  {id:'focus',title:'Фокус и внимание',description:'Длина сессии, пауза перед отвлечением',icon:'media.play',words:'таймер время минуты перерыв пауза лимит блокировка сайты приложения шахматы'},
  {id:'shadow',title:'Тень и подключения',description:'Помощник, сервисы, локальная модель',icon:'nav.shadow',words:'ии ai искусственный интеллект ollama senku strava интеграции голос'},
  {id:'account',title:'Аккаунт и устройства',description:'Вход, синхронизация, разрешения',icon:'nav.hero',words:'профиль почта email пароль язык уведомления iphone телефон'},
  {id:'data',title:'Данные и приватность',description:'Хранение и резервная копия',icon:'media.notes',words:'экспорт скачать json резервная история синхронизация безопасность удалить'},
] as const;
export type SettingsGroup=typeof settingsGroups[number]['id'];
export function searchSettings(query:string){
  const words=query.toLocaleLowerCase().trim().split(/\s+/);
  return settingsGroups.filter(g=>words.every(w=>(g.title+' '+g.description+' '+g.words).toLocaleLowerCase().includes(w)));
}
