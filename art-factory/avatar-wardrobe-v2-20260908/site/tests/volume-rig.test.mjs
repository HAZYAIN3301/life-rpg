import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArm,INITIAL,validate,sample,DURATION} from '../volume-rig.mjs';
test('volume arm skin is closed: every triangle edge has two faces',()=>{
 const a=createArm(),g=a.bodyMesh.geometry,edges=new Map();
 for(let i=0;i<g.index.count;i+=3){const tri=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];for(let k=0;k<3;k++){const pair=[tri[k],tri[(k+1)%3]].sort((a,b)=>a-b).join(':');edges.set(pair,(edges.get(pair)||0)+1)}}
 assert.ok([...edges.values()].every(n=>n===2));
});
test('three garments use the identical skeleton and joint trajectory',()=>{
 const a=createArm();let expected;
 for(const outfit of ['short','long','armor']){a.apply({...INITIAL,outfit,pose:.65});const d=a.inspect();assert.ok(d.sharedSkeleton);if(expected)assert.deepEqual(d.bones,expected);expected=d.bones;for(const[k,ms]of Object.entries(a.garments))assert.ok(ms.every(m=>m.visible===(k===outfit)))}
});
test('palm retains measurable thickness over all gestures and poses',()=>{
 const a=createArm();for(const action of ['bend','reach','turn'])for(let n=0;n<=20;n++){
  a.apply({...INITIAL,action,pose:n/20});const d=a.inspect();assert.ok(d.measuredPalmThickness>.08&&d.measuredPalmThickness<.13);
  for(let i=0;i<a.bodyMesh.geometry.attributes.position.count;i++){const v=a.bodyMesh.getVertexPosition(i,new THREE.Vector3());assert.ok(v.toArray().every(Number.isFinite))}
 }
});
test('clothes and clay change presentation without changing bone transforms',()=>{
 const a=createArm();a.apply({...INITIAL,pose:1});const before=a.inspect().bones;a.apply({...INITIAL,pose:1,outfit:'armor',clay:true,grip:true});assert.deepEqual(a.inspect().bones,before);
});
test('one shot finishes without a timer loop; invalid changes are rejected',()=>{
 assert.equal(sample(0),0);assert.equal(sample(2000),1);assert.equal(sample(DURATION),0);assert.equal(sample(DURATION+1000),0);
 for(const p of [{pose:NaN},{outfit:'bad'},{yaw:151},{grip:1},{extra:true},[]])assert.throws(()=>validate(p));
});
