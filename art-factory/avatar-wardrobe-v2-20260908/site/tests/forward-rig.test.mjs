import test from 'node:test';import assert from 'node:assert/strict';
import {deformForward,JOINTS,forwardAngles,sampleGesture,GESTURE,validatePatch} from '../drawn-rig.mjs';
test('forward pose zero is exactly the source drawing',()=>{for(let y=0;y<=900;y+=5)for(let x=0;x<=640;x+=5)assert.deepEqual(deformForward(x,y,0),{x,y,z:0})});
test('elbow stays closer to torso instead of travelling outward with wrist',()=>{
 const e=deformForward(JOINTS.elbow.x,JOINTS.elbow.y,1),w=deformForward(JOINTS.wrist.x,JOINTS.wrist.y,1);
 assert.ok(e.x<JOINTS.elbow.x);assert.ok(w.x<e.x);assert.ok(w.y<e.y);assert.ok(w.z>0);
 assert.ok(Math.abs(e.y-JOINTS.elbow.y)<15);assert.equal(forwardAngles(1).elbow,Math.PI*.75);
});
test('forearm is foreshortened halfway through flexion and remains in front of torso',()=>{
 const e=deformForward(431,417,2/3),w=deformForward(461,487,2/3);assert.ok(w.z>50);
 assert.ok(Math.hypot(w.x-e.x,w.y-e.y)<30);
 for(let p=0;p<=1;p+=.025)for(let y=285;y<590;y+=5)for(let x=380;x<510;x+=5){const q=deformForward(x,y,p);assert.ok([q.x,q.y,q.z].every(Number.isFinite));assert.ok(q.z>=0)}
});
test('forward flexion preserves face, other arm, legs, coat hem',()=>{
 for(let p=0;p<=1;p+=.05)for(const [x,y]of [[320,175],[365,242],[165,532],[214,400],[320,440],[407,518],[419,548],[426,563],[238,570],[361,675],[267,815]])assert.deepEqual(deformForward(x,y,p),{x,y,z:0});
});
test('gesture has a hold, a return and a terminal rest; no endless loop',()=>{
 assert.equal(sampleGesture(0).pose,0);assert.equal(sampleGesture(GESTURE.lift+200).pose,1);assert.equal(sampleGesture(GESTURE.lift+200).phase,'hold');assert.equal(sampleGesture(GESTURE.total-500).phase,'lower');assert.deepEqual(sampleGesture(GESTURE.total),{pose:0,phase:'rest',done:true});assert.deepEqual(sampleGesture(GESTURE.total*2),sampleGesture(GESTURE.total));
 assert.deepEqual(validatePatch({action:'chest'}),{action:'chest'});assert.throws(()=>validatePatch({action:'delete'}));
});
