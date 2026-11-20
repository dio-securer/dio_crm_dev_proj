import React, {useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiDelete, apiDownload, apiGet, apiPost, saveBlob} from '../api';

type FileRecord={public_id:string;name:string;note:string;size:number;version:number};
export function ContractFiles({contractId,writable}:{contractId:string;writable:boolean}) {
  const path=`/api/contracts/${encodeURIComponent(contractId)}/files`;
  const query=useQuery({queryKey:['contract-files',contractId],queryFn:()=>apiGet<{items:FileRecord[];maxBytes:number}>(path),retry:false});
  const [file,setFile]=useState<File|null>(null),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [pendingDelete,setPendingDelete]=useState<FileRecord|null>(null);
  const input=useRef<HTMLInputElement>(null), key=useRef(crypto.randomUUID());
  const upload=async()=>{if(!file||busy)return;setBusy(true);setMessage('');try{
    const types:Record<string,string>={txt:'text/plain',csv:'text/csv',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
    const contentType=types[file.name.split('.').pop()?.toLowerCase()??''];
    if(!contentType||!file.size||file.size>(query.data?.maxBytes??524288))throw new Error('TXT, CSV, PDF, PNG, JPG 중 512KB 이하 파일을 선택해 주세요.');
    const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
    await apiPost(path,{name:file.name,contentType,base64,note,idempotencyKey:key.current});key.current=crypto.randomUUID();setFile(null);setNote('');if(input.current)input.current.value='';await query.refetch();setMessage('파일을 저장했습니다.');
  }catch(error){setMessage(error instanceof Error?error.message:'파일 저장에 실패했습니다.');}finally{setBusy(false);}};
  const download=async(item:FileRecord)=>{setBusy(true);setMessage('');try{const {blob}=await apiDownload(`${path}/${item.public_id}/download`);saveBlob(blob,item.name);}catch(error){setMessage(error instanceof Error?error.message:'다운로드에 실패했습니다.');}finally{setBusy(false);}};
  const remove=async(item:FileRecord)=>{setBusy(true);setMessage('');try{await apiDelete(`${path}/${item.public_id}`,{expectedVersion:item.version});await query.refetch();setPendingDelete(null);setMessage('파일을 삭제했습니다.');}catch(error){setMessage(error instanceof Error?error.message:'파일 삭제에 실패했습니다.');}finally{setBusy(false);}};
  return <section className="hq-sales-card" aria-label="계약 파일"><h2>계약 파일</h2><p>테스트 데이터 · 최대 10개 · 파일당 512KB</p>
    {writable&&<><label>파일 선택<input ref={input} type="file" accept=".txt,.csv,.pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);key.current=crypto.randomUUID();}} /></label><label>비고<input value={note} maxLength={2000} disabled={busy} onChange={e=>setNote(e.target.value)} /></label><button type="button" disabled={!file||busy} onClick={()=>void upload()}>{busy?'처리 중…':'파일 저장'}</button></>}
    {message&&<p role="status">{message}</p>}{pendingDelete&&<div role="alert"><p>{pendingDelete.name} 파일을 삭제하시겠습니까?</p><button type="button" disabled={busy} onClick={()=>void remove(pendingDelete)}>삭제 확인</button><button type="button" disabled={busy} onClick={()=>setPendingDelete(null)}>취소</button></div>}{query.error&&<p role="alert">파일 목록을 불러오지 못했습니다. <button type="button" onClick={()=>void query.refetch()}>다시 시도</button></p>}{query.isLoading&&<p>파일을 불러오는 중입니다.</p>}
    {query.data&&!query.data.items.length&&<p>등록된 파일이 없습니다.</p>}<ul>{query.data?.items.map(item=><li key={item.public_id}><strong>{item.name}</strong> · {Math.ceil(item.size/1024)}KB {item.note&&<p>{item.note}</p>} <button type="button" disabled={busy} onClick={()=>void download(item)}>다운로드</button>{writable&&<button type="button" disabled={busy} onClick={()=>setPendingDelete(item)}>삭제</button>}</li>)}</ul>
  </section>;
}
