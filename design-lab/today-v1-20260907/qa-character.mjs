import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const records=[],errors=[],typeChecks=[],contrastChecks=[];
await mkdir(new URL('./qa/',import.meta.url),{recursive:true});
try{
 for(const theme of ['light','dark']){
  for(const width of [375,390,1280,1440]){
   const height=width<700?812:1000;
   const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto('http://127.0.0.1:4179/?theme='+theme);await page.evaluate(()=>document.fonts.ready);
   const family=await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily);
   assert.ok(family.includes('Russo'));
   const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
   const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'h1'});
   const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
   assert.ok(fonts.some(f=>f.isCustomFont&&f.familyName.includes('Russo')));
   typeChecks.push({theme,width,fonts});
   const contrast=await page.evaluate(()=>{
    const rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
    return ['.primary','.core-label','.task-outcome','.task-duration','.eyebrow','.nav-item.selected','.recap-trigger','.task-time','.habit-button','.done .task-title','.theme-picker [aria-pressed=true]'].map(selector=>{
     const el=document.querySelector(selector),style=getComputedStyle(el);let bgEl=el,bg=getComputedStyle(bgEl).backgroundColor;
     while(bg==='rgba(0, 0, 0, 0)'&&bgEl.parentElement){bgEl=bgEl.parentElement;bg=getComputedStyle(bgEl).backgroundColor;}
     const a=lum(rgb(style.color)),b=lum(rgb(bg));return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
   });
   contrast.forEach(c=>assert.ok(c.ratio>=4.5,JSON.stringify(c)));contrastChecks.push({theme,width,contrast});
   assert.equal(await page.locator('button[data-theme-choice][aria-pressed=true]').count(),1);
   await page.locator('.den-art').evaluate(img=>img.decode());
   assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
   assert.deepEqual(await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);
   await page.locator('[data-task=video] [data-field=time]').click();
   assert.ok(await page.locator('#edit-form input[name=time]').isVisible());
   await page.keyboard.press('Escape');
   assert.ok(await page.locator('[data-task=video] [data-field=time]').evaluate(el=>el===document.activeElement));
   for(const scenario of ['regular','dense','empty']){
    await page.locator('.preview-settings summary').click();await page.selectOption('#scenario',scenario);await page.locator('.preview-settings summary').click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:new URL('./qa/'+theme+'-'+width+'-'+scenario+'.png',import.meta.url).pathname,fullPage:false});
    const geometry=await page.evaluate(()=>{
      const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}:null;};
      return {overflow:document.documentElement.scrollWidth>innerWidth,first:box('.task')||box('#empty-add'),core:box('.core'),nav:box('.mobile-nav'),composer:box('#composer'),recap:box('#recap-open'),
       small:[...document.querySelectorAll('button,input,select,textarea,summary')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.width<41.5||r.height<41.5;}).map(el=>({text:el.textContent.slice(0,50)||el.getAttribute('aria-label'),id:el.id,cls:el.className,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))};
    });
    records.push({theme,width,scenario,family,...geometry});
    assert.equal(geometry.overflow,false,JSON.stringify(records.at(-1)));
    assert.ok(geometry.recap.bottom<height,'recap discoverable');
    if(width<700){
     assert.equal(await page.locator('.mobile-nav button').count(),5);
     assert.deepEqual(geometry.small,[],'touch targets: '+JSON.stringify(geometry.small));
     assert.ok(geometry.first.bottom<geometry.nav.y,'first action fully visible');
    }
   }
   await page.locator('.preview-settings summary').click();await page.selectOption('#scenario','regular');await page.locator('.preview-settings summary').click();
   if(width<700){
    await page.locator('#compose-open').tap();
    assert.ok(await page.getByLabel('Начало новой задачи').isVisible());assert.ok(await page.getByLabel('Длительность новой задачи').isVisible());
    await page.locator('#task-name').fill('Проба мобильного ввода');await page.locator('#composer input[name=time]').fill('20:10');await page.locator('#composer button[type=submit]').tap();
    assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('.task').count(),6);
    await page.locator('#shadow-open').tap();assert.ok(await page.locator('#dialog[open]').isVisible());await page.locator('#dialog-close').tap();
    await page.locator('#mobile-more').tap();await page.getByRole('button',{name:'Заметки ↗',exact:true}).tap();await page.locator('#dialog-close').tap();
    await page.locator('[data-task=video] [data-field=time]').tap();await page.locator('#edit-form input[name=time]').fill('16:40');await page.locator('#edit-form .primary').tap();
    await page.locator('[data-task=video] .check').tap();assert.ok(await page.locator('[data-task=video].done').isVisible());await page.locator('#undo').tap();
    const before=await page.locator('.task').allTextContents();await page.locator('button[data-theme-choice="'+(theme==='light'?'dark':'light')+'"]').tap();
    assert.deepEqual(await page.locator('.task').allTextContents(),before,'theme preserves work');
    await page.reload();assert.equal(await page.locator('[data-task=video] .task-time').innerText(),'16:40');
    await page.goto('http://127.0.0.1:4179/');assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme==='light'?'dark':'light','theme persists without query');
    await page.locator('#compose-open').tap();await page.locator('#task-name').fill('Черновик не теряется');
    await page.locator('#dialog-close').tap();await page.locator('button[data-theme-choice="'+theme+'"]').tap();
    await page.locator('#compose-open').tap();assert.equal(await page.locator('#task-name').inputValue(),'Черновик не теряется');
    await page.locator('#dialog-close').tap();
   }
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('.shadow-art').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   if(width<700){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% root-font reflow');}
   await context.close();
  }
 }
 // System preference changes only the presentation; explicit light/dark take precedence.
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4179/?theme=system');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 await page.emulateMedia({colorScheme:'dark'});
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 await page.locator('[data-theme-choice=light]').click();
 await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 await page.goto('http://127.0.0.1:4179/?theme=invalid&variant=impulse');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light','invalid query uses saved preference; legacy A link still works');
 await page.locator('[data-task=video] [data-start]').click();
 const taskState=await page.evaluate(()=>localStorage.getItem('satoru:today-design:20260907:v1'));
 await page.locator('[data-theme-choice=dark]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('satoru:today-design:20260907:v1')),taskState,'theme does not mutate active focus or task state');
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked');};});
 await page.locator('[data-theme-choice=light]').click();
 assert.ok(await page.locator('#notice.error').isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light','storage failure still allows current-session theme');
 await context.close();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,views:records.length,errors}));
}finally{await writeFile(new URL('./qa/theme-report.json',import.meta.url),JSON.stringify({records,typeChecks,contrastChecks,errors},null,2));await browser.close();}
