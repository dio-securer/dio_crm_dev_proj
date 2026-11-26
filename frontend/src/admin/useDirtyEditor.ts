import {useEffect,useRef} from 'react';
export function useDirtyEditor(dirty:boolean,save:()=>Promise<void>,onError:(message:string)=>void,error?:string){
 const edited=useRef<HTMLElement|null>(null);
 useEffect(()=>{const track=(event:Event)=>{if(event.target instanceof HTMLElement&&event.target.closest('.configuration-page,.security-panel'))edited.current=event.target;};document.addEventListener('input',track);document.addEventListener('change',track);return()=>{document.removeEventListener('input',track);document.removeEventListener('change',track);window.dispatchEvent(new CustomEvent('admin-editor',{detail:{dirty:false,save:async()=>true}}));};},[]);
 useEffect(()=>{const field=edited.current;if(!field)return;if(error){field.setAttribute('aria-invalid','true');const summary=document.querySelector<HTMLElement>('[role=alert]');if(summary){summary.id||='admin-field-error';field.setAttribute('aria-describedby',summary.id);}field.focus();}else{field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');}},[error]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('admin-editor',{detail:{dirty,save:async()=>{try{await save();return true;}catch(e){onError((e as Error).message);window.dispatchEvent(new Event('admin-save-failed'));requestAnimationFrame(()=>edited.current?.focus());return false;}}}}));});
}
