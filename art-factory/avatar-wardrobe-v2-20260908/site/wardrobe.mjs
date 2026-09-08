import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {normalizeLook} from './contract.mjs';
export async function loadWardrobe(){
 const loader=new GLTFLoader();
 const entries=await Promise.all(['rogue','knight','mage'].map(async id=>[id,await loader.loadAsync('./models/'+id+'.glb')]));
 const sources=Object.fromEntries(entries),root=sources.rogue.scene;
 const bones=new Map();root.traverse(o=>{if(o.isBone)bones.set(o.name,o);});
 const slots={upper:{},lower:{},head:{}},extras=[];
 const dye={skin:{value:new THREE.Color('#ffd3b0')},hair:{value:new THREE.Color('#ad6f4f')},cloth:{value:new THREE.Color('#138c6c')}};
 function prepareMaterial(original,id,part){
  const material=original.clone();material.roughness=.82;
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{labSkin:dye.skin,labHair:dye.hair,labCloth:dye.cloth});
   shader.fragmentShader='uniform vec3 labSkin;uniform vec3 labHair;uniform vec3 labCloth;\n'+shader.fragmentShader;
   // KayKit's authored palette atlas. Recolour only declared semantic cells, not the whole texture.
   let rule='if(cell.x==0.&&cell.y==0.) diffuseColor.rgb=labSkin*mix(.72,1.,localV);';
   if(id==='mage'&&part.startsWith('Arm'))rule+='if(cell.x==7.&&cell.y==2.) diffuseColor.rgb=labSkin*mix(.72,1.,localV);';
   if(id==='rogue'&&part==='Head')rule+='if(cell.x==1.&&cell.y==0.) diffuseColor.rgb=labHair*mix(.55,1.,localV);';
   if(id==='rogue'&&part!=='Head')rule+='if(cell.y==1.&&(cell.x==0.||cell.x==1.)) diffuseColor.rgb=labCloth*mix(.45,1.,localV);';
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n vec2 cell=floor(vMapUv*vec2(8.,4.));float localV=1.-fract(vMapUv.y*4.);'+rule+'\n#endif');
  };
  material.customProgramCacheKey=()=>id+':'+part;return material;
 }
 root.traverse(o=>{if(o.isMesh)o.visible=false;});
 for(const [id,gltf] of entries){
  const prefix=id[0].toUpperCase()+id.slice(1);
  for(const [slot,suffixes] of Object.entries({upper:['Body','ArmLeft','ArmRight'],lower:['LegLeft','LegRight'],head:['Head']})){
   const items=[];for(const suffix of suffixes){
    const original=gltf.scene.getObjectByName(prefix+'_'+suffix);if(!original)throw Error('Отсутствует часть '+prefix+'_'+suffix);
    if(!original.isSkinnedMesh)throw Error('Неподдерживаемая геометрия '+original.name);
    let mesh=original;
    if(id!=='rogue'){
     mesh=original.clone();mesh.geometry=original.geometry;mesh.material=original.material.clone();
     const shared=original.skeleton.bones.map(b=>{const target=bones.get(b.name);if(!target)throw Error('Несовместимый скелет');return target;});
     mesh.bind(new THREE.Skeleton(shared,original.skeleton.boneInverses.map(m=>m.clone())),original.bindMatrix);
     root.add(mesh);
    }
    mesh.material=prepareMaterial(original.material,id,suffix);
    mesh.castShadow=true;mesh.receiveShadow=true;items.push(mesh);
   }slots[slot][id]=items;
  }
 }
 function attach(original){
  if(!original)return null;const parent=bones.get(original.parent.name);if(!parent)throw Error('Нет совместимого крепления '+original.name);
  const copy=original.clone();copy.material=original.material.clone();copy.castShadow=true;parent.add(copy);return copy;
 }
 const cape=root.getObjectByName('Rogue_Cape');if(cape){extras.push(cape);cape.material=prepareMaterial(cape.material,'rogue','Cape');}
 const hats={knight:attach(sources.knight.scene.getObjectByName('Knight_Helmet')),mage:attach(sources.mage.scene.getObjectByName('Mage_Hat'))};
 // Use the creator's weapon and authored attachment transform, never an invented wrist offset.
 const weapon=sources.knight.scene.getObjectByName('1H_Sword')||sources.knight.scene.getObjectByName('Sword');
 let sword=null;
 if(weapon){const parent=bones.get(weapon.parent.name);if(parent){sword=weapon.clone();parent.add(sword);sword.castShadow=true;}}
 const mixer=new THREE.AnimationMixer(root);
 function apply(input){
  const look=normalizeLook(input);
  // Identity never changes with equipment: keep the same head under a helmet/hat.
  for(const [slot,options] of Object.entries(slots))for(const [id,meshes] of Object.entries(options))for(const mesh of meshes)mesh.visible=id===(slot==='head'?'rogue':look[slot]);
  for(const [id,hat]of Object.entries(hats))if(hat)hat.visible=look.head===id;
  if(cape)cape.visible=look.cape;if(sword)sword.visible=look.weapon==='sword';
  dye.skin.value.set(look.skin);dye.hair.value.set(look.hair);dye.cloth.value.set(look.cloth);
  return look;
 }
 function visibleBounds(){root.updateMatrixWorld(true);const box=new THREE.Box3();root.traverse(o=>{if(o.isMesh&&o.visible){if(o.isSkinnedMesh)o.computeBoundingBox();box.union(new THREE.Box3().setFromObject(o));}});return box;}
 function inspect(){return {bones:bones.size,sword:!!sword,swordParent:sword?.parent.name,visibleBounds:{min:visibleBounds().min.toArray(),max:visibleBounds().max.toArray()},meshes:Object.fromEntries(Object.entries(slots).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([id,a])=>[id,a.map(o=>o.name)]))])),visible:Object.values(slots).flatMap(v=>Object.values(v).flat()).filter(o=>o.visible).map(o=>o.name),animations:sources.rogue.animations.map(a=>a.name)};}
 return {root,mixer,animations:sources.rogue.animations,apply,inspect,sword,bones,visibleBounds};
}
