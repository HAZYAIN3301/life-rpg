const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');
function harness(){
 const {window}=parseHTML('<html><body><div id="host" class="b210-owned"></div></body></html>'),document=window.document,host=document.getElementById('host');
 const html='<div class="settings-shell"><section class="settings-group" data-settings-group="experience"><div class="card"><input id="set-appName" value="Saved name"></div><details class="card settings-disclosure" open><summary>Звук</summary><input id="sound-note" value="saved"></details></section></div>';
 const context={window,document,State:{phase:'app',settings:{skills:[]}},CSS:{escape:s=>s},safeViewMarkup:()=>html,lang:()=> 'ru',t:s=>s,translateDOM:()=>{},afterMainCommit:()=>{},mountSettingsDiscovery:()=>{},requestAnimationFrame:f=>f(),setTimeout:()=>0,_partyWorldUI:null,settingsDiscoveryTarget:null,console};
 Object.defineProperty(document,'activeElement',{value:null,writable:true});
 vm.createContext(context);vm.runInContext("let _renderedMainView='settings';"+fs.readFileSync('../../public/app.js','utf8').split('function commitMainView(main, staging, view) {')[1].split('\nfunction renderMainView(main) {')[0].replace(/^/, 'function commitMainView(main, staging, view) {'),context);
 vm.runInContext(fs.readFileSync('plan-bridge.js','utf8'),context);
 return {document,host,mount:()=>context.window.SatoruPlanBridge.mount(host,'settings','experience')};
}
test('background settings repaint keeps a typed draft and an explicitly closed disclosure',()=>{const h=harness();h.mount();const input=h.document.getElementById('set-appName');input.value='Unsaved draft';h.document.activeElement=input;h.host.querySelector('details').open=false;h.mount();assert.equal(h.document.getElementById('set-appName').value,'Unsaved draft');assert.equal(h.host.querySelector('details').open,false);});
test('a settings destination retains an opened disclosure across repeated receipts',()=>{const h=harness();h.mount();h.host.querySelector('details').open=true;h.mount();h.mount();assert.equal(h.host.querySelector('details').open,true);assert.equal(h.host.dataset.settingsGroup,'experience');});
