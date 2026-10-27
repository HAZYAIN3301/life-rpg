import {day} from '../components/generated/B2Model';
import {validDate} from '../components/generated/PlanModel';
export type SourceNavigation={view?:string;settingsGroup?:string;calendarDate?:string;calendarMode?:string;goalId?:string;todayTab?:string;entryFocus?:string};
const world:Record<string,string>={den:'home',character:'hero',pets:'pets',tree:'path',stats:'progress'};
const plan:Record<string,string>={calendar:'Календарь',goals:'Цели',habits:'Привычки',shelf:'Вдохновение'};
const decode=(v:string)=>{try{return decodeURIComponent(v);}catch{return '';}};
/** Projects the existing executor's result, never parses or executes B3 again. */
export function initialAppNavigation(hash:string,source:SourceNavigation={}){
 const parts=hash.split('/'),route=parts[0].slice(1),view=source.view||'today';
 return{route:['today','plan','world','rewards','settings','tribe'].includes(route)?route:world[view]?'world':plan[view]?'plan':view==='settings'?'settings':view==='rewards'?'rewards':['party','leaderboard'].includes(view)?'tribe':'today',
  worldMode:route==='world'&&['home','hero','pets','path','progress'].includes(parts[1])?parts[1]:world[view]||'home',
  planMode:route==='plan'?({goals:'Цели',habits:'Привычки',inspiration:'Вдохновение'}as Record<string,string>)[parts[1]]||'Календарь':plan[view]||'Календарь',
  calendarDate:validDate(parts[2]||'')?parts[2]:validDate(source.calendarDate||'')?source.calendarDate!:day(),
  calendarScale:['День','Неделя','Месяц'].includes(decode(parts[1]||''))?decode(parts[1]):({day:'День',week:'Неделя',month:'Месяц'}as Record<string,string>)[source.calendarMode||'']||'Неделя',
  todayMode:route==='today'?(parts[1]==='notes'?'Заметки':parts[1]==='board'?'Доска':'День'):view==='notes'?'Заметки':source.todayTab==='board'?'Доска':'День',
  settingsGroup:route==='settings'?parts[1]||'':source.settingsGroup||'',goalEntry:route==='plan'&&parts[1]==='goals'?decode(parts[2]||''):view==='goals'?source.goalId||'':''};
}
