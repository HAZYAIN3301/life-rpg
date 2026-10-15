import{createRequire}from'node:module';import{mkdtemp,mkdir,rm,writeFile}from'node:fs/promises';import{tmpdir}from'node:os';import path from'node:path';import{spawn}from'node:child_process';import assert from'node:assert/strict';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),out=path.join(root,'work/tribe-world-20261015'),base='http://127.0.0.1:52043';
await mkdir(out,{recursive:true});const data=await mkdtemp(path.join(tmpdir(),'satoru-world-')),server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATA_DIR:data,PORT:'52043',HOST:'127.0.0.1',PUSH_SCHED:'off'},stdio:'ignore'}),report={engines:[],layouts:0,errors:[]};
try{
 for(let i=0;i<200;i++){try{if((await fetch(base+'/api/version')).ok)break;}catch{}await new Promise(r=>setTimeout(r,30));}
 for(const engine of[chromium,webkit]){
  const browser=await engine.launch();try{
   const pages=[];
   for(let i=0;i<2;i++){
    const c=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block',reducedMotion:'reduce'}),p=await c.newPage();pages.push(p);p.on('pageerror',e=>report.errors.push(e.message));p.setDefaultTimeout(15000);
    assert((await p.request.post(base+'/api/auth/register',{data:{name:i?'Мира':'Альберт',email:`world-${engine.name()}-${i}-${Date.now()}@example.test`,password:'synthetic-world-only',lang:'ru'}})).ok());
    await p.goto(base);await p.waitForFunction(()=>typeof State!=='undefined'&&State.me&&State.phase!=='boot');const defer=p.locator('[data-action="questionnaire-defer"]');if(await defer.count())await defer.click();await p.waitForFunction(()=>State.phase==='app');
    await p.evaluate(async()=>{await guideV3Snooze();await commitmentDataCommit(({settings,tasks})=>({settings:{...settings,lang:'ru',theme:'dark',sound:false,systemMode:false,tutorial:{done:true,active:false}},tasks:[...tasks,{id:'old',title:'fixture',date:'2020-01-01',done:true,completedAt:'2020-01-01T00:00:00Z',xpAwarded:100000,goldAwarded:0}]}));State.view='party';State.party=null;render();});await p.locator('.world-field').waitFor();await p.waitForFunction(()=>State.party===false);
   }
   const[a,b]=pages;
   assert.equal(await a.locator('.world-place').count(),6);assert.equal(await a.locator('.party-empty-hero').count(),0);
   await a.locator('[data-world-walk="den"]').click();await a.waitForFunction(()=>State.view==='den');await a.locator('.world-den-return [data-world="map"]').click();await a.locator('.world-field').waitFor();
   await a.locator('[data-world-walk="sessions"]').click();await a.locator('[data-action="party-entry-create"]').click();await a.locator('#party-create input[name="name"]').fill('Наша долина');await a.locator('#party-create input[name="shareProgress"]').check();await a.locator('#party-create button[type="submit"]').click();await a.locator('[data-duo-host]').waitFor();
   const code=await a.evaluate(()=>State.party.code);await b.locator('[data-world="friends"]').click();await b.locator('[data-action="party-entry-join"]').click();await b.locator('#party-join input[name="code"]').fill(code);await b.locator('#party-join input[name="shareProgress"]').check();await b.locator('#party-join button[type="submit"]').click();await b.locator('.party-members-card').waitFor();
   await a.evaluate(()=>refreshPartyAuthority());await a.locator('[data-world="map"]').click();
   for(const place of['room','sessions','forest','cave','arena','friends']){
    const selector=place==='friends'?'[data-world="friends"]':`[data-world-walk="${place}"]`;await a.locator(selector).click();await a.locator(`[data-world-location="${place}"]`).waitFor();
    assert.equal(await a.locator('.world-field').count(),0);assert.equal(await a.locator('[data-world-location]').count(),1);
    if(place==='cave'){await a.locator('[data-world="forest"]').click();await a.locator('[data-adventure-host]').waitFor();}
    if(place==='arena')assert.equal(await a.locator('[data-view="leaderboard"]').count()>=1,true);
    await a.locator('.world-interior-header [data-world="map"]').click();await a.locator('.world-field').waitFor();
   }
   await a.emulateMedia({reducedMotion:'no-preference'});
   await a.locator('[data-world-walk="den"]').click();await a.locator('[data-world-walk="forest"]').click();await a.locator('[data-world-location="forest"]').waitFor();assert.equal(await a.evaluate(()=>State.view),'party');
   await a.keyboard.press('Escape');await a.locator('.world-field').waitFor();
   await a.locator('[data-world-walk="room"]').focus();await a.keyboard.press('Enter');await a.locator('[data-world-location="room"]').waitFor();await a.keyboard.press('Escape');await a.locator('.world-field').waitFor();
   await a.emulateMedia({reducedMotion:'reduce'});
   for(const lang of['ru','en','de','uk','es'])for(const theme of['dark','light'])for(const width of[375,1280]){
    await a.setViewportSize({width,height:width===375?812:900});await a.evaluate(({lang,theme})=>{State.settings.lang=lang;State.settings.theme=theme;partyWorldUI().go('map');},{lang,theme});await a.locator('.world-field').waitFor();
    const sizes=await a.locator('.world-place').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert(sizes.every(s=>s.w>=44&&s.h>=44));assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);report.layouts++;
    await a.locator('.world-landscape').evaluate(img=>img.decode());await a.locator('.world-chibi img').evaluate(img=>img.decode());
    if(lang==='ru'&&theme==='dark')await a.screenshot({path:path.join(out,`${engine.name()}-${width}.png`)});
    for(const place of['room','sessions','forest','cave','arena','friends']){
     await a.evaluate(place=>partyWorldUI().go(place),place);await a.locator(`[data-world-location="${place}"]`).waitFor();
     assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${engine.name()} ${lang} ${theme} ${width} ${place}`);report.layouts++;
     if(lang==='ru'&&theme==='dark'&&width===375)await a.screenshot({path:path.join(out,`${engine.name()}-${place}.png`)});
    }
    await a.evaluate(()=>partyWorldUI().go('map'));
   }
   await a.setViewportSize({width:375,height:812});await a.evaluate(()=>{for(const e of document.querySelectorAll('.world-place span,.world-header h2,.world-hint'))e.style.fontSize=parseFloat(getComputedStyle(e).fontSize)*2+'px';});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await a.reload();await a.waitForFunction(()=>State.phase==='app');await a.evaluate(()=>{State.view='party';render();});await a.locator('.world-field').waitFor();
   report.engines.push(engine.name()+': real create/join, six places, den return, cave gate, latest-click, keyboard, reload');
  }finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}finally{if(server.exitCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});await rm(data,{recursive:true,force:true});}
