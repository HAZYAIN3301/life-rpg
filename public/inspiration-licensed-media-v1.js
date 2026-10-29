/* Direct licensed media: URL/schema validation, never a playback claim. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.InspirationLicensedMediaV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LICENSE='https://www.pexels.com/license/';
 function safeUrl(value,kind){
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return '';
   const valid=kind==='image'?u.hostname==='images.pexels.com'&&/^\/(?:photos|videos)\/\d+\/[\w.-]+\.(?:jpe?g|png|webp)$/i.test(u.pathname)
    :kind==='video'?u.hostname==='videos.pexels.com'&&/^\/video-files\/\d+\/[\w.-]+\.mp4$/i.test(u.pathname)
     :u.hostname==='www.pexels.com'&&/^\/(?:photo|video)\/[a-z0-9-]+-\d+\/$/i.test(u.pathname);
   return valid?u.href:'';
  }catch{return '';}
 }
 function normalize(raw){
  if(!raw||raw.source!=='pexels'||!['image','video'].includes(raw.format)||raw.delivery?.policy!=='stream'||raw.rights?.kind!=='licensed-direct'||raw.rights.url!==LICENSE)return null;
  const prefix=raw.format==='image'?'photo':'video',external=String(raw.externalId||'');
  if(!/^\d{1,18}$/.test(external)||raw.id!==`pexels-${prefix}-${external}`)return null;
  const imageUrl=safeUrl(raw.imageUrl,'image'),sourceUrl=safeUrl(raw.delivery.sourceUrl||raw.sourceUrl,'source'),videoUrl=raw.format==='video'?safeUrl(raw.delivery.videoUrl||raw.videoUrl,'video'):'';
  if(!imageUrl||!sourceUrl||raw.format==='video'&&!videoUrl||!sourceUrl.endsWith('-'+external+'/'))return null;
  const holder=String(raw.rights.holder||'').trim().slice(0,120);if(!holder)return null;
  const duration=raw.format==='video'?Number(raw.durationSec):null;
  if(duration!==null&&(!Number.isInteger(duration)||duration<1||duration>180))return null;
  const title={},body={};for(const code of ['ru','en','de','uk','es']){title[code]=String(raw.title?.[code]||raw.title?.ru||'').slice(0,140);body[code]=String(raw.body?.[code]||raw.body?.ru||'').slice(0,1600);}
  if(!title.ru||!body.ru||!Array.isArray(raw.interestIds)||!raw.interestIds.length||!/^[0-9TZ:.-]+$/.test(raw.lastCheckedAt||'')||!Number.isFinite(Date.parse(raw.lastCheckedAt)))return null;
  return {id:raw.id,source:'pexels',externalId:external,format:raw.format,lang:'none',interestIds:[...new Set(raw.interestIds.filter(x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(x)))].slice(0,16),title,body,
   imageUrl,videoUrl,durationSec:duration,mediaType:raw.format,rights:{kind:'licensed-direct',holder,url:LICENSE,embedAllowed:false,downloadAllowed:true},
   delivery:{policy:'stream',sourceUrl,...(videoUrl?{videoUrl}:{})},lastCheckedAt:raw.lastCheckedAt,available:raw.available===false?false:'unknown',checkMethod:'metadata',availabilityReason:raw.available===false&&['removed','temporary_error'].includes(raw.availabilityReason)?raw.availabilityReason:'not_checked'};
 }
 return Object.freeze({LICENSE,safeUrl,normalize});
});
