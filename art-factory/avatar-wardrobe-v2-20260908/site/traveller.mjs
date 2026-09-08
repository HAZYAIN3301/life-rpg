import * as T from 'three';
import {createTraveller,INITIAL,validate,sample,DURATION,SOURCE_SIZE} from './traveller-rig.mjs';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let state={...INITIAL},model,renderer,scene,camera,elapsed=0,last=0,visible=true;
function inspect(){return{...state,...model?.inspect()}}
function paint(){
 if(!model)return;model.apply(state);const a=state.yaw*Math.PI/180,target=new T.Vector3(0,860-SOURCE_SIZE[1]/2,0);
 camera.position.set(Math.sin(a)*1600,target.y,Math.cos(a)*1600);camera.lookAt(target);renderer.render(scene,camera);
}
function controls(){
 for(const k of ['pose','yaw']){$(k).value=k==='pose'?state.pose*100:state.yaw;$(k+'-value').value=k==='pose'?Math.round(state.pose*100)+'%':state.yaw+'°'}
 $('outfit').value=state.outfit;$('clay').setAttribute('aria-pressed',state.clay);$('play').setAttribute('aria-pressed',state.playing);$('play').textContent=state.playing?'Пауза':'Протянуть руку';
 $('pose-label').textContent=state.pose>0?'Плечо → локоть → ладонь':'Исходная поза';
 for(const b of document.querySelectorAll('[data-yaw]'))b.setAttribute('aria-pressed',Number(b.dataset.yaw)===state.yaw);
}
function configure(p){validate(p);state={...state,...p};if('pose'in p){state.playing=false;elapsed=0}if(reduced.matches)state.playing=false;controls();paint();return inspect()}
function resize(){if(!renderer)return;const w=$('traveller').clientWidth,h=$('traveller').clientHeight;renderer.setSize(w,h,false);const f=Math.max(SOURCE_SIZE[1]/2,SOURCE_SIZE[0]/2*h/w);camera.left=-f*w/h;camera.right=f*w/h;camera.top=f;camera.bottom=-f;camera.updateProjectionMatrix();paint()}
function frame(now){const dt=last?Math.min(50,now-last):0;last=now;if(state.playing&&!document.hidden&&visible){elapsed+=dt;state.pose=sample(elapsed);if(elapsed>=DURATION)state.playing=false;controls();paint()}requestAnimationFrame(frame)}
try{
 renderer=new T.WebGLRenderer({canvas:$('traveller'),antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
 const art=await new T.TextureLoader().loadAsync('./images/drawn/traveller-original.png');art.colorSpace=T.SRGBColorSpace;art.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 if(art.image.width!==SOURCE_SIZE[0]||art.image.height!==SOURCE_SIZE[1])throw Error('Source image dimensions do not match the reconstruction');
 scene=new T.Scene();camera=new T.OrthographicCamera(-459,459,459,-459,1,5000);
 scene.add(new T.HemisphereLight('#fff2de','#655c6b',2));
 const key=new T.DirectionalLight('#fff1d7',2.2);key.position.set(-600,1000,1000);scene.add(key);
 model=createTraveller(art);scene.add(model.root);
 window.travellerLab=Object.freeze({inspect,configure});
 $('pose').addEventListener('input',()=>configure({pose:Number($('pose').value)/100}));$('yaw').addEventListener('input',()=>configure({yaw:Number($('yaw').value)}));
 $('outfit').addEventListener('change',()=>configure({outfit:$('outfit').value}));$('clay').addEventListener('click',()=>configure({clay:!state.clay}));
 for(const b of document.querySelectorAll('[data-yaw]'))b.addEventListener('click',()=>configure({yaw:Number(b.dataset.yaw)}));
 $('reset').addEventListener('click',()=>{elapsed=0;configure({...INITIAL})});
 $('play').addEventListener('click',()=>{if(elapsed>=DURATION)elapsed=0;configure({playing:!state.playing});if(reduced.matches){configure({pose:1});$('status').textContent='Движение уменьшено. Положение можно менять ползунком.'}});
 reduced.addEventListener('change',()=>{if(reduced.matches)configure({playing:false})});
 new IntersectionObserver(e=>{visible=e[0].isIntersecting}).observe($('traveller'));new ResizeObserver(resize).observe($('traveller'));
 $('controls').disabled=false;$('loading').hidden=true;document.body.dataset.ready='true';resize();controls();requestAnimationFrame(frame);
 if(document.modelContext){
  document.modelContext.registerTool({name:'inspect_traveller',description:'Read the isolated full Traveller prototype. No account data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>({content:[{type:'text',text:JSON.stringify(inspect())}]})});
  document.modelContext.registerTool({name:'configure_traveller',description:'Change test character pose, camera or garment; no production save or gold use.',inputSchema:{type:'object',properties:{pose:{type:'number',minimum:0,maximum:1},yaw:{type:'number',minimum:-120,maximum:180},outfit:{type:'string',enum:['traveller','jacket']},clay:{type:'boolean'},playing:{type:'boolean'}},additionalProperties:false},execute:async p=>{try{return{content:[{type:'text',text:JSON.stringify({ok:true,state:configure(p)})}]}}catch(e){return{content:[{type:'text',text:JSON.stringify({ok:false,error:e.message,state:inspect()})}]}}}});
 }
}catch(e){document.body.dataset.error='true';$('controls').disabled=true;$('loading').hidden=false;$('loading').textContent='Не удалось загрузить объёмного героя. Обнови страницу или попробуй другой браузер.';console.error(e)}
