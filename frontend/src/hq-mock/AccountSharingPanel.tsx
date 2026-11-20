import {AccountActionConfirm} from './AccountActionConfirm';
import React,{useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiGet} from '../api';
import {HqError,useHqCommand,useHqCustomerPolicy} from './customer-shared';
import type {CustomerRecord} from './customer-model';
import {useAccountEditorGuard} from './HqAccountDetail';
type Share={public_id:string;userId:number;name:string;access:'READ'|'EDIT';teamRole:string;version:number};
type Sharing={items:Share[];users:{userId:number;name:string;canEdit:boolean}[];canManage:boolean};
export function AccountSharingPanel({publicId,account,onChanged}:{publicId:string;account:CustomerRecord;onChanged:()=>Promise<void>}) {
 const policy=useHqCustomerPolicy();
 const path=`/api/accounts/${publicId}/shares`,command=useHqCommand();
 const query=useQuery({queryKey:['account-sharing',publicId],queryFn:()=>apiGet<Sharing>(path),retry:false});
 const canManage=Boolean(query.data?.canManage&&policy.has('ACCOUNT.WRITE')&&policy.can('ACC.save',account));
 const [pendingDelete,setPendingDelete]=useState<Share|null>(null);
 const [userId,setUserId]=useState(''),[access,setAccess]=useState<'READ'|'EDIT'>('READ'),[role,setRole]=useState(''),[selected,setSelected]=useState<Share|null>(null),[busy,setBusy]=useState(false);
 const dirty=selected?access!==selected.access||role!==selected.teamRole:Boolean(userId||role);
 const allowLeave=useAccountEditorGuard(dirty,busy||command.busy);
 const clear=()=>{setUserId('');setAccess('READ');setRole('');setSelected(null);};
 const refresh=async()=>{await query.refetch();await onChanged();};
 const save=async()=>{if(busy||!canManage)return;setBusy(true);try{if(selected)await command.run('PATCH',`${path}/${selected.public_id}`,{access,teamRole:role,expectedVersion:selected.version});else await command.run('POST',path,{userId:Number(userId),access,teamRole:role});await refresh();clear();}catch{/* Preserve the share draft. */}finally{setBusy(false);}};
 const remove=async(item:Share)=>{if(busy||!canManage)return;setBusy(true);try{await command.run('DELETE',`${path}/${item.public_id}`,{expectedVersion:item.version});await refresh();setPendingDelete(null);clear();}catch{/* Keep inputs and surface the server error. */}finally{setBusy(false);}};
 const canEdit=query.data?.users.find(user=>user.userId===Number(userId))?.canEdit;
 return <section className="hq-customer-panel" aria-label="거래처 공유 및 팀"><h3>공유 및 팀</h3><p>합성 사용자에게 이 거래처만 공유합니다. 기회·고객센터 액세스는 비공개이며 기존 역할 권한을 초과할 수 없습니다.</p>
 {pendingDelete&&<AccountActionConfirm title="공유 해제" message={`${pendingDelete.name} 사용자의 거래처 공유를 해제합니다.`} confirmLabel="공유 해제 확인" busy={busy||command.busy} onCancel={()=>setPendingDelete(null)} onConfirm={()=>void remove(pendingDelete)}/>}
 <HqError error={command.error??query.error}/>
 {canManage&&<div className="hq-customer-fields"><label>사용자<select value={userId} disabled={busy||Boolean(selected)} onChange={event=>{setUserId(event.target.value);setAccess('READ');}}><option value="">사용자 선택</option>{query.data?.users.map(user=><option key={user.userId} value={user.userId}>{user.name}</option>)}</select></label><label>거래처 액세스<select value={access} disabled={busy} onChange={event=>setAccess(event.target.value as 'READ'|'EDIT')}><option value="READ">읽기 전용</option><option value="EDIT" disabled={!canEdit}>읽기/쓰기</option></select></label><label>팀 역할<input value={role} maxLength={80} disabled={busy} onChange={event=>setRole(event.target.value)}/></label><div><button type="button" disabled={!userId||busy} onClick={()=>void save()}>{selected?'공유 수정':'공유 추가'}</button><button type="button" disabled={busy} onClick={()=>{if(allowLeave())clear();}}>취소</button></div></div>}
 {query.isLoading?<p>불러오는 중…</p>:!query.data?.items.length?<p>추가된 공유 사용자가 없습니다.</p>:<ul>{query.data.items.map(item=><li key={item.public_id} style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',padding:'12px 0'}}><strong>{item.name}</strong><span>{item.access==='EDIT'?'읽기/쓰기':'읽기 전용'}</span><span>{item.teamRole}</span>{canManage&&<><button type="button" disabled={busy} onClick={()=>{if(allowLeave()){setSelected(item);setUserId(String(item.userId));setAccess(item.access);setRole(item.teamRole);}}}>수정</button><button type="button" disabled={busy} onClick={()=>{if(allowLeave())setPendingDelete(item);}}>공유 해제</button></>}</li>)}</ul>}
 </section>;
}
