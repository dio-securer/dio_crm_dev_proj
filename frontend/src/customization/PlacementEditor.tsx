import React, { useState } from 'react';
import { placementRegions, placementErrors, type PlacementRegion } from '@dio-crm/contracts/crm-customization';
import type { VisualEditor } from './VisualPropertyPanel';
export function PlacementEditor({editor,screen,variant,tab,locale}:{editor:VisualEditor;screen:string;variant:string;tab:string;locale:string}){
 const [drag,setDrag]=useState<{region:string;id:string}|null>(null);
 const [message,setMessage]=useState('');
 const ko=locale.startsWith('ko');
 const regions=placementRegions.filter(r=>r.screenId===screen&&r.variant===variant&&(variant==='create'||r.tab===tab));
 const label=(id:string)=>{const e=editor.catalog.entries.find(e=>e.id===id);return e?(editor.config.translations[locale]?.[e.labelKey]??editor.translations[locale]?.[e.labelKey]??id):id;};
 const move=(r:PlacementRegion,id:string,to:number)=>{
  if(editor.disabled)return;const order=[...(editor.config.placementOrders?.[r.id]??r.fieldIds)],from=order.indexOf(id);
  if(from<0||to<0||to>=order.length)return;order.splice(from,1);order.splice(to,0,id);
  const next={...editor.config.placementOrders,[r.id]:order};
  if(placementErrors(next,editor.catalog.entries).length){setMessage(ko?'잠긴 필드 또는 허용되지 않은 위치입니다.':'Locked field or invalid placement.');return;}
  editor.onChange({...editor.config,placementOrders:next});setMessage(ko?'작업본의 필드 순서를 변경했습니다.':'Draft field order updated.');
 };
 if(!regions.length)return null;
 return <section aria-label={ko?'구역별 필드 배치':'Region field placement'} className="lead-grid-picker"><h4>{ko?'구역별 필드 배치':'Region field placement'}</h4><p>{ko?'같은 구역 안에서 드래그하거나 위·아래 버튼으로 이동합니다. 등록과 상세의 위치는 별도로 저장됩니다.':'Drag within a region or use the move buttons. Create and detail placements are independent.'}</p>{regions.map(r=><fieldset key={r.id} disabled={editor.disabled}><legend>{r.id}</legend>{(editor.config.placementOrders?.[r.id]??r.fieldIds).map((id,index)=><div className="lead-grid-picker-item" key={id} draggable={!editor.disabled} onDragStart={e=>{setDrag({region:r.id,id});e.dataTransfer.setData('text/plain',id);}} onDragOver={e=>{if(drag?.region===r.id)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(drag?.region===r.id)move(r,drag.id,index);setDrag(null);}} onDragEnd={()=>setDrag(null)}><span>{index+1}. {label(id)}<small>{r.id}.{id}</small></span><span><button type="button" disabled={editor.disabled||index===0} onClick={()=>move(r,id,index-1)} aria-label={`${label(id)} ${ko?'위로':'up'}`}>↑</button><button type="button" disabled={editor.disabled||index===r.fieldIds.length-1} onClick={()=>move(r,id,index+1)} aria-label={`${label(id)} ${ko?'아래로':'down'}`}>↓</button></span></div>)}<button type="button" disabled={editor.disabled||!editor.config.placementOrders?.[r.id]} onClick={()=>{const next={...editor.config.placementOrders};delete next[r.id];editor.onChange({...editor.config,placementOrders:next});}}>{ko?'구역 순서 상속':'Inherit region order'}</button></fieldset>)}<p role="status">{message}</p></section>;
}
