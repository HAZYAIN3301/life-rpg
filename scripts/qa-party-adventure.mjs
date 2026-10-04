import {createRequire} from 'node:module';
import {writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),base='http://127.0.0.1:52044';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),out=path.join(root,'work/adventure-20261004');
await mkdir(out,{recursive:true});const data=await mkdtemp(path.join(tmpdir(),'satoru-expedition-ui-'));
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATA_DIR:data,PORT:'52044',HOST:'127.0.0.1',PUSH_SCHED:'off'},stdio:'ignore'});
function contrastProbe(el) {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
        const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
        return [...el.querySelectorAll('h3,p,label,strong,small,button:not(:disabled),select,.adventure-node b,.adventure-party-label')].filter(e => e.textContent.trim()).map(e => {
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
  assert(await p.evaluate(async i=>{await guideV3Snooze();return commitmentDataCommit(({settings,tasks})=>({settings:{...settings,lang:'ru',sound:false,theme:'dark',systemMode:false,systemSkinOff:true,tutorial:{done:true,active:false}},tasks:[...tasks,{id:'old',title:'fixture',done:true,completedAt:'2020-01-01T00:00:00Z',xpAwarded:100000,goldAwarded:0,date:todayStr()},...Array.from({length:18},(_,n)=>({id:`qa-${i}-${n}`,title:`PRIVATE_${i}_${n}`,done:false,date:todayStr(),estimateMin:10,difficulty:'normal',skillId:settings.skills[0]?.id||''}))]}));},i));
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
 await a.locator('.adventure-shell').screenshot({path:path.join(out,`${engine.name()}-finale.png`)});
 await b.locator('[data-adventure="room"]').click();await b.locator('#party-world-room[open] .adventure-memento').waitFor();await b.locator('#party-world-room').screenshot({path:path.join(out,`${engine.name()}-memento.png`)});
 assert.equal((await b.locator('.adventure-shell').innerText()).includes('PRIVATE_0'),false);
 await b.locator('[data-adventure="select"][data-node="camp"]').first().click();await b.locator('[data-adventure="start"][data-route="workshop"]').click();await b.waitForFunction(()=>State.party.adventure.runs.length===2);
 for(const[node,count]of[['workshop',2],['bridge',3],['ruins',4]]){await move(b,node);for(let i=0;i<count;i++){if(node==='ruins'&&i===3){await move(a,node);await step(a,0);}else await step(b,1);}}
 for(const p of pages){await p.reload();await p.waitForFunction(()=>State.phase==='app');await nav(p);await refresh(p);assert.equal(await p.evaluate(()=>State.party.adventure.runs.filter(r=>r.completedAt).length),2);}
 await nav(b,'today');await b.evaluate(()=>openPartyRoom());await b.locator('#party-world-room[open] .adventure-den-trophy').waitFor();
 await b.locator('[data-project="start"][data-id="hearth"]').click();await b.waitForFunction(()=>State.party.projects.chapters.length===1);
 await nav(b,'today');await b.locator('[data-project="open"]').click();await b.locator('#party-world-room[open] .shared-project').waitFor();
 await nav(b,'today');await b.evaluate(()=>{const button=document.createElement('button');button.dataset.duo='open-party';return partyDuoUI().handle({target:button,preventDefault(){}});});await b.locator('#party-world-sessions[open]').waitFor();await b.evaluate(()=>render());await b.locator('#party-world-sessions[open]').waitFor();
 await move(b,'camp');await b.emulateMedia({reducedMotion:'no-preference'});
 await b.locator('[data-adventure="select"][data-node="ruins"]').first().click();await b.locator('[data-adventure="move"]').click();await b.locator('.is-walking').waitFor();await b.locator('.is-walking').waitFor({state:'detached'});await b.emulateMedia({reducedMotion:'reduce'});
 const persisted=await b.evaluate(()=>structuredClone(State.party.adventure));
 for(const locale of['ru','en','de','uk','es'])for(const theme of['dark','light'])for(const width of[375,1280]){
  await b.setViewportSize({width,height:900});await b.evaluate(({locale,theme})=>{State.settings.lang=locale;State.settings.theme=theme;render();},{locale,theme});await b.locator('.adventure-shell').waitFor();await b.waitForFunction(()=>!document.querySelector('#main').classList.contains('is-view-pending'));
  const metrics=await b.locator('.adventure-shell').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth+1,small:[...el.querySelectorAll('button,select')].filter(e=>e.getBoundingClientRect().height<42).map(e=>e.textContent)}));assert.equal(metrics.overflow,false,JSON.stringify({locale,theme,width}));assert.deepEqual(metrics.small,[]);const contrast=await b.locator('.adventure-shell').evaluate(contrastProbe);assert(contrast.ratio>=4.5,JSON.stringify({locale,theme,width,contrast}));report.contrastMinimum=Math.min(report.contrastMinimum||100,contrast.ratio);report.layouts++;
 }
 await b.setViewportSize({width:375,height:812});await b.evaluate(()=>{State.settings.lang='ru';State.settings.theme='light';render();});await b.locator('.adventure-shell').screenshot({path:path.join(out,`${engine.name()}-mobile.png`)});
 const realMembers=await b.evaluate(()=>structuredClone(State.party.members));
 for(const theme of['dark','light'])for(const width of[375,1280]){
  await b.setViewportSize({width,height:900});await b.evaluate(({realMembers,theme})=>{State.settings.theme=theme;State.party.members=[...realMembers,...Array.from({length:4},(_,i)=>({id:'dense-'+i,name:'Длинное имя участника '+i,me:false}))];State.party.adventure.positions=State.party.members.map((m,i)=>({actor:m.id,node:'ruins',gender:i%2?'female':'male',at:new Date().toISOString()}));render();},{realMembers,theme});await b.locator('.adventure-person').first().waitFor();assert.equal(await b.locator('.adventure-person').count(),6);assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);report.layouts++;
 }
 await b.setViewportSize({width:375,height:812});await b.locator('.adventure-shell').screenshot({path:path.join(out,`${engine.name()}-dense.png`)});
 await b.evaluate(()=>{for(const el of document.querySelectorAll('.adventure-shell h3,.adventure-shell h4,.adventure-shell p,.adventure-shell button,.adventure-node b'))el.style.setProperty('font-size',parseFloat(getComputedStyle(el).fontSize)*2+'px','important');});assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 report.engines.push(engine.name()+': two complete routes, two accounts, task/habit/focus receipts, retry, keyboard, partner gate, reload, no extra gold');
 }finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}
assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));

}finally{if(server.exitCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});await rm(data,{recursive:true,force:true});}
