import {AccountActionConfirm} from './AccountActionConfirm';
import React, {useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiDownload, apiGet, saveBlob} from '../api';
import {HqError, useHqCommand, useHqCustomerPolicy} from './customer-shared';
import {useAccountEditorGuard} from './HqAccountDetail';
import './account-related.css';
import type {CustomerRecord} from './customer-model';

type FileItem={public_id:string;name:string;size:number;version:number;created_at:string;note?:string;updated_at?:string;changeNote?:string};
export function AccountRelatedPanel({account,onChanged}:{account:CustomerRecord;onChanged:()=>Promise<void>}) {
  const policy=useHqCustomerPolicy(),command=useHqCommand(),input=useRef<HTMLInputElement>(null);
  const [pendingDelete,setPendingDelete]=useState<FileItem|null>(null);
  const [note,setNote]=useState('');
  const [versionTarget,setVersionTarget]=useState<FileItem|null>(null);
  const [editing,setEditing]=useState<FileItem|null>(null),[editName,setEditName]=useState(''),[editNote,setEditNote]=useState('');
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState('');
  const path=`/api/accounts/${account.public_id}/files`;
  const query=useQuery({queryKey:['account-files',account.public_id],queryFn:()=>apiGet<{items:FileItem[];maxBytes:number}>(path),retry:false});
  const allowLeave=useAccountEditorGuard(Boolean(file)||Boolean(note)||Boolean(editing&&(editName!==editing.name||editNote!==(editing.note??''))),busy||command.busy);
  const writable=policy.has('ACCOUNT.WRITE')&&policy.owns(account,'ACCOUNT.MERGE')&&policy.can('ACC.save',account);
  const refresh=async()=>{await query.refetch();await onChanged();};
  const upload=async()=>{
    if(!file||busy||!writable)return;
    setError(null);setNotice('');setBusy(true);
    try {
      if(file.size===0||file.size>(query.data?.maxBytes??512*1024))throw new Error('비어 있지 않은 512KB 이하 파일을 선택해 주세요.');
      const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('파일을 읽을 수 없습니다.'));reader.readAsDataURL(file);});
      const ext=file.name.split('.').pop()?.toLowerCase()??'';
      const types:Record<string,string>={txt:'text/plain',csv:'text/csv',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
      if(!types[ext])throw new Error('TXT, CSV, PDF, PNG, JPG 파일만 등록할 수 있습니다.');
      if(versionTarget)await command.run('POST',`${path}/${versionTarget.public_id}/version`,{contentType:types[ext],base64,changeNote:note,expectedVersion:versionTarget.version});
      else await command.run('POST',path,{name:file.name,contentType:types[ext],base64,note});
      setFile(null);setNote('');setVersionTarget(null);if(input.current)input.current.value='';await refresh();setNotice(versionTarget?'새 버전이 저장되었습니다.':'파일이 등록되었습니다.');
    }catch(reason){setError(reason);}finally{setBusy(false);}
  };
  const download=async(item:FileItem)=>{if(busy)return;setBusy(true);setError(null);try{const {blob}=await apiDownload(`${path}/${item.public_id}/download`);saveBlob(blob,item.name);}catch(reason){setError(reason);}finally{setBusy(false);}};
  const rename=async()=>{if(busy||!writable||!editing)return;setBusy(true);setError(null);try{await command.run('PATCH',`${path}/${editing.public_id}`,{name:editName,note:editNote,expectedVersion:editing.version});await refresh();setEditing(null);setNotice('파일 상세가 변경되었습니다.');}catch(reason){setError(reason);}finally{setBusy(false);}};
  const remove=async(item:FileItem)=>{if(busy||!writable)return;setBusy(true);setError(null);try{await command.run('DELETE',`${path}/${item.public_id}`,{expectedVersion:item.version});await refresh();setPendingDelete(null);if(editing?.public_id===item.public_id)setEditing(null);if(versionTarget?.public_id===item.public_id)setVersionTarget(null);setNotice('파일이 삭제되었습니다.');}catch(reason){setError(reason);}finally{setBusy(false);}};
  return <section className="hq-customer-panel account-related-panel" aria-label="거래처 파일">
    {pendingDelete&&<AccountActionConfirm title="파일 삭제" message={`${pendingDelete.name} 파일을 삭제합니다.`} confirmLabel="삭제 확인" busy={busy||command.busy} onCancel={()=>setPendingDelete(null)} onConfirm={()=>void remove(pendingDelete)}/>}
    <h3>파일</h3><p>테스트용 첨부 · 최대 10개 · 파일당 최대 512KB · TXT, CSV, PDF, PNG, JPG</p>
    {versionTarget&&<p>새 버전 대상: <strong>{versionTarget.name}</strong> · 변경사항을 비고에 입력해 주세요. <button type="button" disabled={busy} onClick={()=>{if(allowLeave()){setVersionTarget(null);setFile(null);setNote('');if(input.current)input.current.value='';}}}>새 버전 취소</button></p>}
    {writable&&<div className="hq-customer-toolbar account-file-upload"><label>파일 선택 <input ref={input} type="file" accept=".txt,.csv,.pdf,.png,.jpg,.jpeg" disabled={busy} onChange={event=>{setFile(event.target.files?.[0]??null);setNotice('');setError(null);}}/></label><label>비고 <input value={note} disabled={busy} maxLength={2000} onChange={event=>setNote(event.target.value)}/></label><button type="button" disabled={!file||busy} onClick={()=>void upload()}>{busy?'처리 중…':versionTarget?'새 버전 업로드':'파일 업로드'}</button></div>}
    {editing&&<div className="hq-customer-fields"><label>파일명<input value={editName} disabled={busy} maxLength={160} onChange={event=>setEditName(event.target.value)}/></label><label className="full">상세 설명<textarea value={editNote} disabled={busy} maxLength={2000} onChange={event=>setEditNote(event.target.value)}/></label><div><button type="button" disabled={busy||!editName.trim()} onClick={()=>void rename()}>상세 저장</button><button type="button" disabled={busy} onClick={()=>{if(allowLeave())setEditing(null);}}>취소</button></div></div>}
    <HqError error={error??command.error??query.error}/>{notice&&<p role="status">{notice}</p>}
    {query.isLoading?<p>파일을 불러오는 중…</p>:!query.data?.items.length?<p>등록된 파일이 없습니다.</p>:<ul className="account-file-list">{query.data.items.map(item=><li key={item.public_id} style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',padding:'12px 0'}}><strong style={{overflowWrap:'anywhere',flex:'1 1 180px'}}>{item.name}</strong><span>{Math.ceil(item.size/1024)}KB · 버전 {item.version}</span><span style={{flexBasis:'100%'}}>최종 수정: {item.updated_at??item.created_at}</span>{item.changeNote&&<span style={{flexBasis:'100%',overflowWrap:'anywhere'}}>변경사항: {item.changeNote}</span>}{item.note&&<span style={{flexBasis:'100%',overflowWrap:'anywhere'}}>{item.note}</span>}<button type="button" disabled={busy} onClick={()=>void download(item)}>다운로드</button>{writable&&<><button type="button" disabled={busy} onClick={()=>{if(allowLeave()){setVersionTarget(item);setFile(null);setNote('');if(input.current){input.current.value='';input.current.click();}}}}>새 버전</button><button type="button" disabled={busy} onClick={()=>{if(allowLeave()){setEditing(item);setEditName(item.name);setEditNote(item.note??'');}}}>상세 편집</button><button type="button" disabled={busy} onClick={()=>{if(allowLeave())setPendingDelete(item);}}>삭제</button></>}</li>)}</ul>}
  </section>;
}
