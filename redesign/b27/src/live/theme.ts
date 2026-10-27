const rgb=(hex:string)=>[0,2,4].map(i=>parseInt(hex.replace('#','').slice(i,i+2),16));
const luminance=(hex:string)=>rgb(hex).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function accentText(hex:string){return contrast(hex,'#fff9ed')>=contrast(hex,'#18202b')?'#fff9ed':'#18202b';}
/** Same chosen hue, with a readable action/link tone on the current paper. */
export function accessibleAccent(hex:string,dark:boolean){
 if(!/^#[0-9a-f]{6}$/i.test(hex))return dark?'#c6c9e0':'#424760';
 const paper=dark?'#292d3b':'#f4f0e7',from=rgb(hex),target=dark?255:0;
 for(let step=0;step<=100;step++){const amount=step/100,value='#'+from.map(v=>Math.round(v+(target-v)*amount).toString(16).padStart(2,'0')).join('');if(contrast(value,paper)>=4.5)return value;}
 return dark?'#c6c9e0':'#424760';
}
