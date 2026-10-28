import {forms} from '../components/generated/B2Scene';
// Alpha bounds of the accepted source art, with a small breathing margin.
// The four forms have different transparent canvases; the same crop loses faces.
const bounds=['347 315 330 441','334 234 355 602','282 119 460 802','199 43 625 935'];
export function Portrait({form=1}:{form?:number}){
 const index=Math.max(0,Math.min(3,form));
 return <span className="wb-portrait"><svg viewBox={bounds[index]} aria-hidden="true" preserveAspectRatio="xMidYMid meet"><image href={forms[index]} width="1024" height="1024"/></svg></span>;
}
