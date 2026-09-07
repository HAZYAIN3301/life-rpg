import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {SCHEMA,BONE_NAMES,PART_NAMES,SOCKET_NAMES,DEFAULT_LOOK,validateGLBEnvelope} from './contract.mjs';
import {applyLook,captureRestRig,poseRig,inspectRig,disposeRig,bakeClips} from './rig.mjs';
import {POSES} from './contract.mjs';

export async function exportRig(rig) {
  const before=rig.pose||'idle';const clips=rig.clips||bakeClips(rig);captureRestRig(rig);
  try {return await new GLTFExporter().parseAsync(rig.root,{binary:true,onlyVisible:false,trs:true,animations:clips});}
  finally {poseRig(rig,before,0);}
}
export async function importRig(bytes,look=DEFAULT_LOOK) {
  validateGLBEnvelope(bytes);
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  const root=gltf.scene.getObjectByName('Avatar'),bones={},parts={},meshes=[],materials=new Map(),byName=new Map();
  const fail=message=>{(root||gltf.scene).traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});throw new Error(message);};
  if(!root || root.userData.schema!==SCHEMA)fail('Expected pilot rig contract');
  let count=0;
  root.traverse(o=>{
    if(o.name){const all=byName.get(o.name)||[];all.push(o);byName.set(o.name,all);}
    if(o.isBone)bones[o.name]=o;
    if(o.isSkinnedMesh)meshes.push(o);
    for(const m of [].concat(o.material||[]))materials.set(m.name,m);
    if(o.geometry)count+=o.geometry.getAttribute('position')?.count||0;
  });
  if(count>100000 || !meshes.length)fail('Mesh budget invalid');
  for(const name of [...BONE_NAMES,...PART_NAMES,...SOCKET_NAMES])if(byName.get(name)?.length!==1)fail('Missing or duplicate '+name);
  for(const name of BONE_NAMES)if(!bones[name])fail('Not a bone '+name);
  for(const name of SOCKET_NAMES)if(byName.get(name)[0].isMesh)fail('Socket is geometry '+name);
  const skeleton=meshes[0].skeleton;
  if(skeleton.bones.length!==BONE_NAMES.length || meshes.some(m=>m.skeleton.bones.some((b,i)=>b!==skeleton.bones[i])))fail('Expected one shared skeleton');
  for(const m of meshes) {
    if(!m.geometry.getAttribute('skinWeight')||!m.geometry.getAttribute('skinIndex'))fail('Missing skinning');
    m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;
  }
  root.traverse(o=>{if(o.name)parts[o.name]=o;});
  const mats={skin:materials.get('Skin'),hair:materials.get('Hair'),cloth:materials.get('Cloth')};
  if(Object.values(mats).some(m=>!m?.color))fail('Missing semantic materials');
  const rest={};for(const name of BONE_NAMES)rest[name]={position:bones[name].position.clone(),quaternion:bones[name].quaternion.clone()};
  root.removeFromParent();
  const rig={root,bones,skeleton,meshes,parts,mats,rest,look};
  const clips=gltf.animations;
  for(const name of POSES)if(clips.filter(c=>c.name===name).length!==1)fail('Missing or duplicate animation '+name);
  for(const clip of clips) {
    if(!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>30)fail('Invalid animation duration');
    for(const track of clip.tracks)if(![...track.values,...track.times].every(Number.isFinite)||track.times.length>1800)fail('Invalid animation track');
  }
  rig.clips=clips;rig.mixer=new T.AnimationMixer(root);const actions=Object.fromEntries(clips.map(c=>[c.name,rig.mixer.clipAction(c)]));let active=null;
  rig.clipSampler=(pose,time)=>{const action=actions[pose];if(active!==action){rig.mixer.stopAllAction();action.reset().play();active=action;}action.paused=true;action.time=Math.max(0,time)%action.getClip().duration;rig.mixer.update(0);};
  applyLook(rig,look);poseRig(rig,'idle',0);
  const report=inspectRig(rig);
  if(report.errors.length){disposeRig(rig);throw new Error(report.errors.join(', '));}
  return rig;
}
