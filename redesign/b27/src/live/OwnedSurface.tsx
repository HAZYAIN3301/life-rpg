import {useLayoutEffect,useRef} from 'react';
import type {Snapshot} from './model';
declare global{interface Window{SatoruPlanBridge:{mount:(host:HTMLElement,kind:string,group?:string)=>void;view:(view:string,group?:string)=>void;flush:()=>Promise<boolean>;preference:(action:string,value:string)=>Promise<boolean>;occurrences:(dates:string[])=>Record<string,Occurrence[]>;translate:(root:HTMLElement)=>void}}}
export type Occurrence={key:string;blockId:string;title:string;date:string;start:string|null;end:string|null;minutes:number;skillId:string|null;fixed:boolean;outdoor:boolean};
/** The original complete forms remain the sole owners of credentials and saves. */
export function OwnedSurface({s,kind,group}:{s:Snapshot;kind:'settings'|'habits'|'inspiration';group?:string}){
  const host=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const el=host.current;if(!el)return;window.SatoruPlanBridge.mount(el,kind,group);},[s.revision,kind,group]);
  useLayoutEffect(()=>{const el=host.current;if(!el)return;const click=async(e:MouseEvent)=>{
    const preference=(e.target as Element).closest<HTMLButtonElement>('[data-action="set-theme"],[data-action="set-lang"],[data-action="set-accent"]');
    if(preference){e.preventDefault();e.stopPropagation();const action=preference.dataset.action!,value=preference.dataset.theme||preference.dataset.lang||preference.dataset.accent||'';const buttons=el.querySelectorAll<HTMLButtonElement>('[data-action="set-theme"],[data-action="set-lang"],[data-action="set-accent"]');buttons.forEach(b=>b.disabled=true);try{await window.SatoruPlanBridge.preference(action,value);}finally{buttons.forEach(b=>b.disabled=false);}return;}
    const target=(e.target as Element).closest<HTMLElement>('[data-view]:not([data-action])');if(!target)return;e.preventDefault();e.stopPropagation();if(!await window.SatoruPlanBridge.flush())return;window.SatoruPlanBridge.view(target.dataset.view!);window.dispatchEvent(new CustomEvent('satoru:legacy-route',{detail:{view:target.dataset.view}}));
  };el.addEventListener('click',click,true);return()=>el.removeEventListener('click',click,true);},[]);
  return <div id="main" ref={host} className={'b210-owned owned-'+kind}/>;
}
