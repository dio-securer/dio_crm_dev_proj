import React,{useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiGetConfigured,ApiError,type ConfigurationContext} from '../api';

type HistoryItem={at:string;action:'LEAD.exclusionReasonChanged';changes:{contactExcludeReason:{before:string|null;after:string|null}}};
type HistoryPage={items:HistoryItem[];nextCursor:string|null};
function checked(value:unknown):HistoryPage{
 if(!value||typeof value!=='object')throw new Error('Invalid history response');
 const page=value as HistoryPage;
 if(!Array.isArray(page.items)||page.items.length>50||!(page.nextCursor===null||typeof page.nextCursor==='string'&&/^\d+$/.test(page.nextCursor)))throw new Error('Invalid history response');
 for(const item of page.items){const change=item?.changes?.contactExcludeReason;if(typeof item?.at!=='string'||!Number.isFinite(Date.parse(item.at))||item.action!=='LEAD.exclusionReasonChanged'||!change||!(change.before===null||typeof change.before==='string')||!(change.after===null||typeof change.after==='string'))throw new Error('Invalid history item');}
 return page;
}
/** This view is enabled only by an authenticated server capability, never by user input. */
export function LeadExclusionHistory({id,cfg,session,ko}:{id:string;cfg:ConfigurationContext;session:string;ko:boolean}){
 const [cursors,setCursors]=useState<(string|null)[]>([null]);const [page,setPage]=useState(0);const cursor=cursors[page];
 const query=useQuery({queryKey:['lead-exclusion-history',session,id,cfg.releaseId,cfg.permissionVersion,cursor],queryFn:async()=>{const params=new URLSearchParams({limit:'20'});if(cursor)params.set('cursor',cursor);const result=await apiGetConfigured<unknown>('/api/leads/'+id+'/history?'+params,cfg);if(result.context?.releaseId!==cfg.releaseId||result.context.permissionVersion!==cfg.permissionVersion)throw new Error('Configuration changed');return checked(result.data);},retry:false,gcTime:0,refetchOnWindowFocus:false});
 const unavailable=query.error instanceof ApiError&&[403,404,503].includes(query.error.statusCode);
 return <section aria-label={ko?'접촉 제외 사유 변경 이력':'Contact exclusion reason history'}><p>{ko?'접촉 제외 사유의 상세 수정 이력만 표시합니다. 전체 리드 변경 이력은 제공하지 않습니다.':'Only contact exclusion reason edits are shown. This is not the complete lead history.'}</p>
 {query.isPending?<p role="status">{ko?'이력을 불러오는 중입니다.':'Loading history.'}</p>:query.isError?<div role="alert"><p>{unavailable?(ko?'이력을 사용할 수 없거나 조회 권한이 없습니다.':'History is unavailable or access is denied.'):(ko?'이력을 불러오지 못했습니다.':'Unable to load history.')}</p>{!unavailable&&<button type="button" onClick={()=>void query.refetch()}>{ko?'다시 시도':'Retry'}</button>}</div>:<>{query.data.items.length===0?<p>{ko?'표시할 사유 변경 이력이 없습니다.':'No reason changes to display.'}</p>:<ol>{query.data.items.map((item,index)=><li key={index}><time dateTime={item.at}>{item.at}</time><dl><dt>{ko?'변경 전':'Before'}</dt><dd>{item.changes.contactExcludeReason.before??'—'}</dd><dt>{ko?'변경 후':'After'}</dt><dd>{item.changes.contactExcludeReason.after??'—'}</dd></dl></li>)}</ol>}<nav aria-label={ko?'이력 페이지':'History pages'}><button type="button" disabled={page===0} onClick={()=>setPage(page-1)}>{ko?'이전':'Previous'}</button><span>{page+1}</span><button type="button" disabled={!query.data.nextCursor} onClick={()=>{const next=query.data.nextCursor;if(!next)return;setCursors(old=>[...old.slice(0,page+1),next]);setPage(page+1);}}>{ko?'다음':'Next'}</button></nav></>}
 </section>;
}
