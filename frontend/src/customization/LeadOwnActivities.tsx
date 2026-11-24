import React,{useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiGetConfigured,type ConfigurationContext} from '../api';

type Activity={publicId:string;subject:string;plannedAt:string;status:string};
const date=(day:Date)=>`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
export function LeadOwnActivities({id,cfg,session,ko}:{id:string;cfg:ConfigurationContext;session:string;ko:boolean}){
 const [to,setTo]=useState(()=>date(new Date())),[from,setFrom]=useState(()=>date(new Date(Date.now()-30*86400000)));
 const valid=from<=to&&Date.parse(to)-Date.parse(from)<=366*86400000;
 const result=useQuery({queryKey:['lead-own-activities',session,id,cfg.releaseId,cfg.permissionVersion,from,to],queryFn:()=>apiGetConfigured<{items:Activity[]}>(`/api/leads/${encodeURIComponent(id)}/activities?from=${from}&to=${to}&limit=50`,cfg),enabled:valid,retry:false,gcTime:0,refetchOnWindowFocus:false});
 return <section aria-label={ko?'내 활동 이력':'My activity history'}><p>{ko?'이 리드에 연결된 내 활동만 표시합니다.':'Only my activities linked to this lead are shown.'}</p><div className="config-toolbar"><label>{ko?'시작일':'From'} <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>{ko?'종료일':'To'} <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>{!valid?<p role="alert">{ko?'조회 기간은 1년 이하여야 합니다.':'The range must be within one year.'}</p>:result.isPending?<p role="status">{ko?'불러오는 중':'Loading'}</p>:result.isError?<p role="alert">{ko?'활동을 불러오지 못했습니다.':'Could not load activities.'} <button type="button" onClick={()=>void result.refetch()}>{ko?'다시 시도':'Retry'}</button></p>:result.data?.context?.releaseId!==cfg.releaseId||result.data.context.permissionVersion!==cfg.permissionVersion?<p role="alert">{ko?'설정이 변경되었습니다. 다시 조회해 주세요.':'Configuration changed. Refresh the view.'}</p>:!result.data.data.items.length?<p>{ko?'이 기간에 내 활동이 없습니다.':'No own activities in this period.'}</p>:<><ul>{result.data.data.items.map(item=><li key={item.publicId}><strong>{item.subject}</strong> · {item.plannedAt} · {item.status}</li>)}</ul>{result.data.data.items.length===50&&<p role="note">{ko?'최근 50건만 표시합니다. 이전 활동은 조회 기간을 좁혀 확인해 주세요.':'Showing the latest 50 items. Narrow the date range to find earlier activities.'}</p>}</>}</section>;
}
