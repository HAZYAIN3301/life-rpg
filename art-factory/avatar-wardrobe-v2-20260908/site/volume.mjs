import * as THREE from 'three';
import {createArm,INITIAL,validate,sample,DURATION} from './volume-rig.mjs';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let state={...INITIAL},arm,renderer,camera,scene,elapsed=0,last=0,visible=true;
function inspect(){return {...state,...arm?.inspect()}}
function paint(){
 if(!arm)return;arm.apply(state);
 const angle=state.yaw*Math.PI/180,target=new THREE.Vector3(-.08,-.52,.18),distance=5;
 camera.position.set(target.x+Math.sin(angle)*distance,target.y+.40,target.z+Math.cos(angle)*distance);camera.lookAt(target);
 renderer.render(scene,camera);
}
function controls(){
 for(const k of ['pose','yaw']){$(k).value=k==='pose'?Math.round(state[k]*100):state[k];$(k+'-value').value=k==='pose'?Math.round(state[k]*100)+'%':state[k]+'°'}
 for(const k of ['action','outfit'])$(k).value=state[k];
 for(const k of ['grip','clay'])$(k).setAttribute('aria-pressed',state[k]);
 $('play').setAttribute('aria-pressed',state.playing);$('play').textContent=state.playing?'Пауза':'Показать движение';
 $('pose-label').textContent=state.pose===0?'Исходное положение':state.action==='turn'?'Поворот кисти':state.action==='reach'?'Рука перед собой':'Сгиб локтя';
}
function configure(p){
 validate(p);if('action'in p&&p.action!==state.action){elapsed=0;state={...state,pose:0,playing:false}}
 state={...state,...p};if('pose'in p){state.playing=false;elapsed=0}
 if(reduced.matches)state.playing=false;controls();paint();return inspect();
}
function resize(){if(!renderer)return;const w=$('volume').clientWidth,h=$('volume').clientHeight;renderer.setSize(w,h,false);const f=1.15;camera.left=-f*w/h;camera.right=f*w/h;camera.top=f;camera.bottom=-f;camera.updateProjectionMatrix();paint()}
function frame(now){const dt=last?Math.min(50,now-last):0;last=now;if(state.playing&&!document.hidden&&visible){elapsed+=dt;state.pose=sample(elapsed);if(elapsed>=DURATION)state.playing=false;controls();paint()}requestAnimationFrame(frame)}
try{
 renderer=new THREE.WebGLRenderer({canvas:$('volume'),antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#333540');renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,30);
 scene.add(new THREE.HemisphereLight('#fff3dc','#53516d',2.0));const key=new THREE.DirectionalLight('#fff3df',3.0);key.position.set(-3,4,5);scene.add(key);const fill=new THREE.DirectionalLight('#929ab0',.65);fill.position.set(4,0,-3);scene.add(fill);
 arm=createArm();scene.add(arm.root);window.volumeLab=Object.freeze({inspect,configure});
 for(const k of ['action','outfit'])$(k).addEventListener('change',()=>configure({[k]:$(k).value}));
 $('pose').addEventListener('input',()=>configure({pose:Number($('pose').value)/100}));$('yaw').addEventListener('input',()=>configure({yaw:Number($('yaw').value)}));
 for(const k of ['grip','clay'])$(k).addEventListener('click',()=>configure({[k]:!state[k]}));
 $('reset').addEventListener('click',()=>{elapsed=0;configure({...INITIAL})});
 $('play').addEventListener('click',()=>{if(elapsed>=DURATION)elapsed=0;configure({playing:!state.playing});if(reduced.matches){configure({pose:1});$('status').textContent='Уменьшение движения включено. Положение можно менять ползунком.'}});
 reduced.addEventListener('change',()=>{if(reduced.matches)configure({playing:false})});
 new IntersectionObserver(e=>{visible=e[0].isIntersecting}).observe($('volume'));new ResizeObserver(resize).observe($('volume'));
 $('controls').disabled=false;$('loading').hidden=true;document.body.dataset.ready='true';resize();controls();requestAnimationFrame(frame);
 if(document.modelContext){
  document.modelContext.registerTool({name:'inspect_volume_arm',description:'Read the isolated 3D arm study. No account data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({content:[{type:'text',text:JSON.stringify(inspect())}]})});
  document.modelContext.registerTool({name:'configure_volume_arm',description:'Change the arm-study pose, garment or camera without saving or spending gold.',inputSchema:{type:'object',properties:{pose:{type:'number',minimum:0,maximum:1},yaw:{type:'number',minimum:-90,maximum:150},action:{type:'string',enum:['bend','reach','turn']},outfit:{type:'string',enum:['short','long','armor']},playing:{type:'boolean'},grip:{type:'boolean'},clay:{type:'boolean'}},additionalProperties:false},execute:async p=>{try{return{content:[{type:'text',text:JSON.stringify({ok:true,state:configure(p)})}]}}catch(e){return{content:[{type:'text',text:JSON.stringify({ok:false,error:e.message,state:inspect()})}]}}}});
 }
}catch(e){document.body.dataset.error='true';$('controls').disabled=true;$('loading').hidden=false;$('loading').textContent='Не удалось запустить объёмную пробу. Попробуй обновить страницу.';console.error(e)}
