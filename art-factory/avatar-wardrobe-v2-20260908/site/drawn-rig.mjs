// Pixel-space 2D skinning of ONE intact approved drawing; no independently placed limbs.
export const SOURCE = Object.freeze({width:640,height:900});
export const JOINTS = Object.freeze({shoulder:{x:386,y:303},elbow:{x:431,y:417},wrist:{x:461,y:487}});
export const INITIAL = Object.freeze({pose:0,playing:false,cloth:'original',original:false});
export const COLORS = Object.freeze({original:null,plum:'#846699',blue:'#4c79aa',forest:'#597d51'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
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
export function validatePatch(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ожидается объект настроек');
 for(const [k,v] of Object.entries(value)){
  if(!(k in INITIAL))throw Error('Неизвестная настройка: '+k);
  if(k==='pose'&&(!Number.isFinite(v)||v<0||v>1))throw Error('Положение от 0 до 1');
  if(k==='cloth'&&!(v in COLORS))throw Error('Неизвестный цвет');
  if(['playing','original'].includes(k)&&typeof v!=='boolean')throw Error('Ожидается переключатель');
 }
 return{...value};
}
