import * as THREE from 'three';
import {SOURCE,INITIAL,COLORS,deform,angles,validatePatch} from './drawn-rig.mjs';
const $=id=>document.getElementById(id),state={...INITIAL};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
$('original').disabled=true;
let renderer,mesh,geometry,material,scene,camera,frame,clockStart=0,ready=false;
const source=[];const color={value:new THREE.Color()},colored={value:0};
function inspect(){return{...state,ready,reducedMotion:motion.matches,vertices:source.length/2,productionWrites:0,source:'unchanged-traveller-core-v1/male/idle',maxElbowDegrees:Math.round(1.24*180/Math.PI)}}
function render(){if(!ready)return;const pos=geometry.attributes.position;
 for(let i=0;i<source.length/2;i++){const v=deform(source[i*2],source[i*2+1],state.pose);pos.setXYZ(i,v.x-320,450-v.y,0)}pos.needsUpdate=true;
 colored.value=state.cloth==='original'?0:1;if(colored.value)color.value.set(COLORS[state.cloth]);
 renderer.render(scene,camera);
 $('pose').value=Math.round(state.pose*100);$('degrees').value=Math.round(-angles(state.pose).elbow*180/Math.PI)+'°';
 $('pose-label').textContent=state.pose<.01?'Исходная поза':'Сгиб руки · '+$('degrees').value;
 $('play').textContent=state.playing?'Ⅱ Пауза':'▶ Согнуть руку';$('play').setAttribute('aria-pressed',String(state.playing));
 $('original').setAttribute('aria-pressed',String(state.original));$('reference').hidden=!state.original;$('cloth').value=state.cloth;
}
function configure(input){const patch=validatePatch(input);if(!ready)throw Error('Рисунок ещё не готов');
 Object.assign(state,patch);if(patch.playing===true){if(motion.matches){state.playing=false;$('status').textContent='Уменьшение движения включено. Положение можно менять ползунком.'}else clockStart=performance.now()-Math.acos(1-2*state.pose)/Math.PI*2400;}
 render();return inspect();
}
function tick(now){if(state.playing){state.pose=(1-Math.cos((now-clockStart)/2400*Math.PI))/2;render()}frame=requestAnimationFrame(tick)}
function resize(){if(!renderer)return;const el=$('drawn'),w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);const fullH=970,fullW=fullH*w/h;camera.left=-fullW/2;camera.right=fullW/2;camera.top=fullH/2;camera.bottom=-fullH/2;camera.updateProjectionMatrix();render()}
try{
 renderer=new THREE.WebGLRenderer({canvas:$('drawn'),alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-320,320,450,-450,.1,20);camera.position.z=10;
 const tex=await new THREE.TextureLoader().loadAsync('./images/drawn/traveller-original.png');tex.colorSpace=THREE.SRGBColorSpace;
 const vertices=[],uv=[],indices=[],nx=128,ny=180;
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const sx=x/nx*SOURCE.width,sy=y/ny*SOURCE.height;source.push(sx,sy);vertices.push(sx-320,450-sy,0);uv.push(x/nx,1-y/ny)}
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d)}
 geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
 material=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
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
motion.addEventListener('change',()=>{if(motion.matches&&ready)configure({playing:false})});document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready)configure({playing:false})});
window.drawnLab={inspect,configure};
const context=document.modelContext,lifecycle=new AbortController();
if(context?.registerTool){for(const tool of [
 {name:'inspect_drawn_avatar',description:'Read the isolated drawn-avatar preview. No account data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>inspect()},
 {name:'configure_drawn_avatar',description:'Change this test pose or cloth color. Does not save or spend gold.',inputSchema:{type:'object',properties:{pose:{type:'number',minimum:0,maximum:1},playing:{type:'boolean'},cloth:{type:'string',enum:Object.keys(COLORS)},original:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{try{return{ok:true,state:configure(input)}}catch(e){return{ok:false,error:e.message,state:inspect()}}}}
]){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(console.warn)}catch(e){console.warn(e)}}}
addEventListener('pagehide',()=>{cancelAnimationFrame(frame);lifecycle.abort();geometry?.dispose();material?.dispose();renderer?.dispose()},{once:true});
