import * as T from 'three';
import {BONE_NAMES, PART_NAMES, SOCKET_NAMES, DEFAULT_LOOK, COLORS, parseLook, POSES, SCHEMA} from './contract.mjs';

const v = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const q = new T.Quaternion();
const down = v(0,-1,0);
const smooth = x => x*x*(3-2*x);
const material = (name,color) => Object.assign(new T.MeshStandardMaterial({color,roughness:.94,metalness:0}),{name});

// Deterministic engineering mannequin, not approved Traveller art.
// All dimensions below are metres in the same bind pose. No per-look bone offsets.
export function createPilotRig() {
  const root = new T.Group(); root.name='Avatar'; root.userData.schema=SCHEMA;
  root.userData.artStatus='engineering-mannequin-not-approved';
  const bones={}, names=[], parts={}, meshes=[];
  function bone(name,parent,position) {
    const b=new T.Bone(); b.name=name; b.position.copy(v(...position));
    (parent ? bones[parent] : root).add(b); bones[name]=b; names.push(name); return b;
  }
  bone('Hips',null,[0,.98,0]); bone('Spine','Hips',[0,.18,0]);
  bone('Chest','Spine',[0,.25,0]); bone('Neck','Chest',[0,.15,0]); bone('Head','Neck',[0,.07,0]);
  for (const [side,s] of [['L',1],['R',-1]]) {
    bone('UpperArm'+side,'Chest',[s*.25,.025,0]);
    bone('LowerArm'+side,'UpperArm'+side,[0,-.31,0]);
    bone('Hand'+side,'LowerArm'+side,[0,-.28,0]);
    bone('UpperLeg'+side,'Hips',[s*.105,0,0]);
    bone('LowerLeg'+side,'UpperLeg'+side,[0,-.44,0]);
    bone('Foot'+side,'LowerLeg'+side,[0,-.43,0]);
  }
  root.updateMatrixWorld(true);
  const skeleton=new T.Skeleton(names.map(n=>bones[n])); skeleton.calculateInverses();
  const indices=Object.fromEntries(names.map((n,i)=>[n,i]));
  const mats={skin:material('Skin',COLORS.skin.warm), hair:material('Hair',COLORS.hairColor.chestnut),
    cloth:material('Cloth',COLORS.cloth.teal), linen:material('Linen','#d5c6a2'),
    leather:material('Leather','#4b3530'), pants:material('Pants','#8b8067'),
    dark:material('Ink','#202b31'), brass:material('Brass','#c49a52'), scarf:material('Scarf','#ae6247'),
    steel:material('Steel','#93a8af')};
  const group=(name,parent=root)=>{const g=new T.Group();g.name=name;parent.add(g);parts[name]=g;return g;};
  function solid(name,geo,mat,parent,pos,scale) {
    const m=new T.Mesh(geo,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;
    if(pos)m.position.copy(v(...pos));if(scale)m.scale.set(...scale);parent.add(m);return m;
  }
  const ellipsoid=(name,parent,pos,scale,mat)=>solid(name,new T.SphereGeometry(1,16,12),mat,parent,pos,scale);
  function box(name,parent,pos,size,mat) {return solid(name,new T.BoxGeometry(...size),mat,parent,pos);}
  // Ring geometry with explicit skin weights. The two sides of a joint share rings,
  // so bending is deformation rather than rotating disconnected pictures.
  function tube(name,parent,rings,mat,segments=16) {
    if(rings[0].y>rings[rings.length-1].y)rings=[...rings].reverse();
    const positions=[],skinIndices=[],skinWeights=[],uv=[],triangles=[];
    rings.forEach((r,ri)=>{
      for(let j=0;j<=segments;j++) {
        const a=j/segments*Math.PI*2;
        positions.push(r.x+Math.cos(a)*r.rx,r.y,r.z+Math.sin(a)*r.rz);
        const w=r.w;skinIndices.push(indices[w[0]],indices[w[2]||w[0]],0,0);skinWeights.push(w[1],1-w[1],0,0);
        uv.push(j/segments,ri/(rings.length-1));
        if(ri<rings.length-1 && j<segments) {
          const k=ri*(segments+1)+j,n=k+segments+1;
          triangles.push(k,n,k+1,k+1,n,n+1);
        }
      }
    });
    // Close both ring ends; the cap centres receive exactly the end-ring weighting.
    for(const ri of [0,rings.length-1]) {
      const r=rings[ri],c=positions.length/3;positions.push(r.x,r.y,r.z);
      skinIndices.push(indices[r.w[0]],indices[r.w[2]||r.w[0]],0,0);skinWeights.push(r.w[1],1-r.w[1],0,0);uv.push(.5,.5);
      for(let j=0;j<segments;j++){const a=ri*(segments+1)+j;triangles.push(...(ri===0?[c,a,a+1]:[c,a+1,a]));}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(triangles);geo.computeVertexNormals();
    const m=new T.SkinnedMesh(geo,mat);m.name=name;parent.add(m);m.bind(skeleton,new T.Matrix4());
    m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;meshes.push(m);return m;
  }
  const ring=(x,y,z,rx,rz,boneA,weight=1,boneB)=>({x,y,z,rx,rz,w:[boneA,weight,boneB]});
  const trunk=(extra=0)=>[
    ring(0,.94,0,.153+extra,.093+extra,'Hips'), ring(0,1.02,0,.162+extra,.101+extra,'Hips',.65,'Spine'),
    ring(0,1.13,0,.133+extra,.084+extra,'Spine'),ring(0,1.28,0,.184+extra,.10+extra,'Spine',.4,'Chest'),
    ring(0,1.41,0,.216+extra,.094+extra,'Chest'),ring(0,1.475,0,.093+extra,.070+extra,'Chest')];
  tube('BodyTorso',root,trunk(),mats.linen);
  tube('NeckSkin',root,[ring(0,1.45,0,.058,.055,'Chest'),ring(0,1.56,0,.065,.057,'Neck'),ring(0,1.655,0,.064,.052,'Head')],mats.skin);
  ellipsoid('Face',bones.Head,[0,.102,.006],[.115,.157,.111],mats.skin);
  for(const s of [-1,1]) {
    ellipsoid('Ear'+s,bones.Head,[s*.113,.101,.0],[.023,.038,.022],mats.skin);
    ellipsoid('Eye'+s,bones.Head,[s*.047,.116,.107],[.015,.022,.006],mats.dark);
    const brow=box('Brow'+s,bones.Head,[s*.047,.149,.105],[.036,.010,.009],mats.hair);brow.rotation.z=s*.08;
  }
  ellipsoid('Nose',bones.Head,[0,.083,.113],[.017,.028,.019],mats.skin);
  box('Mouth',bones.Head,[0,.039,.106],[.034,.005,.004],mats.leather);
  function hand(side,closed,parent) {
    const g=group('Hand'+side+'_'+(closed?'grip':'open'),parent);
    // Socket names must remain unique: GLTFExporter renames duplicate node names.
    box('HandPalm'+side+(closed?'Grip':'Open'),g,[0,-.055,.008],[.067,.092,.045],mats.skin);
    for(let f=0;f<4;f++) {
      if(closed) {
        const y=-.033-f*.020;
        const curve=new T.CatmullRomCurve3([v(-.029,y,.022),v(-.030,y,.063),v(0,y,.080),v(.018,y,.064)]);
        solid('Finger'+side+f,new T.TubeGeometry(curve,8,.008,6,false),mats.skin,g);
      } else ellipsoid('Finger'+side+f,g,[(f-1.5)*.017,-.119+Math.abs(f-1.5)*.004,.008],[.008,.031,.010],mats.skin);
    }
    const thumb=ellipsoid('Thumb'+side,g,[.035,-.059,closed?.047:.006],[.012,.031,.012],mats.skin);thumb.rotation.z=-.5;
    return g;
  }
  for (const [side,s] of [['L',1],['R',-1]]) {
    const x=s*.25;
    tube('ArmSkin'+side,root,[ring(x,1.45,0,.062,.062,'UpperArm'+side),ring(x,1.31,0,.061,.058,'UpperArm'+side),
      ring(x,1.16,0,.044,.043,'UpperArm'+side,.75,'LowerArm'+side),ring(x,1.11,0,.043,.042,'UpperArm'+side,.25,'LowerArm'+side),
      ring(x,.99,0,.044,.041,'LowerArm'+side),ring(x,.84,0,.033,.032,'Hand'+side)],mats.skin);
    hand(side,false,bones['Hand'+side]);if(side==='R')hand(side,true,bones.HandR);
    const ankle=bones['Foot'+side];box('BootSole'+side,ankle,[0,-.083,.055],[.142,.054,.27],mats.dark);
    ellipsoid('Boot'+side,ankle,[0,-.028,.050],[.069,.058,.128],mats.leather);
    tube('Sock'+side,root,[ring(s*.105,.12,0,.051,.050,'Foot'+side),ring(s*.105,.26,0,.056,.052,'LowerLeg'+side)],mats.leather);
  }
  const short=group('Hair_crop',bones.Head),pony=group('Hair_ponytail',bones.Head);
  for(const g of [short,pony]) {
    solid('HairCap'+g.name,new T.SphereGeometry(1,18,12,0,Math.PI*2,0,1.40),mats.hair,g,[0,.127,-.006],[.124,.142,.121]);
    for(const s of [-1,1]) ellipsoid('SideLock'+s,g,[s*.105,.10,-.014],[.023,.076,.056],mats.hair);
  }
  for(let i=0;i<5;i++) {
    const lock=ellipsoid('Fringe'+i,short,[(i-2)*.037,.198,.076],[.032,.063,.056],mats.hair);lock.rotation.z=-.38;
  }
  const tail=group('HairTail',pony);tail.position.set(0,.16,-.103);
  ellipsoid('TailVolume',tail,[0,-.10,-.055],[.051,.154,.057],mats.hair);
  ellipsoid('HairTie',tail,[0,.008,-.027],[.053,.022,.038],mats.brass);
  for(const [key,extra] of [['traveller',.012],['field-vest',.018]]) {
    const top=group('Top_'+key);tube('Jacket_'+key,top,trunk(extra),mats.cloth);
    if(key==='traveller')for(const [side,s] of [['L',1],['R',-1]]) {
      const x=s*.25;tube('Sleeve'+side,top,[ring(x,1.455,0,.079,.079,'UpperArm'+side),ring(x,1.32,0,.073,.070,'UpperArm'+side),
        ring(x,1.17,0,.061,.058,'UpperArm'+side,.75,'LowerArm'+side),ring(x,1.10,0,.059,.057,'UpperArm'+side,.25,'LowerArm'+side),
        ring(x,.94,0,.052,.05,'LowerArm'+side),ring(x,.90,0,.050,.048,'LowerArm'+side)],mats.cloth);
    }
    // Rigid accessories still follow named bones; visibility belongs to their garment.
    const trim=group('Trim_'+key,bones.Chest);trim.userData.owner='Top_'+key;
    for(const s of [-1,1]) {
      const lapel=box('Lapel'+s,trim,[s*.057,.005,.109],[.046,.16,.012],key==='traveller'?mats.linen:mats.leather);lapel.rotation.z=s*.24;
    }
    for(let i=0;i<3;i++)ellipsoid('Button'+i,trim,[0,-.07-i*.063,.121],[.008,.008,.006],mats.brass);
  }
  for(const [key,extra] of [['trousers',.012],['ranger',.023]]) {
    const bottom=group('Bottom_'+key);
    tube('Waist_'+key,bottom,[ring(0,.96,0,.17,.112,'Hips'),ring(0,1.035,0,.15,.105,'Hips')],mats.leather);
    for(const [side,s]of[['L',1],['R',-1]])tube('Leg_'+key+side,bottom,[
      ring(s*.105,.985,0,.09+extra,.097+extra,'UpperLeg'+side),ring(s*.105,.77,0,.079+extra,.080+extra,'UpperLeg'+side),
      ring(s*.105,.585,0,.057+extra,.062+extra,'UpperLeg'+side,.8,'LowerLeg'+side),
      ring(s*.105,.495,0,.055+extra,.06+extra,'UpperLeg'+side,.2,'LowerLeg'+side),
      ring(s*.105,.30,0,.056+extra,.051+extra,'LowerLeg'+side),ring(s*.105,.22,0,.049+extra,.045+extra,'LowerLeg'+side)],key==='ranger'?mats.dark:mats.pants);
  }
  const grip=group('GripR',bones.HandR);grip.position.set(0,-.064,.051);
  const palm=group('PalmL',bones.HandL);palm.position.set(0,-.065,.032);
  const weapon=group('Weapon_training-blade',grip);
  solid('Hilt',new T.CylinderGeometry(.012,.013,.16,10),mats.leather,weapon,[0,0,0]);
  box('Guard',weapon,[0,.097,0],[.18,.032,.045],mats.brass);
  solid('Pommel',new T.SphereGeometry(.020,8,6),mats.brass,weapon,[0,-.09,0]);
  box('Blade',weapon,[0,.34,0],[.067,.46,.023],mats.steel);
  const tip=solid('Tip',new T.ConeGeometry(.041,.10,4),mats.steel,weapon,[0,.62,0]);tip.rotation.y=Math.PI/4;
  const rig={root,bones,skeleton,parts,meshes,mats,look:{...DEFAULT_LOOK},rest:{}};
  for(const name of names)rig.rest[name]={position:bones[name].position.clone(),quaternion:bones[name].quaternion.clone()};
  applyLook(rig,DEFAULT_LOOK);poseRig(rig,'idle',0);return rig;
}

export function applyLook(rig,input) {
  const look=parseLook(input);
  for(const name of PART_NAMES)if(!rig.parts[name])throw new Error('Missing part '+name);
  for(const slot of ['hair','top','bottom'])for(const [name,g]of Object.entries(rig.parts)) {
    const prefix=slot[0].toUpperCase()+slot.slice(1)+'_';
    if(name.startsWith(prefix))g.visible=name===prefix+look[slot];
  }
  for(const g of Object.values(rig.parts))if(g.userData.owner)g.visible=g.userData.owner==='Top_'+look.top;
  rig.parts['Weapon_training-blade'].visible=look.weapon==='training-blade';
  rig.parts.HandR_grip.visible=look.weapon==='training-blade';rig.parts.HandR_open.visible=look.weapon==='none';
  for(const [key,mat]of [['skin','skin'],['hairColor','hair'],['cloth','cloth']])rig.mats[mat].color.set(COLORS[key][look[key]]);
  rig.look=look;return look;
}

function worldDirection(bone,restAxis,direction) {
  const parentQ=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
  bone.quaternion.setFromUnitVectors(restAxis,direction.clone().normalize().applyQuaternion(parentQ));
  bone.updateWorldMatrix(false,true);
}
export function solveTwoBone(upper,lower,end,target,pole) {
  upper.updateWorldMatrix(true,true);
  const a=upper.getWorldPosition(v()),l1=lower.position.length(),l2=end.position.length();
  const direction=target.clone().sub(a),raw=direction.length();if(raw<1e-8)return false;
  direction.normalize();const d=T.MathUtils.clamp(raw,Math.abs(l1-l2)+.00001,l1+l2-.00001);
  const projected=pole.clone().sub(a).addScaledVector(direction,-pole.clone().sub(a).dot(direction));
  if(projected.lengthSq()<1e-9)projected.copy(v(0,0,1)).addScaledVector(direction,-direction.z);
  projected.normalize();const c=(l1*l1+d*d-l2*l2)/(2*l1*d),s=Math.sqrt(Math.max(0,1-c*c));
  const elbow=a.clone().addScaledVector(direction,l1*c).addScaledVector(projected,l1*s);
  worldDirection(upper,lower.position.clone().normalize(),elbow.clone().sub(a));
  worldDirection(lower,end.position.clone().normalize(),a.clone().addScaledVector(direction,d).sub(elbow));
  return Math.abs(raw-d)<.0001;
}
function worldRotation(bone,rotation) {bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));bone.updateWorldMatrix(false,true);}

export function poseRig(rig,pose,time=0) {
  if(!POSES.includes(pose) || !Number.isFinite(time))throw new Error('Invalid pose');
  if(rig.clipSampler){rig.clipSampler(pose,time);rig.root.updateMatrixWorld(true);rig.skeleton.update();rig.pose=pose;
    rig.petTarget=pose==='pet'?v(.54,.67,.115+Math.sin(time*Math.PI*2/2.6)*.025):null;return rig;}
  const {bones:b}=rig;for(const name of BONE_NAMES){b[name].position.copy(rig.rest[name].position);b[name].quaternion.copy(rig.rest[name].quaternion);}
  const phase=time*Math.PI*2,breath=Math.sin(phase/4.6);
  b.Chest.rotation.x=.016*breath;b.Head.rotation.y=.025*Math.sin(phase/5.8);
  b.UpperArmL.rotation.z=.07;b.UpperArmR.rotation.z=-.07;
  b.LowerArmL.rotation.x=-.08;b.LowerArmR.rotation.x=-.10;
  const footTargets={L:v(.105,.11,0),R:v(-.105,.11,0)};
  let petTarget=null;
  if(pose==='walk') {
    const p=time/1.35*Math.PI*2;b.Hips.position.y=.945+.009*Math.cos(2*p);
    for(const [side,offset]of[['L',0],['R',Math.PI]]) {
      const a=p+offset;footTargets[side].z=.14*Math.cos(a);footTargets[side].y+=.085*Math.max(0,Math.sin(a));
      b['UpperArm'+side].rotation.x=.24*Math.cos(a);b['LowerArm'+side].rotation.x=-.12;
    }
  } else if(pose==='sit') {
    b.Hips.position.y=.61;b.Chest.rotation.x=.055;
    footTargets.L.z=.37;footTargets.R.z=.37;
  } else if(pose==='pet') {
    b.Hips.position.y=.72;b.Chest.rotation.z=-.12;b.Chest.rotation.x=.13;b.Head.rotation.z=-.16;
    footTargets.L.x=.17;footTargets.R.x=-.17;
    petTarget=v(.54,.67,.115+Math.sin(phase/2.6)*.025);
  }
  rig.root.updateMatrixWorld(true);
  for(const side of ['L','R']) {
    solveTwoBone(b['UpperLeg'+side],b['LowerLeg'+side],b['Foot'+side],footTargets[side],v(side==='L'?.105:-.105,.7,1));
    worldRotation(b['Foot'+side],new T.Quaternion());
  }
  if(pose==='sit')for(const [side,s]of[['L',1],['R',-1]]) {
    solveTwoBone(b['UpperArm'+side],b['LowerArm'+side],b['Hand'+side],v(s*.18,.69,.26),v(s*.6,.9,-.1));
  }
  if(petTarget) {
    const palmRotation=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0));
    const wristTarget=petTarget.clone().sub(rig.parts.PalmL.position.clone().applyQuaternion(palmRotation));
    solveTwoBone(b.UpperArmL,b.LowerArmL,b.HandL,wristTarget,v(.65,1.1,.3));worldRotation(b.HandL,palmRotation);
  }
  const tail=rig.parts.HairTail;if(tail)tail.rotation.x=.06*Math.sin(phase/3.8);
  rig.root.updateMatrixWorld(true);rig.skeleton.update();rig.pose=pose;rig.petTarget=petTarget;return rig;
}

export function inspectRig(rig) {
  const errors=[],weights=[];let vertices=0,triangles=0;
  for(const name of [...BONE_NAMES,...PART_NAMES,...SOCKET_NAMES])if(!rig.root.getObjectByName(name))errors.push('Missing '+name);
  rig.root.updateMatrixWorld(true);rig.skeleton.update();
  for(const mesh of rig.meshes) {
    const idx=mesh.geometry.getAttribute('skinIndex'),w=mesh.geometry.getAttribute('skinWeight'),p=mesh.geometry.getAttribute('position');
    vertices+=p.count;triangles+=(mesh.geometry.index?.count||p.count)/3;
    for(let i=0;i<w.count;i++) {
      const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);weights.push(Math.abs(1-sum));
      if(!Number.isFinite(sum)||Math.abs(1-sum)>1e-5)errors.push('Invalid weights '+mesh.name);
      if([idx.getX(i),idx.getY(i),idx.getZ(i),idx.getW(i)].some(n=>n<0||n>=rig.skeleton.bones.length))errors.push('Invalid bone index');
      const point=v().fromBufferAttribute(p,i);mesh.applyBoneTransform(i,point);
      if(!Number.isFinite(point.length()) || point.length()>4)errors.push('Invalid deformed vertex');
    }
  }
  const footHeights=['L','R'].map(s=>rig.bones['Foot'+s].getWorldPosition(v()).y-.11);
  const contact=rig.petTarget?rig.parts.PalmL.getWorldPosition(v()).distanceTo(rig.petTarget):null;
  const handError=rig.parts['Weapon_training-blade'].getWorldPosition(v()).distanceTo(rig.parts.GripR.getWorldPosition(v()));
  return {errors:[...new Set(errors)],boneCount:rig.skeleton.bones.length,skinnedMeshes:rig.meshes.length,vertices,triangles,
    maxWeightError:Math.max(0,...weights),footHeights,contactError:contact,gripError:handError};
}

export function captureRestRig(rig) {
  for(const name of BONE_NAMES){rig.bones[name].position.copy(rig.rest[name].position);rig.bones[name].quaternion.copy(rig.rest[name].quaternion);}
  rig.root.updateMatrixWorld(true);rig.skeleton.update();
}
export function disposeRig(rig) {
  rig.mixer?.stopAllAction();rig.mixer?.uncacheRoot(rig.root);
  const geometries=new Set(),materials=new Set();rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());rig.skeleton.dispose();
}

export function bakeClips(rig) {
  const definitions={idle:4.6,walk:1.35,sit:4.6,pet:2.6},clips=[];
  for(const [pose,duration]of Object.entries(definitions)) {
    const count=Math.ceil(duration*30),times=[],tracks={},extra=rig.parts.HairTail;
    for(const name of BONE_NAMES)tracks[name]={position:[],quaternion:[]};
    if(extra)tracks.HairTail={position:[],quaternion:[]};
    for(let i=0;i<=count;i++) {
      const time=i*duration/count;times.push(time);poseRig(rig,pose,i===count?0:time);
      for(const [name,track]of Object.entries(tracks)) {const object=rig.bones[name]||rig.parts[name];object.position.toArray(track.position,track.position.length);object.quaternion.toArray(track.quaternion,track.quaternion.length);}
    }
    const keys=[];for(const [name,track]of Object.entries(tracks)){keys.push(new T.VectorKeyframeTrack(name+'.position',times,track.position),new T.QuaternionKeyframeTrack(name+'.quaternion',times,track.quaternion));}
    clips.push(new T.AnimationClip(pose,duration,keys));
  }
  captureRestRig(rig);return clips;
}
