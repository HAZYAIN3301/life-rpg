'use strict';
const Profile=require('./public/inspiration-profile-v1.js'),{TOPICS}=require('./server-inspiration-pexels-v1.js');
const {isDay}=require('./public/inspiration-supply-policy-v1.js');
function createService({provider,cache,signer,now=()=>new Date()}){
 return {async probe(){
  if(!provider.configured)return {ready:false,samples:[]};
  const groups=await Promise.all(['image','video'].map(format=>cache.get({topic:'nature',format})));
  return {ready:groups.every(g=>g.items.length>0),samples:groups.map(g=>g.items[0]).filter(Boolean).map(r=>({id:r.id,imageUrl:r.imageUrl,videoUrl:r.videoUrl||'',sourceUrl:r.delivery.sourceUrl}))};
 },async daily(raw,day){
  const utc=now().toISOString().slice(0,10);
  if(!isDay(day)||Math.abs(Date.parse(day)-Date.parse(utc))>86400000)throw Error('invalid_supply_day');
  const profile=Profile.normalize(raw),supported=profile.interests.map(i=>i.id).filter(id=>Object.hasOwn(TOPICS,id));
  const formats=profile.formats.filter(f=>['image','video'].includes(f));
  if(!provider.configured)return {provider:'pexels',providerAvailable:false,status:'unconfigured',dayKey:day,candidates:[]};
  if(!supported.length||!formats.length)return {provider:'pexels',providerAvailable:true,status:'unsupported',dayKey:day,candidates:[]};
  const offset=Math.floor(Date.parse(day)/86400000)%supported.length,topics=supported.slice(offset).concat(supported.slice(0,offset)).slice(0,3);
  const jobs=topics.flatMap(topic=>formats.map(format=>({topic,format}))),groups=[];let failures=0;
  await Promise.all(jobs.map(async job=>{try{groups[jobs.indexOf(job)]=(await cache.get(job)).items;}catch{failures++;groups[jobs.indexOf(job)]=[];}}));
  const seen=new Set(profile.shownHistory.filter(r=>Date.parse(day)-Date.parse(r.day)<45*86400000).map(r=>r.id));
  const candidates=[];
  for(let i=0;i<40&&candidates.length<24;i++)for(const group of groups){const row=group[i];if(row&&!seen.has(row.id)&&candidates.length<24){seen.add(row.id);candidates.push(signer.sign(row));}}
  return {provider:'pexels',providerAvailable:true,status:failures===jobs.length?'provider_error':failures?'partial':candidates.length?'ready':'empty',dayKey:day,candidates};
 }};
}
module.exports={createService};
