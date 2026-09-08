import * as THREE from 'three';
import {SOURCE,INITIAL,COLORS,deform,deformForward,sampleGesture,liftTimeForPose,validatePatch} from './drawn-rig.mjs';
const $=id=>document.getElementById(id),state={...INITIAL};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
$('original').disabled=true;
let renderer,mesh,geometry,material,scene,camera,frame,clockStart=0,playhead=0,ready=false;
const source=[];const color={value:new THREE.Color()},colored={value:0};
function inspect(){return{...state,ready,reducedMotion:motion.matches,vertices:source.length/2,productionWrites:0,source:'unchanged-traveller-core-v1/male/idle',maxElbowDegrees:state.action==='chest'?135:Math.round(1.24*180/Math.PI)}}
function render(){if(!ready)return;const pos=geometry.attributes.position;
 for(let i=0;i<source.length/2;i++){const v=(state.action==='chest'?deformForward:deform)(source[i*2],source[i*2+1],state.pose);pos.setXYZ(i,v.x-320,450-v.y,v.z||0)}pos.needsUpdate=true;
 colored.value=state.cloth==='original'?0:1;if(colored.value)color.value.set(COLORS[state.cloth]);
 renderer.render(scene,camera);
 $('pose').value=Math.round(state.pose*100);$('degrees').value=Math.round(state.pose*100)+'%';
 $('pose-label').textContent=state.pose<.01?'Исходная поза':state.action==='chest'?'Рука перед грудью':'Прежний сгиб вбок';
 $('play').textContent=state.playing?'Ⅱ Пауза':'▶ Показать жест';$('play').setAttribute('aria-pressed',String(state.playing));$('action').value=state.action;
 $('original').setAttribute('aria-pressed',String(state.original));$('reference').hidden=!state.original;$('cloth').value=state.cloth;
}
function configure(input){const patch=validatePatch(input);if(!ready)throw Error('Рисунок ещё не готов');
 if('pose' in patch)playhead=liftTimeForPose(patch.pose);
 Object.assign(state,patch);if(patch.playing===true){if(motion.matches){state.playing=false;$('status').textContent='Уменьшение движения включено. Положение можно менять ползунком.'}else clockStart=performance.now()-playhead;}
 render();return inspect();
}
function tick(now){if(state.playing){playhead=now-clockStart;const sample=sampleGesture(playhead);state.pose=sample.pose;if(sample.done){state.playing=false;playhead=0}render()}frame=requestAnimationFrame(tick)}
function resize(){if(!renderer)return;const el=$('drawn'),w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);const fullH=970,fullW=fullH*w/h;camera.left=-fullW/2;camera.right=fullW/2;camera.top=fullH/2;camera.bottom=-fullH/2;camera.updateProjectionMatrix();render()}
try{
 renderer=new THREE.WebGLRenderer({canvas:$('drawn'),alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-320,320,450,-450,.1,3000);camera.position.z=1500;
 const tex=await new THREE.TextureLoader().loadAsync('./images/drawn/traveller-original.png');tex.colorSpace=THREE.SRGBColorSpace;
 const vertices=[],uv=[],indices=[],nx=128,ny=180;
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const sx=x/nx*SOURCE.width,sy=y/ny*SOURCE.height;source.push(sx,sy);vertices.push(sx-320,450-sy,0);uv.push(x/nx,1-y/ny)}
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d)}
 geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
 material=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:true,alphaTest:.02});
 material.onBeforeCompile=shader=>{shader.uniforms.clothColor=color;shader.uniforms.clothEnabled=colored;shader.fragmentShader='uniform vec3 clothColor; uniform float clothEnabled;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  vec3 c = diffuseColor.rgb;
  float cloth = step(0.30, 1.0-vMapUv.y) * step(c.r*1.65,c.g) * step(c.r*1.4,c.b) * step(c.b*0.68,c.g) * step(c.g*0.62,c.b);
  float lum = dot(c, vec3(.2126,.7152,.0722));
  vec3 recolored = clothColor * (lum / max(.03,dot(clothColor,vec3(.2126,.7152,.0722))));
  diffuseColor.rgb = mix(c,recolored,cloth*clothEnabled);`)};
 mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);ready=true;$('loading').hidden=true;$('controls').disabled=false;$('original').disabled=false;document.body.dataset.ready='true';
 resize();new ResizeObserver(resize).observe($('scene'));frame=requestAnimationFrame(tick);
}catch(e){$('loading').textContent='Не удалось загрузить рисунок. Обнови страницу, чтобы попробовать ещё раз.';document.body.dataset.error='true';console.error(e)}
$('play').onclick=()=>configure({playing:!state.playing});$('reset').onclick=()=>configure({...INITIAL});$('pose').oninput=e=>configure({pose:Number(e.target.value)/100,playing:false});$('cloth').onchange=e=>configure({cloth:e.target.value});$('original').onclick=()=>configure({original:!state.original});
$('action').onchange=e=>configure({action:e.target.value,pose:0,playing:false});
motion.addEventListener('change',()=>{if(motion.matches&&ready)configure({playing:false})});document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)configure({playing:false})});
window.drawnLab={inspect,configure};
const context=document.modelContext,lifecycle=new AbortController();
if(context?.registerTool){for(const tool of [
 {name:'inspect_drawn_avatar',description:'Read the isolated drawn-avatar preview. No account data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>inspect()},
 {name:'configure_drawn_avatar',description:'Change this test gesture, pose or cloth color. Does not save or spend gold.',inputSchema:{type:'object',properties:{pose:{type:'number',minimum:0,maximum:1},playing:{type:'boolean'},cloth:{type:'string',enum:Object.keys(COLORS)},original:{type:'boolean'},action:{type:'string',enum:['chest','lateral']}},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{try{return{ok:true,state:configure(input)}}catch(e){return{ok:false,error:e.message,state:inspect()}}}}
]){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.warn)}catch(e){console.warn(e)}}}
addEventListener('pagehide',()=>{cancelAnimationFrame(frame);lifecycle.abort();geometry?.dispose();material?.dispose();renderer?.dispose()},{once:true});
