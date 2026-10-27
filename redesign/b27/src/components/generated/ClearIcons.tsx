import type { ReactNode } from 'react';
const calendar=<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/></>;
const paths:Record<string,ReactNode>={
 'action.search':<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 'action.back':<path d="m14 5-7 7 7 7"/>,
 'action.close':<path d="m6 6 12 12M18 6 6 18"/>,
 'action.check':<path d="m5 12 4 4L19 6"/>,
 'action.add':<path d="M12 5v14M5 12h14"/>,
 'action.delete':<><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
 'action.edit':<><path d="m4 16 11-11 4 4L8 20H4v-4Zm9-9 4 4"/><path d="m15 5 2-2 4 4-2 2"/></>,
 'action.expand':<path d="m9 5 7 7-7 7"/>,
 'action.import':<><path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/></>,
 'media.play':<path d="m8 4 12 8-12 8Z"/>,
 'media.pause':<><path d="M8 5v14M16 5v14"/></>,
 'media.stop':<rect x="5" y="5" width="14" height="14" rx="2"/>,
 'media.notes':<><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8m-8 4h5"/></>,
 'period.week':calendar,'nav.plan':calendar,'period.month':calendar,
 'system.focus':<><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
 'system.day-end':<><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/></>,
 'difficulty.easy':<><path d="M12 21V11m0 4C4 15 4 9 4 6c6 0 8 3 8 9Zm0-3c0-7 3-9 8-9 0 5-2 9-8 9Z"/></>,
 'difficulty.normal':<><path d="m5 3 14 14M19 3 5 17M3 15l6 6m6 0 6-6M3 3l5 1-4 4Zm18 0-5 1 4 4Z"/></>,
 'difficulty.hard':<><path d="m2 20 7-13 4 7 3-10 6 16H2Zm4-7 3 1 2-3m3 0 2 1 2-2"/></>,
 'action.link':<><path d="m10 8 3-3a4 4 0 0 1 6 6l-3 3m-2 2-3 3a4 4 0 0 1-6-6l3-3m0 6 8-8"/></>,
};
export function ClearIcon({id,size=22}:{id:string;size?:number}){const p=paths[id];return p?<span className="wb-glyph" style={{width:size,height:size}} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p}</svg></span>:null;}
export const hasClearIcon=(id:string)=>!!paths[id];
