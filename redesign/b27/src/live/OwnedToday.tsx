import {useLayoutEffect,useRef} from 'react';
import type {Snapshot} from './model';
declare global{interface Window{SatoruTodayBridge:{mount:(h:HTMLElement,p:string)=>void;mode:(m:string)=>void;calendar:(d:string,s:string)=>void;consumeCapture:()=>void}}}
export function OwnedToday({s,part}:{s:Snapshot;part:'board'|'notes'|'capture'|'review'|'tribe'}){
 const host=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(host.current)window.SatoruTodayBridge.mount(host.current,part);},[part,s.revision]);
 return <div ref={host} id={['board','notes','tribe'].includes(part)?'main':undefined} className={'b210-owned b213-owned owned-'+part}/>;
}
