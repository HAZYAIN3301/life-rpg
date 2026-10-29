'use strict';
const P=require('./public/inspiration-profile-v1.js'),A=require('./server-inspiration-apify-v1.js'),E=require('./public/inspiration-edit-media-v1.js');
const {isDay}=require('./public/inspiration-supply-policy-v1.js');
function createService({inventory,signer,now=()=>new Date()}){
 return {async daily(raw,day,uid){
  const at=now().toISOString(),delta=Math.abs(Date.parse(day)-Date.parse(at.slice(0,10)));
  if(!isDay(day)||!Number.isFinite(delta)||delta>86400000)throw Error('invalid_supply_day');
  const p=P.normalize(raw),topics=p.interests.map(i=>i.id).filter(id=>Object.hasOwn(A.TOPICS,id));
  if(!p.configured||!p.formats.includes('edit')||!topics.length)return {status:'unsupported',candidates:[]};
  if(p.digest?.day===day&&p.digest.ids.length)return {status:'fixed',candidates:[]};
  const offset=Math.floor(Date.parse(day)/86400000)%topics.length;
  const result=await inventory.get(topics.slice(offset).concat(topics.slice(0,offset)).slice(0,3));
  const seen=new Set(p.shownHistory.filter(r=>Date.parse(day)-Date.parse(r.day)<45*86400000).map(r=>r.id));
  const candidates=result.items.filter(r=>E.normalize(r,{unsigned:true})&&!seen.has(r.id)&&r.interestIds.some(t=>topics.includes(t))&&!P.isReference({sourceUrl:r.delivery.sourceUrl},p))
   .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id)).slice(0,24).map(r=>signer.sign(r,uid));
  return {status:result.status,candidates};
 }};
}
module.exports={createService};
