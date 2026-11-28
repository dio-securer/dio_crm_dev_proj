import React,{useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ApiError,apiDelete,apiGet,apiPatch,apiPost} from '../api';
import {useHqMock} from './HqMockProvider';
import {HqModal} from './customer-shared';
import {opportunityRequestKeys} from './opportunity-retry';

type Kind='TASK'|'CALL'|'EVENT';
type Draft={kind:Kind;subject:string;note:string;dueDate:string;status:string;priority:string;ownerUserId:number;startAt:string;endAt:string;location:string};
type Item=Draft&{public_id:string;version:number;ownerName?:string};
type Data={items:Item[];owners:{userId:number;name:string}[]};
const labels:Record<Kind,string>={TASK:'과업',CALL:'통화',EVENT:'이벤트'};
const statuses:Record<string,string>={PLANNED:'예정',COMPLETED:'완료',CANCELED:'취소'};
const priorities:Record<string,string>={LOW:'낮음',NORMAL:'보통',HIGH:'높음'};
const empty=(kind:Kind,ownerUserId:number):Draft=>({kind,subject:'',note:'',dueDate:'',status:kind==='CALL'?'COMPLETED':'PLANNED',priority:'NORMAL',ownerUserId,startAt:'',endAt:'',location:''});
const draftOf=(item:Item):Draft=>({kind:item.kind,subject:item.subject,note:item.note,dueDate:item.dueDate,status:item.status,priority:item.priority,ownerUserId:item.ownerUserId,startAt:item.startAt??'',endAt:item.endAt??'',location:item.location??''});

export function HqOpportunityActivities({opportunityId,canEdit,onDirtyChange,onBusyChange}:{opportunityId:string;canEdit:boolean;onDirtyChange:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}){
 const {session}=useHqMock();const permissions=session?.user.permissions??[];const canRead=permissions.includes('ACTIVITY.READ');const writable=canEdit&&permissions.includes('ACTIVITY.WRITE');
 const client=useQueryClient(),path=`/api/opportunities/${opportunityId}/timeline`;
 const query=useQuery({queryKey:['hq-sales','opportunity-timeline',opportunityId,session?.user.userId],queryFn:()=>apiGet<Data>(path),enabled:canRead,retry:false});
 const [open,setOpen]=useState(false),[editing,setEditing]=useState<Item|null>(null),[draft,setDraft]=useState<Draft>(()=>empty('TASK',session?.user.userId??0));
 const baseline=useRef(draft),pending=useRef(false),keys=useRef(opportunityRequestKeys());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false),[filter,setFilter]=useState('');
 const dirty=open&&JSON.stringify(draft)!==JSON.stringify(baseline.current);
 useEffect(()=>{onDirtyChange(dirty||busy);return()=>onDirtyChange(false)},[dirty,busy,onDirtyChange]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange]);
 const begin=(kind:Kind,item?:Item)=>{if(pending.current)return;if(dirty&&!window.confirm('저장하지 않은 활동 입력을 버리시겠습니까?'))return;const next=item?draftOf(item):empty(kind,session?.user.userId??0);baseline.current=next;setDraft(next);setEditing(item??null);setOpen(true);setError('');setNotice('');setConflict(false);};
 const close=()=>{if(pending.current)return;if(dirty&&!window.confirm('저장하지 않은 활동 입력을 버리시겠습니까?'))return;setOpen(false);setEditing(null);setError('');setConflict(false);};
 const refresh=async()=>{await Promise.all([client.invalidateQueries({queryKey:['hq-sales','opportunity-timeline',opportunityId]}),client.invalidateQueries({queryKey:['hq-sales','opportunity-related',opportunityId]})]);};
 const mutate=async(method:'POST'|'PATCH'|'DELETE',item?:Item)=>{
  if(pending.current||!writable)return;
  if(method==='DELETE'&&!window.confirm(`“${item!.subject}” ${labels[item!.kind]}을 삭제하시겠습니까?`))return;
  pending.current=true;setBusy(true);setError('');setNotice('');setConflict(false);
  const url=item?`${path}/${item.public_id}`:path;const body=method==='DELETE'?{}:draft;const version=item?.version;const key=keys.current.get(method,url,body,version);
  const payload={...body,...(version===undefined?{}:{expectedVersion:version}),idempotencyKey:key};
  try{if(method==='POST')await apiPost(url,payload);else if(method==='PATCH')await apiPatch(url,payload);else await apiDelete(url,payload);keys.current.done(method,url,body,version);setOpen(false);setEditing(null);await refresh();setNotice(method==='DELETE'?'활동을 삭제했습니다.':'활동을 저장했습니다.');}
  catch(reason){setError(reason instanceof Error?reason.message:String(reason));setConflict(reason instanceof ApiError&&reason.statusCode===409);}
  finally{pending.current=false;setBusy(false);}
 };
 const reload=async()=>{if(pending.current)return;if(dirty&&!window.confirm('입력을 버리고 최신 활동을 불러오시겠습니까?'))return;const result=await query.refetch();if(result.error){setError('최신 활동을 불러오지 못했습니다. 입력은 유지됩니다.');return;}if(editing){const latest=result.data?.items.find(x=>x.public_id===editing.public_id);if(latest){const next=draftOf(latest);setEditing(latest);setDraft(next);baseline.current=next;}else{setOpen(false);setEditing(null);setNotice('해당 활동이 삭제되었습니다.');}}setError('');setConflict(false);};
 const change=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(previous=>({...previous,[key]:value}));
 const items=!query.isError&&!query.isPending?(query.data?.items??[]).filter(x=>!filter||x.status===filter):[];
 return <section className="hq-sales-card" aria-label="기회 활동"><h3>과업·통화·이벤트</h3><p>이 기회에 연결된 활동을 목업 저장소에 기록합니다. 방문 활동보고·ERP로 전송하지 않습니다.</p>
  {!canRead?<p>활동 조회 권한이 없습니다.</p>:<>
   {writable&&<div className="hq-customer-toolbar">{(['TASK','CALL','EVENT'] as Kind[]).map(kind=><button key={kind} type="button" disabled={busy} onClick={()=>begin(kind)}>새 {labels[kind]}</button>)}</div>}
   {notice&&<p role="status">{notice}</p>}{error&&!open&&<p role="alert">{error}</p>}
   <label>기회 활동 상태<select value={filter} disabled={busy} onChange={event=>setFilter(event.target.value)}><option value="">전체</option>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {query.isPending?<p>활동을 불러오는 중입니다.</p>:query.isError?<p role="alert">활동을 불러오지 못했습니다. <button type="button" disabled={busy} onClick={()=>void reload()}>활동 다시 불러오기</button></p>:!items.length?<p>표시할 활동이 없습니다.</p>:items.map(item=><article key={item.public_id} className="hq-sales-card"><h4>{labels[item.kind]} · {item.subject}</h4><p>{item.ownerName} · {statuses[item.status]} · 우선순위 {priorities[item.priority]}</p><p>{item.kind==='EVENT'?`${item.startAt.replace('T',' ')} ~ ${item.endAt.replace('T',' ')} · ${item.location||'장소 미정'}`:`기한 ${item.dueDate||'미정'}`}</p><p style={{whiteSpace:'pre-wrap'}}>{item.note||'내용 없음'}</p>{writable&&<div><button type="button" disabled={busy} onClick={()=>begin(item.kind,item)}>{labels[item.kind]} 수정</button><button type="button" disabled={busy||dirty} onClick={()=>void mutate('DELETE',item)}>{labels[item.kind]} 삭제</button></div>}</article>)}
  </>}
  {open&&<HqModal title={`${labels[draft.kind]} ${editing?'수정':'등록'}`} busy={busy} onClose={close}><form onSubmit={event=>{event.preventDefault();void mutate(editing?'PATCH':'POST',editing??undefined)}}>
   {!writable&&<p role="alert">현재 활동 저장 권한이 없습니다. 입력은 유지됩니다.</p>}
   <fieldset disabled={busy||!writable} style={{border:0,padding:0}}><div className="hq-sales-fields">
    <label>활동 제목<input required maxLength={200} value={draft.subject} onChange={event=>change('subject',event.target.value)}/></label>
    <label>활동 담당자<select value={draft.ownerUserId} onChange={event=>change('ownerUserId',Number(event.target.value))}>{!query.data?.owners.some(x=>x.userId===draft.ownerUserId)&&<option value={draft.ownerUserId}>{editing?.ownerName??'현재 담당자'}</option>}{query.data?.owners.map(owner=><option key={owner.userId} value={owner.userId}>{owner.name}</option>)}</select></label>
    <label>활동 기한<input type="date" value={draft.dueDate} onChange={event=>change('dueDate',event.target.value)}/></label>
    <label>활동 상태<select value={draft.status} onChange={event=>change('status',event.target.value)}>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>활동 우선순위<select value={draft.priority} onChange={event=>change('priority',event.target.value)}>{Object.entries(priorities).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {draft.kind==='EVENT'&&<><label>이벤트 시작<input type="datetime-local" required value={draft.startAt} onChange={event=>change('startAt',event.target.value)}/></label><label>이벤트 종료<input type="datetime-local" required value={draft.endAt} onChange={event=>change('endAt',event.target.value)}/></label><label>이벤트 장소<input maxLength={200} value={draft.location} onChange={event=>change('location',event.target.value)}/></label></>}
    <label>활동 내용<textarea rows={4} maxLength={4000} value={draft.note} onChange={event=>change('note',event.target.value)}/></label>
   </div></fieldset>
   {error&&<p role="alert">{error} 입력은 유지됩니다.</p>}{conflict&&<button type="button" disabled={busy} onClick={()=>void reload()}>최신 활동 불러오기</button>}
   <footer><button type="submit" disabled={busy||!writable||!draft.subject.trim()}>{busy?'저장 중…':'활동 저장'}</button><button type="button" disabled={busy} onClick={close}>활동 취소</button></footer>
  </form></HqModal>}
 </section>;
}
