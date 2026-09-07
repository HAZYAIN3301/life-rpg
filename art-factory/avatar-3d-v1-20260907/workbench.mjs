import * as T from 'three';
import {DEFAULT_LOOK,parseLook,changeLook,POSES,animationAllowed} from './contract.mjs';
import {createPilotRig,applyLook,poseRig,inspectRig,disposeRig} from './rig.mjs';
import {exportRig,importRig} from './glb.mjs';

const $=s=>document.querySelector(s),storageKey='satoru:factory:avatar-3d-pilot:look:v1';
const stage=$('#stage'),status=$('#load-status'),saveStatus=$('#save-status');
let rig,renderer,scene,camera,bench,cat,pose='idle',elapsed=0,last=0,frame=0,intersecting=true,paused=false,busy=false;
let look={...DEFAULT_LOOK},persisted=false,disposed=false;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const failures=[];
try {const raw=localStorage.getItem(storageKey);if(raw){look=parseLook(JSON.parse(raw));persisted=true;}}catch {saveStatus.textContent='Сохранённый образ не прочитан. Показан исходный; данные не перезаписаны.';}
function saveLook() {
  try {localStorage.setItem(storageKey,JSON.stringify(look));const back=parseLook(JSON.parse(localStorage.getItem(storageKey)));if(JSON.stringify(back)!==JSON.stringify(look))throw new Error('Readback');saveStatus.textContent='Образ сохранён в этом браузере. Золото не тратится.';persisted=true;}
  catch {persisted=false;saveStatus.textContent='Образ показан, но браузер не разрешил его сохранить.';}
}
function syncControls(){for(const select of document.querySelectorAll('[data-look]'))select.value=look[select.dataset.look];}
function metrics(){const m=inspectRig(rig);$('#metrics').textContent=JSON.stringify(m,null,2);return m;}
function canAnimate(){return animationAllowed({visible:!document.hidden,intersecting,reduced:reduce.matches,paused:paused||busy});}
function setCamera(value) {
  const positions={front:[2.6,1.8,6],side:[5.7,1.7,.3],back:[2.5,1.8,-6]};camera.position.set(...(positions[value]||positions.front));camera.lookAt(0,1.0,0);draw();
}
function draw(){if(!renderer||disposed)return;bench.visible=pose==='sit';cat.visible=pose==='pet';renderer.render(scene,camera);}
function applyPose(t=elapsed){poseRig(rig,pose,reduce.matches?0:t);draw();}
function tick(now) {
  frame=0;if(!canAnimate()||disposed){last=0;return;}
  if(last)elapsed+=Math.min((now-last)/1000,.05);last=now;applyPose();frame=requestAnimationFrame(tick);
}
function scheduling(){
  if(!canAnimate()){if(frame)cancelAnimationFrame(frame);frame=0;last=0;if(rig)applyPose();}
  else if(!frame)frame=requestAnimationFrame(tick);
  $('#pause').textContent=reduce.matches?'Без движения':paused?'Продолжить':'Приостановить';
  $('#pause').setAttribute('aria-pressed',String(paused||reduce.matches));$('#pause').disabled=reduce.matches;
}
function dimensions(){if(!renderer)return;const {width,height}=stage.getBoundingClientRect();const size=2.32,aspect=width/height;camera.left=-size*aspect/2;camera.right=size*aspect/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);draw();}
function matte(color){return new T.MeshStandardMaterial({color,roughness:1,metalness:0});}
function block(name,position,scale,color,parent=scene){const m=new T.Mesh(new T.BoxGeometry(...scale),matte(color));m.name=name;m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
async function boot() {
  try {
    renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.setClearColor('#1b2629');stage.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;status.hidden=false;status.textContent='3D-контекст потерян. Перезагрузи стенд; сохранённый образ останется.';scheduling();});
    scene=new T.Scene();scene.background=new T.Color('#1b2629');
    camera=new T.OrthographicCamera(-1.4,1.4,1.4,-1.4,.1,40);
    scene.add(new T.HemisphereLight('#fff3d7','#455c69',2.6));
    const light=new T.DirectionalLight('#ffe3ab',3.0);light.position.set(-2.5,4,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=3;light.shadow.camera.bottom=-1;light.shadow.bias=-.0005;scene.add(light);
    const rim=new T.DirectionalLight('#91c5c1',1.3);rim.position.set(2,2,-2);scene.add(rim);
    const floor=new T.Mesh(new T.CylinderGeometry(1.05,1.12,.08,64),matte('#34463f'));floor.position.set(0,-.047,0);floor.receiveShadow=true;scene.add(floor);
    const ring=new T.Mesh(new T.TorusGeometry(1.045,.008,6,80),matte('#ab9264'));ring.rotation.x=Math.PI/2;ring.position.y=-.004;scene.add(ring);
    bench=new T.Group();bench.name='PreviewBench';scene.add(bench);block('Seat',[0,.48,-.11],[.66,.07,.35],'#6c5240',bench);
    for(const x of[-.27,.27])block('BenchLeg',[x,.235,-.11],[.055,.46,.25],'#344039',bench);
    cat=new T.Group();cat.name='Existing2DPet';scene.add(cat);cat.position.set(.54,.36,.035);
    const texture=await new T.TextureLoader().loadAsync('/public/art/pets/fortune/assembled.png');texture.colorSpace=T.SRGBColorSpace;
    const aspect=texture.image.width/texture.image.height;
    const pet=new T.Mesh(new T.PlaneGeometry(.72*aspect,.72),new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.08,side:T.DoubleSide,depthWrite:true}));cat.add(pet);
    rig=createPilotRig();applyLook(rig,look);scene.add(rig.root);syncControls();poseRig(rig,pose,0);
    dimensions();setCamera('front');status.hidden=true;
    if(persisted)saveStatus.textContent='Восстановлен образ из этого браузера. Аккаунт Satoru не затронут.';
    new ResizeObserver(dimensions).observe(stage);
    new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;scheduling();},{threshold:.01}).observe(stage);
    document.addEventListener('visibilitychange',scheduling);reduce.addEventListener('change',scheduling);scheduling();metrics();
    window.__avatarLab.ready=true;
  }catch(error){failures.push(String(error));status.textContent='Не удалось открыть 3D-сцену. Проверь поддержку WebGL и локальные файлы. Satoru не изменён.';console.error(error);}
}
for(const select of document.querySelectorAll('[data-look]'))select.addEventListener('change',()=>{
  if(!rig||busy)return;look=changeLook(look,select.dataset.look,select.value);applyLook(rig,look);saveLook();applyPose();
});
for(const button of document.querySelectorAll('[data-pose]'))button.addEventListener('click',()=>{
  if(!rig||busy)return;pose=button.dataset.pose;elapsed=0;for(const b of document.querySelectorAll('[data-pose]'))b.setAttribute('aria-pressed',String(b===button));applyPose();metrics();scheduling();
});
$('#camera').addEventListener('change',event=>{if(camera)setCamera(event.target.value);});
$('#pause').addEventListener('click',()=>{paused=!paused;scheduling();});

export function stressRig() {
  const results=[],before={look,pose,time:elapsed};busy=true;scheduling();
  try {
    for(const hair of ['crop','ponytail'])for(const top of ['traveller','field-vest'])for(const bottom of ['trousers','ranger'])for(const weapon of ['none','training-blade']) {
      applyLook(rig,{...look,hair,top,bottom,weapon});
      for(const p of POSES)for(const t of [0,.27,.63,1.0]) {
        poseRig(rig,p,t);const m=inspectRig(rig);
        const fail=m.errors.length||m.footHeights.some(y=>y<-.0001)||m.gripError>.00001||(m.contactError!==null && m.contactError>.005);
        results.push({hair,top,bottom,weapon,pose:p,time:t,ok:!fail,...m});
      }
    }
  }finally{applyLook(rig,before.look);poseRig(rig,before.pose,before.time);busy=false;scheduling();draw();}
  const passed=results.filter(r=>r.ok).length;
  $('#test-status').textContent=passed+' / '+results.length+' геометрических проверок. Художественная приёмка — отдельно.';
  window.__avatarLab.lastStress=results;metrics();return results;
}
$('#stress').addEventListener('click',()=>{if(rig&&!busy)stressRig();});
$('#export').addEventListener('click',async()=>{
  if(!rig||busy)return;busy=true;scheduling();
  try{const bytes=await exportRig(rig);const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='satoru-avatar-engineering-pilot.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);saveStatus.textContent='Скачан технический GLB со всеми деталями. Это не финальный арт.';}
  catch(error){saveStatus.textContent='Не удалось экспортировать GLB.';failures.push(String(error));}
  finally{busy=false;applyPose();scheduling();}
});
$('#import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file||busy)return;
  if(file.size>12*1024*1024){saveStatus.textContent='Файл больше лимита 12 МБ.';return;}
  busy=true;scheduling();
  try{const next=await importRig(await file.arrayBuffer(),look);const old=rig;scene.remove(old.root);rig=next;scene.add(rig.root);disposeRig(old);saveStatus.textContent='GLB прошёл технический контракт. Выбранный образ не изменён; художественная проверка ещё нужна.';metrics();}
  catch(error){saveStatus.textContent='GLB не прошёл контракт. Прежний персонаж оставлен на месте.';failures.push(String(error));}
  finally{busy=false;event.target.value='';applyPose();scheduling();}
});
window.__avatarLab={ready:false,failures,lastStress:null,
  state:()=>({look,pose,elapsed,paused,reduced:reduce.matches,intersecting,animating:!!frame,persisted,metrics:rig?inspectRig(rig):null,renderer:renderer?.info.render}),
  sample:(p,t)=>{poseRig(rig,p,t);draw();return inspectRig(rig);},
  roundtrip:async()=>{const bytes=await exportRig(rig);const next=await importRig(bytes,look);const report=inspectRig(next),samples=[];
    for(const p of POSES)for(const t of [0,.27,.63,1]){poseRig(next,p,t);samples.push({pose:p,time:t,...inspectRig(next)});}
    const clips=next.clips.map(c=>c.name);disposeRig(next);return{bytes:bytes.byteLength,clips,samples,...report};},
  stress:stressRig
};
window.addEventListener('pagehide',()=>{disposed=true;if(frame)cancelAnimationFrame(frame);if(rig)disposeRig(rig);renderer?.dispose();});
boot();
