import {AccountActionConfirm} from './AccountActionConfirm';
import React,{useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiGet} from '../api';
import {HqError,useHqCommand,useHqCustomerPolicy} from './customer-shared';
import {useAccountEditorGuard} from './HqAccountDetail';
import {useHqMock} from './HqMockProvider';
import type {CustomerRecord} from './customer-model';
import './account-related.css';
type Form={subject:string;content:string;answer:string;internalNote:string;status:string;origin:string;priority:string;type:string;contactPublicId:string;ownerUserId:number};
type Case=Form&{public_id:string;version:number;created_at:string;updated_at:string;start_at:string;end_at:string|null;created_by:string;updated_by:string;ownerName:string};
const blank=(ownerUserId:number):Form=>({subject:'',content:'',answer:'아직 답변이 등록되지 않았습니다.',internalNote:'',status:'신규등록',origin:'Community',priority:'Medium',type:'',contactPublicId:'',ownerUserId});
const formOf=(row:Case):Form=>Object.fromEntries(Object.keys(blank(0)).map(key=>[key,row[key as keyof Form]])) as Form;
type Response={items:Case[];contacts:{public_id:string;name:string}[];owners:{userId:number;name:string}[];choices:Record<string,string[]>};
export function AccountServicePanel({account,onChanged}:{account:CustomerRecord;onChanged:()=>Promise<void>}) {
 const {session}=useHqMock(),policy=useHqCustomerPolicy(),command=useHqCommand();
 const [pendingDelete,setPendingDelete]=useState<Case|null>(null);
 const defaults=()=>blank(session?.user.userId??0),[form,setForm]=useState<Form>(defaults),[baseline,setBaseline]=useState<Form>(defaults),[selected,setSelected]=useState<Case|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const path=`/api/accounts/${account.public_id}/services`;
 const query=useQuery({queryKey:['account-services',account.public_id],queryFn:()=>apiGet<Response>(path),retry:false});
 const canWrite=!account.shared_access&&policy.has('ACCOUNT.WRITE')&&policy.owns(account,'ACCOUNT.MERGE')&&policy.can('ACC.save',account);
 const allowLeave=useAccountEditorGuard(open&&JSON.stringify(form)!==JSON.stringify(baseline),busy||command.busy);
 const begin=(row:Case|null)=>{if(!allowLeave())return;const next=row?formOf(row):defaults();setForm(next);setBaseline(next);setSelected(row);setOpen(true);setNotice('');command.clearError();};
 const refresh=async()=>{await query.refetch();await onChanged();};
 const save=async(event:React.FormEvent)=>{event.preventDefault();if(!canWrite||busy)return;setBusy(true);try{const saved=await command.run<Case>(selected?'PATCH':'POST',selected?`${path}/${selected.public_id}`:path,{...form,...(selected?{expectedVersion:selected.version}:{})});setSelected(saved);setForm(formOf(saved));setBaseline(formOf(saved));await refresh();setNotice('고객센터 사례가 저장되었습니다.');}catch{/* Keep draft on validation, permission, or version failure. */}finally{setBusy(false);}};
 const remove=async(row:Case)=>{if(busy||!canWrite)return;setBusy(true);try{await command.run('DELETE',`${path}/${row.public_id}`,{expectedVersion:row.version});await refresh();setPendingDelete(null);setOpen(false);setSelected(null);setNotice('고객센터 사례가 삭제되었습니다.');}catch{/* Keep the selected case. */}finally{setBusy(false);}};
 const reload=async()=>{if(!allowLeave())return;setBusy(true);try{const result=await query.refetch();const row=result.data?.items.find(item=>item.public_id===selected?.public_id);if(row){setSelected(row);setForm(formOf(row));setBaseline(formOf(row));command.clearError();}}finally{setBusy(false);}};
 const field=(key:keyof Form,value:string)=>setForm(current=>({...current,[key]:key==='ownerUserId'?Number(value):value}));
 return <section className="hq-customer-panel account-related-panel" aria-label="고객센터"><header className="hq-customer-toolbar"><h3>고객센터</h3>{canWrite&&<button type="button" disabled={busy} onClick={()=>begin(null)}>새 고객센터 사례</button>}</header><p>내부비고는 이 테스트 사례에 저장되며 게시물이나 외부 메시지를 전송하지 않습니다.</p><HqError error={command.error??query.error}/>{notice&&<p role="status">{notice}</p>}
 {pendingDelete&&<AccountActionConfirm title="고객센터 사례 삭제" message={`${pendingDelete.subject} 사례를 삭제합니다.`} confirmLabel="삭제 확인" busy={busy||command.busy} onCancel={()=>setPendingDelete(null)} onConfirm={()=>void remove(pendingDelete)}/>}
 {open&&<form onSubmit={event=>void save(event)}><fieldset disabled={busy||!canWrite} style={{border:0,padding:0}}><div className="hq-customer-fields"><label>거래처<input readOnly value={String(account.account_name??account.public_id)}/></label><label>제목 *<input required maxLength={200} value={form.subject} onChange={event=>field('subject',event.target.value)}/></label><label>연락처<select value={form.contactPublicId} onChange={event=>field('contactPublicId',event.target.value)}><option value="">없음</option>{query.data?.contacts.map(contact=><option key={contact.public_id} value={contact.public_id}>{contact.name}</option>)}</select></label><label>소유자<select value={form.ownerUserId} onChange={event=>field('ownerUserId',event.target.value)}>{selected&&!query.data?.owners.some(owner=>owner.userId===form.ownerUserId)&&<option value={form.ownerUserId}>{selected.ownerName}</option>}{query.data?.owners.map(owner=><option key={owner.userId} value={owner.userId}>{owner.name}</option>)}</select></label>
 {([['status','상태'],['origin','접수 경로'],['priority','중요도'],['type','유형']] as const).map(([key,label])=><label key={key}>{label}<select value={form[key]} onChange={event=>field(key,event.target.value)}>{query.data?.choices[key]?.map(value=><option key={value} value={value}>{value||'없음'}</option>)}</select></label>)}
 {([['content','내용'],['answer','답변'],['internalNote','내부비고']] as const).map(([key,label])=><label className="full" key={key}>{label}<textarea rows={3} maxLength={4000} value={form[key]} onChange={event=>field(key,event.target.value)}/></label>)}</div></fieldset>
 {selected&&<p>시작 {selected.start_at} · 종료 {selected.end_at??'—'} · 작성 {selected.created_by} · 수정 {selected.updated_by} ({selected.updated_at})</p>}
 <footer>{selected&&<button type="button" disabled={busy} onClick={()=>void reload()}>최신 내용 불러오기</button>}{canWrite&&<button type="submit" disabled={busy}>{busy?'저장 중…':'저장'}</button>}<button type="button" disabled={busy} onClick={()=>{if(allowLeave())setOpen(false);}}>닫기</button>{selected&&canWrite&&<button type="button" disabled={busy} onClick={()=>{if(allowLeave())setPendingDelete(selected);}}>삭제</button>}</footer></form>}
 {query.isLoading?<p>불러오는 중…</p>:!query.data?.items.length?<p>등록된 고객센터 사례가 없습니다.</p>:<ul>{query.data.items.map(row=><li key={row.public_id} style={{display:'flex',flexWrap:'wrap',gap:12,padding:'12px 0'}}><button type="button" disabled={busy} onClick={()=>begin(row)}>{row.subject}</button><span>{row.status} · {row.priority||'중요도 없음'} · {row.ownerName}</span><span>{row.start_at}</span></li>)}</ul>}
 </section>;
}
