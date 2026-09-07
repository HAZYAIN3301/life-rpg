import test from 'node:test';
import assert from 'node:assert/strict';
import {createPilotRig,applyLook,poseRig,inspectRig,disposeRig} from '../rig.mjs';
import {DEFAULT_LOOK,CATALOG,BONE_NAMES,PART_NAMES,SOCKET_NAMES,parseLook,changeLook,animationAllowed,validateGLBEnvelope} from '../contract.mjs';

test('look contract rejects unknown fields/IDs and does not mutate input',()=>{
  assert.deepEqual(parseLook(DEFAULT_LOOK),DEFAULT_LOOK);
  assert.throws(()=>parseLook({...DEFAULT_LOOK,admin:true}));
  assert.throws(()=>parseLook({...DEFAULT_LOOK,weapon:'paid-legendary'}));
  assert.throws(()=>parseLook({...DEFAULT_LOOK,schema:'v0'}));
  const changed=changeLook(DEFAULT_LOOK,'hair','ponytail');assert.equal(changed.hair,'ponytail');assert.equal(DEFAULT_LOOK.hair,'crop');
});
test('shared skeleton and geometry survive all wardrobe combinations and motion samples',()=>{
  const rig=createPilotRig(),meshIDs=rig.meshes.map(m=>m.uuid),boneIDs=rig.skeleton.bones.map(b=>b.uuid);let checks=0;
  try {
    for(const name of [...BONE_NAMES,...PART_NAMES,...SOCKET_NAMES]) {
      let count=0;rig.root.traverse(o=>{if(o.name===name)count++;});
      assert.equal(count,1,'GLB contract name must be unique: '+name);
    }
    for(const hair of CATALOG.hair)for(const top of CATALOG.top)for(const bottom of CATALOG.bottom)for(const weapon of CATALOG.weapon) {
      applyLook(rig,{...DEFAULT_LOOK,hair,top,bottom,weapon});
      for(const pose of ['idle','walk','sit','pet'])for(let f=0;f<24;f++) {
        const time=f/24*2.7;poseRig(rig,pose,time);const m=inspectRig(rig);
        assert.deepEqual(m.errors,[]);assert.ok(m.maxWeightError<1e-6);assert.ok(m.footHeights.every(y=>y>=-.0001));
        if(pose==='walk')assert.ok(Math.min(...m.footHeights)<.0001,'at least one planted foot');
        if(pose==='pet')assert.ok(m.contactError<.005,'palm reaches contact');
        assert.equal(m.gripError,0);checks++;
      }
    }
    assert.equal(checks,1536);assert.deepEqual(rig.meshes.map(m=>m.uuid),meshIDs);assert.deepEqual(rig.skeleton.bones.map(b=>b.uuid),boneIDs);
  } finally {disposeRig(rig);}
});
test('same look remains equipped in every pose and hidden variants do not appear',()=>{
  const rig=createPilotRig();const look={...DEFAULT_LOOK,hair:'ponytail',top:'field-vest',bottom:'ranger',weapon:'none'};
  try {
    applyLook(rig,look);for(const pose of ['idle','walk','sit','pet']){poseRig(rig,pose,.4);assert.deepEqual(rig.look,look);
      assert.ok(rig.parts.Hair_ponytail.visible);assert.equal(rig.parts.Hair_crop.visible,false);
      assert.ok(rig.parts['Top_field-vest'].visible);assert.equal(rig.parts.Top_traveller.visible,false);
      assert.equal(rig.parts.Trim_traveller.visible,false);assert.equal(rig.parts['Trim_field-vest'].visible,true);
      assert.equal(rig.parts.HandR_grip.visible,false);assert.equal(rig.parts.HandR_open.visible,true);
    }
  }finally{disposeRig(rig);}
});
test('semantic recolouring changes neither other materials nor geometry',()=>{
  const rig=createPilotRig(),pants=rig.mats.pants.color.getHex(),geometry=Array.from(rig.meshes[0].geometry.attributes.position.array);
  try {applyLook(rig,{...DEFAULT_LOOK,skin:'deep',hairColor:'silver',cloth:'plum'});
    assert.equal(rig.mats.skin.color.getHexString(),'593b32');assert.equal(rig.mats.pants.color.getHex(),pants);
    assert.deepEqual(Array.from(rig.meshes[0].geometry.attributes.position.array),geometry);
  }finally{disposeRig(rig);}
});
test('pause, reduced motion, hidden and offscreen each stop animation',()=>{
  const state={visible:true,intersecting:true,reduced:false,paused:false};assert.ok(animationAllowed(state));
  for(const key of ['visible','intersecting','reduced','paused'])assert.equal(animationAllowed({...state,[key]:!state[key]}),false);
});
function glb(doc){const json=new TextEncoder().encode(JSON.stringify(doc));const len=Math.ceil(json.length/4)*4;const bytes=new ArrayBuffer(20+len);const d=new DataView(bytes);d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,bytes.byteLength,true);d.setUint32(12,len,true);d.setUint32(16,0x4e4f534a,true);new Uint8Array(bytes,20).fill(32);new Uint8Array(bytes,20,json.length).set(json);return bytes;}
test('GLB preflight rejects malformed or externally fetching assets',()=>{
  assert.throws(()=>validateGLBEnvelope(new ArrayBuffer(100)));
  for(const bad of [{buffers:[{uri:'https://example.org/private'}]},{images:[{uri:'file:///etc/passwd'}]},{images:[{uri:'data:image/png;base64,abc'}]},{extensionsUsed:['custom_shader']}])assert.throws(()=>validateGLBEnvelope(glb({asset:{version:'2.0'},...bad})));
  assert.deepEqual(validateGLBEnvelope(glb({asset:{version:'2.0'},nodes:[]})).nodes,[]);
});
