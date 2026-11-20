import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listLogicEvents, LOGIC_EVENT_REGISTRY_VERSION } from '@dio-crm/contracts/logic-events';
import { apiAdminCommand, apiGet, ApiError } from '../api';
import './logic-draft-editor.css';

type Item = { eventId:string; screenId:string; registryVersion:number; source:string; sourceHash:string };
type Draft = { companyId:string; draftId:string; configRevision:number; revision:number; items:Item[]; runtimeStatus:'not-implemented'; releaseBinding:'not-connected'; capabilities?:{edit?:boolean} };
type Pending = { key:string; body:{ companyId:string; draftId:string; configRevision:number; revision:number; items:Array<{eventId:string;screenId:string;registryVersion:number;source:string}> } };
type Props = { companyId:string; draftId:string; configRevision:number; configDirty:boolean; disabled:boolean; onBlockingChange:(value:boolean)=>void; onPendingChange:(value:boolean)=>void; onSourcePresenceChange:(value:boolean)=>void };

const eventLabels:Record<string,string> = {
 'lead.create.field-change.v1':'리드 등록 · 필드 변경 (화면)',
 'lead.detail.field-change.v1':'리드 상세 · 필드 변경 (화면)',
 'lead.create.before-save.v1':'리드 등록 · 저장 전 (서버)',
 'lead.detail.before-save.v1':'리드 상세 · 저장 전 (서버)',
 'lead.convert.before-command.v1':'리드 고객 전환 전 (서버)',
};
const events=listLogicEvents('HQ_LEAD',LOGIC_EVENT_REGISTRY_VERSION);
const known=new Set(events.map(event=>event.eventId));
const byteLength=(value:string)=>new TextEncoder().encode(value).length;
const itemsFromSources=(sources:Record<string,string>)=>events.flatMap(event=>sources[event.eventId] ? [{ eventId:event.eventId, screenId:event.screenId, registryVersion:event.registryVersion, source:sources[event.eventId] }] : []);
const sourceMap=(items:Item[])=>Object.fromEntries(items.map(item=>[item.eventId,item.source]));

function parseDraft(value:unknown,companyId:string,draftId:string):Draft {
 if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('INVALID_RESPONSE');
 const v=value as Partial<Draft>;
 if(v.companyId!==companyId||v.draftId!==draftId||!Number.isSafeInteger(v.configRevision)||!Number.isSafeInteger(v.revision)||Number(v.revision)<0||!Array.isArray(v.items)||v.items.length>events.length||v.runtimeStatus!=='not-implemented'||v.releaseBinding!=='not-connected')throw new Error('INVALID_RESPONSE');
 const seen=new Set<string>();
 for(const item of v.items){
  if(!item||typeof item!=='object'||!known.has(item.eventId)||seen.has(item.eventId)||item.screenId!=='HQ_LEAD'||item.registryVersion!==LOGIC_EVENT_REGISTRY_VERSION||typeof item.source!=='string'||byteLength(item.source)>32768||typeof item.sourceHash!=='string'||!item.sourceHash)throw new Error('INVALID_RESPONSE');
  seen.add(item.eventId);
 }
 return v as Draft;
}

/** Authoring only: it neither evaluates source nor binds it to a published release. */
export function LogicDraftEditor({companyId,draftId,configRevision,configDirty,disabled,onBlockingChange,onPendingChange,onSourcePresenceChange}:Props){
 const [open,setOpen]=useState(false),[loaded,setLoaded]=useState<Draft|null>(null),[sources,setSources]=useState<Record<string,string>>({}),[selected,setSelected]=useState(events[0]?.eventId??'');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[stale,setStale]=useState(false),[message,setMessage]=useState('');
 const pending=useRef<Pending|null>(null);
 const initial=useMemo(()=>loaded?JSON.stringify(itemsFromSources(sourceMap(loaded.items))):'', [loaded]);
 const dirty=!!loaded&&JSON.stringify(itemsFromSources(sources))!==initial;
 const blocking=dirty||busy||uncertain||loading;
 useEffect(()=>{onBlockingChange(blocking);return()=>onBlockingChange(false);},[blocking,onBlockingChange]);
 useEffect(()=>{onPendingChange(busy||uncertain||loading);return()=>onPendingChange(false);},[busy,uncertain,loading,onPendingChange]);
 useEffect(()=>{onSourcePresenceChange(itemsFromSources(sources).length>0);return()=>onSourcePresenceChange(false);},[sources,onSourcePresenceChange]);
 const descriptor=events.find(event=>event.eventId===selected);
 const read=async(force=false)=>{
  if(loading||busy||uncertain)return;
  if(force&&dirty&&!window.confirm('저장하지 않은 로직 편집 내용을 버리고 서버 작업본을 다시 불러오시겠습니까?'))return;
  setLoading(true);setMessage('');
  try{
   const response=parseDraft(await apiGet<unknown>('/api/admin/logic-drafts?companyId='+encodeURIComponent(companyId)+'&draftId='+encodeURIComponent(draftId)),companyId,draftId);
   setLoaded(response);setSources(sourceMap(response.items));setStale(false);
   if(response.configRevision!==configRevision)setMessage('서버 설정 작업본 버전이 다릅니다. 설정을 다시 조회한 뒤 로직 작업본을 열어 주세요.');
  }catch(error){
   // Do not discard an existing unsaved buffer if a refresh fails.
   setMessage(error instanceof ApiError&&error.statusCode===403?'이 법인의 로직 작업본을 조회할 권한이 없습니다.':error instanceof ApiError&&(error.statusCode===404||error.statusCode===503)?'이 환경에서는 로직 작업본 저장을 지원하지 않습니다.':'로직 작업본을 확인하지 못했습니다. 다시 조회해 주세요.');
   if(!loaded)setStale(true);
  }finally{setLoading(false);}
 };
 const execute=async(command?:Pending)=>{
  if(busy||loading)return;
  if(command)pending.current=command;
  const current=pending.current;if(!current)return;
  setBusy(true);setMessage('');
  try{
   const response=parseDraft(await apiAdminCommand<unknown>('/api/admin/logic-drafts','PUT',current.body,current.key),companyId,draftId);
   if(response.configRevision!==current.body.configRevision)throw new Error('INVALID_RESPONSE');
   pending.current=null;setLoaded(response);setSources(sourceMap(response.items));setUncertain(false);setStale(false);
   setMessage('로직 작업본만 저장했습니다. 구문 검사·실행·사용자 적용 및 설정 게시와의 연결은 아직 제공되지 않습니다.');
  }catch(error){
   const unknown=!(error instanceof ApiError)||error.statusCode>=500;
   setUncertain(unknown);
   if(unknown)setMessage('저장 결과를 확인할 수 없습니다. 편집을 잠그고 동일한 요청으로 다시 시도합니다.');
   else {pending.current=null;setStale(error.statusCode===409||error.statusCode===403);setMessage(error.statusCode===409?'작업본 버전이 변경됐습니다. 입력을 보존했습니다. 서버 상태를 다시 조회하고 내용을 확인해 주세요.':error.statusCode===403?'저장 권한이 없거나 변경됐습니다. 입력을 보존했습니다.':'저장하지 못했습니다. 입력을 확인한 뒤 다시 시도하세요.');}
  }finally{setBusy(false);}
 };
 const editing=!!loaded&&loaded.capabilities?.edit===true&&loaded.configRevision===configRevision&&!configDirty&&!disabled&&!loading&&!busy&&!uncertain&&!stale;
 const save=()=>{
  if(!editing||!dirty||!loaded)return;
  const items=itemsFromSources(sources);
  if(items.some(item=>byteLength(item.source)>32768)){setMessage('각 이벤트의 코드는 UTF-8 기준 32KiB 이하여야 합니다.');return;}
  const body={companyId,draftId,configRevision,revision:loaded.revision,items};
  void execute({key:crypto.randomUUID(),body:structuredClone(body)});
 };
 return <details className="logic-draft-editor" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>관리자 작성 로직 작업본 · 리드</summary>
  <p className="logic-draft-notice"><strong>작성·저장 단계:</strong> 이 작업본은 현재 화면 설정 게시에 포함되지 않습니다. 구문 검사, 테스트 실행, 사용자 화면·서버 실행과 게시 연결은 아직 제공되지 않습니다.</p>
  {!loaded&&<button type="button" disabled={disabled||loading||busy||configDirty} onClick={()=>void read()}>{loading?'작업본 확인 중…':'로직 작업본 열기'}</button>}
  {configDirty&&<p role="status">화면 설정의 미저장 변경을 먼저 저장하거나 되돌린 뒤 로직 작업본을 편집하세요.</p>}
  {message&&<p role={uncertain||stale?'alert':'status'}>{message}</p>}
  {uncertain&&<button type="button" disabled={busy} onClick={()=>void execute()}>같은 요청 다시 시도</button>}
  {loaded&&<>
   <p>법인 작업본 revision {configRevision} · 로직 revision {loaded.revision} · {dirty?'미저장 변경 있음':'저장된 작업본'}</p>
   {loaded.configRevision!==configRevision&&<p role="alert">설정 작업본 버전이 변경됐습니다. 로직 작업본을 다시 조회한 뒤 편집하세요.</p>}
   {loaded.capabilities?.edit!==true&&<p role="status">이 환경 또는 계정에서는 로직 작업본 편집 권한을 확인할 수 없습니다.</p>}
   <label>이벤트 <select value={selected} disabled={!events.length||busy||uncertain} onChange={event=>setSelected(event.target.value)}>{events.map(event=><option key={event.eventId} value={event.eventId}>{eventLabels[event.eventId]??event.eventId}</option>)}</select></label>
   {descriptor&&<p className="logic-draft-meta">{descriptor.eventId} · {descriptor.executionContext==='screen'?'화면 이벤트':'서버 이벤트'} · 실행기 미구현</p>}
   <label className="logic-draft-source">스크립트 코드<textarea spellCheck={false} rows={12} value={sources[selected]??''} disabled={!editing} onChange={event=>setSources(old=>({...old,[selected]:event.target.value}))} aria-describedby="logic-source-help"/></label>
   <p id="logic-source-help" className="logic-draft-meta">이벤트별 최대 32KiB. 내용을 비우면 해당 이벤트의 작업본 코드를 제거합니다. 코드 입력은 실행되지 않습니다.</p>
   <div className="logic-draft-actions"><button type="button" disabled={!editing||!dirty} onClick={save}>로직 작업본 저장</button><button type="button" disabled={loading||busy||uncertain} onClick={()=>void read(true)}>서버 작업본 다시 조회</button></div>
  </>}
 </details>;
}
