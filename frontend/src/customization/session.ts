import {useSyncExternalStore} from 'react';
// Cache identity is opaque; bearer tokens are never stored in query keys or logs.
let credential:string|null|undefined,scope='';
function snapshot(){
  if(typeof window==='undefined'||(window as Window & {__DIO_VISUAL_PREVIEW__?:boolean}).__DIO_VISUAL_PREVIEW__) return scope;
  let current:string|null=null;
  try{current=localStorage.getItem('dio_crm_access_token');}catch{return scope;}
  if(current!==credential){credential=current;scope=crypto.randomUUID();}
  return scope;
}
function subscribe(notify:()=>void){const timer=window.setInterval(notify,250);window.addEventListener('storage',notify);window.addEventListener('focus',notify);return()=>{clearInterval(timer);window.removeEventListener('storage',notify);window.removeEventListener('focus',notify);};}
export const useConfigurationSession=()=>useSyncExternalStore(subscribe,snapshot,()=> 'server');

export const getConfigurationSession=snapshot;
