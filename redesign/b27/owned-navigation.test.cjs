const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const {ownedNavigationTarget}=require('./.checks/owned-surface.cjs');
test('sound/profile disclosures and ordinary input cannot become navigation via html data-view',()=>{
 const {document}=parseHTML('<html data-view="settings"><body><main><div id="owner"><details><summary>Sound</summary><input></details><button data-action="save" data-view="settings">Save</button><button data-view="habits"><span>Habits</span></button></div></main></body></html>');
 const host=document.getElementById('owner');
 for(const selector of ['summary','input','[data-action]'])assert.equal(ownedNavigationTarget(host,host.querySelector(selector)),null);
 assert.equal(ownedNavigationTarget(host,host.querySelector('button[data-view="habits"] span')).dataset.view,'habits');
 const outside=document.createElement('button');outside.dataset.view='settings';document.body.append(outside);assert.equal(ownedNavigationTarget(host,outside),null);
});
