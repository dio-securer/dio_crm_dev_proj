import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiGet, apiPatch, apiPost } from '../api';
import { opportunityRequestKeys } from './opportunity-retry';
import { opportunityTimeline } from './opportunity-timeline';

type FollowUp = { public_id:string; opportunity_public_id:string; opportunity_name:string; title:string; due_date:string; status:'OPEN'|'COMPLETED'; version:number };
export function HqOpportunityFollowUps({ opportunityId, canEdit, onDirtyChange }: { opportunityId:string; canEdit:boolean; onDirtyChange:(dirty:boolean)=>void }) {
  const qc=useQueryClient(); const [params,setParams]=useSearchParams(); const selected=params.get('followUp') ?? '';
  const [title,setTitle]=useState(''); const [dueDate,setDueDate]=useState(''); const [editing,setEditing]=useState<FollowUp|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [conflict,setConflict]=useState(false);
  const pending=useRef(false); const keys=useRef(opportunityRequestKeys());
  const list=useQuery({queryKey:['hq-sales','opportunity-followups',opportunityId],queryFn:()=>apiGet<{followUps:FollowUp[]; activities:{public_id:string;planned_at?:string;visit_purpose?:string;status?:string}[]}>(`/api/opportunities/${opportunityId}/related`),retry:false});
  const original=useQuery({queryKey:['hq-sales','followup',selected],queryFn:()=>apiGet<FollowUp>(`/api/follow-ups/${selected}`),enabled:Boolean(selected),retry:false});
  const dirty=editing ? title!==editing.title || dueDate!==editing.due_date : Boolean(title || dueDate);
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false)},[dirty,onDirtyChange]);
  const select=(id:string)=>setParams(previous=>{const next=new URLSearchParams(previous);if(id)next.set('followUp',id);else next.delete('followUp');return next});
  const clear=()=>{setEditing(null);setTitle('');setDueDate('');setError('');setNotice('');setConflict(false)};
  const save=async (item?:FollowUp,status?:'OPEN'|'COMPLETED')=>{
    if(pending.current)return;
    pending.current=true;setBusy(true);setError('');setNotice('');setConflict(false);
    const path=item?`/api/follow-ups/${item.public_id}`:`/api/opportunities/${opportunityId}/follow-ups`;
    const method=item?'PATCH':'POST';
    const body=status ? {status} : {title:title.trim(),dueDate};
    const version=item?.version;const key=keys.current.get(method,path,body,version);
    try {const result=item?await apiPatch<FollowUp>(path,{...body,expectedVersion:version,idempotencyKey:key}):await apiPost<FollowUp>(path,{...body,idempotencyKey:key});keys.current.done(method,path,body,version);await Promise.all([qc.invalidateQueries({queryKey:['hq-sales','opportunity-related',opportunityId]}),qc.invalidateQueries({queryKey:['hq-sales','opportunity-followups',opportunityId]}),qc.invalidateQueries({queryKey:['hq-sales','opportunities']}),qc.invalidateQueries({queryKey:['hq-sales','pipeline']}),qc.invalidateQueries({queryKey:['hq-sales','followup',result.public_id]})]);clear();setNotice(status?'후속조치 상태를 저장했습니다.':item?'후속조치를 수정했습니다.':'후속조치를 등록했습니다.');}
    catch(reason){setError(reason instanceof Error?reason.message:String(reason));setConflict(reason instanceof ApiError && reason.statusCode===409)}
    finally{pending.current=false;setBusy(false)}
  };
  const changeEditing=(row:FollowUp)=>{if(dirty&&!window.confirm('입력 중인 후속조치를 버리시겠습니까?'))return;setEditing(row);setTitle(row.title);setDueDate(row.due_date);setError('');setNotice('')};
  const reload=async()=>{if(dirty&&!window.confirm('입력을 버리고 최신 후속조치 목록을 불러오시겠습니까?'))return;clear();await list.refetch();if(selected)await original.refetch()};
  return <section aria-label="후속조치"><h3>후속조치 <small>(MOCK)</small></h3><p>기회에 필요한 다음 조치와 기한을 기록합니다. 완료해도 기회 단계나 활동보고 승인 상태는 바뀌지 않습니다.</p>
    {notice&&<p role="status" className="hq-sales-notice">{notice}</p>}{error&&<p role="alert" className="hq-sales-error">{error}</p>}{conflict&&<button type="button" onClick={()=>void reload()}>최신 후속조치 불러오기</button>}
    {list.isPending&&<p>후속조치를 불러오는 중입니다.</p>}{list.isError&&<p role="alert">후속조치를 불러오지 못했습니다. <button type="button" onClick={()=>void list.refetch()}>다시 시도</button></p>}
    {list.data && !list.data.followUps?.length && <p>등록된 후속조치가 없습니다.</p>}
    {list.data?.followUps?.map(row=><article className="hq-sales-card" key={row.public_id}><strong>{row.title}</strong><p>기한 {row.due_date} · {row.status==='OPEN'?'진행 예정':'완료'}</p><button type="button" onClick={()=>select(row.public_id)}>후속조치 원본 보기</button>{canEdit&&<><button type="button" disabled={busy} onClick={()=>changeEditing(row)}>수정</button><button type="button" disabled={busy||dirty} onClick={()=>void save(row,row.status==='OPEN'?'COMPLETED':'OPEN')}>{row.status==='OPEN'?'완료 처리':'다시 진행'}</button></>}</article>)}
    {list.data && <div><h4>활동·후속조치 시간순</h4>{opportunityTimeline(list.data.activities ?? [],list.data.followUps ?? []).length===0?<p>표시할 활동과 후속조치가 없습니다.</p>:<ul>{opportunityTimeline(list.data.activities ?? [],list.data.followUps ?? []).map(row=><li key={`${row.kind}-${row.id}`}>{row.date || '날짜 없음'} · {row.kind==='activity'?'활동':'후속조치'} · {row.title} · {({OPEN:'진행 예정',COMPLETED:'완료',PLANNED:'예정',IN_PROGRESS:'진행 중',CANCELLED:'취소'} as Record<string,string>)[row.status] ?? row.status}{row.kind==='activity'?<a href={`/activities?record=${encodeURIComponent(row.id)}`}> 활동 원본 보기</a>:<button type="button" onClick={()=>select(row.id)}>시간순 원본 보기</button>}</li>)}</ul>}</div>}
    {selected && <section className="hq-sales-card" aria-label="후속조치 원본"><h4>후속조치 원본</h4>{original.isPending?<p>불러오는 중...</p>:original.isError?<p role="alert">원본을 불러올 수 없습니다.</p>:original.data?.opportunity_public_id!==opportunityId?<p role="alert">이 기회의 후속조치가 아닙니다.</p>:<><p>{original.data.title} · 기한 {original.data.due_date} · {original.data.status==='OPEN'?'진행 예정':'완료'}</p><button type="button" onClick={()=>select('')}>기회로 돌아가기</button></>}</section>}
    {canEdit&&<form className="hq-sales-fields" onSubmit={event=>{event.preventDefault();void save(editing??undefined)}}><h4>{editing?'후속조치 수정':'후속조치 등록'}</h4><label>후속조치 내용<input required maxLength={200} value={title} disabled={busy} onChange={event=>setTitle(event.target.value)} /></label><label>후속조치 기한<input required type="date" value={dueDate} disabled={busy} onChange={event=>setDueDate(event.target.value)} /></label><button disabled={busy}>{editing?'수정 저장':'후속조치 등록'}</button>{editing&&<button type="button" disabled={busy} onClick={()=>{if(dirty&&!window.confirm('입력 중인 후속조치를 버리시겠습니까?'))return;clear()}}>수정 취소</button>}</form>}
  </section>;
}
