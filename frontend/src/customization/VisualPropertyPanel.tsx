import React, { useState } from 'react';
import type { CompanyConfig, ConfigCatalog, ConfigEntry, ConfigProperty, ConfigScalar, Translations,LeadColumnWidth } from '@dio-crm/contracts/crm-customization';
import { describeEditorProperty, fieldOrderNeedsPlacement, presentationPlacements } from '@dio-crm/contracts/crm-customization';
import {resolvedLeadColumnOrder} from '@dio-crm/contracts/lead-grid-columns';
import { editSetting, editTranslation } from './draft-editor';
import { adminText, adminIssueText } from './admin-labels';
import {canConfigureLeadSort} from './lead-sort-ui';
import {instanceForPlacement,placementIdForInstance} from './placement-instance';

export type VisualSelection = { id: string; instance: string | null; support: string | null };
export type VisualEditor = {
  catalog: ConfigCatalog;
  translations: Translations;
  config: CompanyConfig;
  onChange: (next: CompanyConfig) => void;
  disabled?: boolean;
  placementPresentationSupported?: boolean;
  accountPlacementPresentationSupported?: boolean;
  leadGridSupported?: boolean;
  leadGridDensitySupported?: boolean;
  leadGridSortSupported?: boolean;
  leadColumnWidthsSupported?: boolean;
  leadColumnAlignmentsSupported?: boolean;
  popupPresentationSupported?: boolean;
  buttonPresentationSupported?: boolean;
  issues?: Array<{ code: string; targetId?: string; messageKey?: string }>;
};

function currentEntry(entry: ConfigEntry, config: CompanyConfig): ConfigEntry {
  const settings = { ...entry.settings };
  for (const patch of config.patches.filter(item => item.targetId === entry.id && item.operation === 'set')) {
    (settings as unknown as Record<string, ConfigScalar>)[patch.property] = patch.value ?? null;
  }
  return { ...entry, settings };
}

export function VisualPropertyPanel({ editor, selected, screen, variant, locale, onSelect }: {
  editor: VisualEditor; selected: VisualSelection | null; screen: string; variant: string; locale: string; onSelect: (selection: VisualSelection) => void;
}) {
  const { catalog, translations, config, onChange, disabled } = editor;
  const [error, setError] = useState('');
  const t = adminText(locale);
  const standard = selected && catalog.entries.find(item => item.id === selected.id);
  const entry = standard ? currentEntry(standard, config) : null;
  const anchorSupport = selected?.support === 'mapped' ? 'supported' : selected?.support;
  const name = (item: ConfigEntry) => config.translations[locale]?.[item.labelKey]
    ?? translations[locale]?.[item.labelKey]
    ?? translations[config.defaultLocale]?.[item.labelKey]
    ?? item.id;
  const changed = (id: string, property?: ConfigProperty) => config.patches.some(patch => patch.targetId === id && (!property || patch.property === property));
  const tableOrderPending = Boolean(entry && fieldOrderNeedsPlacement(entry.id, config)) || selected?.instance?.startsWith('list.table.') === true || !!selected && !selected.instance && screen === 'HQ_LEAD' && variant === 'list';
  const canEdit = (property: ConfigProperty) => Boolean(entry && !disabled && !(property === 'order' && tableOrderPending) && (!anchorSupport || anchorSupport === entry.support) && describeEditorProperty(entry, property)?.editable);
  const canResetOrder = Boolean(entry && !disabled && entry.support === 'supported' && (!anchorSupport || anchorSupport === entry.support) && entry.capabilities.includes('order') && !entry.locks.includes('order'));
  const set = (property: ConfigProperty, value: ConfigScalar | undefined) => {
    if (!standard || !(canEdit(property) || property === 'order' && value === undefined && canResetOrder)) return;
    try { onChange(editSetting(config, standard, property, value)); setError(''); }
    catch { setError(t('locked')); }
  };
  const patchIds = [...new Set(config.patches.map(patch => patch.targetId))]
    .filter(id => catalog.entries.some(item => item.id === id && (item.id === screen || item.screenId === screen)));
  const translationIds = catalog.entries
    .filter(item => (item.id === screen || item.screenId === screen) && Boolean(config.translations[locale]?.[item.labelKey]))
    .map(item => item.id);
  const changedIds = [...new Set([...patchIds, ...translationIds])];
  const issueText = (issue: { code: string; messageKey?: string }) => adminIssueText(locale,issue,translations);
  const placement=presentationPlacements.find(item=>item.screenId===screen && item.variant===variant && item.fieldId===entry?.id && item.id===placementIdForInstance(screen,selected?.instance));
  const placementSupported=!!editor.placementPresentationSupported&&(screen!=='HQ_ACCOUNT'||!!editor.accountPlacementPresentationSupported);
  const changedPlacements=presentationPlacements.filter(item=>item.screenId===screen && item.variant===variant && Boolean(config.placementPresentation?.values[item.id]?.[locale]));
  const selectedIssues = editor.issues?.filter(issue => issue.targetId === entry?.id || !!placement && issue.targetId === placement.id) ?? [];
  const placementText=placement ? config.placementPresentation?.values[placement.id]?.[locale] : undefined;
  const setPlacementText=(key:'label'|'helpText',value:string)=>{
    if(!placement||disabled||!placementSupported||entry?.support!=='supported'||!config.activeLocales.includes(locale))return;
    const envelope=structuredClone(config.placementPresentation??{schemaVersion:1 as const,values:{}});
    const locales=envelope.values[placement.id]??={};
    const fields=locales[locale]??={};
    if(value==='') delete fields[key]; else fields[key]=value;
    if(!Object.keys(fields).length)delete locales[locale];
    if(!Object.keys(locales).length&&placement.id!=='account.create.basic.crmName')delete envelope.values[placement.id];
    onChange({...config,placementPresentation:envelope});
  };
  const sortEligible=canConfigureLeadSort(catalog,config);
  const setGridProperty=(key:'pageSize'|'density'|'defaultSort',value:25|50|100|'compact'|'default'|'comfortable'|{fieldId:'lead.updatedAt';direction:'asc'|'desc'}|undefined)=>{
    if(disabled||!editor.leadGridSupported || key==='density'&&!editor.leadGridDensitySupported || key==='defaultSort'&&(!editor.leadGridSortSupported||!!value&&!sortEligible))return;
    const grid={...config.leadGrid,schemaVersion:1 as const};
    if(key==='pageSize'){if(value===undefined)delete grid.pageSize;else if(typeof value==='number')grid.pageSize=value;}
    else if(key==='density'){if(value===undefined)delete grid.density;else if(typeof value==='string')grid.density=value;}
    else {if(value===undefined)delete grid.defaultSort;else if(typeof value==='object')grid.defaultSort=value;}
    const next={...config};if(grid.pageSize===undefined&&grid.density===undefined&&grid.defaultSort===undefined)delete next.leadGrid;else next.leadGrid=grid;onChange(next);
  };
  const selectedColumn=screen==='HQ_LEAD'&&variant==='list'&&selected?.instance?.startsWith('list.table.')&&entry?.kind==='FIELD'&&resolvedLeadColumnOrder(config).includes(entry.id)?entry:null;
  const setColumnWidth=(id:string,value:LeadColumnWidth|undefined)=>{
    if(disabled||!editor.leadColumnWidthsSupported)return;
    const widths={...config.leadColumnWidths?.values};if(value)widths[id]=value;else delete widths[id];
    const next={...config};if(Object.keys(widths).length)next.leadColumnWidths={schemaVersion:1,values:widths};else delete next.leadColumnWidths;onChange(next);
  };
  const setColumnAlignment=(id:string,value:'start'|'center'|'end'|undefined)=>{
    if(disabled||!editor.leadColumnAlignmentsSupported)return;
    const values={...config.leadColumnAlignments?.values};if(value)values[id]=value;else delete values[id];
    const next={...config};if(Object.keys(values).length)next.leadColumnAlignments={schemaVersion:1,values};else delete next.leadColumnAlignments;onChange(next);
  };
  const setButtonEmphasis=(value:string)=>{
    if(disabled||!editor.buttonPresentationSupported||entry?.support!=='supported')return;
    const values={...config.buttonPresentation?.values};
    if(value==='')delete values['lead.detail.save'];else if(value==='primary'||value==='secondary')values['lead.detail.save']=value;else return;
    const next={...config};if(Object.keys(values).length)next.buttonPresentation={schemaVersion:1,values};else delete next.buttonPresentation;onChange(next);
  };
  const setPopupPresentation=(key:'title'|'size',value:string)=>{
    if(disabled||!editor.popupPresentationSupported||!config.activeLocales.includes(locale)&&key==='title')return;
    const values=structuredClone(config.popupPresentation?.values??{}),popup=values['POP.LEAD.CREATE']??{};
    if(key==='title'){const titles={...popup.titles};if(value==='')delete titles[locale];else titles[locale]=value;if(Object.keys(titles).length)popup.titles=titles;else delete popup.titles;}
    else if(value==='')delete popup.size;else if(['small','medium','large','full'].includes(value))popup.size=value as 'small'|'medium'|'large'|'full';
    if(Object.keys(popup).length)values['POP.LEAD.CREATE']=popup;else delete values['POP.LEAD.CREATE'];
    const next={...config};if(Object.keys(values).length)next.popupPresentation={schemaVersion:1,values};else delete next.popupPresentation;onChange(next);
  };

  return <aside className="visual-property-panel" aria-label="선택 요소 속성">
    <h4>선택 요소 속성</h4>
    {!selected && <p>화면의 필드·탭·버튼을 클릭하거나 Tab으로 이동한 뒤 Enter를 누르세요.</p>}
    {selected && !entry && <p role="alert">카탈로그에 없는 설정 ID: <code>{selected.id}</code>. 이 요소는 편집할 수 없습니다.</p>}
    {entry && <>
      <h5>{name(entry)}</h5>
      <p><code data-testid="visual-selected-id">{entry.id}</code> · {entry.kind}</p>
      <p className="visual-property-instance">위치: {selected?.instance ?? '미지정'}</p>
      {selectedIssues.length > 0 && <div role="alert" data-testid="visual-selected-issues"><strong>{t('selectedIssues')}</strong><ul>{selectedIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueText(issue)}</li>)}</ul></div>}
      {anchorSupport && anchorSupport !== entry.support && <p role="alert">화면과 카탈로그의 지원 상태가 다릅니다. 편집을 중단하고 매핑을 확인하세요.</p>}
      {entry.support !== 'supported' && <p role="status">{entry.support === 'decision_pending' ? '정책 결정 대기' : '현재 화면에서 설정 미지원'} · 읽기 전용</p>}
      {entry.locks.length > 0 && <p>본사 잠금: {entry.locks.map(property => t(property)).join(', ')}</p>}
      {entry.support === 'supported' && entry.capabilities.length === 0 && <p>변경 가능한 속성이 없습니다.</p>}
      {screen==='HQ_LEAD' && variant==='list' && selected?.instance==='list.grid' && <fieldset disabled={disabled||!editor.leadGridSupported}><legend>리드 목록 그리드</legend><label>페이지 크기<select aria-label="그리드 페이지 크기" value={config.leadGrid?.pageSize??100} onChange={event=>{const pageSize=Number(event.target.value);if([25,50,100].includes(pageSize))setGridProperty('pageSize',pageSize as 25|50|100);}}><option value={25}>25행</option><option value={50}>50행</option><option value={100}>100행</option></select></label><span>{config.leadGrid?.pageSize!==undefined?'법인 변경':'표준 상속'}</span>{config.leadGrid?.pageSize!==undefined&&<button type="button" onClick={()=>setGridProperty('pageSize',undefined)}>그리드 기본값 상속 복원</button>}<label>행 높이<select aria-label="그리드 행 높이" value={config.leadGrid?.density??'default'} disabled={!editor.leadGridDensitySupported} onChange={event=>{const density=event.target.value;if(['compact','default','comfortable'].includes(density))setGridProperty('density',density as 'compact'|'default'|'comfortable');}}><option value="compact">촘촘하게</option><option value="default">기본</option><option value="comfortable">넓게</option></select></label><span>{config.leadGrid?.density!==undefined?'법인 변경':'표준 상속'}</span>{config.leadGrid?.density!==undefined&&<button type="button" disabled={!editor.leadGridDensitySupported} onClick={()=>setGridProperty('density',undefined)}>행 높이 상속 복원</button>}{!editor.leadGridDensitySupported&&<p>현재 서버는 행 높이 저장을 지원하지 않습니다.</p>}<p>기존 설정이 없으면 100행·기본 높이입니다. 정렬·행 선택·집계·출력 등은 아직 설정할 수 없습니다.</p><p>미리보기는 고정 예시 4행만 표시합니다. 실제 페이지 수와 다음 페이지는 사용자 목록에서 검증합니다.</p>{!editor.leadGridSupported&&<p>현재 서버는 그리드 속성 저장을 지원하지 않아 편집할 수 없습니다.</p>}</fieldset>}
      {screen==='HQ_LEAD'&&variant==='list'&&selected?.instance==='list.grid'&&<fieldset disabled={disabled||!editor.leadGridSupported||!editor.leadGridSortSupported}><legend>그리드 기본 정렬</legend><label>정렬 필드<select aria-label="그리드 기본 정렬 필드" value={config.leadGrid?.defaultSort?.fieldId??''} onChange={event=>{if(!event.target.value)setGridProperty('defaultSort',undefined);else if(sortEligible)setGridProperty('defaultSort',{fieldId:'lead.updatedAt',direction:config.leadGrid?.defaultSort?.direction??'desc'});}}><option value="">표준 순서 상속</option><option value="lead.updatedAt" disabled={!sortEligible}>수정일</option></select></label>{config.leadGrid?.defaultSort&&<><label>정렬 방향<select aria-label="그리드 기본 정렬 방향" value={config.leadGrid.defaultSort.direction} disabled={!sortEligible} onChange={event=>setGridProperty('defaultSort',{fieldId:'lead.updatedAt',direction:event.target.value as 'asc'|'desc'})}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label><span>법인 변경</span><button type="button" onClick={()=>setGridProperty('defaultSort',undefined)}>기본 정렬 상속 복원</button></>}{!sortEligible&&<p>수정일 필드가 지원되고 목록에 표시되며 마스킹되지 않아야 선택할 수 있습니다.</p>}{!editor.leadGridSortSupported&&<p>현재 서버는 그리드 정렬 저장을 지원하지 않습니다.</p>}<p>사용자에게 수정일 조회 권한이 없거나 가림 처리되면 서버의 표준 순서가 적용됩니다.</p></fieldset>}
      {selectedColumn&&<ColumnWidthControl key={selectedColumn.id} fieldId={selectedColumn.id} width={config.leadColumnWidths?.values[selectedColumn.id]} disabled={!!disabled||selectedColumn.support!=='supported'||!!anchorSupport&&anchorSupport!==selectedColumn.support||!editor.leadColumnWidthsSupported} supported={!!editor.leadColumnWidthsSupported} onChange={setColumnWidth}/>}
      {selectedColumn&&<fieldset disabled={!!disabled||selectedColumn.support!=='supported'||!!anchorSupport&&anchorSupport!==selectedColumn.support||!editor.leadColumnAlignmentsSupported}><legend>이 목록 열의 글자 정렬</legend><label>글자 정렬<select aria-label="열 글자 정렬" value={config.leadColumnAlignments?.values[selectedColumn.id]??'inherit'} onChange={event=>{const value=event.target.value;if(value==='inherit')setColumnAlignment(selectedColumn.id,undefined);else if(value==='start'||value==='center'||value==='end')setColumnAlignment(selectedColumn.id,value);}}><option value="inherit">표준 상속</option><option value="start">시작</option><option value="center">가운데</option><option value="end">끝</option></select></label><p>헤더와 셀의 글자 위치에만 적용됩니다. 데이터 순서는 바꾸지 않습니다.</p>{!editor.leadColumnAlignmentsSupported&&<p>현재 서버는 열 글자 정렬 저장을 지원하지 않습니다.</p>}</fieldset>}
      {screen==='HQ_LEAD'&&variant==='detail'&&selected?.id==='LEAD.save'&&selected.instance==='detail.form.save'&&<fieldset disabled={!!disabled||entry.support!=='supported'||!!anchorSupport&&anchorSupport!==entry.support||!editor.buttonPresentationSupported}><legend>상세 저장 버튼 표시</legend><label>강조 방식<select aria-label="버튼 강조 방식" value={config.buttonPresentation?.values['lead.detail.save']??''} onChange={event=>setButtonEmphasis(event.target.value)}><option value="">표준 상속</option><option value="primary">강조</option><option value="secondary">기본</option></select></label><p>상세 저장 버튼의 모양만 변경합니다. 저장 동작과 권한은 변경되지 않습니다.</p>{!editor.buttonPresentationSupported&&<p>현재 서버는 버튼 표시 저장을 지원하지 않습니다.</p>}</fieldset>}
      {screen==='HQ_LEAD'&&variant==='create'&&selected?.id==='POP.LEAD.CREATE'&&<fieldset disabled={!!disabled||entry.support!=='supported'||!editor.popupPresentationSupported}><legend>리드 등록 팝업 속성</legend><label>팝업 제목 ({locale})<input aria-label="팝업 제목" maxLength={200} value={config.popupPresentation?.values['POP.LEAD.CREATE']?.titles?.[locale]??''} disabled={!config.activeLocales.includes(locale)} onChange={event=>setPopupPresentation('title',event.target.value)}/></label><span>{config.popupPresentation?.values['POP.LEAD.CREATE']?.titles?.[locale]?'법인 변경':'표준 상속'}</span><label>팝업 크기<select aria-label="팝업 크기" value={config.popupPresentation?.values['POP.LEAD.CREATE']?.size??''} onChange={event=>setPopupPresentation('size',event.target.value)}><option value="">표준 상속</option><option value="small">작게</option><option value="medium">중간</option><option value="large">넓게</option><option value="full">화면에 맞춤</option></select></label><p>제목을 비우거나 크기에서 상속을 선택하면 기존 표준을 사용합니다. 화면이 좁으면 화면 폭에 맞추고 내용은 내부에서 스크롤합니다.</p>{!editor.popupPresentationSupported&&<p>현재 서버는 팝업 속성 저장을 지원하지 않습니다.</p>}</fieldset>}
      <fieldset disabled={disabled || entry.support !== 'supported' || Boolean(anchorSupport && anchorSupport !== entry.support)}>
        <legend>설정 속성</legend>
        {(['enabled', 'visible', 'readOnly', 'required'] as const).filter(property => entry.capabilities.includes(property)).map(property =>
          <div className="visual-property-row" key={property}>
            <label><input type="checkbox" data-testid={`visual-property-${property}`} checked={entry.settings[property]} disabled={!canEdit(property)} onChange={event => set(property, event.target.checked)} />{t(property)}</label>
            <span>{changed(entry.id, property) ? '법인 변경' : '표준 상속'}</span>
            {entry.locks.includes(property) && <small>본사 잠금</small>}
            {changed(entry.id, property) && <button type="button" disabled={!canEdit(property)} onClick={() => set(property, undefined)}>{t('inherit')}</button>}
          </div>)}
        {entry.capabilities.includes('order') && <div className="visual-property-row"><label>{t('order')}<input type="number" min="0" step="1" data-testid="visual-property-order" value={entry.settings.order} disabled={!canEdit('order')} onChange={event => { const value = Number(event.target.value); if (Number.isSafeInteger(value) && value >= 0) set('order', value); }} /></label><span>{changed(entry.id, 'order') ? '법인 변경' : '표준 상속'}</span>{tableOrderPending && <small>목록 열 순서는 E04의 배치 계약에서 설정합니다.</small>}{entry.locks.includes('order') && <small>본사 잠금</small>}{changed(entry.id, 'order') && <button type="button" onClick={() => set('order', undefined)} disabled={!canResetOrder}>{t('inherit')}</button>}</div>}
        {entry.capabilities.includes('masking') && <div className="visual-property-row"><label>{t('masking')}<select value={entry.settings.masking ?? 'none'} disabled={!canEdit('masking')} onChange={event => set('masking', event.target.value)}><option value="none">{t('none')}</option><option value="redact">{t('redact')}</option></select></label><span>{changed(entry.id, 'masking') ? '법인 변경' : '표준 상속'}</span>{changed(entry.id, 'masking') && <button type="button" onClick={() => set('masking', undefined)} disabled={!canEdit('masking')}>{t('inherit')}</button>}</div>}
        {entry.capabilities.includes('default') && <div className="visual-property-row"><label>{t('default')}{entry.valueRule?.options ? <select data-testid="visual-property-default" value={entry.settings.default === undefined ? '' : String(entry.valueRule.options.findIndex(option => option === entry.settings.default))} disabled={!canEdit('default')} onChange={event => set('default', event.target.value === '' ? undefined : entry.valueRule!.options![Number(event.target.value)])}><option value="">{t('inherit')}</option>{entry.valueRule.options.map((option, index) => <option key={index} value={index}>{String(option)}</option>)}</select> : entry.valueRule?.type === 'boolean' ? <select data-testid="visual-property-default" value={entry.settings.default === undefined ? '' : String(entry.settings.default)} disabled={!canEdit('default')} onChange={event => set('default', event.target.value === '' ? undefined : event.target.value === 'true')}><option value="">{t('inherit')}</option><option value="true">{t('enabled')}</option><option value="false">{t('none')}</option></select> : <input data-testid="visual-property-default" type={entry.valueRule?.type === 'number' ? 'number' : entry.valueRule?.type === 'date' ? 'date' : 'text'} min={entry.valueRule?.min} max={entry.valueRule?.max} minLength={entry.valueRule?.minLength} maxLength={entry.valueRule?.maxLength} step={entry.valueRule?.integer ? 1 : 'any'} value={entry.settings.default == null ? '' : String(entry.settings.default)} disabled={!canEdit('default')} onChange={event => { const raw = event.target.value; if (raw === '') set('default', undefined); else if (entry.valueRule?.type !== 'number' || Number.isFinite(Number(raw))) set('default', entry.valueRule?.type === 'number' ? Number(raw) : raw); }} />}</label><span>{changed(entry.id, 'default') ? '법인 변경' : '표준 상속'}</span>{entry.valueRule?.nullable && <button type="button" onClick={() => set('default', null)} disabled={!canEdit('default')}>null</button>}{changed(entry.id, 'default') && <button type="button" onClick={() => set('default', undefined)} disabled={!canEdit('default')}>{t('inherit')}</button>}</div>}
      </fieldset>
      <div className="visual-property-translation"><label>{t('translation')}<input value={config.translations[locale]?.[entry.labelKey] ?? ''} placeholder={translations[locale]?.[entry.labelKey] ?? entry.labelKey} disabled={disabled || entry.support !== 'supported' || Boolean(anchorSupport && anchorSupport !== entry.support) || !config.activeLocales.includes(locale)} onChange={event => { try { onChange(editTranslation(config, locale, entry.labelKey, event.target.value)); setError(''); } catch { setError(t('locked')); } }} /></label><span>{config.translations[locale]?.[entry.labelKey] ? '법인 변경' : '표준 상속'}</span></div>
      {placement && <fieldset className="visual-placement-presentation" disabled={disabled || !placementSupported || entry.support!=='supported' || Boolean(anchorSupport && anchorSupport!==entry.support) || !config.activeLocales.includes(locale)}><legend>이 위치의 표시 속성</legend><p>{placementSupported?'선택한 화면 위치에 적용됩니다. 비우면 상속합니다.':'현재 서버는 이 위치 속성의 저장을 지원하지 않아 편집할 수 없습니다.'}</p><label>이 위치의 표시명<input data-testid="placement-label" maxLength={200} value={placementText?.label??''} onChange={e=>setPlacementText('label',e.target.value)}/></label><label>이 위치의 도움말<input data-testid="placement-help" maxLength={1000} value={placementText?.helpText??''} onChange={e=>setPlacementText('helpText',e.target.value)}/></label><small>{placement.id} · {locale}</small></fieldset>}
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="visual-change-list"><h5>변경 목록</h5>{changedIds.length === 0 && changedPlacements.length===0 ? <p>이 화면의 변경된 속성·표시명이 없습니다.</p> : <ul>{changedIds.map(id => { const item = catalog.entries.find(entry => entry.id === id)!; return <li key={id}><button type="button" onClick={() => onSelect({ id, instance: null, support: item.support })}>{name(item)} · {id}{translationIds.includes(id) ? ' · 표시명' : ''}{config.patches.some(patch => patch.targetId === id && patch.property === 'visible' && patch.value === false) ? ' · 숨김' : ''}</button></li>; })}{changedPlacements.map(item=><li key={item.id}><button type="button" onClick={()=>onSelect({id:item.fieldId,instance:instanceForPlacement(item.id),support:'supported'})}>{item.id} · 위치별 표시 속성</button></li>)}</ul>}</div>
  </aside>;
}

function ColumnWidthControl({fieldId,width,disabled,supported,onChange}:{fieldId:string;width:LeadColumnWidth|undefined;disabled:boolean;supported:boolean;onChange:(id:string,value:LeadColumnWidth|undefined)=>void}){
  const [input,setInput]=useState(width?.mode==='min'?String(width.widthPx):'160');
  React.useEffect(()=>{setInput(width?.mode==='min'?String(width.widthPx):'160');},[fieldId,width?.mode,width?.mode==='min'?width.widthPx:undefined]);
  const amount=Number(input),valid=/^\d+$/.test(input)&&Number.isInteger(amount)&&amount>=80&&amount<=600;
  return <fieldset disabled={disabled}><legend>이 목록 열의 너비</legend><label>너비 방식<select aria-label="열 너비 방식" value={width?.mode??'inherit'} onChange={event=>{const mode=event.target.value;if(mode==='inherit')onChange(fieldId,undefined);else if(mode==='auto')onChange(fieldId,{mode:'auto'});else onChange(fieldId,{mode:'min',widthPx:160});}}><option value="inherit">표준 상속</option><option value="auto">자동</option><option value="min">최소 너비</option></select></label>{width?.mode==='min'&&<><label>최소 너비(px)<input aria-label="열 최소 너비(px)" type="number" min="80" max="600" step="1" value={input} onChange={event=>setInput(event.target.value)}/></label><button type="button" disabled={!valid} onClick={()=>onChange(fieldId,{mode:'min',widthPx:amount})}>너비 적용</button>{!valid&&<p role="alert">80~600의 정수를 입력하세요.</p>}</>}<p>입력 후 너비 적용을 누르세요. 실제 폭은 내용이나 화면 공간에 따라 커질 수 있습니다. 정확한 고정폭과 최대폭은 아직 지원하지 않습니다.</p>{!supported&&<p>현재 서버는 열 너비 저장을 지원하지 않습니다.</p>}</fieldset>;
}
