import {createRequire} from 'node:module';
import {writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),base='http://127.0.0.1:52044';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),out=path.join(root,'work/trial-20261004');
await mkdir(out,{recursive:true});const data=await mkdtemp(path.join(tmpdir(),'satoru-trial-ui-'));
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATA_DIR:data,PORT:'52044',HOST:'127.0.0.1',PUSH_SCHED:'off'},stdio:'ignore'});
function contrastProbe(el) {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
        const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
        return [...el.querySelectorAll('h3,p,label,strong,small,button:not(:disabled),select')].filter(e => e.textContent.trim()).map(e => {
          const bg = [255, 255, 255], ancestors = []; let parent = e;
          while (parent) { ancestors.unshift(parent); parent = parent.parentElement; }
          for (const ancestor of ancestors) { const c = rgba(getComputedStyle(ancestor).backgroundColor); for (let i = 0; i < 3; i++) bg[i] = c[i] * c[3] / 255 + bg[i] * (1 - c[3] / 255); }
          const foreground = rgba(getComputedStyle(e).color); for (let i = 0; i < 3; i++) foreground[i] = foreground[i] * foreground[3] / 255 + bg[i] * (1 - foreground[3] / 255);
          return { ratio: (Math.max(lum(foreground), lum(bg)) + .05) / (Math.min(lum(foreground), lum(bg)) + .05), text: e.textContent.slice(0, 90), fg: getComputedStyle(e).color, bg };
        }).sort((a,b) => a.ratio - b.ratio)[0];
}

const report={engines:[],layouts:0,errors:[]};
try{
for(let i=0;i<200;i++){if(server.exitCode!==null)throw Error('QA server exited');try{if((await fetch(base+'/api/version')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}

for(const engine of [chromium,webkit]){
 if(process.env.QA_ENGINE&&engine.name()!==process.env.QA_ENGINE)continue;
 const browser=await engine.launch(),pages=[];
 try{
 for(let i=0;i<2;i++){
  const c=await browser.newContext({viewport:{width:i?375:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),p=await c.newPage();pages.push(p);p.on('pageerror',e=>report.errors.push(e.message));p.setDefaultTimeout(15000);
  const r=await p.request.post(base+'/api/auth/register',{data:{name:i?'Мира':'Александр',email:`exp-${engine.name()}-${i}-${Date.now()}@example.test`,password:'synthetic-adventure-only',lang:'ru'}});assert(r.ok());
  await p.goto(base);await p.waitForFunction(()=>typeof State!=='undefined'&&State.phase!=='boot'&&State.me);
  const later=p.locator('[data-action="questionnaire-defer"]');if(await later.count())await later.click();
  await p.waitForFunction(()=>State.phase==='app');
  assert(await p.evaluate(async i=>{await guideV3Snooze();return commitmentDataCommit(({settings,tasks})=>({settings:{...settings,lang:'ru',sound:false,theme:'dark',systemMode:false,systemSkinOff:true,tutorial:{done:true,active:false}},tasks:[...tasks,{id:'old',title:'fixture',done:true,completedAt:'2020-01-01T00:00:00Z',xpAwarded:100000,goldAwarded:0,date:todayStr()},...Array.from({length:70},(_,n)=>({id:`qa-${i}-${n}`,title:`PRIVATE_${i}_${n}`,done:false,date:todayStr(),estimateMin:10,difficulty:'normal',skillId:settings.skills[0]?.id||''}))]}));},i));
 }
 const[a,b]=pages;
 const party=await(await a.request.post(base+'/api/party/create',{data:{name:'Друзья в долине',shareProgress:true,acknowledgedVisibility:true}})).json();assert(party.party);
 assert((await b.request.post(base+'/api/party/join',{data:{code:party.party.code,shareProgress:true,acknowledgedVisibility:true}})).ok());
 const nav=async(p,view='party')=>{await p.evaluate(async view=>{await refreshPartyAuthority();State.view=view;render();},view);await p.waitForFunction(view=>_renderedMainView===view&&!document.querySelector('#main').classList.contains('is-view-pending'),view);};
 const refresh=async p=>{await p.evaluate(()=>partyAdventureUI().refresh(true));};
 for(const p of pages){await nav(p);await refresh(p);}
 await a.locator('.adventure-shell').screenshot({path:path.join(out,`${engine.name()}-choose.png`)});
 await a.locator('[data-adventure="start"][data-route="grove"]').click();await a.waitForFunction(()=>State.party.adventure.runs.length===1);
 await nav(a,'today');await a.locator('[data-adventure="open"]').click();await a.locator('.adventure-map').waitFor();
 const move=async(p,node)=>{await refresh(p);await p.locator(`[data-adventure="select"][data-node="${node}"]`).first().click();const button=p.locator('[data-adventure="move"]');if(await button.count())await button.click();await p.waitForFunction(node=>State.party.adventure.positions.some(x=>x.actor===State.party.members.find(m=>m.me).id&&x.node===node),node);};
 await move(a,'grove');await a.locator('.adventure-map').focus();await a.keyboard.press('ArrowDown');await a.waitForFunction(()=>State.party.adventure.positions.find(x=>x.actor===State.party.members.find(m=>m.me).id).node==='camp');await a.waitForFunction(()=>document.activeElement?.matches('.adventure-map'));await move(a,'grove');
 const counters=[0,0];
 async function step(p,index,kind='task',lose=false){
  let id=`qa-${index}-${counters[index]++}`;
  if(kind==='habit')id=await p.evaluate(async()=>{const h={id:'qa-habit',title:'PRIVATE_habit',days:[0,1,2,3,4,5,6],estimateMin:10,difficulty:'normal',skillId:State.settings.skills[0]?.id||''};const habits=[...State.habits,h];if(!await habitDataCommit({habits},()=>{State.habits=habits;}))throw Error('habit fixture');await transactHabitCompletion(h,{twoMinute:true});return JSON.stringify([habitDayKey(),h.id]);});
  else if(kind==='focus'){await p.evaluate(id=>{startFocus(id);State.timer.startedAt=Date.now()-65000;State.timer.focusStartedAt=new Date(State.timer.startedAt).toISOString();stopFocus(true);},id);await p.waitForFunction(()=>focusSessionSync().count()===0);}
  else await p.evaluate(id=>completeTask(State.tasks.find(q=>q.id===id),null,todayStr()),id);
  await refresh(p);await p.locator('#adventure-source').selectOption(JSON.stringify([kind,id]));
  const before=await p.evaluate(()=>({gold:goldBalance(),run:State.party.adventure.runs.find(r=>!r.completedAt)}));
  if(lose)await p.route('**/api/party/expedition',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort();}else await route.continue();},{times:1});
  await p.locator('[data-adventure="contribute"]').click();if(lose){await p.locator('[data-adventure="retry"]').click();}
  await p.waitForFunction(({run})=>State.party.adventure.runs.find(r=>r.id===run.id).progress===run.progress+1,before);
  assert.equal(await p.evaluate(()=>goldBalance()),before.gold);
 }
 await step(a,0,'task',true);await step(a,0,'habit');await move(a,'bridge');await step(a,0,'focus');await step(a,0);await move(a,'ruins');await step(a,0);await step(a,0);
 // Final step cannot be completed by one account alone.
 await a.evaluate(id=>completeTask(State.tasks.find(q=>q.id===id),null,todayStr()),`qa-0-${counters[0]++}`);await refresh(a);await a.locator('[data-adventure="contribute"]').click();await a.getByText('Для финала нужен хотя бы один шаг друга.',{exact:true}).waitFor();
 await move(b,'ruins');await step(b,1);await refresh(a);assert((await a.evaluate(()=>State.party.adventure.runs[0])).completedAt);
 await a.locator('[data-adventure="trial"]').click();await a.locator('.trial-shell').waitFor();await a.evaluate(()=>partyTrialUI().refresh(true));
 await a.screenshot({path:path.join(out,`${engine.name()}-roles.png`)});
 const snapshots={ready:await a.evaluate(()=>structuredClone(State.party.trial))};
 const current=async p=>p.evaluate(()=>structuredClone(State.party.trial.trials.find(r=>!r.completedAt)||State.party.trial.trials.at(-1)));
 const refreshTrial=async p=>p.evaluate(()=>partyTrialUI().refresh(true));
 async function trialStep(p,index,action,kind='task',lose=false){
  let id=`qa-${index}-${counters[index]++}`;
  if(kind==='habit')id=await p.evaluate(async()=>{const h={id:'trial-habit',title:'PRIVATE_trial_habit',days:[0,1,2,3,4,5,6],estimateMin:10,difficulty:'normal',skillId:State.settings.skills[0]?.id||''},habits=[...State.habits,h];if(!await habitDataCommit({habits},()=>{State.habits=habits;}))throw Error('habit');await transactHabitCompletion(h,{twoMinute:true});return JSON.stringify([habitDayKey(),h.id]);});
  else if(kind==='focus'){await p.evaluate(id=>{startFocus(id);State.timer.startedAt=Date.now()-65000;State.timer.focusStartedAt=new Date(State.timer.startedAt).toISOString();stopFocus(true);},id);await p.waitForFunction(()=>focusSessionSync().count()===0);}
  else await p.evaluate(id=>completeTask(State.tasks.find(q=>q.id===id),null,todayStr()),id);
  await refreshTrial(p);const before=await current(p),gold=await p.evaluate(()=>goldBalance());await p.locator('#trial-source').selectOption(JSON.stringify([kind,id]));
  if(lose)await p.route('**/api/party/trial',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort();}else await route.continue();},{times:1});
  await p.emulateMedia({reducedMotion:index===0&&!lose?'no-preference':'reduce'});
  await p.locator(`[data-trial="${action}"]`).click();if(lose)await p.locator('[data-trial="retry"]').click();
  await p.waitForFunction(r=>State.party.trial.trials.find(x=>x.id===r.id).turn===r.turn+1,before);assert.equal(await p.evaluate(()=>goldBalance()),gold);
  const animations=await p.locator('.trial-boss').evaluate(el=>el.getAnimations().length);
  if(index===0&&!lose)assert(animations>0,'confirmed move animates');else assert.equal(animations,0,'reduced motion/replay is quiet');
 }
 for(let tier=0;tier<3;tier++){
  if(tier)await a.locator('[data-trial="next"]').click();
  await a.locator('[data-trial="pick"][data-role="spark"]').click();await a.locator('[data-trial="start"]').click();await a.waitForFunction(n=>State.party.trial.trials.length===n,tier+1);
  await nav(b);if(!await b.locator('.trial-shell').count())await b.locator('[data-trial="open"]').click();await refreshTrial(b);
  if(tier)await b.locator('.trial-role-change summary').click();
  await b.locator(`[data-trial="pick"][data-role="${tier?'leaf':'stone'}"]`).click();await b.locator('[data-trial="role"]').click();await b.waitForFunction(role=>State.party.trial.roles.some(r=>r.memberId===State.party.members.find(m=>m.me).id&&r.role===role),tier?'leaf':'stone');
  await nav(a,'today');await a.locator('[data-trial="open"]').click();await a.locator('.trial-shell').waitFor();
  let turns=0;
  while(true){
   await refreshTrial(a);let r=await current(a);if(r.completedAt)break;assert(turns<30);
   if(r.resting){snapshots.rest=await a.evaluate(()=>structuredClone(State.party.trial));await a.screenshot({path:path.join(out,`${engine.name()}-rest.png`)});const hp=r.hp;await a.locator('[data-trial="resume"]').click();await a.waitForFunction(()=>!State.party.trial.trials.find(r=>!r.completedAt).resting);assert.equal((await current(a)).hp,hp);continue;}
   const index=turns%2,p=index?b:a;
   let action=tier===1?'strike':index?(turns%4===1?'ward':'inspire'):'strike';
   const kind=tier===0&&turns===1?'habit':tier===0&&turns===2?'focus':'task';
   await trialStep(p,index,action,kind,tier===0&&turns===0);turns++;
   if(tier===0&&turns===1){snapshots.active=await a.evaluate(()=>structuredClone(State.party.trial));await a.screenshot({path:path.join(out,`${engine.name()}-battle.png`)});}
  }
  assert.equal((await current(a)).contributors,2);
  assert(!(await b.locator('.trial-shell').innerText()).includes('PRIVATE_0'));
 }
 assert(snapshots.rest,'real second-tier counterattack must produce a breather');
 for(const p of pages){await p.reload();await p.waitForFunction(()=>State.phase==='app');await nav(p);await p.locator('[data-trial="open"]').click();await refreshTrial(p);assert.equal(await p.evaluate(()=>State.party.trial.trials.filter(r=>r.completedAt).length),3);}
 snapshots.complete=await a.evaluate(()=>structuredClone(State.party.trial));
 await a.screenshot({path:path.join(out,`${engine.name()}-win.png`)});
 await a.locator('[data-trial="room"]').click();await a.locator('.adventure-den-trophy[data-trial-rank="3"]').waitFor();assert((await a.locator('.trial-trophy-rank').innerText()).includes('3/3'));
 await a.locator('.shared-den-scene').screenshot({path:path.join(out,`${engine.name()}-trophy.png`)});
 await a.locator('[data-trial="open"]').click();
 // Freeze network only for rendering fixtures; all paths above used the real server.
 await a.emulateMedia({reducedMotion:'reduce'});
 await a.route('**/api/party/trial',async route=>route.fulfill({json:await a.evaluate(()=>({partyId:State.party.id,trial:State.party.trial,eligible:[{kind:'task',id:'layout-only',title:'Мой сохранённый шаг — длинное название для проверки карточки'}]}))}));
 for(const lang of['ru','en','de','uk','es'])for(const theme of['dark','light'])for(const width of[375,1280])for(const state of['ready','active','rest','complete']){
  await a.setViewportSize({width,height:900});await a.evaluate(({lang,theme,snapshot})=>{State.settings.lang=lang;State.settings.theme=theme;State.party.trial=structuredClone(snapshot);render();},{lang,theme,snapshot:snapshots[state]});await a.locator('.trial-shell').waitFor();
  await refreshTrial(a);
  const m=await a.locator('.trial-shell').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,small:[...el.querySelectorAll('button,select')].filter(b=>b.getClientRects().length&&b.getBoundingClientRect().height<42).map(b=>b.textContent)}));assert(!m.overflow,JSON.stringify({lang,theme,width,state}));assert.deepEqual(m.small,[]);
  const contrast=await a.locator('.trial-controls').evaluate(contrastProbe);assert(contrast.ratio>=4.5,JSON.stringify({lang,theme,width,state,contrast}));report.contrastMinimum=Math.min(report.contrastMinimum||100,contrast.ratio);report.layouts++;
 }
 await a.setViewportSize({width:375,height:812});await a.evaluate(snapshot=>{State.settings.lang='ru';State.settings.theme='dark';State.party.trial=snapshot;render();},snapshots.active);await refreshTrial(a);await a.locator('.trial-shell').scrollIntoViewIfNeeded();await a.screenshot({path:path.join(out,`${engine.name()}-mobile.png`),fullPage:true});
 await a.evaluate(()=>{for(let n=2;n<6;n++){State.party.members.push({id:'dense'+n,name:'Длинное имя участника '+n});State.party.trial.roles.push({memberId:'dense'+n,role:['spark','stone','leaf'][n%3]});}render();});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await a.locator('[data-trial="back"]').focus();await a.keyboard.press('Tab');assert(await a.evaluate(()=>document.querySelector('.trial-shell').contains(document.activeElement)));
 await a.evaluate(()=>{for(const el of document.querySelectorAll('.trial-shell h2,.trial-shell h3,.trial-shell p,.trial-shell button,.trial-shell small,.trial-shell label'))el.style.fontSize=parseFloat(getComputedStyle(el).fontSize)*2+'px';});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 report.engines.push(engine.name()+': real expedition unlock, three trials, all roles/actions, task/habit/focus, lost receipt/retry, rest, shared trophy and reload');
 }finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}
assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{if(server.exitCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});await rm(data,{recursive:true,force:true});}
