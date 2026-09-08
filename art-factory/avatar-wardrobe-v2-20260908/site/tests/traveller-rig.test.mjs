import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTraveller,INITIAL,validate,sample,DURATION,SOURCE_SIZE} from '../traveller-rig.mjs';
import {readFileSync} from 'node:fs';
test('texture projection and comparison camera use the real PNG dimensions',()=>{
 const png=readFileSync(new URL('../public/images/drawn/traveller-original.png',import.meta.url));
 assert.deepEqual(SOURCE_SIZE,[png.readUInt32BE(16),png.readUInt32BE(20)]);
 const m=createTraveller(),g=m.meshes.find(o=>o.name==='face').geometry;
 for(let i=0;i<g.attributes.position.count;i++){
  assert.ok(Math.abs(g.attributes.uv.getX(i)-(g.attributes.position.getX(i)+320)/SOURCE_SIZE[0])<1e-6);
 }
});
test('whole Traveller has one shared articulated rig, normalized skin weights and finite meshes',()=>{
 const m=createTraveller();assert.equal(m.bones.length,19);assert.ok(m.meshes.length>50);
 for(const mesh of m.meshes){
  assert.equal(mesh.skeleton,m.skeleton);
  const w=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
 }
 for(const pose of [0,.25,.5,.75,1]){
  m.apply({...INITIAL,pose});
  for(const mesh of m.meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){
   const v=mesh.getVertexPosition(i,new T.Vector3());assert.ok(v.toArray().every(Number.isFinite));
  }
 }
});
test('clothes and inspection material do not change the shared motion',()=>{
 const m=createTraveller();m.apply({...INITIAL,pose:.6});const before=m.inspect().bones;
 m.apply({...INITIAL,pose:.6,outfit:'jacket',clay:true});assert.deepEqual(m.inspect().bones,before);
 for(const [k,ms]of Object.entries(m.garments))assert.ok(ms.every(o=>o.visible===(k==='jacket')));
});
test('reach goes forward with clavicle participation, and feet remain planted',()=>{
 const m=createTraveller(),rest=m.inspect().bones;m.apply({...INITIAL,pose:1});const after=m.inspect().bones;
 const get=(bs,n)=>bs.find(b=>b.name===n).position;
 assert.ok(get(after,'wrist-1')[2]-get(rest,'wrist-1')[2]>120);
 assert.ok(get(after,'clavicle-1')[1]>get(rest,'clavicle-1')[1]);
 for(const name of ['ankle-1','ankle1','knee-1','knee1'])assert.deepEqual(get(after,name),get(rest,name));
 // This tests bounded kinematics, NOT anatomical/artistic approval.
});
test('arm is closed and retains cross-sectional volume in the posed palm',()=>{
 const m=createTraveller(),mesh=m.meshes.find(m=>m.name==='arm-1'),g=mesh.geometry,edges=new Map();
 for(let i=0;i<g.index.count;i+=3){const t=[0,1,2].map(j=>g.index.getX(i+j));for(let j=0;j<3;j++){const key=[t[j],t[(j+1)%3]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1)}}
 assert.ok([...edges.values()].every(n=>n===2));
 const rows=(g.attributes.position.count-2)/48,row=rows-3;
 for(const pose of [0,.5,1]){
  m.apply({...INITIAL,pose});
  const a=mesh.getVertexPosition(row*48+12,new T.Vector3()),b=mesh.getVertexPosition(row*48+36,new T.Vector3());
  assert.ok(a.distanceTo(b)>15);
 }
});
test('patch contract rejects unknown keys and invalid values before any mutation',()=>{
 for(const v of [[],null,{pose:NaN},{pose:2},{yaw:Infinity},{outfit:'armor'},{gold:4},{clay:1},{playing:'true'},{toString:1}])assert.throws(()=>validate(v));
 assert.doesNotThrow(()=>validate({pose:.5,outfit:'jacket',yaw:-90}));
 assert.equal(sample(0),0);assert.equal(sample(DURATION),0);assert.equal(sample(DURATION+10000),0);
});
