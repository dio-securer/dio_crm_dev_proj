import React,{useId} from 'react';
import './account-related.css';
export function AccountActionConfirm({title,message,confirmLabel,busy,onConfirm,onCancel}:{title:string;message:string;confirmLabel:string;busy:boolean;onConfirm:()=>void;onCancel:()=>void}) {
 const id=useId();
 return <div className="account-action-confirm" role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} aria-busy={busy}>
  <h4 id={`${id}-title`}>{title}</h4><p id={`${id}-message`}>{message}</p>
  <div><button type="button" autoFocus disabled={busy} onClick={onCancel}>취소</button><button type="button" disabled={busy} onClick={onConfirm}>{busy?'처리 중…':confirmLabel}</button></div>
 </div>;
}
