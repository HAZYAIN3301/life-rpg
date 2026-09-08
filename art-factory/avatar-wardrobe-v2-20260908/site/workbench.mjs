import * as THREE from 'three';
import {loadWardrobe} from './wardrobe.mjs';
import {readLook,saveLook,MOTIONS,LOOK_OPTIONS,validateLookPatch} from './contract.mjs';
const $=s=>document.querySelector(s),canvas=$('#avatar'),stage=$('#stage'),form=$('#look-form'),status=$('#loading');
async function boot(){
let storage;try{storage=localStorage;}catch{storage=null;}
let avatar,look=readLook(storage),paused=false,current='Idle',phase='Idle',action,last=0,inView=true,pending=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const controls=[...document.querySelectorAll('button,select,input')];controls.forEach(e=>e.disabled=true);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color('#283336');
const camera=new THREE.PerspectiveCamera(32,1,.01,40);
const fill=new THREE.HemisphereLight('#e4efff','#776e53',2.5);scene.add(fill);
const key=new THREE.DirectionalLight('#fff3dd',3.1);key.position.set(3,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=4;key.shadow.camera.bottom=-3;key.shadow.normalBias=.018;scene.add(key);
const rim=new THREE.DirectionalLight('#b7a1ff',1.5);rim.position.set(-4,3,-2);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(6,80),new THREE.MeshStandardMaterial({color:'#62756a',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
function resize(){const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
function render(){renderer.render(scene,camera);}
let center=new THREE.Vector3(0,1.24,0),radius=5.8,cameraMode='front';
function setCamera(mode){cameraMode=mode;const positions={front:[.15,.15,1],side:[1,.12,.15],back:[.15,.15,-1]},p=positions[mode]||positions.front;center.y=current==='Sit_Floor_Idle'?.9:1.24;const distance=current.startsWith('1H_')?7.3:radius;camera.position.copy(center).add(new THREE.Vector3(...p).multiplyScalar(distance));camera.lookAt(center);document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===mode)));render();}
function apply(){look=avatar.apply(look);for(const [k,v]of Object.entries(look)){const f=form.elements.namedItem(k);if(f)f.type==='checkbox'?f.checked=v:f.value=v;}render();}
function play(name,once=false,blend=true){
 const clip=avatar.animations.find(a=>a.name===name);if(!clip)throw Error('Missing clip '+name);
 const next=avatar.mixer.clipAction(clip),canBlend=blend&&action&&action!==next&&!reduced.matches;
 if(canBlend)action.fadeOut(.2);else avatar.mixer.stopAllAction();
 next.reset().setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
 if(canBlend)next.fadeIn(.2);next.play();action=next;phase=name;avatar.mixer.update(.001);apply();
}
function motion(name){
 if(!avatar||!MOTIONS.includes(name))return;
 const was=current;current=name;pending=null;
 if(!reduced.matches&&name==='Sit_Floor_Idle'&&was!==name){pending=name;play('Sit_Floor_Down',true);}
 else if(!reduced.matches&&was==='Sit_Floor_Idle'&&name!==was){pending=name;play('Sit_Floor_StandUp',true);}
 else play(name);
 document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===name)));
 setCamera(cameraMode);
}
function loop(t){const delta=last?Math.min((t-last)/1000,.05):0;last=t;if(avatar&&!paused&&!document.hidden&&inView&&!reduced.matches){avatar.mixer.update(delta);avatar.apply(look);render();}requestAnimationFrame(loop);}
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
document.querySelectorAll('[data-motion]').forEach(b=>b.addEventListener('click',()=>motion(b.dataset.motion)));
$('#pause').addEventListener('click',()=>{paused=!paused;$('#pause').textContent=paused?'Продолжить':'Пауза';$('#pause').setAttribute('aria-pressed',String(paused));});
function configure(patch){look={...look,...validateLookPatch(patch)};apply();$('#receipt').textContent='Примерка изменена. Золото не тратится.';return {...look};}
function save(){const result=saveLook(storage,look);$('#receipt').textContent=result.ok?'Образ сохранён в этом браузере.':'Сохранить не удалось. Примерка остаётся на экране.';return result;}
form.addEventListener('change',e=>{const el=e.target;if(el.name)configure({[el.name]:el.type==='checkbox'?el.checked:el.value});});
form.addEventListener('submit',e=>{e.preventDefault();save();});
new ResizeObserver(resize).observe(stage);new IntersectionObserver(([e])=>{inView=e.isIntersecting;last=0;}).observe(stage);
try{
 avatar=await loadWardrobe();scene.add(avatar.root);
 avatar.mixer.addEventListener('finished',e=>{if(e.action===action&&pending){const next=pending;pending=null;play(next);}});
 motion('Idle');avatar.mixer.update(.1);apply();
 const box=avatar.visibleBounds();floor.position.y=box.min.y-.005;
 setCamera('front');resize();status.hidden=true;controls.forEach(e=>e.disabled=false);
 if(!avatar.sword){form.elements.weapon.querySelector('[value=sword]').disabled=true;}
 document.body.dataset.ready='true';
 const inspect=()=>({...avatar.inspect(),look:{...look},motion:current,phase,paused,reduced:reduced.matches,mixerTime:avatar.mixer.time});
 window.avatarLab={inspect,sample:(name,time)=>{if(!MOTIONS.includes(name))throw Error('Unknown sample');pending=null;current=name;play(name,false,false);avatar.mixer.setTime(time);avatar.apply(look);document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===name)));setCamera(cameraMode);}};
 const context=document.modelContext;
 if(context?.registerTool){
  const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const empty={type:'object',properties:{},additionalProperties:false};
  function noArgs(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('No arguments accepted');}
  const specs=[
   {name:'inspect_avatar_preview',description:'Read this isolated avatar preview. Does not read a Satoru account.',inputSchema:empty,annotations:{readOnlyHint:true},execute(input){noArgs(input);return {look:{...look},motion:current,phase,paused};}},
   {name:'configure_avatar_preview',description:'Stage clothing and colours in the visible isolated preview. Does not save, buy items, or change a Satoru account.',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(LOOK_OPTIONS).map(([k,v])=>[k,{type:k==='cape'?'boolean':'string',enum:v}])),minProperties:1,additionalProperties:false},annotations:{readOnlyHint:false},execute(input){return {look:configure(input),saved:false};}},
   {name:'save_avatar_preview_locally',description:'Save the staged outfit only in this browser. No account or gold changes.',inputSchema:empty,annotations:{readOnlyHint:false},execute(input){noArgs(input);const result=save();if(!result.ok)throw Error('Local save failed; preview is unchanged');return result;}}
  ];
  for(const spec of specs)try{Promise.resolve(context.registerTool(spec,{signal:lifecycle.signal})).catch(()=>{});}catch{}
 }
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;status.hidden=false;status.textContent='3D-сцена остановлена. Обнови страницу, чтобы восстановить её.';controls.forEach(e=>e.disabled=true);});
 requestAnimationFrame(loop);
}catch(error){document.body.dataset.error='true';status.textContent='Персонаж не загрузился. Обнови страницу, чтобы повторить.';console.error(error);}
}
boot().catch(()=>{document.body.dataset.error='true';status.hidden=false;status.textContent='Браузер не смог открыть 3D. Попробуй обновить страницу или открыть её в другом браузере.';});
