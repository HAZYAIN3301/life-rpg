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
  function dates(start) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('invalid_date');
    const d = new Date(start+'T12:00:00Z');
    if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==start) throw new Error('invalid_date');
    return Array.from({length:7},(_,i)=>new Date(+d+i*86400000).toISOString().slice(0,10));
  }
  const overlaps = (a,b) => a[0]<b[1] && b[0]<a[1];
  // Draft only. User-selected working hours and recurring appointments are hard limits.
  // Existing timed tasks stay fixed; missing durations are returned for clarification.
  function propose({start,today,tasks,routine=[],from,to,nowTime='00:00'}) {
    const a=minutes(from),b=minutes(to), fixed=blocks(routine), days=dates(start);
    if (a===null||b===null||a>=b) throw new Error('invalid_hours');
    const busy = Object.fromEntries(days.map(d=>[d, fixed.filter(x=>x.day===new Date(d+'T12:00:00Z').getUTCDay()).map(x=>[minutes(x.start),minutes(x.end)])]));
    for (const task of tasks) {
      const t=minutes(task.startTime), duration=Number(task.estimateMin);
      if (busy[task.date] && t!==null) busy[task.date].push([t,Number.isFinite(duration)&&duration>0?t+duration:1440]);
    }
    const moves=[],unplaced=[];
    for (const task of tasks.filter(t=>!t.done && !t.startTime && days.includes(t.date))) {
      const duration=Number(task.estimateMin);
      if (!Number.isFinite(duration)||duration<5||duration>1080) {unplaced.push({id:task.id,reason:'duration'});continue;}
      let placed=false;
      for (const day of days.filter(d=>d>=today)) {
        const floor=day===today?Math.max(a,minutes(nowTime)??a):a;
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
  return Object.freeze({minutes,blocks,dates,propose});
});
