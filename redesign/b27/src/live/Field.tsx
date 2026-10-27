import {Children,cloneElement,isValidElement,useId} from 'react';
import type {ReactNode,ReactElement} from 'react';
/** Keep the visible B2.5 label; options never become part of a select's name. */
export function Field({label,children}:{label:string;children:ReactNode}){const id=useId();return <label className="wb-field" htmlFor={id}><span>{label}</span>{Children.map(children,c=>isValidElement(c)?cloneElement(c as ReactElement<any>,{id,'aria-label':label}):c)}</label>;}
