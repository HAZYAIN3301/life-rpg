export const LOOK_KEY='satoru:avatar-wardrobe-lab:v2';
export const PALETTES=Object.freeze({skin:['#ffd3b0','#c98b63','#754f3c'],hair:['#ad6f4f','#302b38','#ddd1ae'],cloth:['#138c6c','#7563a1','#3c6890']});
export const DEFAULT_LOOK=Object.freeze({upper:'rogue',lower:'rogue',head:'rogue',weapon:'none',cape:true,skin:PALETTES.skin[0],hair:PALETTES.hair[0],cloth:PALETTES.cloth[0]});
export const MOTIONS=Object.freeze(['Idle','Walking_A','Sit_Floor_Idle','Cheer','1H_Melee_Attack_Slice_Horizontal']);
export const LOOK_OPTIONS=Object.freeze({upper:['rogue','knight','mage'],lower:['rogue','knight','mage'],head:['rogue','knight','mage'],weapon:['none','sword'],cape:[true,false],...PALETTES});
export function validateLookPatch(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length)throw Error('Expected clothing or colour choices');
 for(const [key,value]of Object.entries(input))if(!Object.hasOwn(LOOK_OPTIONS,key)||!LOOK_OPTIONS[key].includes(value))throw Error('Unsupported choice: '+key);
 return {...input};
}
export function normalizeLook(input={}){
 const source=input&&typeof input==='object'?input:{},out={};
 for(const k of ['upper','lower','head'])out[k]=['rogue','knight','mage'].includes(source[k])?source[k]:DEFAULT_LOOK[k];
 out.weapon=source.weapon==='sword'?'sword':'none';out.cape=typeof source.cape==='boolean'?source.cape:DEFAULT_LOOK.cape;
 for(const k of ['skin','hair','cloth'])out[k]=PALETTES[k].includes(source[k])?source[k]:DEFAULT_LOOK[k];
 return out;
}
export function readLook(storage){try{return normalizeLook(JSON.parse(storage.getItem(LOOK_KEY)||'{}'));}catch{return {...DEFAULT_LOOK};}}
export function saveLook(storage,input){const look=normalizeLook(input),serialized=JSON.stringify(look);try{storage.setItem(LOOK_KEY,serialized);if(storage.getItem(LOOK_KEY)!==serialized)return {ok:false};return {ok:true,look};}catch{return {ok:false};}}
