'use strict';
const crypto=require('node:crypto'),M=require('./public/inspiration-licensed-media-v1.js');
// No private labels, references or arbitrary client text leave for the provider.
const TOPICS=Object.freeze({nature:'nature landscape',mountains:'mountain landscape',travel:'travel landscape',hiking:'hiking trail',sport:'sports training',fitness:'fitness training',movement:'outdoor exercise',running:'running outdoors',yoga:'yoga practice',rest:'calm nature',recovery:'calm nature',health:'healthy lifestyle',design:'design studio',art:'art studio',creative:'creative studio',music:'musical instruments',science:'science laboratory',technology:'technology',learning:'learning books',study:'studying',reading:'reading books',business:'creative business',product:'product design',diy:'craft workshop',home:'interior design',social:'friends outdoors',focus:'focused work'});
const maps=s=>Object.fromEntries(['ru','en','de','uk','es'].map(c=>[c,s]));
function common(row,topic,format,at){
 const author=format==='image'?row.photographer:row.user?.name;
 return {id:`pexels-${format==='image'?'photo':'video'}-${row.id}`,source:'pexels',externalId:String(row.id),format,lang:'none',interestIds:[topic],
  title:maps(String(row.alt||TOPICS[topic]||topic).trim()),body:format==='video'?{ru:'Короткое видео без звука · Pexels',en:'A short silent video · Pexels',de:'Ein kurzes Video ohne Ton · Pexels',uk:'Коротке відео без звуку · Pexels',es:'Un vídeo corto sin sonido · Pexels'}:maps('Pexels'),
  imageUrl:format==='image'?row.src?.large:row.image,durationSec:format==='video'?row.duration:null,mediaType:format,
  rights:{kind:'licensed-direct',holder:String(author||'').trim()+' · Pexels',url:M.LICENSE,embedAllowed:false,downloadAllowed:true},delivery:{policy:'stream',sourceUrl:row.url},lastCheckedAt:at,available:'unknown',checkMethod:'metadata',availabilityReason:'not_checked'};
}
function photoCandidate(row,topic,at){if(!row?.photographer)return null;return M.normalize(common(row,topic,'image',at));}
function videoCandidate(row,topic,at){
 if(!row?.user?.name)return null;
 const files=(row.video_files||[]).filter(f=>f.file_type==='video/mp4'&&Number(f.width)>0&&Number(f.height)>0&&Math.max(f.width,f.height)<=1920&&M.safeUrl(f.link,'video'));
 files.sort((a,b)=>Math.abs(Math.max(a.width,a.height)-1280)-Math.abs(Math.max(b.width,b.height)-1280));
 if(!files.length)return null;const item=common(row,topic,'video',at);item.delivery.videoUrl=files[0].link;return M.normalize(item);
}
function createProvider({apiKey,request,now=()=>new Date()}){
 let retryAt=0;
 return {configured:!!apiKey,async fetchPage({topic,format,page}){
  if(!TOPICS[topic]||!['image','video'].includes(format)||!Number.isInteger(page)||page<1||page>1000)throw Error('unsupported_topic');
  if(!apiKey)throw Error('provider_unconfigured');if(Date.now()<retryAt)throw Error('provider_backoff');
  const url=new URL(format==='image'?'https://api.pexels.com/v1/search':'https://api.pexels.com/v1/videos/search');
  url.searchParams.set('query',TOPICS[topic]);url.searchParams.set('page',page);url.searchParams.set('per_page','40');
  let result;try{result=await request({url:url.href,headers:{Authorization:apiKey,Accept:'application/json'},maxBytes:1024*1024});}catch{retryAt=Date.now()+60000;throw Error('provider_unavailable');}
  if(result.status!==200){retryAt=Date.now()+60000;throw Error(result.status===429?'provider_rate_limited':result.status===401||result.status===403?'provider_auth':'provider_unavailable');}
  const rows=result.json?.[format==='image'?'photos':'videos'];if(!Array.isArray(rows))throw Error('provider_invalid_response');
  const at=now().toISOString();return {items:rows.slice(0,40).map(r=>(format==='image'?photoCandidate:videoCandidate)(r,topic,at)).filter(Boolean),hasMore:!!result.json.next_page};
 }};
}
function createSigner(secret){
 const mac=item=>crypto.createHmac('sha256',secret()).update('inspiration-licensed-v1\n'+JSON.stringify(item)).digest('hex');
 return {sign(raw){const item=M.normalize(raw);if(!item)throw Error('invalid_media');return {...item,supplyProof:mac(item)};},verify(raw){
  const item=M.normalize(raw),proof=raw?.supplyProof;if(!item||typeof proof!=='string'||!/^[a-f0-9]{64}$/.test(proof))return false;
  return crypto.timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(mac(item),'hex'));
 }};
}
module.exports={TOPICS,createProvider,photoCandidate,videoCandidate,createSigner};
