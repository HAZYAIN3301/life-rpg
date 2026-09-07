import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../art-factory/avatar-3d-v1-20260907/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const records=[],errors=[],typeChecks=[],contrastChecks=[];
await mkdir(new URL('./qa/',import.meta.url),{recursive:true});
try{
 for(const variant of ['impulse','companion']){
  for(const width of [375,390,1280,1440]){
   const height=width<700?812:1000;
   const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto('http://127.0.0.1:4179/?variant='+variant);await page.evaluate(()=>document.fonts.ready);
   const family=await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily);
   assert.ok(family.includes(variant==='impulse'?'Unbounded':'Russo'));
   const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
   const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'h1'});
   const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
   assert.ok(fonts.some(f=>f.isCustomFont&&f.familyName.includes(variant==='impulse'?'Unbounded':'Russo')));
   typeChecks.push({variant,width,fonts});
   const contrast=await page.evaluate(()=>{
    const rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
    return ['.primary','.core-label','.task-outcome','.task-duration','.eyebrow','.nav-item.selected','.recap-trigger','.task-time'].map(selector=>{
     const el=document.querySelector(selector),style=getComputedStyle(el);let bgEl=el,bg=getComputedStyle(bgEl).backgroundColor;
     while(bg==='rgba(0, 0, 0, 0)'&&bgEl.parentElement){bgEl=bgEl.parentElement;bg=getComputedStyle(bgEl).backgroundColor;}
     const a=lum(rgb(style.color)),b=lum(rgb(bg));return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
   });
   contrast.forEach(c=>assert.ok(c.ratio>=4.5,JSON.stringify(c)));contrastChecks.push({variant,width,contrast});
   assert.equal(await page.locator('button[data-variant][aria-pressed=true]').count(),1);
   for(const scenario of ['regular','dense','empty']){
    await page.locator('.preview-settings summary').click();await page.selectOption('#scenario',scenario);await page.locator('.preview-settings summary').click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:new URL('./qa/'+variant+'-'+width+'-'+scenario+'.png',import.meta.url).pathname,fullPage:false});
    const geometry=await page.evaluate(()=>{
      const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}:null;};
      return {overflow:document.documentElement.scrollWidth>innerWidth,first:box('.task')||box('#empty-add'),core:box('.core'),nav:box('.mobile-nav'),composer:box('#composer'),recap:box('#recap-open'),
       small:[...document.querySelectorAll('button,input,select,textarea,summary')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const r=el.getBoundingClientRect();return r.width<41.5||r.height<41.5;}).map(el=>({text:el.textContent.slice(0,50)||el.getAttribute('aria-label'),id:el.id,cls:el.className,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}))};
    });
    records.push({variant,width,scenario,family,...geometry});
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
    const before=await page.locator('.task').allTextContents();await page.locator('button[data-variant="'+(variant==='impulse'?'companion':'impulse')+'"]').tap();
    assert.deepEqual(await page.locator('.task').allTextContents(),before,'variant preserves work');
    await page.reload();assert.equal(await page.locator('[data-task=video] .task-time').innerText(),'16:40');
   }
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('.shadow-art').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   if(width<700){await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% root-font reflow');}
   await context.close();
  }
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,views:records.length,errors}));
}finally{await writeFile(new URL('./qa/character-report.json',import.meta.url),JSON.stringify({records,typeChecks,contrastChecks,errors},null,2));await browser.close();}
