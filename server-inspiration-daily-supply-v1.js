'use strict';

// Shared provider inventory, not an account profile or a second digest owner.
// The host supplies bounded licensed-provider queries and durable storage.
function createDailySupply({read,write,fetchPage,now=()=>new Date()}) {
  const flights=new Map();
  async function load(topic,format,key) {
    const at=new Date(now());
    if(!Number.isFinite(at.getTime()))throw Error('invalid_time');
    const day=at.toISOString().slice(0,10),old=await read(key);
    if(old!==null&&old!==undefined&&(!old||old.version!==1||old.key!==key
      ||!Number.isInteger(old.page)||old.page<1||old.page>1000
      ||!/^\d{4}-\d{2}-\d{2}$/.test(old.day)||old.day>day
      ||typeof old.hasMore!=='boolean'||!Array.isArray(old.items)||old.items.length>40))throw Error('corrupt_supply_cache');
    if(old?.day===day)return {items:structuredClone(old.items),cached:true,day};
    const page=old&&old.hasMore?Math.min(1000,old.page+1):1;
    const response=await fetchPage({topic,format,page});
    if(!response||!Array.isArray(response.items)||response.items.length>40||typeof response.hasMore!=='boolean')throw Error('invalid_provider_response');
    const ids=new Set();
    const items=response.items.filter(item=>{
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>64)throw Error('invalid_provider_identity');
      if(ids.has(item.id))return false;ids.add(item.id);return true;
    });
    const next={version:1,key,day,page,hasMore:response.hasMore,items:structuredClone(items)};
    const receipt=await write(key,next);
    if(receipt?.ok!==true)throw Error('supply_save_unconfirmed');
    return {items:structuredClone(items),cached:false,day};
  }
  async function get({topic,format}={}) {
    if(typeof topic!=='string'||! /^[a-z][a-z0-9-]{0,47}$/.test(topic)||!['image','video'].includes(format))throw Error('invalid_supply_topic');
    const key=topic+'-'+format;
    if(flights.has(key))return structuredClone(await flights.get(key));
    if(flights.size>=128)throw Error('supply_busy');
    const work=load(topic,format,key);flights.set(key,work);
    try{return structuredClone(await work);}finally{if(flights.get(key)===work)flights.delete(key);}
  }
  return Object.freeze({get});
}
module.exports={createDailySupply};
