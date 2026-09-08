import * as T from 'three';
import {ease,sample,DURATION} from './volume-rig.mjs';
export {sample,DURATION};
export const SOURCE_SIZE=[640,900];
export const INITIAL={pose:0,yaw:0,outfit:'traveller',clay:false,playing:false};
export function validate(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Нужен объект параметров');
 for(const[k,v]of Object.entries(p)){
  if(!Object.hasOwn(INITIAL,k))throw Error('Неизвестный параметр');
  if(k==='pose'&&(!Number.isFinite(v)||v<0||v>1))throw Error('Положение: 0–1');
  if(k==='yaw'&&(!Number.isFinite(v)||v< -120||v>180))throw Error('Ракурс: −120–180°');
  if(k==='outfit'&&!['traveller','jacket'].includes(v))throw Error('Неизвестная одежда');
  if(['clay','playing'].includes(k)&&typeof v!=='boolean')throw Error('Нужен переключатель');
 }return p;
}
// Art geometry, in the original drawing's pixel coordinates. This is a custom
// volume reconstruction, NOT an artist-authored model or a projection billboard.
const V=(x,y,z=0)=>new T.Vector3(x-320,860-y,z);
function geometry(points,indices){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();
 const uv=[];for(let i=0;i<points.length;i+=3)uv.push((points[i]+320)/SOURCE_SIZE[0],1-(860-points[i+1])/SOURCE_SIZE[1]);
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;
}
function rings(rows,{segments=48,start=0,end=Math.PI*2,caps=true,flatten=1}={}){
 const p=[],ids=[],closed=end-start>Math.PI*2-.001,n=closed?segments:segments+1;
 for(const[y,x,rx,rz,z=0]of rows)for(let j=0;j<n;j++){
  const a=start+(end-start)*j/segments,s=Math.sin(a);
  p.push(x-320+rx*Math.cos(a),860-y,z+rz*Math.sign(s)*Math.pow(Math.abs(s),flatten));
 }
 for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){
  const a=i*n+j,b=i*n+(j+1)%n,c=a+n,d=b+n;ids.push(a,b,c,b,d,c);
 }
 if(caps&&closed)for(const r of [0,rows.length-1]){
  const[y,x,,,z=0]=rows[r],center=p.length/3;p.push(x-320,860-y,z);
  for(let j=0;j<n;j++)ids.push(...(r===0?[center,r*n+(j+1)%n,r*n+j]:[center,r*n+j,r*n+(j+1)%n]));
 }
 return geometry(p,ids);
}
function tuft(points,width,depth,sharp=false){
 const curve=new T.CatmullRomCurve3(points.map(p=>V(...p))),pos=[],ids=[],N=18,R=sharp?8:12;
 for(let i=0;i<=N;i++){
  const t=i/N,c=curve.getPoint(t),tan=curve.getTangent(t).normalize(),u=new T.Vector3(-tan.y,tan.x,0).normalize(),v=new T.Vector3().crossVectors(tan,u).normalize();
  const taper=sharp?Math.max(.002,Math.pow(1-t,.72)):Math.max(.005,Math.pow(Math.sin(Math.PI*(t*.98+.01)),.75));
  for(let j=0;j<R;j++){const a=j/R*Math.PI*2,q=c.clone().addScaledVector(u,Math.cos(a)*width*taper).addScaledVector(v,Math.sin(a)*depth*taper);pos.push(...q.toArray())}
 }
 for(let i=0;i<N;i++)for(let j=0;j<R;j++){const a=i*R+j,b=i*R+(j+1)%R;ids.push(a,b,a+R,b,b+R,a+R)}
 for(const i of [0,N]){const c=curve.getPoint(i/N),q=pos.length/3;pos.push(...c.toArray());for(let j=0;j<R;j++)ids.push(...(i===0?[q,(j+1)%R,j]:[q,i*R+j,i*R+(j+1)%R]))}
 return geometry(pos,ids);
}
export function createTraveller(texture=null){
 const root=new T.Group(),bones=[],rest=new Map(),meshes=[],garments={traveller:[],jacket:[]};
 function bone(name,point,parent){
  const b=new T.Bone();b.name=name;const w=V(...point);b.position.copy(parent?w.clone().sub(rest.get(parent)):w);
  (parent||root).add(b);bones.push(b);rest.set(b,w);return b;
 }
 const pelvis=bone('pelvis',[322,479]),spine=bone('spine',[322,393],pelvis),chest=bone('chest',[322,287],spine),neck=bone('neck',[322,256],chest),head=bone('head',[321,210],neck);
 const limbs=[];
 for(const side of [-1,1]){
  const mirror=x=>side<0?x:654-x;
  const clav=bone('clavicle'+side,[mirror(294),284],chest);
  const upper=bone('upperArm'+side,[mirror(270),295],clav),elbow=bone('elbow'+side,[mirror(222),408],upper),wrist=bone('wrist'+side,[mirror(187),494],elbow);
  limbs.push({side,mirror,clav,upper,elbow,wrist});
 }
 const legs=[];
 for(const side of [-1,1]){
  const hip=bone('hip'+side,[322+side*42,482],pelvis),knee=bone('knee'+side,[322+side*52,666],hip),ankle=bone('ankle'+side,[322+side*63,800],knee);
  legs.push({side,hip,knee,ankle});
 }
 root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);skeleton.calculateInverses();
 function material(color,project=true,patch=null){
  const m=new T.MeshStandardMaterial({color,roughness:1,metalness:0});
  m.onBeforeCompile=s=>{
   s.uniforms.sourceArt={value:texture};s.uniforms.hasSource={value:texture&&project?1:0};
   s.uniforms.sourceSize={value:new T.Vector2(...SOURCE_SIZE)};
   s.uniforms.pigmentPatch={value:new T.Vector4(...(patch||[375,350,20,32]))};
   s.uniforms.hasPatch={value:texture&&patch?1:0};
   s.vertexShader='varying vec3 artPosition; varying vec3 artNormal; varying vec2 artUV;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nartPosition=position;artNormal=normal;artUV=uv;');
   s.fragmentShader='uniform sampler2D sourceArt; uniform vec2 sourceSize; uniform float hasSource; uniform vec4 pigmentPatch; uniform float hasPatch; varying vec3 artPosition; varying vec3 artNormal; varying vec2 artUV;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec4 art=texture2D(sourceArt,artUV);
    float front=smoothstep(0.15,0.75,artNormal.z)*hasSource*art.a;
    vec2 pigmentUV=(vec2(pigmentPatch.x,sourceSize.y-pigmentPatch.y)+(fract(vec2(artPosition.z,artPosition.y)/64.0)-0.5)*pigmentPatch.zw)/sourceSize;
    vec4 pigment=texture2D(sourceArt,pigmentUV);
    diffuseColor.rgb=mix(diffuseColor.rgb,pigment.rgb,hasPatch*pigment.a*0.65);
    diffuseColor.rgb=mix(diffuseColor.rgb,art.rgb,front);
    float grain=fract(sin(dot(floor(artPosition*2.0),vec3(12.9898,78.233,39.425)))*43758.5453);
    diffuseColor.rgb*=0.975+0.05*grain;`);
   // The source already carries authored lighting. Mostly diffuse/unlit pigment
   // prevents double shadows while keeping a readable silhouette on side views.
   s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=mix(diffuseColor.rgb,outgoingLight,mix(0.58,0.16,front));\n#include <opaque_fragment>');
  };m.customProgramCacheKey=()=>project?'traveller-project-v6':'traveller-pigment-v6';return m;
 }
 const skin=material('#e9b67b',true,[330,211,10,12]),teal=material('#337a7c',true,[375,350,20,40]),cream=material('#e4cba1',true,[321,370,24,48]),pants=material('#374547',true,[280,621,22,40]),leather=material('#57462c',true,[262,818,15,16]),hair=material('#51422b',true,[308,93,16,16]),gold=material('#b08743',false),lens=material('#326b69');
 const clay=new T.MeshStandardMaterial({color:'#9aafb2',roughness:1});
 function blend(a,b,t){t=ease(t);return[[a,1-t],[b,t]]}
 function torsoWeights(v){const y=860-v.y;return y<310?[[chest,1]]:y<393?blend(spine,chest,(393-y)/83):blend(pelvis,spine,(479-y)/86)}
 function bind(g,m,weights,name){
  const ix=[],w=[],p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const pairs=typeof weights==='function'?weights(new T.Vector3().fromBufferAttribute(p,i)):[[weights,1]];
   const sum=pairs.reduce((s,a)=>s+a[1],0);for(let k=0;k<4;k++){ix.push(pairs[k]?bones.indexOf(pairs[k][0]):0);w.push(pairs[k]?pairs[k][1]/sum:0)}
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ix,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));
  const mesh=new T.SkinnedMesh(g,m);mesh.name=name;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton);mesh.userData.original=m;meshes.push(mesh);return mesh;
 }
 // Continuous shaped head: broad temples, cheeks and tapered jaw, not a sphere.
 bind(rings([[116,321,28,26],[132,321,43,35],[154,321,53,39],[180,321,52,40],[204,321,43,35],[224,321,29,25],[237,321,8,10]],{flatten:.45}),skin,head,'face');
 bind(rings([[223,322,17,17],[250,322,17,17],[274,322,23,21]]),skin,neck,'neck');
 for(const side of [-1,1])bind(rings([[178,321+side*52,5,8],[187,321+side*55,9,9],[205,321+side*52,7,7],[211,321+side*49,2,2]]),skin,head,'ear');
 bind(tuft([[319,193,36],[319,201,41],[322,204,38]],2.5,2.5),skin,head,'nose');
 // Hair cap and designed, genuinely thick locks; no camera-facing hair cards.
 bind(rings([[81,315,6,6],[96,319,43,33],[121,321,66,46],[149,321,67,47],[176,322,58,42],[205,321,47,32]],{start:Math.PI*.88,end:Math.PI*2.13,caps:false}),hair,head,'hair-cap');
 const locks=[
  [[[329,110,18],[307,76,10],[285,66,0]],15,12],
  [[[314,104,22],[278,94,15],[238,116,0]],17,12],
  [[[284,123,22],[253,143,14],[232,162,0]],16,13],
  [[[281,147,28],[258,170,23],[248,194,2]],15,12],
  [[[282,144,37],[274,169,40],[276,198,26]],13,10],
  [[[314,123,38],[305,153,48],[320,181,40]],16,11],
  [[[342,130,35],[355,157,44],[368,178,31]],15,11],
  [[[353,110,20],[378,108,14],[403,137,0]],17,12],
  [[[369,140,24],[389,164,14],[408,174,0]],15,11],
  [[[373,155,20],[387,183,12],[386,206,-1]],13,12],
  [[[346,110,0],[353,91,0],[361,77,-4]],13,10],
  [[[357,151,-26],[380,174,-19],[394,210,-9]],13,10]
 ];
 for(const[pts,w,d]of locks)bind(tuft(pts,w,d,true),hair,head,'hair-lock');
 function setUV(g){const a=g.attributes.position,uv=[];for(let i=0;i<a.count;i++)uv.push((a.getX(i)+320)/SOURCE_SIZE[0],1-(860-a.getY(i))/SOURCE_SIZE[1]);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g}
 for(const[x,rot]of [[286,-.28],[354,.28]]){
  const mat=new T.Matrix4().compose(V(x,127,43),new T.Quaternion().setFromEuler(new T.Euler(.12,x<320?-.16:.16,rot)),new T.Vector3(1,1.18,1));
  bind(setUV(new T.TorusGeometry(22,4.2,12,40).applyMatrix4(mat)),material('#b08743'),head,'goggle-rim');
  const g=new T.SphereGeometry(1,32,16);g.scale(17.7,23,3.5);g.applyMatrix4(new T.Matrix4().makeRotationZ(rot));g.translate(x-320,733,45);bind(setUV(g),lens,head,'goggle-lens');
 }
 bind(tuft([[308,124,41],[320,122,46],[331,124,42]],3,3),gold,head,'goggle-bridge');
 bind(rings([[278,322,57,37],[311,322,64,40],[365,322,58,38],[423,322,44,32],[472,322,43,32]]),cream,torsoWeights,'shirt');
 // Scarf is a closed angular cowl with a hanging front, not a torus.
 const scarfRows=[[239,322,44,28],[254,322,62,43],[274,322,78,51],[298,322,56,49],[321,322,12,28]];
 bind(rings(scarfRows,{segments:32}),material('#b55227'),chest,'scarf');
 for(const outfit of ['traveller','jacket']){
  const end=outfit==='traveller'?585:478;
  const rows=[[276,322,61,42],[310,322,68,44],[357,322,64,44],[412,322,56,39],[447,322,60,38]];
  if(outfit==='traveller')rows.push([479,322,79,42],[520,322,85,46]);
  rows.push([end,322,outfit==='traveller'?99:79,49]);
  const cut=.42,g=rings(rows,{start:Math.PI/2+cut,end:Math.PI*2.5-cut,caps:false});
  g.computeVertexNormals();const coat=bind(g,teal,torsoWeights,'coat-'+outfit);coat.material.side=T.DoubleSide;garments[outfit].push(coat);
  // Narrow volumetric piping follows each open edge and belongs to the same rig.
  for(const a of [Math.PI/2+cut,Math.PI*2.5-cut]){
   const pts=rows.map(([y,x,rx,rz])=>[x+rx*Math.cos(a),y,rz*Math.sin(a)+1]);
   garments[outfit].push(bind(tuft(pts,3.7,2.2),cream,torsoWeights,'coat-piping'));
  }
 }
 bind(rings([[425,322,49,38],[457,322,49,38]]),leather,pelvis,'belt');
 // Buckle is a restrained solid frame, fixed to the belt, not to a floating sprite.
 const buckle=new T.TorusGeometry(12,3.2,4,4);buckle.rotateZ(Math.PI/4);buckle.scale(1.12,1,1);buckle.translate(-8,418,42);bind(setUV(buckle),gold,pelvis,'buckle');
 for(const leg of legs){
  const{side,hip,knee,ankle}=leg,cx=322+side*46;
  const weights=v=>{const y=860-v.y;return y<595?[[hip,1]]:y<706?blend(hip,knee,(y-595)/111):blend(knee,ankle,(y-741)/52)};
  bind(rings([[469,322+side*27,23,29],[520,322+side*39,31,33],[588,cx+side*6,39,32],[643,cx+side*9,38,30],[687,cx+side*9,32,25],[703,cx+side*9,25,21]]),pants,weights,'trouser');
  bind(rings([[691,cx+side*9,23,21],[735,cx+side*12,20,19],[773,cx+side*13,19,19]]),skin,weights,'calf');
  const footX=cx+side*15;
  bind(rings([[741,footX,29,28,-1],[764,footX,24,25],[797,footX,25,27],[823,footX+side*7,36,45,15],[846,footX+side*9,39,48,18],[855,footX+side*9,38,47,18]]),leather,ankle,'boot');
  bind(rings([[845,footX+side*9,39,48,18],[857,footX+side*9,39,48,18]]),material('#846435'),ankle,'sole');
 }
 for(const limb of limbs){
  const{side,mirror,upper,elbow,wrist}=limb;
  const armShape=[[287,272,22,23],[317,263,25,24],[353,246,21,20],[392,228,18,18],[408,222,16,16],[433,211,18,16],[470,196,14,13],[494,187,12,11],[516,180,16,10],[533,176,14,9]];
  const weights=v=>{const y=860-v.y;return y<384?[[upper,1]]:y<428?blend(upper,elbow,(y-384)/44):blend(elbow,wrist,(y-480)/24)};
  const dense=[];
  for(let i=0;i<armShape.length-1;i++)for(let n=0;n<6;n++)dense.push(armShape[i].map((v,j)=>T.MathUtils.lerp(v,armShape[i+1][j],n/6)));
  dense.push(armShape.at(-1));
  bind(rings(dense.map(([y,x,rx,rz])=>[y,mirror(x),rx,rz])),skin,weights,'arm'+side);
  bind(rings([[287,mirror(272),25,26],[316,mirror(262),29,28],[349,mirror(247),27,26],[377,mirror(235),26,24]]),teal,weights,'sleeve'+side);
  bind(rings([[370,mirror(238),27,25],[383,mirror(232),27,25]]),gold,weights,'sleeve-trim'+side);
  bind(rings([[391,mirror(227),24,22],[405,mirror(222),24,22],[423,mirror(215),23,22],[438,mirror(209),23,21]]),cream,weights,'cuff'+side);
  bind(rings([[470,mirror(196),16,15],[488,mirror(190),17,15],[497,mirror(185),15,14]]),leather,weights,'wrist-wrap'+side);
  bind(rings([[500,mirror(184),15,12],[518,mirror(179),17,12],[535,mirror(175),14,11]]),leather,wrist,'glove'+side);
  for(let i=0;i<4;i++){
   const x=166+i*6,tip=555+[0,7,5,-3][i];
   bind(tuft([[mirror(x),528,3],[mirror(x-2),545,6],[mirror(x),tip,10]],3.5,4),skin,wrist,'finger'+side+i);
  }
  bind(tuft([[mirror(192),510,4],[mirror(198),526,10],[mirror(194),535,14]],5,5),skin,wrist,'thumb'+side);
 }
 const resting=new Map(bones.map(b=>[b,b.position.clone()]));
 function apply(state){
  for(const b of bones){b.position.copy(resting.get(b));b.rotation.set(0,0,0)}
  const p=ease(state.pose),moving=limbs[0];
  // Coordinated reach, forward flexion rather than a lateral hinge. Both feet
  // stay planted. Clavicle elevation and torso rotation precede hand extension.
  spine.rotation.set(.025*p,-.07*p,-.016*p);
  chest.rotation.set(.035*p,-.065*p,-.018*p);
  neck.rotation.y=.065*p;head.rotation.x=.03*p;
  moving.clav.position.y+=5*p;moving.clav.position.z+=4*p;
  moving.clav.rotation.set(-.05*p,0,-.025*p);
  moving.upper.rotation.set(-.70*p,-.10*p,.18*p);
  moving.elbow.rotation.set(-.90*p,0,0);
  moving.wrist.rotation.set(.09*p,-.35*p,.04*p);
  limbs[1].upper.rotation.x=.04*p;
  for(const[k,group]of Object.entries(garments))for(const m of group)m.visible=k===state.outfit;
  for(const m of meshes)m.material=state.clay?clay:m.userData.original;
  root.updateMatrixWorld(true);skeleton.update();
 }
 function inspect(){
  root.updateMatrixWorld(true);skeleton.update();
  return {sharedSkeleton:meshes.every(m=>m.skeleton===skeleton),skinnedMeshes:meshes.length,boneCount:bones.length,bones:bones.map(b=>({name:b.name,position:b.getWorldPosition(new T.Vector3()).toArray()})),productionWrites:0,scope:'Full volume reconstruction; source-projected front art, provisional sides and animation. Not artistically approved.'};
 }
 apply(INITIAL);return{root,apply,inspect,skeleton,meshes,garments,bones};
}
