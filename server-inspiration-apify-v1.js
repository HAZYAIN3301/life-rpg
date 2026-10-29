'use strict';
const crypto=require('node:crypto'),E=require('./public/inspiration-edit-media-v1.js'),Media=require('./public/inspiration-media-v1.js');
// Public product vocabulary only. Never send profile text, refs, history or account IDs.
const TOPICS=Object.freeze({
 anime:['anime motivation edit',/anime|manga|naruto|gojo|jujutsu|jjk|berserk|guts|onepiece|one piece|aot|eren|аниме/i],
 superhero:['superhero motivation edit',/superhero|spider|marvel|batman|superman|супергер|человек.?паук/i],
 minecraft:['minecraft cinematic edit',/minecraft|майнкрафт/i],games:['gaming motivation edit',/gaming|videogame|game edit|elden.?ring|dark.?souls|minecraft|игр/i],
 sport:['sports motivation edit',/sport|athlet|football|basketball|boxing|спорт/i],fitness:['gym motivation edit',/gym|fitness|workout|bodybuild|тренир/i],
 running:['running motivation edit',/running|runner|marathon|бег/i],movement:['sports movement edit',/sport|athlet|running|movement|движ/i],yoga:['yoga cinematic edit',/yoga|йога/i],
 nature:['nature cinematic edit',/nature|forest|landscape|ocean|природ|лес/i],mountains:['mountain cinematic edit',/mountain|alps|himalaya|гор[ыа]/i],
 travel:['travel cinematic edit',/travel|adventure|journey|путеше/i],hiking:['hiking cinematic edit',/hik[ei]|trail|trekk|поход/i],
 space:['space cinematic edit',/space|cosmos|cosmic|universe|galax|космос/i],science:['science motivation edit',/science|scientist|laborator|наук/i],
 technology:['technology cinematic edit',/technolog|robot|programming|coding|engineer|технолог/i],
 learning:['study motivation edit',/study|studying|learning|student|уч[её]б/i],study:['study motivation edit',/study|studying|student|уч[её]б/i],
 reading:['reading cinematic edit',/reading|book|library|книг/i],philosophy:['stoic motivation edit',/stoic|philosoph|aurelius|stoicism|философ/i],
 design:['design process edit',/design|дизайн/i],art:['art cinematic edit',/artist|artwork|painting|drawing|искусств/i],creative:['creative process edit',/creativ|artist|artwork|drawing|творч/i],
 animation:['animation cinematic edit',/animation|animator|blender|анимац/i],music:['music cinematic edit',/music|musician|piano|guitar|музык/i],
 video:['filmmaking cinematic edit',/filmmak|cinemat|editing|монтаж/i],content:['filmmaking motivation edit',/filmmak|creator|content|editing/i],
 business:['entrepreneur motivation edit',/entrepreneur|business|startup|бизнес/i],product:['startup motivation edit',/startup|product|founder|стартап/i],
 diy:['craft process edit',/craft|woodwork|diy|handmade/i],home:['home cinematic edit',/interior|home|house|дома|интерьер/i],
 social:['friendship cinematic edit',/friend|friendship|together|друз/i],focus:['discipline motivation edit',/discipline|focus|motivation|дисциплин/i],
 rest:['calm nature edit',/calm|nature|peace|relax|спокой/i],recovery:['recovery motivation edit',/recover|rest|healing|восстанов/i],health:['healthy life motivation edit',/health|healthy|wellbeing|здоров/i]
});
const maps=s=>Object.fromEntries(['ru','en','de','uk','es'].map(l=>[l,s]));
function fromPost(row,topics,at){
 const source=Media.parseSource(row?.webVideoUrl),caption=String(row?.text||'').slice(0,4000),tags=[...new Set([...(Array.isArray(row?.hashtags)?row.hashtags:[]).map(t=>typeof t==='string'?t:t?.name),...(caption.match(/#[\p{L}\p{N}_]+/gu)||[]).map(t=>t.slice(1))].filter(t=>typeof t==='string'))].slice(0,32),hay=[caption,...tags].join(' ');
 if(!source||source.provider!=='tiktok'||String(row.id)!==source.id||row.isSlideshow||row.isAd||row.isSponsored||row.authorMeta?.name&&row.authorMeta.name.toLowerCase()!==source.authorHandle.toLowerCase())return null;
 if(!/(?:edit|amv|cinematic|motivat|inspir|эдит|мотивац)/i.test(hay)||/thinspo|proana|self.?harm|suicide.?challenge|casino|guaranteed.?profit|free.?crypto/i.test(hay))return null;
 const interests=[...new Set(topics)].filter(t=>TOPICS[t]?.[1].test(hay));if(!interests.length)return null;
 const published=row.createTimeISO||(Number.isFinite(row.createTime)?new Date(row.createTime*1000).toISOString():'');
 if(!Number.isFinite(Date.parse(published))||Date.parse(published)>Date.parse(at)+86400000)return null;
 return E.normalize({id:'edit-tiktok-'+source.id,externalId:source.id,source:'tiktok',format:'edit',personalRecommendation:true,
  interestIds:interests,title:maps(caption.replace(/#[\p{L}\p{N}_]+/gu,'').replace(/\s+/g,' ').trim().slice(0,140)||'@'+source.authorHandle),body:maps(caption.slice(0,800)),tags,durationSec:row.videoMeta?.duration,
  publishedAt:new Date(published).toISOString(),lastCheckedAt:at,rights:{kind:'linked-public',downloadAllowed:false},
  delivery:{policy:'embed',sourceUrl:source.url,embedUrl:Media.buildEmbed(source)},discovery:{provider:'apify'}},{unsigned:true});
}
function createSigner(secret){
 const mac=(row,uid)=>crypto.createHmac('sha256',secret()).update('inspiration-private-edit-v1\n'+uid+'\n'+JSON.stringify(row)).digest('hex');
 return {sign(raw,uid){const c=E.normalize(raw,{unsigned:true});if(!c||!uid)throw Error('invalid_edit');return {...c,supplyProof:mac(c,uid)};},verify(raw,uid){const c=E.normalize(raw,{unsigned:true});return !!(c&&uid&&/^[a-f0-9]{64}$/.test(raw.supplyProof||'')&&crypto.timingSafeEqual(Buffer.from(raw.supplyProof,'hex'),Buffer.from(mac(c,uid),'hex')));}};
}
async function requestJson({url,method='GET',headers,body}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  if(new URL(url).origin!=='https://api.apify.com')throw Error('invalid_provider_host');
  const r=await fetch(url,{method,headers,redirect:'error',signal:controller.signal,...(body?{body:JSON.stringify(body)}:{})});
  if(!r.body)throw Error('provider_unreadable');const reader=r.body.getReader(),chunks=[];let size=0;
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024*1024){await reader.cancel();throw Error('provider_oversize');}chunks.push(Buffer.from(part.value));}
  let json;try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('provider_json');}return {status:r.status,json};
 }finally{clearTimeout(timer);}
}
function createInventory({apiKey,read,write,request=requestJson,now=()=>new Date(),monthlyUsd=4.5,dailyUsd=0.2}){
 const reserve=0.1,id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(value);
 monthlyUsd=Math.min(4.5,Math.max(0,Number(monthlyUsd)||0));dailyUsd=Math.min(0.2,Math.max(0,Number(dailyUsd)||0));
 let queue=Promise.resolve();
 const save=async s=>{if((await write(s))?.ok!==true)throw Error('apify_save_unconfirmed');};
 const call=async(path,method='GET',body)=>{
  const response=await request({url:'https://api.apify.com/v2/'+path,method,headers:{Authorization:'Bearer '+apiKey,Accept:'application/json','Content-Type':'application/json'},...(body?{body}:{})});
  if(response.status<200||response.status>=300)throw Error('apify_request_failed');return response.json;
 };
 async function refresh(input){
  const topics=[...new Set((Array.isArray(input)?input:[]).filter(t=>Object.hasOwn(TOPICS,t)))].sort().slice(0,3);
  if(!apiKey)return {status:'unconfigured',items:[]};if(!topics.length)return {status:'unsupported',items:[]};
  const at=now().toISOString(),day=at.slice(0,10),month=day.slice(0,7),key=topics.join('+');
  const state=(await read())??{version:1,runs:[],items:[]};
  if(state.version!==1||!Array.isArray(state.runs)||state.runs.length>200||!Array.isArray(state.items)||state.items.length>600||state.runs.some(r=>!r||typeof r.key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||r.reservedUsd!==reserve||!['starting','running','done','failed','uncertain'].includes(r.state)||!Array.isArray(r.topics)||r.topics.some(t=>!Object.hasOwn(TOPICS,t))||r.state==='running'&&!id(r.runId)))throw Error('apify_corrupt_state');
  // Completed run metadata is normalized before it becomes inventory. A failed
  // GET/dataset read retains its run ID and can be resumed without another POST.
  for(const run of state.runs.filter(r=>r.state==='running'&&r.topics.some(t=>topics.includes(t)))){
   try{
    const result=(await call('actor-runs/'+run.runId)).data;
    if(!result||result.id!==run.runId||typeof result.status!=='string')throw Error('invalid_run');
    if(['FAILED','ABORTED','TIMED-OUT','TIMED_OUT'].includes(result.status)){run.state='failed';await save(state);continue;}
    if(result.status!=='SUCCEEDED')continue;
    if(!id(result.defaultDatasetId))throw Error('invalid_dataset');
    const fields='id,text,webVideoUrl,authorMeta,videoMeta,createTimeISO,createTime,hashtags,isSlideshow,isAd,isSponsored';
    const rows=await call('datasets/'+result.defaultDatasetId+'/items?clean=true&limit=12&fields='+encodeURIComponent(fields));
    if(!Array.isArray(rows)||rows.length>12)throw Error('invalid_dataset_rows');
    const normalized=rows.map(r=>fromPost(r,run.topics,at)).filter(Boolean),byId=new Map(state.items.map(r=>[r.id,r]));
    for(const row of normalized)byId.set(row.id,row);
    state.items=[...byId.values()].filter(r=>E.normalize(r,{unsigned:true})&&Date.parse(at)-Date.parse(r.lastCheckedAt)<=30*86400000).sort((a,b)=>b.lastCheckedAt.localeCompare(a.lastCheckedAt)).slice(0,600);
    run.state='done';run.completedAt=at;run.accepted=normalized.length;
    if(Number.isFinite(result.usageTotalUsd))run.actualUsd=result.usageTotalUsd;
    await save(state);
   }catch{ return {status:'provider_error',items:state.items.filter(r=>r.interestIds.some(t=>topics.includes(t)))}; }
  }
  const items=()=>state.items.filter(r=>r.interestIds.some(t=>topics.includes(t))&&Date.parse(at)-Date.parse(r.lastCheckedAt)<=30*86400000);
  const existing=state.runs.find(r=>r.key===key&&(r.day===day||r.state==='running'));
  if(existing)return {status:['starting','uncertain','failed'].includes(existing.state)?'provider_error':existing.state==='running'?'pending':items().length?'ready':'empty',items:items()};
  const spent=period=>state.runs.filter(r=>r.day.startsWith(period)).reduce((n,r)=>n+r.reservedUsd,0);
  if(spent(day)+reserve>dailyUsd+1e-8||spent(month)+reserve>monthlyUsd+1e-8)return {status:'budget_limited',items:items()};
  // Reserve durably BEFORE sending a non-idempotent start. On an uncertain
  // outcome keep the reservation and never retry this topic/day blindly.
  const run={key,topics,day,reservedUsd:reserve,state:'starting',startedAt:at};state.runs.push(run);
  state.runs=state.runs.filter(r=>r.day.slice(0,7)===month||r.state==='running').slice(-200);await save(state);
  const params=new URLSearchParams({timeout:'180',maxTotalChargeUsd:'0.1',restartOnError:'false',waitForFinish:'0',forcePermissionLevel:'LIMITED_PERMISSIONS'});
  try{
   const result=(await call('acts/clockworks~free-tiktok-scraper/runs?'+params,'POST',{
    searchQueries:topics.map(t=>TOPICS[t][0]),searchSection:'/video',videoSearchSorting:'LATEST',resultsPerPage:Math.max(1,Math.floor(12/topics.length)),
    shouldDownloadVideos:false,shouldDownloadCovers:false,shouldDownloadSlideshowImages:false,shouldDownloadAvatars:false,shouldDownloadMusicCovers:false,
    downloadSubtitlesOptions:'NEVER_DOWNLOAD_SUBTITLES',maxFollowersPerProfile:0,maxFollowingPerProfile:0,commentsPerPost:0,
    scrapeRelatedSearchWords:false,scrapeRelatedVideos:false,scrapeAdditionalAuthorMeta:false
   })).data;
   if(!result||!id(result.id))throw Error('invalid_start_receipt');run.runId=result.id;run.state='running';await save(state);
   return {status:'pending',items:items()};
  }catch{run.state=run.runId?'running':'uncertain';await save(state);return {status:'provider_error',items:items()};}
 }
 return Object.freeze({configured:!!apiKey,get(topics){const result=queue.then(()=>refresh(topics));queue=result.catch(()=>{});return result;}});
}
module.exports={TOPICS,fromPost,createSigner,createInventory,requestJson};
