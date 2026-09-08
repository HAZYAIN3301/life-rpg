import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeLook,DEFAULT_LOOK,LOOK_KEY,readLook,saveLook,PALETTES,MOTIONS,validateLookPatch} from '../contract.mjs';
function store(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};}
test('UI and tool share strict patch validation before mutation',()=>{assert.deepEqual(validateLookPatch({upper:'mage',cape:false}),{upper:'mage',cape:false});for(const bad of [{},{gold:100},{upper:'evil'},{cape:'false'},[],null])assert.throws(()=>validateLookPatch(bad));});
test('allowlist rejects account, inventory and arbitrary URLs',()=>{assert.deepEqual(normalizeLook({upper:'https://evil',weapon:'delete',gold:999,admin:true}),DEFAULT_LOOK);});
test('valid independent clothing, skin and hair round-trip',()=>{const s=store(),look={...DEFAULT_LOOK,upper:'knight',lower:'mage',head:'mage',skin:PALETTES.skin[2],hair:PALETTES.hair[2]};assert.deepEqual(saveLook(s,look),{ok:true,look});assert.deepEqual(readLook(s),look);});
test('bad storage and corrupted JSON do not silently claim a save',()=>{for(const s of [null,{getItem:()=>null,setItem:()=>{}},{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}]){assert.equal(saveLook(s,DEFAULT_LOOK).ok,false);assert.deepEqual(readLook(s),DEFAULT_LOOK);}const s=store();s.setItem(LOOK_KEY,'{broken');assert.deepEqual(readLook(s),DEFAULT_LOOK);});
test('all delivered models have one matching named skeleton and authored motion clips',()=>{
 let first;
 for(const name of ['rogue','knight','mage']){
  const b=fs.readFileSync(new URL('../public/models/'+name+'.glb',import.meta.url)),end=20+b.readUInt32LE(12);
  assert.equal(b.toString('utf8',0,4),'glTF');const j=JSON.parse(b.subarray(20,end));
  assert.equal(j.buffers.length,1);assert.equal(j.buffers[0].uri,undefined);assert.ok(j.images.every(i=>i.bufferView!==undefined&&!i.uri));
  const bones=j.skins[0].joints.map(i=>j.nodes[i].name);if(first)assert.deepEqual(bones,first);else first=bones;
  for(const m of [...MOTIONS,'Sit_Floor_Down','Sit_Floor_StandUp'])assert.ok(j.animations.some(a=>a.name===m),name+':'+m);
  const prefix=name[0].toUpperCase()+name.slice(1);for(const part of ['Head','Body','ArmLeft','ArmRight','LegLeft','LegRight'])assert.ok(j.nodes.some(n=>n.name===prefix+'_'+part&&n.skin===0));
 }
});
