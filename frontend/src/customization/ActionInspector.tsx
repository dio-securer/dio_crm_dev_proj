import React from 'react';
import { screenActions } from '@dio-crm/contracts/crm-customization';
import type { VisualEditor } from './VisualPropertyPanel';
import { editSetting,editTranslation } from './draft-editor';
export function ActionInspector({editor,screen,locale,open}:{editor:VisualEditor;screen:string;locale:string;open:(variant:'owner'|'convert')=>void}){
 const ko=locale.startsWith('ko');
 const actions=screenActions.filter(a=>a.screenId===screen);
 if(!actions.length)return null;
 return <details className="lead-grid-picker"><summary>{ko?'버튼·팝업 연결':'Button and popup connections'}</summary><p>{ko?'편집 미리보기에서는 팝업만 열고 실제 담당자 변경·고객 전환은 실행하지 않습니다. 새 버튼의 임의 URL·스크립트 연결은 지원하지 않습니다.':'The preview opens a fixture popup without executing business actions. Arbitrary URL or script bindings are not supported.'}</p><p>{ko?'전환 미리보기는 HQ 화면 기준입니다. 관리형 사용자 전환 화면은 별도 입력 계약을 사용하므로 연락처·기회 선택 등 모든 입력이 동일하다고 보지 않습니다.':'Conversion preview uses the HQ screen. The managed conversion form uses a separate input contract.'}</p>{actions.map(action=><fieldset key={action.actionId} disabled={editor.disabled}><legend>{action.actionId} → {action.popupId}</legend>{[action.actionId,action.popupId].map(id=>{
 const entry=editor.catalog.entries.find(e=>e.id===id);if(!entry)return <p key={id}>{id} · {ko?'표준 연결 없음':'No standard binding'}</p>;
 const value=(property:'enabled'|'visible')=>{const p=editor.config.patches.find(p=>p.targetId===id&&p.property===property&&p.operation==='set');return typeof p?.value==='boolean'?p.value:entry.settings[property];};
 return <div key={id}><strong>{editor.translations[locale]?.[entry.labelKey]??id}</strong>{(['enabled','visible'] as const).map(property=><label key={property}><input type="checkbox" aria-label={`${id} ${property}`} checked={value(property)} disabled={editor.disabled||entry.support!=='supported'||entry.locks.includes(property)||!entry.capabilities.includes(property)} onChange={e=>editor.onChange(editSetting(editor.config,entry,property,e.target.checked))}/>{property==='enabled'?(ko?'사용':'Enabled'):(ko?'표시':'Visible')}</label>)}<label>{ko?'표시명':'Label'}<input disabled={editor.disabled||entry.support!=='supported'} value={editor.config.translations[locale]?.[entry.labelKey]??''} onChange={e=>editor.onChange(editTranslation(editor.config,locale,entry.labelKey,e.target.value))}/></label></div>;
 })}<p>{ko?'필요 권한':'Permission'}: {action.permission}</p><button type="button" onClick={()=>open(action.variant)}>{ko?'부모 화면에서 팝업 확인':'Inspect popup with parent'}</button></fieldset>)}</details>;
}
