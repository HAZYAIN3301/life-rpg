import { useState,useRef,useEffect } from 'react';
import { PlanGoal } from './PlanModel';
import { sphere } from './B2Model';
export function GoalMap({goals,open}:{goals:PlanGoal[];open:(id:string)=>void}){
 const [selected,setSelected]=useState(''),[zoom,setZoom]=useState(1);
 const box=useRef<HTMLDivElement>(null),[viewport,setViewport]=useState(800);
 useEffect(()=>{const el=box.current;if(!el)return;const ob=new ResizeObserver(()=>setViewport(el.clientWidth));ob.observe(el);return()=>ob.disconnect();},[]);
 const mobile=viewport<600;
 const roots=goals.filter(g=>!goals.some(p=>p.id===g.parent));
 const points=new Map<string,{x:number;y:number}>();
 let nextY=80;
 function placeLevel(items:PlanGoal[]){const columns=mobile?Math.min(3,Math.max(1,items.length)):items.length;items.forEach((g,i)=>points.set(g.id,{x:mobile?viewport/columns*(i%columns+.5):140+i*250,y:nextY+(mobile?Math.floor(i/columns)*150:0)}));nextY+=(mobile?Math.ceil(items.length/columns):1)*170;}
 placeLevel(roots);
 let remaining=goals.filter(g=>!points.has(g.id)),level=0;
 while(remaining.length&&level++<goals.length){const ready=remaining.filter(g=>points.has(g.parent||''));if(!ready.length){placeLevel(remaining);break;}placeLevel(ready);remaining=remaining.filter(g=>!points.has(g.id));}
 const width=mobile?viewport:Math.max(720,...[...points.values()].map(p=>p.x+150)),height=Math.max(500,...[...points.values()].map(p=>p.y+120));
 const picked=goals.find(g=>g.id===selected),near=new Set([selected,...goals.filter(g=>g.parent===selected).map(g=>g.id),picked?.parent||'']);
 return <div className="b24-map"><div className="b24-map-tools"><span>От смысла — к следующему шагу</span><button aria-label="Уменьшить карту" onClick={()=>setZoom(Math.max(.55,zoom-.15))}>−</button><button aria-label="Восстановить масштаб" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button aria-label="Увеличить карту" onClick={()=>setZoom(Math.min(1.6,zoom+.15))}>+</button></div><div ref={box} className={'b24-map-scroll '+(mobile?'mobile-map':'')} tabIndex={0} aria-label="Карта целей, можно прокручивать"><div style={{width:width*zoom,height:height*zoom}}><div className="b24-map-canvas" style={{width,height,transform:`scale(${zoom})`,transformOrigin:'0 0'}}><svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">{goals.filter(g=>points.has(g.parent||'')).map(g=>{const a=points.get(g.parent!)!,b=points.get(g.id)!;return <path key={g.id} d={`M${a.x} ${a.y+20} C${a.x} ${b.y-70},${b.x} ${a.y+70},${b.x} ${b.y-20}`} stroke={selected&&near.has(g.id)&&near.has(g.parent!)?'#c4a66f':'#697587'} strokeWidth={selected&&near.has(g.id)?2:1} fill="none"/>;})}</svg>{goals.map(g=>{const p=points.get(g.id)!;return <button key={g.id} className={'b24-map-node '+(selected&&!near.has(g.id)?'dim':'')} style={{left:p.x,top:p.y,width:mobile?Math.min(145,viewport/3-4):190,'--node':sphere(g.primary[0]).color} as React.CSSProperties} aria-pressed={g.id===selected} onClick={()=>setSelected(g.id)} onDoubleClick={()=>open(g.id)}><i/><strong>{g.title}</strong><small>{g.horizon}</small></button>;})}</div></div></div>{picked&&<div className="b24-map-selected"><span><strong>{picked.title}</strong><small>{picked.steps.filter(s=>s.done).length} / {picked.steps.length} шагов · {picked.project}</small></span><button className="wb-primary" onClick={()=>open(picked.id)}>Открыть цель</button></div>}</div>;
}
