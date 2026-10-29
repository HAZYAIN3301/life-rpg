/* Signed personal recommendations are source links, never a shared content licence. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./inspiration-media-v1.js'):root.InspirationMediaV1);if(node)module.exports=api;if(root)root.InspirationEditMediaV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Media){
 'use strict';
 const locales=['ru','en','de','uk','es'];
 const text=(s,n)=>typeof s==='string'?s.replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';
 function normalize(raw,{unsigned=false}={}){
  if(!raw||raw.personalRecommendation!==true||raw.source!=='tiktok'||raw.format!=='edit'||raw.rights?.kind!=='linked-public'||raw.rights.downloadAllowed!==false||raw.delivery?.policy!=='embed'||raw.discovery?.provider!=='apify')return null;
  const source=Media.parseSource(raw.delivery.sourceUrl);
  if(source?.provider!=='tiktok'||raw.id!=='edit-tiktok-'+source.id||raw.externalId!==source.id||!Media.isAllowedEmbed(raw.delivery.embedUrl,source))return null;
  if(!unsigned&&!/^[a-f0-9]{64}$/.test(raw.supplyProof||''))return null;
  const duration=Number(raw.durationSec),at=raw.lastCheckedAt,posted=raw.publishedAt;
  if(!Number.isInteger(duration)||duration<1||duration>180||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at||!Number.isFinite(Date.parse(posted))||new Date(posted).toISOString()!==posted)return null;
  const ids=[...new Set((Array.isArray(raw.interestIds)?raw.interestIds:[]).filter(i=>typeof i==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(i)))].slice(0,16);
  if(!ids.length)return null;const title={},body={};for(const l of locales){title[l]=text(raw.title?.[l]||raw.title?.ru,140);body[l]=text(raw.body?.[l]||raw.body?.ru,800);if(!title[l]||!body[l])return null;}
  const out={id:raw.id,source:'tiktok',externalId:source.id,format:'edit',personalRecommendation:true,lang:'unknown',interestIds:ids,
   title,body,tags:(Array.isArray(raw.tags)?raw.tags:[]).map(s=>text(s,64)).filter(Boolean).slice(0,32),
   durationSec:duration,publishedAt:posted,imageUrl:'',rights:{kind:'linked-public',holder:'TikTok @'+source.authorHandle,url:'https://developers.tiktok.com/doc/embed-player/',embedAllowed:true,downloadAllowed:false},
   delivery:{policy:'embed',sourceUrl:source.url,embedUrl:Media.buildEmbed(source)},discovery:{provider:'apify'},
   lastCheckedAt:at,checkMethod:'metadata',available:raw.available===false?false:'unknown',availabilityReason:raw.available===false?'removed':'not_checked'};
  if(!unsigned)out.supplyProof=raw.supplyProof;return out;
 }
 function toRow(raw,locale='ru'){
  const c=normalize(raw);if(!c)return null;const pick=m=>m[locale]||m.ru;
  return {...c,title:pick(c.title),body:pick(c.body),provider:'tiktok',personalMedia:true,mediaPolicy:'iframe',sourceUrl:c.delivery.sourceUrl,embedUrl:c.delivery.embedUrl,attribution:c.rights.holder,rightsKind:'linked-public',durationLabel:Math.floor(c.durationSec/60)+':'+String(c.durationSec%60).padStart(2,'0')};
 }
 function readable(raw,now){const c=normalize(raw),time=Date.parse(now);return !!(c&&c.available!==false&&Number.isFinite(time)&&time-Date.parse(c.lastCheckedAt)<=30*86400000&&Date.parse(c.lastCheckedAt)-time<=86400000);}
 function savedLink(item){
  const source=Media.parseSource(item?.url);
  if(source?.provider!=='tiktok'||item.catalogId!=='edit-tiktok-'+source.id)return null;
  return {...item,catalogId:'',catalogItem:null,supplyUnavailable:false,personalMedia:true,provider:'tiktok',sourceUrl:source.url,embedUrl:Media.buildEmbed(source),imageUrl:'',videoUrl:'',mediaPolicy:'iframe'};
 }
 return Object.freeze({normalize,toRow,readable,savedLink});
});
