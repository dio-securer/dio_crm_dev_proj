import React, { useState } from 'react';
import { resolveCompanyConfig, type ConfigEntry } from '@dio-crm/contracts/crm-customization';
import { editSetting } from './draft-editor';
import { VisualPreviewPanel } from './VisualPreviewPanel';
import type { VisualEditor } from './VisualPropertyPanel';
import type { PreviewScreen } from './VisualPreviewRuntime';
import './admin-workspace.css';

/** Both workspaces receive the very same unsaved CompanyConfig from the page. */
export function AdminWorkspace({ editor, locale }: { editor: VisualEditor; locale: string }) {
  const [mode, setMode] = useState<'process' | 'screen'>('screen');
  const [screen, setScreen] = useState('HQ_LEAD');
  const [menuOpen, setMenuOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia('(max-width: 800px)').matches);
  const [query, setQuery] = useState('');
  const ko = locale.startsWith('ko');
  const effective = resolveCompanyConfig(editor.catalog, editor.config);
  // Invalid intermediate drafts must remain navigable so the operator can fix them.
  const editableEntries = effective.entries.length ? effective.entries : editor.catalog.entries.map(entry => {
    const settings={...entry.settings};
    for(const patch of editor.config.patches.filter(p=>p.targetId===entry.id&&p.operation==='set')) {
      if((patch.property==='enabled'||patch.property==='visible')&&typeof patch.value==='boolean'&&entry.capabilities.includes(patch.property)&&!entry.locks.includes(patch.property))settings[patch.property]=patch.value;
    }
    return {...entry,settings};
  });
  const entries = new Map(editableEntries.map(e => [e.id, e]));
  const label = (e: ConfigEntry) => editor.config.translations[locale]?.[e.labelKey] ?? editor.translations[locale]?.[e.labelKey] ?? editor.translations['ko-KR']?.[e.labelKey] ?? e.id;
  const menus = editableEntries.filter(e => e.kind === 'MENU');
  const screens = editableEntries.filter(e => e.kind === 'SCREEN').sort((a,b) => (menus.find(m=>m.screenId===a.id)?.settings.order??a.settings.order)-(menus.find(m=>m.screenId===b.id)?.settings.order??b.settings.order));
  const shown = screens.filter(e => `${label(e)} ${e.id}`.toLowerCase().includes(query.toLowerCase()));
  const mutable = (e: ConfigEntry | undefined, property: 'enabled'|'visible') => !!e && !editor.disabled && e.support === 'supported' && e.capabilities.includes(property) && !e.locks.includes(property);
  const toggle = (e: ConfigEntry, property: 'enabled'|'visible', value: boolean) => editor.onChange(editSetting(editor.config,e,property,value));
  const linked = screen === 'HQ_LEAD' || screen === 'HQ_ACCOUNT' || screen === 'HQ_DIRECT_WORK' || screen === 'HQ_ANALYTICS' || screen === 'HQ_OPPORTUNITY';
  const selected = entries.get(screen);
  return <section className="admin-workspace" aria-label={ko?'법인 관리자 작업 공간':'Company administration workspace'}>
    <div className="admin-workspace-modes" role="group" aria-label={ko?'설정 작업 선택':'Choose configuration task'}>
      <button type="button" aria-pressed={mode==='process'} onClick={()=>setMode('process')}>{ko?'프로세스·메뉴':'Processes and menus'}</button>
      <button type="button" aria-pressed={mode==='screen'} onClick={()=>setMode('screen')}>{ko?'화면 속성':'Screen properties'}</button>
    </div>
    <p>{ko?'두 작업 공간의 변경은 같은 법인 작업본에 저장됩니다. 게시 전에는 사용자 화면에 반영되지 않습니다.':'Both workspaces share this company draft. Changes reach users only after publication.'}</p>
    <label hidden={mode==='screen'&&!menuOpen}>{ko?'화면 메뉴 검색':'Find a screen'}<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {mode==='process'?<div className="admin-process-table"><table><thead><tr><th>{ko?'사용자 메뉴 / 화면':'User menu / screen'}</th><th>{ko?'기능 사용':'Enable function'}</th><th>{ko?'메뉴 표시':'Show menu'}</th><th>{ko?'제약·영향':'Constraints and impact'}</th></tr></thead><tbody>{shown.map(e=>{
      const menu=menus.find(m=>m.screenId===e.id);
      const dependents=editableEntries.filter(x=>x.dependencies.includes(e.id)||x.screenId===e.id&&x.id!==e.id);
      return <tr key={e.id}><th scope="row">{label(e)}<small>{menu?.parentId?`${menu.parentId} / `:''}{e.id}</small></th>
        <td><input type="checkbox" aria-label={`${label(e)} ${ko?'기능 사용':'enabled'}`} checked={e.settings.enabled} disabled={!mutable(e,'enabled')} onChange={event=>toggle(e,'enabled',event.target.checked)}/></td>
        <td>{menu?<input type="checkbox" aria-label={`${label(e)} ${ko?'메뉴 표시':'menu visible'}`} checked={menu.settings.visible} disabled={!mutable(menu,'visible')} onChange={event=>toggle(menu,'visible',event.target.checked)}/>:<span>{ko?'메뉴 연결 없음':'No menu binding'}</span>}</td>
        <td>{e.support!=='supported'?(ko?'미지원 / 정책 결정 필요':'Unsupported / policy pending'):!mutable(e,'enabled')?(ko?'본사 잠금 또는 읽기 전용':'Standard lock or read-only'):ko?'게시 전 화면·API 적용 범위 검증 필요':'Screen/API enforcement must be verified before publication'}<small>{ko?'의존 항목':'Dependents'}: {dependents.length}{dependents.length>0&&<details><summary>{ko?'영향 확인':'Inspect impact'}</summary>{dependents.map(d=><div key={d.id}>{label(d)} · {d.id}</div>)}</details>}</small></td></tr>;
    })}</tbody></table>{!shown.length&&<p>{ko?'검색 결과가 없습니다.':'No matching screens.'}</p>}</div>:<><button type="button" aria-expanded={menuOpen} aria-controls="admin-screen-menu" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?(ko?'화면 메뉴 접기':'Hide screen menu'):(ko?'화면 메뉴 열기':'Show screen menu')}</button><div className={`admin-screen-layout ${menuOpen?'':'menu-collapsed'}`}>
      <nav id="admin-screen-menu" hidden={!menuOpen} aria-label={ko?'사용자 화면 메뉴':'User screens'}>{shown.map(e=><button type="button" key={e.id} aria-current={screen===e.id?'page':undefined} onClick={()=>setScreen(e.id)}>{label(e)}<small>{['HQ_LEAD','HQ_ACCOUNT','HQ_DIRECT_WORK','HQ_ANALYTICS','HQ_OPPORTUNITY'].includes(e.id)?(ko?'실제 미리보기 연결':'Preview connected'):(ko?'화면 편집 연결 대기':'Editor connection pending')}</small></button>)}</nav>
      <div className="admin-screen-content">{linked?<VisualPreviewPanel key={screen} initialScreen={screen as PreviewScreen} onScreenChange={setScreen} editor={editor}/>:<section><h3>{selected?label(selected):screen}</h3><p role="status">{ko?'이 화면의 사용자 기능과 설정 항목은 존재하지만 실제 화면 편집 연결은 아직 지원하지 않습니다. 미리보기·배치 편집은 E08 화면별 검증 후 제공합니다.':'User features and configuration entries exist, but visual editing is not connected. Preview and placement editing require per-screen E08 validation.'}</p><ul>{effective.entries.filter(e=>e.screenId===screen&&['TAB','SECTION','POPUP'].includes(e.kind)).map(e=><li key={e.id}>{label(e)} · {e.kind} · {e.support}</li>)}</ul></section>}</div>
    </div></>}
  </section>;
}
