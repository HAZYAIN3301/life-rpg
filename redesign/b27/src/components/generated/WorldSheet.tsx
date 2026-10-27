import {useEffect,useRef,type ReactNode} from 'react';
export function WorldSheet({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const opener=document.activeElement as HTMLElement;ref.current?.showModal();return()=>{ref.current?.close();if(opener?.isConnected)opener.focus();};},[]);
 return <dialog ref={ref} className="wb-dialog b25-sheet" aria-label={title} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><header><h2>{title}</h2><button aria-label="Закрыть окно" onClick={close}>×</button></header><div className="b25-sheet-body">{children}</div></dialog>;
}
