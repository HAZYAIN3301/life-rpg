import {useEffect,useRef,type ReactNode} from 'react';
import {Icon} from '../components/generated/B2Scene';
/** One modal contract across Plan and its nested project/goal forms. */
export function WorldSheet({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),dismiss=useRef(close);dismiss.current=close;
 useEffect(()=>{const opener=document.activeElement as HTMLElement;const el=ref.current;el?.showModal();return()=>{el?.close();if(opener?.isConnected)opener.focus();};},[]);
 return <dialog ref={ref} className="wb-dialog b217-dialog" aria-label={title} onCancel={e=>{e.preventDefault();dismiss.current();}} onClick={e=>{if(e.target===e.currentTarget)dismiss.current();}}><div className="wb-sheet"><header><h2>{title}</h2><button type="button" aria-label="Закрыть окно" onClick={()=>dismiss.current()}><Icon id="action.close" size={24}/></button></header><div className="b217-dialog-body">{children}</div></div></dialog>;
}
