/* Exact calendar proposals. Pure checks; writes and confirmation belong to the UI. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AssistantScheduleV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n/60000:null;}
  function minutes(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return null;const [h,m]=value.split(':').map(Number);return h*60+m;}
  function valid(command,today){return !!command&&day(today)!==null&&day(command.date)!==null&&command.date>=today&&minutes(command.startTime)!==null&&Number.isInteger(command.estimateMin)&&command.estimateMin>=5&&command.estimateMin<=1080&&command.endTime==null;}
  function snapshot(task){
    const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
    return task?JSON.stringify(stable(task)):null;
  }
  const overlap=(a,b,c,d)=>a<d&&c<b;
  function check({command,tasks=[],routine=[],today,nowTime,expected,lockedIds=[],timerTaskId=null}){
    if(!valid(command,today)||minutes(nowTime)===null)return {ok:false,reason:'invalid'};
    const task=tasks.find(t=>String(t.id)===String(command.targetId));
    if(!task)return {ok:false,reason:'missing'};
    if(task.done)return {ok:false,reason:'done'};
    if(timerTaskId===task.id)return {ok:false,reason:'timer'};
    if(lockedIds.includes(task.id))return {ok:false,reason:'boundary'};
    if(!expected||snapshot(task)!==expected)return {ok:false,reason:'stale'};
    const begin=day(command.date)+minutes(command.startTime),end=begin+command.estimateMin;
    if(begin<day(today)+minutes(nowTime))return {ok:false,reason:'past'};
    for(const other of tasks){
      if(other.id===task.id||!other.startTime)continue;
      const date=day(other.date),time=minutes(other.startTime);
      if(date===null||time===null)return {ok:false,reason:'calendar'};
      const a=date+time,duration=Number(other.estimateMin),b=Number.isFinite(duration)&&duration>0?a+duration:date+1440;
      if(overlap(begin,end,a,b))return {ok:false,reason:'overlap',title:String(other.title||'').slice(0,120),targetId:other.id};
    }
    if(!Array.isArray(routine))return {ok:false,reason:'calendar'};
    for(const block of routine){
      const a=minutes(block?.start),b=minutes(block?.end);
      if(!Number.isInteger(block?.day)||block.day<0||block.day>6||a===null||b===null||a>=b)return {ok:false,reason:'calendar'};
      for(let offset=day(command.date);offset<end;offset+=1440){
        if(new Date(offset*60000).getUTCDay()===block.day&&overlap(begin,end,offset+a,offset+b))return {ok:false,reason:'routine',title:String(block.title||'').slice(0,120)};
      }
    }
    const noop=task.date===command.date&&task.startTime===command.startTime&&task.estimateMin===command.estimateMin;
    return {ok:true,noop,endDate:new Date(Math.floor(end/1440)*86400000).toISOString().slice(0,10),endTime:String(Math.floor(end%1440/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0')};
  }
  return Object.freeze({day,minutes,valid,snapshot,check});
});
