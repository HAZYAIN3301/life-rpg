(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WeekPlannerV1 = api;
})(typeof window === 'object' ? window : globalThis, function() {
  'use strict';
  function minutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) return null;
    const [h,m] = value.split(':').map(Number); return h*60+m;
  }
  const clock = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  function blocks(value) {
    if (!Array.isArray(value) || value.length > 70) throw new Error('invalid_blocks');
    return value.map(b => {
      const start = minutes(b?.start), end = minutes(b?.end);
      if (!Number.isInteger(b?.day) || b.day<0 || b.day>6 || start===null || end===null || start>=end) throw new Error('invalid_block');
      return {day:b.day,start:b.start,end:b.end,title:String(b.title||'').slice(0,100)};
    });
  }
  function dayStamp(value) {
    if (typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid_date');
    const d = new Date(value+'T00:00:00Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==value) throw new Error('invalid_date');
    return +d;
  }
  function dates(start) {
    const stamp=dayStamp(start);
    return Array.from({length:7},(_,i)=>new Date(stamp+i*86400000).toISOString().slice(0,10));
  }
  const overlaps = (a,b) => a[0]<b[1] && b[0]<a[1];
  function moveContext(tasks, id) {
    return JSON.stringify(tasks.map(task => {
      if (task.id!==id) return task;
      const {date,startTime,estimateMin,postponedCount,firstDate,...unchanged}=task;
      return unchanged;
    }));
  }
  function sameSchedule(task, expected) {
    return !!task && task.date===expected.date && (task.startTime||null)===(expected.startTime||null) && task.estimateMin===expected.estimateMin;
  }
  // Draft only. User-selected working hours and recurring appointments are hard limits.
  // Existing timed tasks stay fixed; missing durations are returned for clarification.
  function propose({start,today,tasks,routine=[],from,to,nowTime='00:00'}) {
    const a=minutes(from),b=minutes(to), now=minutes(nowTime), fixed=blocks(routine), days=dates(start);
    dayStamp(today);
    if (a===null||b===null||a>=b) throw new Error('invalid_hours');
    if (now===null) throw new Error('invalid_time');
    const busy = Object.fromEntries(days.map(d=>[d, fixed.filter(x=>x.day===new Date(d+'T12:00:00Z').getUTCDay()).map(x=>[minutes(x.start),minutes(x.end)])]));
    for (const task of tasks) {
      const t=minutes(task.startTime), duration=Number(task.estimateMin);
      if (t===null) continue;
      const taskDay=dayStamp(task.date)/60000, begin=taskDay+t;
      const end=Number.isFinite(duration)&&duration>0?begin+duration:taskDay+1440;
      // A fixed task may start before this week or run past midnight. Split its
      // occupied interval across visible calendar dates without moving the task.
      for (const day of days) {
        const offset=dayStamp(day)/60000;
        if (overlaps([begin,end],[offset,offset+1440])) busy[day].push([Math.max(0,begin-offset),Math.min(1440,end-offset)]);
      }
    }
    const moves=[],unplaced=[];
    for (const task of tasks.filter(t=>!t.done && !t.startTime && days.includes(t.date))) {
      const rawDuration=Number(task.estimateMin), duration=Math.round(rawDuration);
      if (!Number.isFinite(rawDuration)||rawDuration<5||rawDuration>1080) {unplaced.push({id:task.id,reason:'duration'});continue;}
      let placed=false;
      for (const day of days.filter(d=>d>=today)) {
        const floor=day===today?Math.max(a,now):a;
        for(let at=Math.ceil(floor/5)*5;at+duration<=b;at+=5) {
          if(busy[day].some(x=>overlaps(x,[at,at+duration])))continue;
          moves.push({id:task.id,date:day,startTime:clock(at),estimateMin:duration,before:{date:task.date,startTime:task.startTime||null,estimateMin:task.estimateMin}});
          busy[day].push([at,at+duration]);placed=true;break;
        }
        if(placed)break;
      }
      if(!placed)unplaced.push({id:task.id,reason:'capacity'});
    }
    return {moves,unplaced};
  }
  return Object.freeze({minutes,blocks,dates,propose,moveContext,sameSchedule});
});
