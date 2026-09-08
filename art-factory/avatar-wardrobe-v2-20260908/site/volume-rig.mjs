import * as THREE from 'three';

// Isolated engineering asset, not a finished Traveller model. Metre-like units.
export const INITIAL={pose:0,action:'bend',outfit:'short',yaw:25,playing:false,clay:false,grip:false};
export const DURATION=4200;
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
export function sample(ms){return ms<1700?ease(ms/1700):ms<2300?1:ms<DURATION?1-ease((ms-2300)/1900):0}
export function validate(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Нужен объект параметров');
 for(const[k,v]of Object.entries(p)){
  if(!(k in INITIAL))throw Error('Неизвестный параметр: '+k);
  if(k==='pose'&&(!Number.isFinite(v)||v<0||v>1))throw Error('Поза от 0 до 1');
  if(k==='yaw'&&(!Number.isFinite(v)||v< -90||v>150))throw Error('Ракурс от −90 до 150');
  if(k==='action'&&!['bend','reach','turn'].includes(v))throw Error('Неизвестный жест');
  if(k==='outfit'&&!['short','long','armor'].includes(v))throw Error('Неизвестная одежда');
  if(['playing','clay','grip'].includes(k)&&typeof v!=='boolean')throw Error('Нужен переключатель');
 }return p;
}
export function makeMaterial(hex){
 const mat=new THREE.MeshToonMaterial({color:hex});
 // Matte pigment variation, tied to object space so it does not crawl with camera.
 mat.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 pigmentPosition;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npigmentPosition=position;');
  s.fragmentShader='varying vec3 pigmentPosition;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=fract(sin(dot(floor(pigmentPosition*500.0),vec3(12.9898,78.233,39.425)))*43758.5453);
   diffuseColor.rgb*=0.97+0.06*grain;`);
 };return mat;
}
function loft(profile,segments=32){
 const positions=[],indices=[];
 for(const [y,rx,rz,cx=0,cz=0]of profile)for(let k=0;k<segments;k++){
  const a=k/segments*Math.PI*2;positions.push(cx+rx*Math.cos(a),y,cz+rz*Math.sin(a));
 }
 for(let j=0;j<profile.length-1;j++)for(let k=0;k<segments;k++){
  const a=j*segments+k,b=j*segments+(k+1)%segments,c=a+segments,d=b+segments;
  indices.push(a,b,c,b,d,c);
 }
 // Actual end caps, not an open ribbon viewed edge-on.
 for(const j of [0,profile.length-1]){
  const p=profile[j],center=positions.length/3;positions.push(p[3]||0,p[0],p[4]||0);
  for(let k=0;k<segments;k++){const a=j*segments+k,b=j*segments+(k+1)%segments;indices.push(...(j===0?[center,b,a]:[center,a,b]))}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function profileAt(rows,y){
 if(y<=rows[0][0])return rows[0].slice(1);
 for(let i=0;i<rows.length-1;i++)if(y>=rows[i][0]&&y<=rows[i+1][0]){
  const t=(y-rows[i][0])/(rows[i+1][0]-rows[i][0]);return [THREE.MathUtils.lerp(rows[i][1],rows[i+1][1],t),THREE.MathUtils.lerp(rows[i][2],rows[i+1][2],t)];
 }return rows.at(-1).slice(1);
}
export function createArm(){
 const root=new THREE.Group();root.name='volume-study';
 const shoulder=new THREE.Bone();shoulder.name='shoulder';
 const elbow=new THREE.Bone();elbow.name='elbow';elbow.position.y=-.62;shoulder.add(elbow);
 const wrist=new THREE.Bone();wrist.name='wrist';wrist.position.y=-.55;elbow.add(wrist);
 const bones=[shoulder,elbow,wrist];root.add(shoulder);root.updateMatrixWorld(true);
 const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
 const skin=makeMaterial('#dab385'),teal=makeMaterial('#32696c'),cream=makeMaterial('#d8c69e'),leather=makeMaterial('#594735'),gold=makeMaterial('#bd9451');
 const meshes=[],garments={short:[],long:[],armor:[]};
 function bind(g,mat){
  const idx=[],w=[],p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const d=-p.getY(i),blend=ease((d-.52)/.20),handBlend=ease((d-1.11)/.09);
   idx.push(0,1,2,0);w.push(1-blend,blend*(1-handBlend),handBlend,0);
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(idx,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(w,4));
  const m=new THREE.SkinnedMesh(g,mat);m.frustumCulled=false;root.add(m);m.bind(skeleton);meshes.push(m);return m;
 }
 const shape=[[0,.14,.145],[.12,.159,.15],[.30,.14,.13],[.48,.116,.114],[.62,.11,.106],[.76,.126,.111],[.92,.102,.091],[1.08,.079,.071],[1.17,.066,.057],[1.215,.079,.052],[1.30,.086,.045],[1.36,.073,.039]];
 function armGeo(start,end,extra=0){
  const rows=[];
  for(let n=0;n<=64;n++){const d=THREE.MathUtils.lerp(start,end,n/64),[rx,rz]=profileAt(shape,d);rows.push([-d,rx+extra,rz+extra])}
  return loft(rows);
 }
 const bodyMesh=bind(armGeo(0,1.36),skin);
 garments.short.push(bind(armGeo(-.005,.36,.027),teal),bind(armGeo(.29,.385,.04),cream));
 garments.long.push(bind(armGeo(-.01,1.08,.026),teal),bind(armGeo(1.00,1.12,.041),cream));
 garments.armor.push(bind(armGeo(-.01,.36,.028),teal),bind(armGeo(.30,.4,.04),cream),bind(armGeo(.79,1.1,.041),leather),bind(armGeo(.81,.845,.052),gold),bind(armGeo(1.055,1.105,.05),gold));
 // Hand and fingers have real closed cross-sections and share the wrist socket.
 const hand=new THREE.Group();hand.name='hand';wrist.add(hand);
 // Palm is part of the continuous skin mesh above: no intersecting wrist end caps.
 const fingers=[];
 for(let i=0;i<4;i++){
  const finger=new THREE.Group();finger.position.set((i-1.5)*.043,-.17,0);hand.add(finger);
  const len=[.137,.164,.152,.117][i];
  const proximal=new THREE.Mesh(loft([[.015,.025,.038],[-.025,.024,.029],[-len*.55,.021,.024]]),skin);finger.add(proximal);
  const knuckle=new THREE.Group();knuckle.position.y=-len*.55;finger.add(knuckle);
  knuckle.add(new THREE.Mesh(loft([[.01,.021,.024],[-len*.25,.020,.022],[-len*.45,.011,.012]]),skin));
  fingers.push({finger,knuckle});
 }
 const thumb=new THREE.Group();thumb.position.set(-.069,-.052,.008);thumb.rotation.z=-.52;hand.add(thumb);
 thumb.add(new THREE.Mesh(loft([[.015,.028,.027],[-.07,.027,.025],[-.12,.015,.017]]),skin));
 const socket=new THREE.Group();socket.name='grip-socket';socket.position.set(0,-.185,.087);hand.add(socket);
 const hilt=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.35,12),leather);hilt.rotation.z=Math.PI/2;socket.add(hilt);
 const guard=new THREE.Mesh(new THREE.CapsuleGeometry(.02,.20,4,8),gold);guard.position.x=.20;socket.add(guard);
 const blade=new THREE.Mesh(loft([[0,.047,.017],[-.45,.041,.011],[-.58,.001,.002]]),makeMaterial('#cbd3ce'));blade.rotation.z=Math.PI/2;blade.position.x=.22;socket.add(blade);
 // Torso is only a cropped shoulder support in this close-up, not a proposed hero.
 const torso=new THREE.Mesh(loft([[.10,.23,.19],[-.1,.39,.235],[-.43,.37,.22],[-.87,.30,.20],[-1.15,.33,.22]]),teal);torso.position.x=-.36;root.add(torso);
 const insert=new THREE.Mesh(loft([[.02,.12,.13],[-.34,.13,.14],[-.82,.12,.13],[-1.11,.10,.12]]),cream);insert.position.set(-.39,0,.16);root.add(insert);
 const originals=new Map();root.traverse(o=>{if(o.isMesh)originals.set(o,o.material)});
 const clay=makeMaterial('#a8b4b8');
 function apply(state){
  const t=ease(state.pose);
  shoulder.rotation.set(-.12,0,.10);
  elbow.rotation.set(-.08,0,0);wrist.rotation.set(0,0,0);
  if(state.action==='bend'){
   shoulder.rotation.x=-.12-.37*t;shoulder.rotation.z=.10-.19*t;
   elbow.rotation.x=-.08-1.68*t;wrist.rotation.x=.13*t;
  }else if(state.action==='reach'){
   shoulder.rotation.x=-.12-1.04*t;elbow.rotation.x=-.08-.30*t;wrist.rotation.y=.35*t;
  }else{
   shoulder.rotation.x=-.70;elbow.rotation.x=-1.00;wrist.rotation.y=THREE.MathUtils.lerp(-1.0,1.0,t);
  }
  // Local elbow volume corrective belongs to the rig, shared by all clothes.
  // LBS alone pinches the joint; compensate cross-section using the same weights.
  for(const m of meshes){
   const p=m.geometry.attributes.position;
   if(!m.userData.rest)m.userData.rest=new Float32Array(p.array);
   const rest=m.userData.rest;
   for(let i=0;i<p.count;i++){
    const d=-rest[i*3+1],weight=ease((d-.52)/.20),factor=1/Math.sqrt(1-2*weight*(1-weight)*(1-Math.cos(elbow.rotation.x)));
    p.setXYZ(i,rest[i*3],rest[i*3+1],rest[i*3+2]*Math.min(1.55,factor));
   }p.needsUpdate=true;m.geometry.computeVertexNormals();
  }
  for(const [key,group]of Object.entries(garments))for(const m of group)m.visible=state.outfit===key;
  for(const {finger,knuckle}of fingers){finger.rotation.x=state.grip?-1.12:-.12;knuckle.rotation.x=state.grip?-1.30:-.10}
  thumb.rotation.x=state.grip?-1.0:-.16;thumb.rotation.z=state.grip?-.30:-.52;socket.visible=state.grip;
  for(const [o,m]of originals)o.material=state.clay?clay:m;
  root.updateMatrixWorld(true);skeleton.update();
 }
 function inspect(){
  root.updateMatrixWorld(true);skeleton.update();
  const front=bodyMesh.getVertexPosition(58*32+8,new THREE.Vector3()),back=bodyMesh.getVertexPosition(58*32+24,new THREE.Vector3());
  return {bones:bones.map(b=>({name:b.name,position:b.getWorldPosition(new THREE.Vector3()).toArray()})),sharedSkeleton:meshes.every(m=>m.skeleton===skeleton),skinnedMeshes:meshes.length,measuredPalmThickness:front.distanceTo(back),source:'Closed-volume procedural arm study; not a production character',productionWrites:0};
 }
 apply(INITIAL);return {root,apply,inspect,skeleton,bodyMesh,hand,garments};
}
