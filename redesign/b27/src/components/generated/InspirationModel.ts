import Profile from './vendor/inspiration-profile-v1.cjs';
import Importer from './vendor/inspiration-import-v1.cjs';
import Media from './vendor/inspiration-media-v1.cjs';
import Catalog from './vendor/inspiration-catalog-v1.cjs';
import {type Data,day,uid} from './B2Model';
export {Profile,Importer,Media};
export type InspirationItem={id:string;title:string;body:string;format:string;interestIds:string[];sourceUrl?:string;embedUrl?:string;imageUrl?:string;provider?:string;durationLabel?:string;rightsKind:string;rightsUrl?:string;attribution?:string;visual?:string;demo?:boolean};
export type InspirationState={profile:any;saved:string[];externalVisits:{url:string;at:string}[]};
export type InspirationData=Data&{inspirationV2?:InspirationState};
export const interestGroups=[{title:'Делать и создавать',items:[['creative','Творчество'],['design','Дизайн'],['animation','Анимация'],['business','Своё дело'],['product','Продукты'],['video','Видео']]},{title:'Движение и мир',items:[['sport','Спорт'],['running','Бег'],['nature','Природа'],['travel','Путешествия'],['space','Космос']]},{title:'То, что зажигает',items:[['anime','Аниме'],['games','Игры'],['music','Музыка'],['study','Учёба'],['focus','Концентрация'],['philosophy','Философия']]}];
export const formatNames:Record<string,string>={edit:'Эдиты',video:'Видео',image:'Изображения',quote:'Мысли',podcast:'Подкасты'};
export function interestLabel(id:string){return interestGroups.flatMap(g=>g.items).find(x=>x[0]===id)?.[1]||({hiking:'Походы',mountains:'Горы',fitness:'Фитнес',yoga:'Йога',learning:'Обучение',art:'Искусство',reading:'Чтение',science:'Наука',finance:'Финансы',diy:'Своими руками',social:'Общение',home:'Дом',animation:'Анимация',superhero:'Супергерои',minecraft:'Minecraft',audio:'Аудио',calm:'Спокойствие',stoicism:'Стоицизм',future:'Будущее',fantasy:'Фэнтези'} as Record<string,string>)[id]||id;}
// This is an explicitly labelled prototype pool, not an admitted production feed.
// Unchecked external sources and official-source-only rows never silently become recommendations.
const approvedSamples=new Set(['blender-spring','blender-bunny','dvids-run','control-circle','builder-release','study-question']);
export const inspirationCatalog:InspirationItem[]=[...Catalog.items('ru').filter((i:any)=>approvedSamples.has(i.id)).map((i:any)=>({...i,demo:true})),
 {id:'satoru-path',format:'image',title:'Шаг за горизонт',body:'Не обязательно видеть весь путь, чтобы пройти его следующий участок.',interestIds:['travel','nature','focus'],visual:'path',rightsKind:'satoru-original',provider:'Satoru · иллюстрация',demo:true},
 {id:'satoru-orbit',format:'image',title:'Место для большой мысли',body:'Иногда расстояние помогает снова увидеть главное.',interestIds:['space','creative','philosophy'],visual:'orbit',rightsKind:'satoru-original',provider:'Satoru · иллюстрация',demo:true},
 {id:'satoru-motion',format:'image',title:'Ритм начинается с движения',body:'Небольшое движение сегодня тоже имеет значение.',interestIds:['sport','running','focus'],visual:'motion',rightsKind:'satoru-original',provider:'Satoru · иллюстрация',demo:true}
];
export function inspirationState(d:InspirationData):InspirationState{return {profile:Profile.normalize(d.inspirationV2?.profile),saved:d.inspirationV2?.saved||[],externalVisits:d.inspirationV2?.externalVisits||[]};}
export function putProfile(d:InspirationData,profile:any):InspirationData{return {...d,inspirationV2:{...inspirationState(d),profile:Profile.normalize({...profile,discoveryEnabled:false})}};}
export function dailyPool(profile:any,today=day()){
 return inspirationCatalog.filter(i=>!(profile.shownHistory||[]).some((h:any)=>h.id===i.id&&h.day!==today&&h.day>=new Date(new Date(today+'T12:00:00').getTime()-45*86400000).toISOString().slice(0,10)));
}
export function prepareDigest(d:InspirationData,today=day()):InspirationData{
 const p=inspirationState(d).profile;
 const catalog=p.digest?.day===today?inspirationCatalog:dailyPool(p,today);
 const next=Profile.ensureDigest(p,catalog,today);
 return putProfile(d,Profile.recordShown(next.profile,today));
}
export function configureTaste(d:InspirationData,fields:any,today=day()):InspirationData{
 const old=inspirationState(d).profile;
 const p=Profile.configure({...old,...fields,discoveryEnabled:false});
 if(!p.configured)throw Error('Выбери хотя бы один интерес и один формат.');
 // Preference edits affect tomorrow. Today's fixed receipt survives.
 if(old.digest?.day===today)p.digest=old.digest;
 return prepareDigest(putProfile(d,p),today);
}
export function digestItems(d:InspirationData,today=day()):InspirationItem[]{const p=inspirationState(d).profile;return p.digest?.day===today?p.digest.ids.map((id:string)=>inspirationCatalog.find(i=>i.id===id)).filter((i:InspirationItem)=>i&&!Profile.isReference(i,p)):[];}
export function feedback(d:InspirationData,item:InspirationItem,verdict:string,reason='',today=day()){return putProfile(d,Profile.recordFeedback(inspirationState(d).profile,item,verdict,today,reason));}
export function watched(d:InspirationData,id:string){return putProfile(d,Profile.markDone(inspirationState(d).profile,id));}
export function toggleSaved(d:InspirationData,id:string){const s=inspirationState(d);return {...d,inspirationV2:{...s,saved:s.saved.includes(id)?s.saved.filter(x=>x!==id):[id,...s.saved]}};}
export function safeSource(raw:string){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||/[\s\\]/.test(raw))return '';return u.href;}catch{return '';}}
export function embedAllowed(url:string){
 if(!safeSource(url)||Media.externalOnly(url))return false;
 // app.js inspirationEmbedAllowed owns the legacy YouTube/DVIDS boundary.
 // Limit this prototype further to the exact reviewed catalogue URLs.
 return inspirationCatalog.some(i=>i.embedUrl===url)&&!new URL(url).searchParams.has('autoplay')&&['www.youtube-nocookie.com','www.dvidshub.net'].includes(new URL(url).hostname);
}
export function addReference(d:InspirationData,title:string,url:string,why:string){
 const safe=safeSource(url);if(!safe)throw Error('Нужна полная безопасная ссылка https://');
 const p=inspirationState(d).profile;
 const ref=Profile.cleanVideoReference({url:safe,title,why});
 if(!ref)throw Error('Не удалось сохранить этот пример. Проверь ссылку.');
 if(p.videoReferences.some((r:any)=>Profile.referenceKey(r.url)===Profile.referenceKey(ref.url)))throw Error('Эта ссылка уже есть в твоих примерах.');
 if(p.videoReferences.length>=10)throw Error('Можно хранить до 10 примеров вкуса. Удали ненужный перед добавлением.');
 return putProfile(d,{...p,videoReferences:[...p.videoReferences,ref]});
}
export function importTaste(d:InspirationData,result:any,selected:string[],links:string[]){
 const p=inspirationState(d).profile;
 const wanted=(result.interests||[]).filter((i:any)=>selected.includes(i.id)).map((i:any)=>({id:i.id,label:interestLabel(i.id),source:'TikTok import'}));
 let next=putProfile(d,{...p,interests:Profile.uniqueInterests([...p.interests,...wanted]),imports:[...p.imports,{id:uid(),source:'tiktok',importedOn:day(),signals:wanted.length,videos:links.length}],videoReferences:p.videoReferences});
 for(const l of (result.links||[]).filter((r:any)=>links.includes(r.url))){if(inspirationState(next).profile.videoReferences.length>=10)break;try{next=addReference(next,'Из моего TikTok',l.url,'Личный пример из архива');}catch{/* Canonical duplicate: keep the original. */}}
 return next;
}
export function recordExternal(d:InspirationData,url:string){const safe=safeSource(url);if(!safe)throw Error('Ссылка недоступна.');const s=inspirationState(d);return {...d,inspirationV2:{...s,externalVisits:[{url:safe,at:new Date().toISOString()},...s.externalVisits].slice(0,40)}};}
