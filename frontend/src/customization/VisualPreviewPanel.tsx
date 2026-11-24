/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import type { PreviewBoot, PreviewScreen, PreviewVariant, PreviewFixtureState } from './VisualPreviewRuntime';
import { VisualPropertyPanel, type VisualEditor, type VisualSelection } from './VisualPropertyPanel';
import { adminText, adminIssueText } from './admin-labels';
import { visualPreviewProjection } from './visual-preview-projection';
import { effectivePlacementPresentation, effectivePopupPresentation, presentationPlacements } from '@dio-crm/contracts/crm-customization';
import {canConfigureLeadSort} from './lead-sort-ui';
import baseline from '../../../packages/contracts/catalogs/hq-customization-baseline.json';
import { leadGridCandidates, resolvedLeadColumnOrder, mergeLeadColumnOrder } from '@dio-crm/contracts/lead-grid-columns';
import './visual-preview.css';
import { PlacementEditor } from './PlacementEditor';
import { ActionInspector } from './ActionInspector';

const variants: Record<PreviewScreen, Array<{ id: PreviewVariant; label: string; kind: 'screen' | 'popup'; popupId?: string }>> = {
  HQ_LEAD: [{ id: 'list', label: '목록', kind: 'screen' }, { id: 'detail', label: '상세', kind: 'screen' }, { id: 'create', label: '등록', kind: 'popup', popupId: 'POP.LEAD.CREATE' }, { id: 'owner', label: '담당자 변경', kind: 'popup', popupId: 'POP.LEAD.OWNER' }, { id: 'convert', label: '전환', kind: 'popup', popupId: 'POP.LEAD.CONVERT' }],
  HQ_ACCOUNT: [{ id: 'list', label: '목록', kind: 'screen' }, { id: 'detail', label: '상세', kind: 'screen' }, { id: 'create', label: '등록', kind: 'screen' }, { id: 'contact', label: '연락처', kind: 'popup', popupId: 'POP.ACC.CONTACT' }, { id: 'bulk', label: '일괄 수정', kind: 'popup', popupId: 'POP.ACC.BULK' }, { id: 'merge', label: '병합', kind: 'popup', popupId: 'POP.ACC.MERGE' }],
  HQ_DIRECT_WORK: [{ id: 'detail', label: '승인 상세', kind: 'screen' }],
  HQ_ANALYTICS: [{ id: 'detail', label: '분석 조회', kind: 'screen' }],
  HQ_OPPORTUNITY: [{ id: 'detail', label: '목록·상세', kind: 'screen' }]
};

let bundlePromise: Promise<{ script: string; css: string }> | undefined;
function loadBundle() {
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    let source = document;
    if (import.meta.env.DEV) {
      const index = await fetch('/__visual-preview/index.html', { cache: 'no-store' });
      if (!index.ok) throw new Error('미리보기를 사용하려면 프런트엔드를 먼저 빌드해 주세요.');
      source = new DOMParser().parseFromString(await index.text(), 'text/html');
    }
    const scriptPath = source.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
    const cssPath = source.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href]')?.getAttribute('href');
    if (!scriptPath || !/^\/?assets\/[\w.-]+\.js$/.test(scriptPath) || cssPath && !/^\/?assets\/[\w.-]+\.css$/.test(cssPath)) throw new Error('미리보기 앱 빌드를 찾을 수 없습니다.');
    const assetUrl = (asset: string) => import.meta.env.DEV ? '/__visual-preview/' + asset.replace(/^\//, '') : new URL(asset, document.baseURI).href;
    const script = assetUrl(scriptPath);
    const css = cssPath ? assetUrl(cssPath) : undefined;
    const [jsResponse, cssResponse] = await Promise.all([fetch(script), css ? fetch(css) : Promise.resolve(null)]);
    if (!jsResponse.ok || cssResponse && !cssResponse.ok) throw new Error('미리보기 화면 자산을 불러오지 못했습니다.');
    return { script: await jsResponse.text(), css: cssResponse ? await cssResponse.text() : '' };
  })().catch(error => { bundlePromise = undefined; throw error; });
  return bundlePromise;
}

function frameDocument(bundle: { script: string; css: string }, boot: PreviewBoot) {
  const flag = JSON.stringify(boot).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${boot.locale.startsWith('ko') ? 'ko' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; worker-src 'none'"><style>${bundle.css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script>window.__DIO_VISUAL_PREVIEW__=true;window.__DIO_VISUAL_PREVIEW_BOOT__=${flag};</script><script type="module">${bundle.script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}

export function VisualPreviewPanel({ editor, initialScreen = 'HQ_LEAD', onScreenChange }: { editor?: VisualEditor; initialScreen?: PreviewScreen; onScreenChange?: (screen: PreviewScreen) => void }) {
  const [screen, setScreen] = useState<PreviewScreen>(initialScreen);
  const [compare, setCompare] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(true);
  const [mobileProperties, setMobileProperties] = useState(false);
  const [fit, setFit] = useState(true);
  const [variant, setVariant] = useState<PreviewVariant>(initialScreen === 'HQ_DIRECT_WORK' || initialScreen === 'HQ_ANALYTICS' || initialScreen === 'HQ_OPPORTUNITY' ? 'detail' : 'list');
  const [tab,setTab] = useState('basic');
  const [device, setDevice] = useState<'pc' | 'mobile'>('pc');
  const [locale, setLocale] = useState('ko-KR');
  const [fixtureState, setFixtureState] = useState<PreviewFixtureState>('normal');
  const [frames, setFrames] = useState<{ viewKey:string; standard: { html: string; nonce: string }; company: { html: string; nonce: string } } | null>(null);
  const [status, setStatus] = useState({ standard: '화면을 준비하는 중…', company: '화면을 준비하는 중…' });
  const [selected, setSelected] = useState<VisualSelection | null>(null);
  const selectionByView = useRef(new Map<string, VisualSelection>());
  const returnFocusKey = useRef<string | null>(null);
  const viewKey = `${screen}:${variant}:${tab}`;
  const [frameReady, setFrameReady] = useState({ standard: false, company: false });
  const standardRef = useRef<HTMLIFrameElement>(null);
  const companyRef = useRef<HTMLIFrameElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const scale = Math.min(1, Math.max(.25, (entry.contentRect.width - 24) / 1024));
        (entry.target as HTMLElement).style.setProperty('--fit-scale', String(scale));
      }
    });
    workspace.querySelectorAll('.visual-preview-stage').forEach(stage => observer.observe(stage));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let current = true;
    const standardNonce = crypto.randomUUID(), companyNonce = crypto.randomUUID();
    setFrames(null); setFrameReady({ standard: false, company: false }); setSelected(selectionByView.current.get(viewKey) ?? null); setStatus({ standard: '화면을 준비하는 중…', company: '화면을 준비하는 중…' });
    void loadBundle().then(bundle => {
      if (!current) return;
      setFrames({
        viewKey,
        standard: { html: frameDocument(bundle, { screen, variant, locale, fixtureState, tab, nonce: standardNonce }), nonce: standardNonce },
        company: { html: frameDocument(bundle, { screen, variant, locale, fixtureState, tab, nonce: companyNonce }), nonce: companyNonce }
      });
    }).catch(error => { if (current) { const message = error instanceof Error ? error.message : String(error); setStatus({ standard: message, company: message }); } });
    return () => { current = false; };
  }, [screen, variant, locale, fixtureState, tab]);
  useEffect(() => {
    if (!frames) return;
    const receive = (event: MessageEvent) => {
      const side = event.source === standardRef.current?.contentWindow && event.data?.nonce === frames.standard.nonce ? 'standard'
        : event.source === companyRef.current?.contentWindow && event.data?.nonce === frames.company.nonce ? 'company' : null;
      if (!side) return;
      if (event.data.type === 'DIO_VISUAL_PREVIEW_READY') { setFrameReady(value => ({ ...value, [side]: true })); setStatus(value => ({ ...value, [side]: `${event.data.fixtureState === 'error' ? '조회 오류 예시' : event.data.fixtureState === 'empty' ? '빈 목록 예시' : event.data.fixtureState === 'erp-requesting' ? 'ERP 요청 중 예시' : '고정 fixture'} · 화면 요소 ${event.data.anchorCount}개` })); }
      if (event.data.type === 'DIO_VISUAL_PREVIEW_ERROR') setStatus(value => ({ ...value, [side]: `미리보기 오류: ${event.data.message}` }));
      if (event.data.type === 'DIO_VISUAL_PREVIEW_SELECT' && typeof event.data.id === 'string' && event.data.id.length <= 240 && (typeof event.data.instance === 'string' || event.data.instance == null)) {
        const selection = { id: event.data.id, instance: typeof event.data.instance === 'string' ? event.data.instance : null, support: typeof event.data.support === 'string' ? event.data.support : null };
        selectionByView.current.set(viewKey, selection);
        setSelected(selection);
        const opposite = side === 'standard' ? { ref: companyRef, nonce: frames.company.nonce } : { ref: standardRef, nonce: frames.standard.nonce };
        opposite.ref.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_FOCUS', nonce: opposite.nonce, id: event.data.id, instance: event.data.instance }, '*');
      }
    };
    window.addEventListener('message', receive);
    const timeout = window.setTimeout(() => setStatus(value => ({ standard: value.standard === '화면을 준비하는 중…' ? '미리보기 화면 응답이 없습니다.' : value.standard, company: value.company === '화면을 준비하는 중…' ? '미리보기 화면 응답이 없습니다.' : value.company })), 15000);
    return () => { window.removeEventListener('message', receive); window.clearTimeout(timeout); };
  }, [frames, viewKey]);
  useEffect(() => {
    if (!frames || !editor) return;
    const entries = visualPreviewProjection(editor.catalog, editor.config, screen, locale);
    if (frameReady.standard) standardRef.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_APPLY', nonce: frames.standard.nonce, entries: [] }, '*');
    if (frameReady.company) companyRef.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_APPLY', nonce: frames.company.nonce, entries }, '*');
    if (frameReady.standard) standardRef.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_GRID_COLUMNS', nonce: frames.standard.nonce, columns: [], order:resolvedLeadColumnOrder({}) }, '*');
    if (frameReady.company) companyRef.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_GRID_COLUMNS', nonce: frames.company.nonce, columns: editor.config.leadGridColumns ?? [], order:resolvedLeadColumnOrder(editor.config) }, '*');
    if (frameReady.standard) standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_PLACEMENTS',nonce:frames.standard.nonce,orders:{}},'*');
    if (frameReady.company) companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_PLACEMENTS',nonce:frames.company.nonce,orders:editor.config.placementOrders??{}},'*');
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_DENSITY',nonce:frames.standard.nonce,density:'default'},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_DENSITY',nonce:frames.company.nonce,density:editor.config.leadGrid?.density??'default'},'*');
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_SORT',nonce:frames.standard.nonce,direction:null},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_SORT',nonce:frames.company.nonce,direction:canConfigureLeadSort(editor.catalog,editor.config)?editor.config.leadGrid?.defaultSort?.direction??null:null},'*');
    const ordered=new Set(resolvedLeadColumnOrder(editor.config));
    const widthValues=Object.fromEntries(Object.entries(editor.config.leadColumnWidths?.values??{}).filter(([id])=>ordered.has(id)&&editor.catalog.entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.support==='supported')));
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_WIDTHS',nonce:frames.standard.nonce,values:{}},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_WIDTHS',nonce:frames.company.nonce,values:widthValues},'*');
    const alignmentValues=Object.fromEntries(Object.entries(editor.config.leadColumnAlignments?.values??{}).filter(([id])=>ordered.has(id)&&editor.catalog.entries.some(e=>e.id===id&&e.kind==='FIELD'&&e.support==='supported')));
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_ALIGNMENTS',nonce:frames.standard.nonce,values:{}},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_GRID_ALIGNMENTS',nonce:frames.company.nonce,values:alignmentValues},'*');
    const previewPolicy=editor.catalog.entries.map(entry=>({id:entry.id,readable:entry.support==='supported',enabled:entry.support==='supported'}));
    const emphasis=editor.config.buttonPresentation?.values['lead.detail.save'];
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_BUTTON_PRESENTATION',nonce:frames.standard.nonce,value:null},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_BUTTON_PRESENTATION',nonce:frames.company.nonce,value:emphasis??null},'*');
    const popup=effectivePopupPresentation(editor.config.popupPresentation,locale,editor.config.defaultLocale,previewPolicy)?.['POP.LEAD.CREATE']??{};
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_POPUP_PRESENTATION',nonce:frames.standard.nonce,value:{}},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_POPUP_PRESENTATION',nonce:frames.company.nonce,value:popup},'*');
    const readable=new Set(editor.catalog.entries.filter(entry=>entry.support==='supported').map(entry=>entry.id));
    if(frameReady.standard)standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_PRESENTATION',nonce:frames.standard.nonce,values:{}},'*');
    if(frameReady.company)companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_PRESENTATION',nonce:frames.company.nonce,values:effectivePlacementPresentation(editor.config.placementPresentation,locale,editor.config.defaultLocale,readable)??{}},'*');
    if (selected) {
      if (frameReady.standard) standardRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_FOCUS',nonce:frames.standard.nonce,id:selected.id,instance:selected.instance},'*');
      if (frameReady.company) companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_FOCUS',nonce:frames.company.nonce,id:selected.id,instance:selected.instance},'*');
    }
  }, [editor?.catalog, editor?.config, frames, frameReady, locale, screen, selected]);
  useEffect(() => {
    if (!frames || frames.viewKey !== viewKey || !frameReady.company || returnFocusKey.current !== viewKey || !selected) return;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches && mobileProperties) return;
    companyRef.current?.contentWindow?.postMessage({type:'DIO_VISUAL_PREVIEW_RETURN_FOCUS',nonce:frames.company.nonce,id:selected.id,instance:selected.instance},'*');
    returnFocusKey.current = null;
  }, [frames,frameReady.company,viewKey,selected,mobileProperties]);
  const selectFromList = (selection: VisualSelection) => {
    selectionByView.current.set(viewKey, selection);
    setSelected(selection);
    if (frames) {
      standardRef.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_FOCUS', nonce: frames.standard.nonce, id: selection.id, instance: selection.instance }, '*');
      companyRef.current?.contentWindow?.postMessage({ type: 'DIO_VISUAL_PREVIEW_FOCUS', nonce: frames.company.nonce, id: selection.id, instance: selection.instance }, '*');
    }
  };
  const changeScreen = (value: PreviewScreen) => { setScreen(value); setVariant(['HQ_DIRECT_WORK','HQ_ANALYTICS','HQ_OPPORTUNITY'].includes(value) ? 'detail' : 'list'); setFixtureState('normal'); onScreenChange?.(value); };
  const selectedVariant = variants[screen].find(item => item.id === variant);
  const screenIssues = editor?.issues?.filter(issue => editor.catalog.entries.some(entry => entry.id === issue.targetId && (entry.id === screen || entry.screenId === screen)) || presentationPlacements.some(item=>item.screenId===screen && item.id===issue.targetId)) ?? [];
  return <section className="visual-preview-panel" aria-label="실제 화면 격리 미리보기">
    <header className="visual-preview-heading"><div><h3>실제 CRM 화면 편집</h3><p>화면 요소를 선택해 속성을 편집합니다. 미리보기의 업무 요청은 차단됩니다.</p></div><div className="visual-preview-actions"><button type="button" aria-pressed={compare} onClick={()=>setCompare(!compare)}>{compare ? '비교 닫기' : '본사 화면과 비교'}</button><button type="button" aria-pressed={propertyOpen} onClick={()=>setPropertyOpen(!propertyOpen)}>{propertyOpen ? '속성 접기' : '속성 열기'}</button></div></header>
    <div className="visual-preview-controls">
      <label>화면<select value={screen} onChange={event => changeScreen(event.target.value as PreviewScreen)}><option value="HQ_LEAD">리드</option><option value="HQ_ACCOUNT">거래처</option><option value="HQ_DIRECT_WORK">직출·직퇴 승인</option><option value="HQ_ANALYTICS">영업 분석</option><option value="HQ_OPPORTUNITY">영업기회</option></select></label>
      <label>화면 / 팝업<select value={variant} onChange={event => { setVariant(event.target.value as PreviewVariant); setFixtureState('normal'); }}><optgroup label="화면">{variants[screen].filter(item => item.kind === 'screen').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup><optgroup label="팝업">{variants[screen].filter(item => item.kind === 'popup').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup></select></label>
      <label>기기<select value={device} onChange={event => setDevice(event.target.value as 'pc' | 'mobile')}><option value="pc">PC</option><option value="mobile">모바일 390px</option></select></label>
      <label>언어<select value={locale} onChange={event => setLocale(event.target.value)}><option value="ko-KR">한국어</option><option value="en-US">English</option></select></label>
      <label>데이터 상태<select value={fixtureState} onChange={event => setFixtureState(event.target.value as PreviewFixtureState)}>{screen === 'HQ_DIRECT_WORK' ? <><option value="normal">지점 승인 요청</option><option value="approval-branch-approved">본부 승인 대기</option></> : <><option value="normal">기본 예시</option>{variant === 'list' && <><option value="empty">빈 목록</option><option value="error">목록 조회 오류</option></>}{screen === 'HQ_ACCOUNT' && variant === 'detail' && <option value="erp-requesting">ERP 연계 요청 중</option>}</>}</select></label>
    </div>
    {screen==='HQ_LEAD'&&variant==='detail'&&<label>탭 / 구역<select aria-label="탭 / 구역" value={tab} onChange={e=>setTab(e.target.value)}>{[['basic','기본 정보'],['keyman','키맨'],['hospital','병원 현황'],['exclusions','제외 설정'],['hira','심평원 원천'],['marketing','마케팅'],['history','변경 이력'],['activities','활동 이력']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
    {selectedVariant?.kind === 'popup' && <button type="button" onClick={()=>{const parent=screen === 'HQ_LEAD' && variant === 'create' || screen === 'HQ_ACCOUNT' && (variant === 'bulk' || variant === 'merge') ? 'list' : 'detail';returnFocusKey.current=`${screen}:${parent}:${tab}`;setVariant(parent);setFixtureState('normal');}}>부모 화면으로 돌아가기</button>}
    {editor&&screen==='HQ_LEAD'&&variant==='create'&&editor.catalog.entries.some(item=>item.id==='POP.LEAD.CREATE')&&<button type="button" onClick={()=>{const entry=editor.catalog.entries.find(item=>item.id==='POP.LEAD.CREATE')!;selectFromList({id:entry.id,instance:'POP.LEAD.CREATE.0',support:entry.support});setPropertyOpen(true);setMobileProperties(true);}}>팝업 속성 선택</button>}
    {editor&&screen==='HQ_LEAD'&&variant==='detail'&&editor.catalog.entries.some(item=>item.id==='LEAD.save')&&<button type="button" onClick={()=>{const entry=editor.catalog.entries.find(item=>item.id==='LEAD.save')!;selectFromList({id:entry.id,instance:'detail.form.save',support:entry.support});setPropertyOpen(true);setMobileProperties(true);}}>상세 저장 버튼 선택</button>}
    {editor && screen==='HQ_LEAD' && variant==='list' && <div className="visual-grid-summary"><button type="button" onClick={()=>{selectFromList({id:'section:lead.list',instance:'list.grid',support:'supported'});setPropertyOpen(true);setMobileProperties(true);}}>그리드 전체 속성 선택</button><span>작업본 페이지 크기: {editor.config.leadGrid?.pageSize??100}행 · 미리보기는 고정 예시 4행</span></div>}
    <p className="visual-preview-status">{selectedVariant?.kind === 'popup' ? `팝업 ${selectedVariant.popupId} · 부모 화면과 함께 표시` : '일반 화면'} · 법인 작업본에 저장 전 변경이 즉시 반영됩니다.{compare && ' 비교 화면의 왼쪽은 본사 표준입니다.'}</p>
    {screen === 'HQ_ANALYTICS' && <p role="note">분석 화면에서는 날짜 필터 구역과 시작일·종료일만 연결했습니다. 집계 카드·조회 액션·출력은 화면별 계약 확인 전 편집할 수 없습니다. 합성 데이터로 표시하며 실제 분석 조회는 실행하지 않습니다.</p>}
    {screen === 'HQ_OPPORTUNITY' && <p role="note">목록과 상세의 확인된 필드 및 저장·단계 액션만 연결했습니다. 생성·제품·팝업과 실제 서버 권한 반영은 검증 전이며 편집 대상에 포함하지 않습니다.</p>}
    {screenIssues.length > 0 && <div className="visual-preview-issues" role="alert"><strong>{adminText(locale)('screenIssues')} ({screenIssues.length})</strong><ul>{screenIssues.map((issue, index) => <li key={`${issue.targetId}-${issue.code}-${index}`}><button type="button" onClick={() => { const placement=presentationPlacements.find(item=>item.id===issue.targetId); const entry = editor!.catalog.entries.find(item => item.id === (placement?.fieldId??issue.targetId)); if(!entry)return; if(placement&&(variant!==placement.variant||tab!=='basic')){const selection={id:entry.id,instance:placement.id.replace(/^lead\./,''),support:entry.support};selectionByView.current.set(`${screen}:${placement.variant}:basic`,selection);setVariant(placement.variant);setTab('basic');}else selectFromList({ id: entry.id, instance: placement?.id.replace(/^lead\./,'')??null, support: entry.support }); }}>{issue.targetId} · {adminIssueText(locale,issue,editor!.translations)}</button></li>)}</ul></div>}
    {device === 'pc' && <div className="visual-preview-fit"><button type="button" aria-pressed={fit} onClick={()=>setFit(!fit)}>{fit?'원본 크기 보기':'화면 폭에 맞추기'}</button><span>{fit?'1024px PC 화면을 축소해 보여 줍니다.':'원본 크기에서는 화면 안에서 가로로 스크롤할 수 있습니다.'}</span></div>}
    {editor && <div className="visual-mobile-switch" role="group" aria-label="모바일 편집 영역"><button type="button" aria-pressed={!mobileProperties} onClick={()=>setMobileProperties(false)}>화면 보기</button><button type="button" aria-pressed={mobileProperties} onClick={()=>{setPropertyOpen(true);setMobileProperties(true);}}>속성 보기</button></div>}
    <div ref={workspaceRef} className={`visual-preview-workspace ${editor && propertyOpen ? 'with-properties' : ''} ${mobileProperties ? 'mobile-properties' : ''} ${fit ? 'fit' : ''}`}>
      <div className={`visual-preview-comparison ${compare ? 'comparing' : ''}`}>
        <div className={`visual-preview-stage ${device} visual-preview-standard`} hidden={!compare}>
          <h4>본사 표준 화면</h4><p role="status">{status.standard}</p>
          {frames && <iframe ref={standardRef} key={frames.standard.nonce} title={`${screen} ${variant} 본사 표준 화면`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={frames.standard.html} />}
        </div>
        <div className={`visual-preview-stage ${device}`}>
          <h4>법인 작업본 화면</h4><p role="status">{status.company}</p>
          {frames && <iframe ref={companyRef} key={frames.company.nonce} title={`${screen} ${variant} 법인 작업본 화면`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={frames.company.html} />}
        </div>
      </div>
      {editor && <div className="visual-properties-container" hidden={!propertyOpen}><VisualPropertyPanel editor={editor} selected={selected} screen={screen} variant={variant} locale={locale} onSelect={selectFromList} /></div>}
    </div>
    {editor && <details className="visual-editor-tool"><summary>화면 요소 찾아 선택</summary><p>카탈로그의 부모 ID를 기준으로 묶습니다. 현재 화면·팝업에 실제 배치된 위치는 별도 확인이 필요합니다.</p><CatalogTree editor={editor} screen={screen} locale={locale} onSelect={selection=>{selectFromList(selection);setMobileProperties(true);setPropertyOpen(true);}} /></details>}
    {editor && screen === 'HQ_LEAD' && variant === 'list' && <details className="visual-editor-tool"><summary>목록 열 추가·순서</summary><LeadGridColumnPicker editor={editor} locale={locale} /></details>}
    {editor&&<details className="visual-editor-tool"><summary>구역과 필드 배치</summary><PlacementEditor editor={editor} screen={screen} variant={variant} tab={tab} locale={locale}/></details>}
    {editor&&<details className="visual-editor-tool"><summary>버튼·팝업 연결</summary><ActionInspector editor={editor} screen={screen} locale={locale} open={next=>{setVariant(next);setFixtureState('normal');}}/></details>}
  </section>;
}

function CatalogTree({editor,screen,locale,onSelect}:{editor:VisualEditor;screen:string;locale:string;onSelect:(selection:VisualSelection)=>void}) {
  const entries=editor.catalog.entries.filter(entry=>entry.id===screen||entry.screenId===screen);
  const ids=new Set(entries.map(entry=>entry.id));
  const render=(entry:typeof entries[number], ancestors:Set<string>):React.ReactNode=>{
    if(ancestors.has(entry.id))return null;
    const next=new Set([...ancestors,entry.id]);
    const children=entries.filter(child=>child.parentId===entry.id&&!next.has(child.id));
    const label=editor.config.translations[locale]?.[entry.labelKey] ?? editor.translations[locale]?.[entry.labelKey] ?? entry.id;
    const select=<button type="button" onClick={()=>onSelect({id:entry.id,instance:null,support:entry.support})}>{label} · {entry.kind} · {entry.support}</button>;
    return <li key={entry.id}>{select}{children.length>0&&<details><summary>하위 요소 {children.length}개</summary><ul>{children.map(child=>render(child,next))}</ul></details>}</li>;
  };
  const roots=entries.filter(entry=>!entry.parentId||!ids.has(entry.parentId));
  return <div className="visual-structure-tree"><ul>{roots.map(entry=>render(entry,new Set()))}</ul></div>;
}

function LeadGridColumnPicker({ editor, locale }: { editor: VisualEditor; locale: string }) {
  const [query, setQuery] = useState('');
  const current = editor.config.leadGridColumns ?? [];
  const entries = new Map(editor.catalog.entries.map(entry => [entry.id, entry]));
  const orphanWidths=Object.keys(editor.config.leadColumnWidths?.values??{}).filter(id=>!resolvedLeadColumnOrder(editor.config).includes(id)||entries.get(id)?.support!=='supported');
  const orphanAlignments=Object.keys(editor.config.leadColumnAlignments?.values??{}).filter(id=>!resolvedLeadColumnOrder(editor.config).includes(id)||entries.get(id)?.support!=='supported');
  const label = (id: string) => {
    const key = entries.get(id)?.labelKey;
    const baseLabels:Record<string,string>=locale.startsWith('ko')?{'lead.hospitalName':'병원명','lead.status':'상태','lead.ownerName':'담당자','lead.phone':'전화','lead.businessNo':'사업자번호','lead.sido':'시·도','lead.sigungu':'시·군·구','lead.updatedAt':'최근 수정'}:{'lead.hospitalName':'Hospital','lead.status':'Status','lead.ownerName':'Owner','lead.phone':'Phone','lead.businessNo':'Business number','lead.sido':'Province','lead.sigungu':'District','lead.updatedAt':'Updated'};
    return key ? editor.config.translations[locale]?.[key] ?? editor.translations[locale]?.[key] ?? editor.translations['ko-KR']?.[key] ?? baseLabels[id]??id : baseLabels[id]??id;
  };
  const reason = (id: string) => {
    const entry = entries.get(id);
    if (!entry || entry.kind !== 'FIELD' || entry.screenId !== 'HQ_LEAD' || entry.support !== 'supported') return '표준 필드 계약 없음';
    const effective = { ...entry.settings };
    for (const patch of editor.config.patches.filter(item => item.targetId === id && item.operation === 'set'))
      if (patch.property === 'enabled' || patch.property === 'visible' || patch.property === 'masking') (effective as unknown as Record<string, unknown>)[patch.property] = patch.value;
    if (!effective.enabled || !effective.visible || effective.masking === 'redact') return '법인 설정에서 조회할 수 없는 필드';
    return '';
  };
  const update = (columns: string[]) => editor.onChange({ ...editor.config, leadGridColumns: columns,leadListOrder:mergeLeadColumnOrder(resolvedLeadColumnOrder(editor.config),columns) });
  const filtered = leadGridCandidates.filter(candidate => `${label(candidate.fieldId)} ${candidate.fieldId} ${candidate.source} ${candidate.rowKey}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="lead-grid-picker" aria-label="리드 목록 열 추가">
    <h4>리드 목록 열 추가</h4>
    <p>관리형 사용자 목록의 기존 8열(시·구·최근 수정 포함)과 추가 열을 함께 배치합니다. 기존 열을 보존한 상태에서 순서를 변경합니다.</p>
    <fieldset disabled={editor.disabled}><legend>전체 열 위치</legend>{resolvedLeadColumnOrder(editor.config).map((id,index,order)=><div key={id} className="lead-grid-picker-item"><span>{index+1}. {label(id)}</span><span>{[-1,1].map(delta=><button key={delta} type="button" aria-label={`${label(id)} ${delta<0?'왼쪽':'오른쪽'}`} disabled={editor.disabled||index+delta<0||index+delta>=order.length} onClick={()=>{const next=[...order];[next[index],next[index+delta]]=[next[index+delta],next[index]];editor.onChange({...editor.config,leadListOrder:next});}}>{delta<0?'←':'→'}</button>)}</span></div>)}</fieldset>
    <p>등록·상세 화면에 이미 정의되고 목록 응답에서 조회 가능한 필드를 검색해 선택합니다. 추가한 열은 오른쪽 법인 작업본에만 표시됩니다.</p>
    <label>기존 필드 검색 <input value={query} onChange={event => setQuery(event.target.value)} placeholder="필드명, 설정 ID, 출처" /></label>
    <div className="lead-grid-picker-list">{filtered.map(candidate => {
      const used = current.includes(candidate.fieldId), blocked = reason(candidate.fieldId);
      return <div key={candidate.fieldId} className="lead-grid-picker-item">
        <span><strong>{label(candidate.fieldId)}</strong> <small>{candidate.fieldId} · {candidate.source} · {candidate.rowKey}</small></span>
        <span>{used ? '목록에 배치됨' : blocked || '추가 가능'}</span>
        <button type="button" disabled={editor.disabled || used || !!blocked} onClick={() => update([...current, candidate.fieldId])}>추가</button>
      </div>;
    })}{!filtered.length && <p>검색 결과가 없습니다.</p>}</div>
    {!!orphanWidths.length&&<div role="alert"><h5>목록에서 사용할 수 없는 열 너비</h5><p>기존 설정은 자동으로 삭제되지 않습니다. 상속 복원 후 저장해 주세요.</p>{orphanWidths.map(id=><div className="lead-grid-picker-item" key={id}><span>{id}</span><button type="button" disabled={editor.disabled||!editor.leadColumnWidthsSupported} onClick={()=>{const values={...editor.config.leadColumnWidths?.values};delete values[id];const next={...editor.config};if(Object.keys(values).length)next.leadColumnWidths={schemaVersion:1,values};else delete next.leadColumnWidths;editor.onChange(next);}}>너비 상속 복원</button></div>)}</div>}
    {!!orphanAlignments.length&&<div role="alert"><h5>목록에서 사용할 수 없는 열 글자 정렬</h5><p>기존 설정은 자동으로 삭제되지 않습니다. 상속 복원 후 저장해 주세요.</p>{orphanAlignments.map(id=><div className="lead-grid-picker-item" key={id}><span>{id}</span><button type="button" disabled={editor.disabled||!editor.leadColumnAlignmentsSupported} onClick={()=>{const values={...editor.config.leadColumnAlignments?.values};delete values[id];const next={...editor.config};if(Object.keys(values).length)next.leadColumnAlignments={schemaVersion:1,values};else delete next.leadColumnAlignments;editor.onChange(next);}}>글자 정렬 상속 복원</button></div>)}</div>}
    {!!current.length && <div><h5>추가한 열</h5><p>열 순서는 위의 전체 열 위치에서 변경합니다.</p>{current.map(id => <div key={id} className="lead-grid-picker-item"><span>{resolvedLeadColumnOrder(editor.config).indexOf(id) + 1}. {label(id)}</span><button type="button" disabled={editor.disabled} onClick={() => update(current.filter(item => item !== id))}>제거</button></div>)}</div>}
  </section>;
}

/** Fixture-only entry used by the browser isolation gate; it never loads administration data. */
export function VisualPreviewHarness() {
  const [config, setConfig] = useState<VisualEditor['config']>({ companyId: 'W04_SYNTHETIC', baseStandardReleaseId: baseline.catalog.standardReleaseId, patches: [], activeLocales: ['ko-KR', 'en-US'], defaultLocale: 'ko-KR', translations: {} });
  return <main className="visual-preview-harness"><h1>W03 fixture preview</h1><VisualPreviewPanel editor={{ catalog: baseline.catalog as VisualEditor['catalog'], translations: baseline.translations, config, onChange: setConfig }} /></main>;
}
