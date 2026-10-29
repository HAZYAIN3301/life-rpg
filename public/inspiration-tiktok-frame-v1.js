/* Personal-link playback boundary. It grants no shared-catalog/content rights. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./inspiration-media-v1.js'):root.InspirationMediaV1);
 if(node)module.exports=api;if(root)root.InspirationTikTokFrameV1=api;
 if(!node&&root.document?.documentElement.dataset.inspirationFrame==='tiktok')api.mount(root.document,root);
})(typeof globalThis!=='undefined'?globalThis:this,function(Media){
 'use strict';
 const validId=id=>typeof id==='string'&&/^[1-9]\d{14,21}$/.test(id);
 function personalSource(item){
  if(!item||item.personalMedia!==true||item.catalogId||item.supplyUnavailable)return null;
  const source=Media.parseSource(item.sourceUrl||item.url);
  return source?.provider==='tiktok'&&Media.isAllowedEmbed(item.embedUrl,source)?source:null;
 }
 function wrapperUrl(item){const source=personalSource(item);return source?'inspiration-tiktok-player.html?id='+source.id:'';}
 function requestId(path){try{const q=new URL(path,'https://satoru.invalid').searchParams;return q.getAll('id').length===1&&validId(q.get('id'))?q.get('id'):'';}catch{return '';}}
 function headers(path){
  const id=requestId(path),frame=id?'https://www.tiktok.com/player/v1/'+id:"'none'";
  return {'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; frame-src "+frame+"; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-same-origin allow-presentation",'Referrer-Policy':'no-referrer','Cache-Control':'no-store'};
 }
 function cleanEvent(m){
  if(!m||typeof m!=='object'||Array.isArray(m))return null;
  if(['ready','playing','paused','buffering','init','ended'].includes(m.type))return {type:m.type};
  if(m.type==='error'&&Number.isInteger(m.code)&&m.code>=1&&m.code<=3999)return {type:'error',code:m.code};
  if(m.type==='time'&&Number.isFinite(m.currentTime)&&Number.isFinite(m.duration)&&m.duration>0&&m.duration<=86400&&m.currentTime>=0&&m.currentTime<=m.duration+1)return {type:'time',currentTime:m.currentTime,duration:m.duration};
  return null;
 }
 function parseMessage(event,source,id,origin){return event?.source===source&&event.origin===origin&&event.data?.satoruInspirationPlayer===true&&event.data.id===id?cleanEvent(event.data.event):null;}
 function mount(document,window){
  const id=requestId(window.location.href),host=document.getElementById('player');if(!id||!host)return;
  const selected=Media.parseSource('https://www.tiktok.com/@selected/video/'+id);
  const frame=document.createElement('iframe');frame.title='TikTok';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');frame.setAttribute('allow','fullscreen; picture-in-picture');frame.setAttribute('allowfullscreen','');frame.referrerPolicy='no-referrer';
  let active=true;
  const close=()=>{if(!active)return;active=false;frame.removeAttribute('src');frame.remove();window.removeEventListener('message',receive);};
  const receive=event=>{if(!active)return;const m=Media.parsePlayerEvent(event,frame.contentWindow,selected);if(!m)return;if(m.type==='ended'||m.type==='error')close();window.parent.postMessage({satoruInspirationPlayer:true,id,event:m},window.location.origin);};
  window.addEventListener('message',receive);window.addEventListener('pagehide',close,{once:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
  frame.src=Media.buildEmbed(selected);host.appendChild(frame);
 }
 return Object.freeze({personalSource,wrapperUrl,headers,parseMessage,mount});
});
