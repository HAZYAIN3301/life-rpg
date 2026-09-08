import test from 'node:test';
import assert from 'node:assert/strict';
import {deform,angles,validatePatch,INITIAL} from '../drawn-rig.mjs';
test('zero pose preserves source coordinates exactly',()=>{for(let y=0;y<=900;y+=5)for(let x=0;x<=640;x+=5)assert.deepEqual(deform(x,y,0),{x,y})});
test('head, opposite arm, legs and flared coat stay pinned throughout motion',()=>{
 const fixed=[[320,175],[365,242],[165,532],[214,400],[320,440],[407,518],[419,548],[426,563],[238,570],[361,675],[267,815]];
 for(let p=0;p<=1;p+=.05)for(const[x,y]of fixed)assert.deepEqual(deform(x,y,p),{x,y},'unrelated source pixels must not follow arm');
});
test('wrist follows elbow, deformation is finite and deterministic',()=>{
 assert.ok(deform(470,520,1).x>530);assert.ok(deform(470,520,1).y<450);
 for(let p=0;p<=1;p+=.1)for(let y=280;y<=610;y+=5)for(let x=370;x<=530;x+=5){const a=deform(x,y,p);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.deepEqual(a,deform(x,y,p))}
 assert.ok(-angles(1).elbow<Math.PI/2);
});
test('configuration rejects unknown, non-finite and out-of-range state before mutation',()=>{
 const saved={...INITIAL};for(const input of [null,[],{pose:NaN},{pose:1.1},{pose:-1},{playing:1},{cloth:'pink'},{deleteAccount:true}])assert.throws(()=>validatePatch(input));assert.deepEqual(INITIAL,saved);
 assert.deepEqual(validatePatch({pose:.5,cloth:'plum',original:true}),{pose:.5,cloth:'plum',original:true});
});
test('hand is rigid below the blend, including inner fingertips',()=>{
 const fingers=[[455,530],[468,551],[477,566]],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(let p=0;p<=1;p+=.05)for(const [x,y]of fingers){const a=deform(x,y,p),b=deform(x+5,y+5,p);assert.ok(Math.abs(distance(a,b)-Math.sqrt(50))<1e-8,'no stretched finger seam')}
});
