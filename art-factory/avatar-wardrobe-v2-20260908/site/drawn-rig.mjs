// Pixel-space 2D skinning of ONE intact approved drawing; no independently placed limbs.
export const SOURCE = Object.freeze({width:640,height:900});
export const JOINTS = Object.freeze({shoulder:{x:386,y:303},elbow:{x:431,y:417},wrist:{x:461,y:487}});
export const INITIAL = Object.freeze({pose:0,playing:false,cloth:'original',original:false,action:'chest'});
export const COLORS = Object.freeze({original:null,plum:'#846699',blue:'#4c79aa',forest:'#597d51'});
export const GESTURE = Object.freeze({lift:1800,hold:650,lower:1650,total:4100});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function sampleGesture(ms){
 const ease=t=>(1-Math.cos(Math.PI*clamp(t,0,1)))/2;
 if(ms<GESTURE.lift)return{pose:ease(ms/GESTURE.lift),phase:'lift',done:false};
 if(ms<GESTURE.lift+GESTURE.hold)return{pose:1,phase:'hold',done:false};
 if(ms<GESTURE.total)return{pose:1-ease((ms-GESTURE.lift-GESTURE.hold)/GESTURE.lower),phase:'lower',done:false};
 return{pose:0,phase:'rest',done:true};
}
export const liftTimeForPose=pose=>Math.acos(1-2*clamp(pose,0,1))/Math.PI*GESTURE.lift;
function rotate(p,pivot,angle){const c=Math.cos(angle),s=Math.sin(angle),x=p.x-pivot.x,y=p.y-pivot.y;return{x:pivot.x+x*c-y*s,y:pivot.y+x*s+y*c}}
export function angles(pose){return{shoulder:-.10*pose,elbow:-1.24*pose}}
export function deform(x,y,pose){
 const p=clamp(pose,0,1),a=angles(p),s=JOINTS.shoulder,e=JOINTS.elbow;
 // Follow the transparent gap between the flared coat and the hanging arm.
 // A constant x cutoff drags the hem with the hand (the first visual QA caught it).
 const boundary=y<385?376+(y-285)*.20:Math.min(440,396+(y-385)*.32);
 const arm=smooth(boundary-4,boundary+8,x)*smooth(280,313,y)*(1-smooth(594,615,y));
 if(!arm||!p)return{x,y};
 const upper=rotate({x,y},s,a.shoulder),ep=rotate(e,s,a.shoulder);
 const rotated=rotate({x,y},e,a.shoulder+a.elbow);
 const lower={x:rotated.x+ep.x-e.x,y:rotated.y+ep.y-e.y};
 const forearm=smooth(389,443,y);
 return{x:x+arm*(upper.x+(lower.x-upper.x)*forearm-x),y:y+arm*(upper.y+(lower.y-upper.y)*forearm-y)};
}
// Forward elbow flexion around the local cross-arm axis, not a screen-space spin.
// An unlit shallow surface supplies thickness at the foreshortened midpoint.
// This remains a drawing-derived experiment, not a volume-complete anatomical mesh.
export function forwardAngles(pose){return{shoulder:.20*clamp(pose,0,1),elbow:Math.PI*.75*clamp(pose,0,1)}}
export function deformForward(x,y,pose){
 const p=clamp(pose,0,1);if(!p)return{x,y,z:0};
 const boundary=y<385?376+(y-285)*.20:Math.min(440,396+(y-385)*.32);
 const arm=smooth(boundary-4,boundary+8,x)*smooth(280,313,y)*(1-smooth(594,615,y));
 if(!arm)return{x,y,z:0};
 const a=forwardAngles(p),s=JOINTS.shoulder,e=JOINTS.elbow;
 const upper=rotate({x,y},s,a.shoulder),ep=rotate(e,s,a.shoulder);
 const len=Math.hypot(JOINTS.wrist.x-e.x,JOINTS.wrist.y-e.y);
 const u={x:(JOINTS.wrist.x-e.x)/len,y:(JOINTS.wrist.y-e.y)/len};
 const v={x:u.y,y:-u.x};
 const t=(x-e.x)*u.x+(y-e.y)*u.y,w=(x-e.x)*v.x+(y-e.y)*v.y;
 const side=rotate(v,{x:0,y:0},a.shoulder),along=rotate(u,{x:0,y:0},a.shoulder);
 const forearmSurface=12*Math.sqrt(Math.max(0,1-(w/23)**2));
 // Close the palm surface along its length. A constant-width open ribbon/tube
 // disappears edge-on at 90 degrees, even with correct skeleton projection.
 const palmSurface=22*Math.sqrt(Math.max(0,1-(w/23)**2-((t-98)/58)**2));
 const palmBlend=smooth(58,82,t);
 const roundness=forearmSurface+(palmSurface-forearmSurface)*palmBlend;
 const flex=Math.cos(a.elbow)*t-Math.sin(a.elbow)*roundness;
 const depth=Math.sin(a.elbow)*t+(Math.cos(a.elbow)-1)*roundness;
 const lower={x:ep.x+side.x*w+along.x*flex,y:ep.y+side.y*w+along.y*flex,z:depth};
 const forearm=smooth(389,443,y);
 return{x:x+arm*(upper.x+(lower.x-upper.x)*forearm-x),y:y+arm*(upper.y+(lower.y-upper.y)*forearm-y),z:arm*forearm*Math.max(0,lower.z)};
}
export function validatePatch(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ожидается объект настроек');
 for(const [k,v] of Object.entries(value)){
  if(!(k in INITIAL))throw Error('Неизвестная настройка: '+k);
  if(k==='pose'&&(!Number.isFinite(v)||v<0||v>1))throw Error('Положение от 0 до 1');
  if(k==='cloth'&&!(v in COLORS))throw Error('Неизвестный цвет');
  if(k==='action'&&!['chest','lateral'].includes(v))throw Error('Неизвестное движение');
  if(['playing','original'].includes(k)&&typeof v!=='boolean')throw Error('Ожидается переключатель');
 }
 return{...value};
}
