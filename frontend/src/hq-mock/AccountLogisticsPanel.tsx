import React,{useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiGet} from '../api';
import {HqError,useHqCommand,useHqCustomerPolicy} from './customer-shared';
import {useAccountEditorGuard} from './HqAccountDetail';
import {AccountActionConfirm} from './AccountActionConfirm';
import type {CustomerRecord} from './customer-model';
import './account-related.css';

const definitions={
 destinations:[['name','배송지명','text'],['recipient','수령인','text'],['phone','전화','tel'],['postalCode','우편번호','text'],['address','주소','text'],['detailAddress','상세 주소','text'],['note','배송 요청사항','textarea']],
 rentals:[['name','장비명','text'],['serialNumber','일련번호','text'],['installedOn','설치일','date'],['endsOn','종료일','date'],['ended','렌탈 종료','checkbox'],['note','비고','textarea']]
} as const;
type Kind=keyof typeof definitions;
type Form=Record<string,string|boolean>;
type Item=Form&{public_id:string;version:number;updated_at:string;ownerName:string};
const empty=(kind:Kind):Form=>Object.fromEntries(definitions[kind].map(([key,,type])=>[key,type==='checkbox'?false:'']));
const formOf=(kind:Kind,row:Item):Form=>Object.fromEntries(definitions[kind].map(([key])=>[key,row[key]]));
export function AccountLogisticsPanel({kind,account,onChanged}:{kind:Kind;account:CustomerRecord;onChanged:()=>Promise<void>}){
 const title=kind==='destinations'?'직송지':'렌탈장비',path=`/api/accounts/${account.public_id}/${kind}`;
 const policy=useHqCustomerPolicy(),command=useHqCommand();
 const query=useQuery({queryKey:['account-logistics',kind,account.public_id],queryFn:()=>apiGet<{items:Item[]}>(path),retry:false});
 const [form,setForm]=useState<Form>(()=>empty(kind)),[baseline,setBaseline]=useState(form),[selected,setSelected]=useState<Item|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[pendingDelete,setPendingDelete]=useState<Item|null>(null);
 const canWrite=policy.has('ACCOUNT.WRITE')&&(account.shared_access==='EDIT'||policy.owns(account,'ACCOUNT.MERGE'))&&policy.can('ACC.save',account);
 const allowLeave=useAccountEditorGuard(open&&JSON.stringify(form)!==JSON.stringify(baseline),busy||command.busy);
 const begin=(row:Item|null)=>{if(!allowLeave())return;const next=row?formOf(kind,row):empty(kind);setSelected(row);setForm(next);setBaseline(next);setOpen(true);setNotice('');command.clearError();};
 const refresh=async()=>{await query.refetch();await onChanged();};
 const save=async(event:React.FormEvent)=>{event.preventDefault();if(!canWrite||busy)return;setBusy(true);try{const saved=await command.run<Item>(selected?'PATCH':'POST',selected?`${path}/item/${selected.public_id}`:path,{...form,...(selected?{expectedVersion:selected.version}:{})});setSelected(saved);setForm(formOf(kind,saved));setBaseline(formOf(kind,saved));await refresh();setNotice(`${title} 저장 완료`);}catch{/* Retain the draft on validation, permission and version errors. */}finally{setBusy(false);}};
 const remove=async()=>{if(!pendingDelete||busy||!canWrite)return;setBusy(true);try{await command.run('DELETE',`${path}/item/${pendingDelete.public_id}`,{expectedVersion:pendingDelete.version});setPendingDelete(null);setOpen(false);setSelected(null);await refresh();setNotice(`${title} 삭제 완료`);}catch{/* Keep confirmation and record for retry. */}finally{setBusy(false);}};
 const reload=async()=>{if(!allowLeave())return;setBusy(true);try{const result=await query.refetch();if(result.error)return;const row=result.data?.items.find(item=>item.public_id===selected?.public_id);if(row){setSelected(row);const next=formOf(kind,row);setForm(next);setBaseline(next);command.clearError();}else{setOpen(false);setSelected(null);setNotice('이 항목은 삭제되었습니다.');}}finally{setBusy(false);}};
 return <section className="hq-customer-panel account-related-panel account-logistics" aria-label={title}>
  <header className="hq-customer-toolbar"><h3>{title}</h3>{canWrite&&<button disabled={busy} onClick={()=>begin(null)}>새 {title}</button>}</header>
  <p>거래처: {String(account.account_name??'')} · CRM에서 직접 관리하는 정보입니다.</p>
  <HqError error={command.error??query.error}/>{notice&&<p role="status">{notice}</p>}
  {pendingDelete&&<AccountActionConfirm title={`${title} 삭제`} message={`${pendingDelete.name} 항목을 삭제합니다.`} confirmLabel="삭제 확인" busy={busy} onCancel={()=>setPendingDelete(null)} onConfirm={()=>void remove()}/>}
  {open&&<form onSubmit={event=>void save(event)}><fieldset disabled={busy||!canWrite}><div className="hq-customer-fields">
   {definitions[kind].map(([key,label,type])=><label className={type==='textarea'?'full':undefined} key={key}>{label}{key==='name'||key==='address'?' *':''}
    {type==='textarea'?<textarea rows={3} maxLength={4000} value={String(form[key])} onChange={event=>setForm({...form,[key]:event.target.value})}/>:type==='checkbox'?<input type="checkbox" checked={Boolean(form[key])} onChange={event=>setForm({...form,[key]:event.target.checked})}/>:<input type={type} required={key==='name'||key==='address'} maxLength={key==='name'?200:500} min={key==='endsOn'?String(form.installedOn||''):undefined} value={String(form[key])} onChange={event=>setForm({...form,[key]:event.target.value})}/>}
   </label>)}
  </div></fieldset>{selected&&<p>담당자 {selected.ownerName} · 수정 {selected.updated_at}</p>}
  <footer>{canWrite&&<button type="submit" disabled={busy}>{busy?'저장 중…':'저장'}</button>}<button type="button" disabled={busy} onClick={()=>{if(allowLeave())setOpen(false);}}>닫기</button>{selected&&<button type="button" disabled={busy} onClick={()=>void reload()}>최신 내용 불러오기</button>}{selected&&canWrite&&<button type="button" disabled={busy} onClick={()=>{if(allowLeave())setPendingDelete(selected);}}>삭제</button>}</footer></form>}
  {query.isLoading?<p>불러오는 중…</p>:query.data?.items.length?<ul className="account-file-list">{query.data.items.map(row=><li key={row.public_id}><button disabled={busy} onClick={()=>begin(row)}>{String(row.name)}</button><p>{kind==='destinations'?`${row.address} ${row.detailAddress} · ${row.recipient} ${row.phone}`:`${row.serialNumber||'일련번호 없음'} · ${row.installedOn||'설치일 미지정'} ~ ${row.endsOn||'종료일 미지정'} · ${row.ended?'렌탈 종료':'사용 중'}`}</p></li>)}</ul>:!query.error&&<p>등록된 {title}가 없습니다.</p>}
 </section>;
}
