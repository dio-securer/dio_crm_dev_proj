import {ContractCollectionMethod} from './ContractCollectionMethod';
import {ContractFiles} from './ContractFiles';
import {contractOpportunityDefaults} from './contract-opportunity-defaults';
import {ContractPlanCards} from './ContractPlanCards';
import {ContractObservedFields} from './ContractObservedFields';
import {HqOpportunityNotes} from './HqOpportunityNotes';
import {HqOpportunityContactRoles} from './HqOpportunityContactRoles';
import {HqOpportunityContractProducts} from './HqOpportunityContractProducts';
import {HqOpportunityActivities} from './HqOpportunityActivities';
import {HqOpportunityQuotes} from './HqOpportunityQuotes';
import {HqOpportunityHistory} from './HqOpportunityHistory';
import {OpportunityInfoFields, emptyOpportunityInfo} from './OpportunityInfoFields';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, ChartNoAxesCombined, FileSignature, BadgeCheck, WalletCards, Database, CircleDollarSign, Plus } from 'lucide-react';
import { WorkspaceHeading } from './WorkspaceHeading';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../api';
import { useGlobalization } from '../market/globalization-context';
import { formatCurrency } from '../formatting/currency';
import { useHqMock } from './HqMockProvider';
import { configAnchor } from './config-anchor';
import { HqOpportunityProductPicker } from './HqOpportunityProductPicker';
import { HqOpportunityFollowUps } from './HqOpportunityFollowUps';
import { HqContractOrders } from './HqContractOrders';
import { HqCollectionPlanList } from './HqCollectionPlanList';
import { contractBalanceLabel, planDifference, receiptAmountLabel } from './contract-feedback';
import { HqModal } from './customer-shared';
import { HqOrdersPage } from './HqH06Pages';
import { HqGlobalSearch } from './HqGlobalSearch';
import { opportunityRequestKeys } from './opportunity-retry';
import { activateOpportunityNavigationGuard } from './opportunity-navigation-guard';
import './hq-sales.css';

type Row = Record<string, any> & { public_id: string };
type ProductLineDraft = { quantity:number; proposedUnitPrice:number; productAmount:number; goodsAmount:number; surchargeRate:number; discountRate:number; description:string };
const productLineDraft=(line:Row):ProductLineDraft=>({quantity:Number(line.quantity),proposedUnitPrice:Number(line.proposed_unit_price),productAmount:Number(line.product_amount??0),goodsAmount:Number(line.goods_amount??0),surchargeRate:Number(line.surcharge_rate??0),discountRate:Number(line.discount_rate??0),description:String(line.description??'')});
type PlanInput = { publicId?: string; installmentNo: number; collectionMethod: string; amount: number; plannedDate: string };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const newPlan = (amount = 0, number = 1): PlanInput => ({ installmentNo: number, collectionMethod: '', amount, plannedDate: today() });
const stages = ['NEEDS_ANALYSIS', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
const field = (value: unknown) => value == null || value === '' ? '—' : String(value);

function useSalesCommand() {
  const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [errorStatus, setErrorStatus] = useState(0);
  const run = async <T,>(job: () => Promise<T>, success: string) => {
    setBusy(true); setError(''); setNotice(''); setErrorStatus(0);
    try { const result = await job(); setNotice(success); await qc.invalidateQueries({ queryKey: ['hq-sales'] }); return result; }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setErrorStatus(reason instanceof ApiError ? reason.statusCode : 0); return undefined; }
    finally { setBusy(false); }
  };
  return { run, busy, error, notice, errorStatus, clear: () => { setError(''); setNotice(''); setErrorStatus(0); } };
}
function Feedback({ command }: { command: ReturnType<typeof useSalesCommand> }) {
  return <>{command.error && <p role="alert" className="hq-sales-error">{command.error}</p>}{command.notice && <p role="status" className="hq-sales-notice">{command.notice}</p>}</>;
}
function editable(perms: string[] | undefined, permission: string, row: Row | undefined, userId: number | undefined) {
  return Boolean(row && perms?.includes(permission) && (row.owner_user_id === userId || perms.includes('HQ.RESET')));
}

export function HqOpportunitiesPage() {
  const [noteDirty,setNoteDirty]=useState(false),[noteBusy,setNoteBusy]=useState(false);
  const [contactRoleDirty,setContactRoleDirty]=useState(false),[contactRoleBusy,setContactRoleBusy]=useState(false);
  const [activityDirty,setActivityDirty]=useState(false),[activityBusy,setActivityBusy]=useState(false),[quoteDirty,setQuoteDirty]=useState(false),[quoteBusy,setQuoteBusy]=useState(false),[contractProductDirty,setContractProductDirty]=useState(false),[contractProductBusy,setContractProductBusy]=useState(false);
  const { session } = useHqMock(), perms = session?.user.permissions, baseCommand = useSalesCommand(); const command={...baseCommand,busy:baseCommand.busy||activityBusy||quoteBusy||contractProductBusy||contactRoleBusy||noteBusy}; const { globalization } = useGlobalization();
  const opportunities = useQuery({ queryKey: ['hq-sales', 'opportunities', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/opportunities'), retry: false });
  const accounts = useQuery({ queryKey: ['hq-sales', 'accounts', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/accounts'), retry: false });
  const catalog = useQuery({ queryKey: ['hq-sales', 'catalog', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/product-packages'), retry: false });
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('record') ?? '';
  const setSelectedId = (id: string) => setSearchParams(previous => { const next = new URLSearchParams(previous); if (id) next.set('record', id); else next.delete('record'); next.delete('followUp'); return next; });
  const [registering, setRegistering] = useState(false);
  const [search, setSearch] = useState(''); const [stageFilter, setStageFilter] = useState(''); const [accountFilter, setAccountFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState(''); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState('');
  const [sort, setSort] = useState('date-asc'); const [page, setPage] = useState(1);
  const [create, setCreate] = useState({ accountPublicId: '', opportunityName: '', recordType: 'EXISTING', expectedCloseDate: today(), ...emptyOpportunityInfo });
  const createBaseline = useRef(create);
  const [edit, setEdit] = useState({ opportunityName: '', recordType: 'NEW', expectedCloseDate: '', successProbability: 0, forecastCategory: 'PIPELINE', priceListCode: 'ERP_STANDARD', ...emptyOpportunityInfo });
  const [targetStage, setTargetStage] = useState(''); const [reason, setReason] = useState('');
  const [product, setProduct] = useState({ packagePublicId: '', quantity: 1, proposedUnitPrice: 0 });
  const [productTouched, setProductTouched] = useState(false);
  const [followUpDirty, setFollowUpDirty] = useState(false);
  const [lineEdit, setLineEdit] = useState<Record<string, ProductLineDraft>>({});
  const [productPicker, setProductPicker] = useState(false);
  const [salesDialog, setSalesDialog] = useState<'price' | 'close' | null>(null);
  const [priceChoice, setPriceChoice] = useState('ERP_STANDARD');
  const [previewStage, setPreviewStage] = useState('NEEDS_ANALYSIS');
  const [editEpoch, setEditEpoch] = useState(0); const baseVersion = useRef<number | undefined>(undefined); const editBaseline = useRef(''); const retryKeys = useRef(opportunityRequestKeys()); const mutationPending = useRef(false);
  const current = selectedId ? opportunities.data?.find(row => row.public_id === selectedId) : undefined;
  const money = (value: number) => formatCurrency(Number(value || 0), globalization.locale, current?.currency || 'KRW');
  const related = useQuery({ queryKey: ['hq-sales', 'opportunity-related', current?.public_id, session?.user.userId], queryFn: () => apiGet<{activities:Row[]; reports:Row[]; contracts:Row[]}>(`/api/opportunities/${current!.public_id}/related`), enabled: Boolean(current?.public_id), retry: false });
  useEffect(() => { if (!current) return; baseVersion.current = typeof current.version === 'number' ? current.version : undefined; const next = { opportunityName: String(current.opportunity_name ?? ''), recordType: String(current.record_type ?? 'NEW'), expectedCloseDate: String(current.expected_close_date ?? ''), successProbability: Number(current.success_probability ?? 0), forecastCategory: String(current.forecast_category ?? 'PIPELINE'), priceListCode: String(current.price_list_code ?? 'ERP_STANDARD'), stockStatus: String(current.stock_status ?? ''), paymentStatus: String(current.payment_status ?? ''), description: String(current.description ?? ''), paymentDate: String(current.payment_date ?? ''), interestProduct: String(current.interest_product ?? ''), specialTerms: String(current.special_terms ?? ''), paymentMethod: String(current.payment_method ?? ''), competitorUsage: String(current.competitor_usage ?? ''), ownedEquipment: String(current.owned_equipment ?? ''), treatmentFeeInfo: String(current.treatment_fee_info ?? ''), installmentMonths: Number(current.installment_months ?? 0) }; editBaseline.current = JSON.stringify(next); setEdit(next); setTargetStage(String(current.stage)); }, [current?.public_id, editEpoch]);
  const mutate = async <T,>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: Record<string, unknown>, message: string, creating = false) => {
    if (mutationPending.current) return undefined;
    mutationPending.current = true;
    try {
    const version = creating ? undefined : baseVersion.current;
    const key = retryKeys.current.get(method, path, body, version);
    const payload = { ...body, ...(version === undefined ? {} : { expectedVersion: version }), idempotencyKey: key };
    const result = await command.run(() => method === 'POST' ? apiPost<T>(path, payload) : method === 'PATCH' ? apiPatch<T>(path, payload) : apiDelete<T>(path, payload), message);
    if (result !== undefined) { retryKeys.current.done(method, path, body, version); if (!creating) { const refreshed = await opportunities.refetch(); const row = refreshed.data?.find(item => item.public_id === selectedId); if (typeof row?.version === 'number') baseVersion.current = row.version; if (method === 'PATCH' && path === `/api/opportunities/${selectedId}` && Object.keys(body).length > 1) editBaseline.current = JSON.stringify(body); } }
    return result;
    } finally { mutationPending.current = false; }
  };
  const reloadLatest = async () => { if (!window.confirm('저장하지 않은 입력을 버리고 최신 정보를 불러오시겠습니까?')) return; const result = await opportunities.refetch(); if (!result.error) { setEditEpoch(value => value + 1); setLineEdit({}); setReason(''); setSalesDialog(null); setProductPicker(false); command.clear(); } };
  const hasDraft = registering ? JSON.stringify(create) !== JSON.stringify(createBaseline.current) : Boolean(current && (editBaseline.current && JSON.stringify(edit) !== editBaseline.current || Object.keys(lineEdit).length || reason || productTouched || followUpDirty || activityDirty || activityBusy || quoteDirty || quoteBusy || contractProductDirty || contractProductBusy || contactRoleDirty || contactRoleBusy || noteDirty || noteBusy || targetStage !== current.stage));
  useEffect(() => {
    const parentClean = editBaseline.current === JSON.stringify(edit) && !Object.keys(lineEdit).length && !reason && !productTouched && targetStage === current?.stage;
    if (current && parentClean && !command.busy && typeof current.version === 'number') baseVersion.current = current.version;
  }, [current?.version, command.busy, edit, lineEdit, reason, productTouched, targetStage]);
  const leaveDetail = () => { if(command.busy)return; if (hasDraft && !window.confirm('저장하지 않은 입력을 버리시겠습니까?')) return; setLineEdit({}); setReason(''); setProductTouched(false); setSelectedId(''); };
  useLayoutEffect(() => {
    if (!hasDraft && !command.busy) return;
    const deactivateNavigationGuard = activateOpportunityNavigationGuard(() => !command.busy && window.confirm('저장하지 않은 입력을 버리고 이동하시겠습니까?'));
    const onUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const onClick = (event: MouseEvent) => { const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null; if (!anchor || anchor.origin !== window.location.origin || anchor.href === window.location.href) return; if (command.busy || !window.confirm('저장하지 않은 입력을 버리고 이동하시겠습니까?')) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener('beforeunload', onUnload); document.addEventListener('click', onClick, true);
    return () => { deactivateNavigationGuard(); window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onClick, true); };
  }, [hasDraft,command.busy]);
  useEffect(() => { const first = catalog.data?.[0]; if (first && !product.packagePublicId) setProduct({ packagePublicId: first.public_id, quantity: 1, proposedUnitPrice: Number(first.base_price ?? 0) }); }, [catalog.data]);
  const canEdit = editable(perms, 'OPPORTUNITY.WRITE', current, session?.user.userId);
  const canProduct = editable(perms, 'OPPORTUNITY.PRODUCT.WRITE', current, session?.user.userId) && !String(current?.stage).startsWith('CLOSED_');
  const canStage = editable(perms, 'OPPORTUNITY.STAGE', current, session?.user.userId);
  const stagesAllowed = stages.filter(stage => stage !== current?.stage);
  const stageNames: Record<string, string> = { NEEDS_ANALYSIS: '니즈파악', PROPOSAL: '제안', NEGOTIATION: '협상', CLOSED_WON: '수주 성공', CLOSED_LOST: '수주 실패' };
  const rows = (opportunities.data ?? []).filter(row => {
    const text = `${row.opportunity_name ?? ''} ${row.account_name ?? ''}`.toLocaleLowerCase(); const date = String(row.expected_close_date ?? '').slice(0, 10);
    return text.includes(search.trim().toLocaleLowerCase()) && (!stageFilter || row.stage === stageFilter) && (!accountFilter || row.account_public_id === accountFilter) && (!ownerFilter || String(row.owner_user_id) === ownerFilter) && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  }).sort((a, b) => sort === 'name' ? String(a.opportunity_name).localeCompare(String(b.opportunity_name)) : (sort === 'date-desc' ? -1 : 1) * String(a.expected_close_date ?? '').localeCompare(String(b.expected_close_date ?? '')));
  const pages = Math.max(1, Math.ceil(rows.length / 10)); const currentPage = Math.min(page, pages);
  const resetPage = () => setPage(1);
  return <main className="hq-sales-page hq-opportunity-page">
    <header><WorkspaceHeading icon={BriefcaseBusiness}>영업기회</WorkspaceHeading><p>거래처 승인, 제품 금액, 단계와 예상 실적을 같은 기회에서 관리합니다.</p></header>
    <Feedback command={command} />
    {command.errorStatus === 409 && <div role="alert">다른 변경과 충돌했거나 요청이 중복되었습니다. 입력은 유지됩니다. <button type="button" onClick={() => void reloadLatest()}>최신 정보 다시 불러오기</button></div>}
    {current && salesDialog === 'price' && <HqModal title="가격 목록 선택" busy={command.busy} onClose={() => setSalesDialog(null)}>
      <p>현재 가격 목록: {current.price_list_code === 'CUSTOM_QUOTE' ? '별도 제안가격' : 'ERP 표준가격'}</p>
      <label>적용할 가격 목록<select value={priceChoice} onChange={e => setPriceChoice(e.target.value)}><option value="ERP_STANDARD">ERP 표준가격</option><option value="CUSTOM_QUOTE">별도 제안가격</option></select></label>
      <p>ERP 표준가격으로 변경하면 기존 제품의 단가를 현재 기준가로 다시 계산합니다. 별도 제안가격은 기존 단가를 유지합니다.</p>
      <Feedback command={command} />{command.errorStatus === 409 && <button type="button" onClick={() => void reloadLatest()}>최신 정보 다시 불러오기</button>}<button disabled={command.busy || !canProduct} onClick={async () => { const saved = await mutate('PATCH', `/api/opportunities/${current.public_id}`, { priceListCode: priceChoice }, '가격 목록을 저장했습니다.'); if (saved) { setEdit(previous => ({ ...previous, priceListCode: priceChoice })); if (editBaseline.current) editBaseline.current = JSON.stringify({ ...JSON.parse(editBaseline.current), priceListCode: priceChoice }); setSalesDialog(null); } }}>가격 목록 저장</button><button disabled={command.busy} onClick={() => setSalesDialog(null)}>취소</button>
    </HqModal>}
    {current && salesDialog === 'close' && <HqModal title="마감된 단계 선택" busy={command.busy} onClose={() => setSalesDialog(null)}>
      <label>마감 단계<select value={targetStage} onChange={e => setTargetStage(e.target.value)}><option value="CLOSED_WON">수주 성공</option><option value="CLOSED_LOST">수주 실패</option></select></label>
      <label>마감 사유<input value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
      {targetStage === 'CLOSED_WON' && (!current.erp_approved_yn || Number(current.amount) <= 0) && <p role="alert">ERP 거래처 승인과 0원보다 큰 제안 제품 금액이 필요합니다.</p>}
      <Feedback command={command} />{command.errorStatus === 409 && <button type="button" onClick={() => void reloadLatest()}>최신 정보 다시 불러오기</button>}<button disabled={command.busy || !canStage || targetStage === current.stage || (targetStage === 'CLOSED_WON' && (!current.erp_approved_yn || !current.products?.length || Number(current.amount) <= 0))} onClick={async () => { const saved = await mutate('POST', `/api/opportunities/${current.public_id}/stage`, { toStage: targetStage, reason: reason || undefined }, '기회를 마감했습니다.'); if (saved) { setReason(''); setSalesDialog(null); } }}>마감 저장</button><button disabled={command.busy} onClick={() => setSalesDialog(null)}>취소</button>
    </HqModal>}
    {(opportunities.error || accounts.error || catalog.error) && <p role="alert" className="hq-sales-error">{String(opportunities.error ?? accounts.error ?? catalog.error)}</p>}
    {!registering && !selectedId && perms?.includes('OPPORTUNITY.WRITE') && <button type="button" className="opp-create-action" onClick={() => setRegistering(true)}><Plus size={18} className="opp-create-icon" aria-hidden="true"/>기회 등록</button>}
    {registering && perms?.includes('OPPORTUNITY.WRITE') && <form className="hq-sales-card hq-sales-fields" onSubmit={async e => { e.preventDefault(); const row = await mutate<Row>('POST', '/api/opportunities', create, '기회를 생성했습니다.', true); if (row) { setSelectedId(row.public_id); setRegistering(false); setCreate(createBaseline.current); } }}>
      <h2>기회 생성</h2><label><span>거래처 <span className="opp-required" aria-hidden="true">필수</span></span><select required value={create.accountPublicId} onChange={e => setCreate({ ...create, accountPublicId: e.target.value })}><option value="">선택</option>{accounts.data?.map(row => <option key={row.public_id} value={row.public_id}>{row.account_name}</option>)}</select></label>
      <label><span>기회명 <span className="opp-required" aria-hidden="true">필수</span></span><input required maxLength={200} value={create.opportunityName} onChange={e => setCreate({ ...create, opportunityName: e.target.value })} /></label>
      <label>유형<select value={create.recordType} onChange={e => setCreate({ ...create, recordType: e.target.value })}><option value="NEW">신규</option><option value="EXISTING">기존</option><option value="RECONTRACT">재계약</option></select></label>
      <label><span>예상 마감일 <span className="opp-required" aria-hidden="true">필수</span></span><input type="date" required value={create.expectedCloseDate} onChange={e => setCreate({ ...create, expectedCloseDate: e.target.value })} /></label><OpportunityInfoFields scope="create" recordType={create.recordType} value={create} onChange={info=>setCreate({...create,...info})} disabled={command.busy}/><button disabled={command.busy}>생성</button><button type="button" disabled={command.busy} onClick={() => { if (JSON.stringify(create) !== JSON.stringify(createBaseline.current) && !window.confirm('저장하지 않은 기회 입력을 버리시겠습니까?')) return; setCreate(createBaseline.current); setRegistering(false); }}>목록으로</button>
    </form>}
    <div className="hq-opportunity-content">{!registering && !selectedId && <section className="hq-sales-card"><h2>기회 목록</h2><div className="hq-sales-fields">
      <label>기회 검색<input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} /></label>
      <label>단계<select value={stageFilter} onChange={e => { setStageFilter(e.target.value); resetPage(); }}><option value="">전체</option>{stages.map(stage => <option key={stage} value={stage}>{stageNames[stage]}</option>)}</select></label>
      <label>거래처<select value={accountFilter} onChange={e => { setAccountFilter(e.target.value); resetPage(); }}><option value="">전체</option>{(accounts.data ?? []).map(row => <option key={row.public_id} value={row.public_id}>{row.account_name}</option>)}</select></label>
      <label>담당자<select value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); resetPage(); }}><option value="">전체</option>{Array.from(new Set((opportunities.data ?? []).map(row => String(row.owner_user_id)))).map(owner => <option key={owner} value={owner}>{owner}</option>)}</select></label>
      <label>마감 시작일<input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); resetPage(); }} /></label><label>마감 종료일<input type="date" value={toDate} onChange={e => { setToDate(e.target.value); resetPage(); }} /></label>
      <label>정렬<select value={sort} onChange={e => { setSort(e.target.value); resetPage(); }}><option value="date-asc">마감 빠른 순</option><option value="date-desc">마감 늦은 순</option><option value="name">이름 순</option></select></label></div>
      {opportunities.isPending && <p role="status">불러오는 중...</p>}{opportunities.isError && <div role="alert">목록을 불러오지 못했습니다. <button type="button" onClick={() => void opportunities.refetch()}>다시 시도</button></div>}{!opportunities.isPending && !opportunities.isError && rows.length === 0 && <p>기회가 없습니다.</p>}
      {!opportunities.isError && rows.slice((currentPage - 1) * 10, currentPage * 10).map(row => <button type="button" className="hq-sales-row" key={row.public_id} onClick={() => setSelectedId(row.public_id)}><strong {...configAnchor('opportunity.name', `list.name.${row.public_id}`)}>{row.opportunity_name}</strong><span>{row.account_name} · <span {...configAnchor('opportunity.stage', `list.stage.${row.public_id}`)}>{stageNames[row.stage] ?? row.stage}</span></span><span>{formatCurrency(Number(row.amount || 0), globalization.locale, row.currency || 'KRW')} {row.currency || 'KRW'} · {field(row.expected_close_date)} · 담당자 {row.owner_user_id}</span><span>다음 조치: {row.next_follow_up ? `${row.next_follow_up.title} · ${row.next_follow_up.due_date}` : '없음'}</span></button>)}
      {pages > 1 && <nav aria-label="기회 목록 페이지"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button> {currentPage} / {pages} <button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></nav>}
    </section>}{!registering && selectedId && <section className="hq-sales-card" {...configAnchor('section:opportunity.basic', 'detail.basic')}><div className="tablet-detail-heading"><button type="button" disabled={command.busy} onClick={leaveDetail}>목록으로</button><h2>기회 상세</h2></div>{current ? <>
      {canEdit && <button type="button" {...configAnchor('OPP.delete','detail.delete')} disabled={command.busy} onClick={async()=>{if(!window.confirm(`“${current.opportunity_name}” 기회를 삭제하시겠습니까? 저장하지 않은 입력은 사라집니다. 계약·활동·견적 등 연결된 기록이 있으면 삭제가 차단됩니다.`))return; const deleted=await mutate('DELETE',`/api/opportunities/${current.public_id}`,{},'기회를 삭제했습니다.');if(deleted){setSelectedId('');setLineEdit({});setReason('');setProductTouched(false);}}}>기회 삭제</button>}
      <section aria-label="기회 단계 안내"><p>저장된 단계: {stageNames[current.stage] ?? current.stage}</p><div role="tablist" aria-label="기회 단계 미리보기">{['NEEDS_ANALYSIS','PROPOSAL','NEGOTIATION'].map(stage => <button type="button" role="tab" aria-selected={previewStage === stage} key={stage} onClick={() => setPreviewStage(stage)}>{stageNames[stage]}</button>)}</div><p>{previewStage === 'NEEDS_ANALYSIS' ? '관심 제품, 타사 사용현황, 보유장비, 수가정보를 확인하세요.' : previewStage === 'PROPOSAL' ? '제안 제품, 제안 금액, 특약을 확인하세요.' : '결제 방법, 할부 개월수, 특약을 확인하세요.'} 단계 선택은 저장된 상태를 변경하지 않습니다.</p></section>
      <dl className="hq-sales-summary"><div><dt><BadgeCheck size={16} aria-hidden="true" />거래처 ERP 승인</dt><dd>{current.erp_approved_yn ? '승인' : '미승인 · 수주 차단'}</dd></div><div><dt><WalletCards size={16} aria-hidden="true" />제안 총액</dt><dd>{money(current.amount)}</dd></div><div><dt><FileSignature size={16} aria-hidden="true" />계약 생성</dt><dd>{current.contract_created_yn ? '완료' : '대기'}</dd></div><div><dt><Database size={16} aria-hidden="true" />ERP 거래처번호</dt><dd>{field(current.erp_customer_code)}</dd></div></dl>
      <form onSubmit={e => { e.preventDefault(); void mutate('PATCH', `/api/opportunities/${current.public_id}`, edit, '기회 정보를 저장했습니다.'); }}><fieldset className="hq-sales-fields hq-opportunity-edit" disabled={command.busy}>
        <label {...configAnchor('opportunity.name', 'detail.name')}><span>기회명 <span className="opp-required" aria-hidden="true">필수</span></span><input disabled={!canEdit} required maxLength={200} value={edit.opportunityName} onChange={e => setEdit({ ...edit, opportunityName: e.target.value })} /></label>
        <label {...configAnchor('opportunity.recordType','detail.recordType')}>기회 유형<select disabled={!canEdit} value={edit.recordType} onChange={e=>setEdit({...edit,recordType:e.target.value})}><option value="NEW">신규</option>{edit.recordType==='EXISTING'&&<option value="EXISTING">기존</option>}<option value="RECONTRACT">재계약</option></select></label>
        <label {...configAnchor('opportunity.expectedCloseDate', 'detail.expectedCloseDate')}>예상 마감일<input disabled={!canEdit} type="date" value={edit.expectedCloseDate} onChange={e => setEdit({ ...edit, expectedCloseDate: e.target.value })} /></label>
        <label {...configAnchor('opportunity.successProbability', 'detail.successProbability')}>성공 확률 (%)<input disabled={!canEdit} type="number" min={0} max={100} value={edit.successProbability} onChange={e => setEdit({ ...edit, successProbability: Number(e.target.value) })} /></label>
        <label {...configAnchor('opportunity.forecastCategory', 'detail.forecastCategory')}>예상 범주<select disabled={!canEdit} value={edit.forecastCategory} onChange={e => setEdit({ ...edit, forecastCategory: e.target.value })}>{['PIPELINE', 'BEST_CASE', 'COMMIT', 'OMITTED'].map(x => <option key={x}>{x}</option>)}</select></label>
        <label {...configAnchor('opportunity.priceListCode', 'detail.priceListCode')}>가격 목록<select disabled={!canEdit || String(current.stage).startsWith('CLOSED_')} value={edit.priceListCode} onChange={e => setEdit({ ...edit, priceListCode: e.target.value })}><option value="ERP_STANDARD">ERP 표준가격</option><option value="CUSTOM_QUOTE">별도 제안가격</option></select></label>
        <OpportunityInfoFields scope="detail" recordType={edit.recordType} value={edit} onChange={info=>setEdit({...edit,...info})} disabled={command.busy||!canEdit}/>
        {canEdit && <button {...configAnchor('OPP.saveNegotiation', 'detail.save')} disabled={command.busy}>정보 저장</button>}
      </fieldset></form>
      <p>가격 목록을 ERP 표준가격으로 바꾸면 기존 제품의 제안 단가를 현재 ERP 기준가로 다시 계산합니다. 별도 제안가격으로 바꿀 때는 기존 단가를 유지합니다.</p>
      {canProduct && <button disabled={command.busy} onClick={() => { command.clear(); setPriceChoice(String(current.price_list_code ?? 'ERP_STANDARD')); setSalesDialog('price'); }}>가격 목록 선택</button>}
      {canStage && !String(current.stage).startsWith('CLOSED_') && <button disabled={command.busy} onClick={() => { command.clear(); setTargetStage('CLOSED_WON'); setSalesDialog('close'); }}>마감된 단계 선택</button>}
      <div className="hq-sales-stage"><h3>단계 변경</h3><div className="hq-sales-fields"><label {...configAnchor('opportunity.targetStage', 'detail.targetStage')}>목표 단계<select disabled={!canStage} value={targetStage} onChange={e => setTargetStage(e.target.value)}>{stagesAllowed.map(stage => <option key={stage}>{stage}</option>)}{current.stage && <option value={current.stage}>{current.stage}</option>}</select></label><label {...configAnchor('opportunity.reason', 'detail.stageReason')}>변경 사유<input disabled={!canStage} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label></div>
        {canStage && <button {...configAnchor('OPP.stage', 'detail.stage.save')} type="button" disabled={command.busy || !targetStage || targetStage === current.stage || (targetStage === 'CLOSED_WON' && (!current.erp_approved_yn || !current.products?.length || Number(current.amount) <= 0))} onClick={async () => { const saved = await mutate('POST', `/api/opportunities/${current.public_id}/stage`, { toStage: targetStage, reason: reason || undefined }, '단계를 변경했습니다.'); if (saved) setReason(''); }}>단계 저장</button>}
        {targetStage === 'CLOSED_WON' && !current.erp_approved_yn && <p>ERP 거래처 승인이 완료되어야 수주할 수 있습니다. 입력과 제품은 유지됩니다.</p>}
        {targetStage === 'CLOSED_WON' && Number(current.amount) <= 0 && <p>제안 총액이 0원입니다. 제품 수량과 제안 단가를 확인하세요.</p>}
      </div>
      <HqOpportunityHistory history={current.history ?? []} />
      <HqOpportunityNotes key={`notes-${current.public_id}`} opportunityId={current.public_id} canEdit={canEdit} blocked={baseCommand.busy||activityBusy||quoteBusy||contractProductBusy||contactRoleBusy} onDirtyChange={setNoteDirty} onBusyChange={setNoteBusy}/>
      <HqOpportunityContactRoles key={`contact-${current.public_id}`} opportunityId={current.public_id} canEdit={canEdit&&!noteBusy&&!baseCommand.busy&&!activityBusy&&!quoteBusy&&!contractProductBusy} onDirtyChange={setContactRoleDirty} onBusyChange={setContactRoleBusy}/>
      <HqOpportunityActivities key={`activity-${current.public_id}`} opportunityId={current.public_id} canEdit={canEdit&&!noteBusy&&!contactRoleBusy&&!baseCommand.busy&&!quoteBusy&&!contractProductBusy} onDirtyChange={setActivityDirty} onBusyChange={setActivityBusy}/>
      <HqOpportunityQuotes key={`quote-${current.public_id}`} opportunityId={current.public_id} opportunityVersion={current.version} canEdit={canEdit&&!noteBusy&&!contactRoleBusy&&!baseCommand.busy&&!activityBusy&&!contractProductBusy} onDirtyChange={setQuoteDirty} onBusyChange={setQuoteBusy}/>
      <HqOpportunityContractProducts key={`cp-${current.public_id}`} opportunityId={current.public_id} canEdit={canEdit&&!noteBusy&&!contactRoleBusy&&!baseCommand.busy&&!activityBusy&&!quoteBusy} onDirtyChange={setContractProductDirty} onBusyChange={setContractProductBusy}/>
      <HqOpportunityFollowUps key={current.public_id} opportunityId={current.public_id} canEdit={canEdit} onDirtyChange={setFollowUpDirty} />
      <section><h3>관련 활동·보고·계약</h3>{related.isPending && <p>불러오는 중...</p>}{related.isError && <p role="alert">관련 정보를 불러오지 못했습니다. <button type="button" onClick={() => void related.refetch()}>다시 시도</button></p>}{related.data && <><h4>활동</h4>{(related.data.activities ?? []).map(row => <p key={row.public_id}><a href={`/activities?record=${encodeURIComponent(row.public_id)}`}>{row.related_name_snapshot} · {field(row.planned_at)} · {row.status}</a></p>)}<h4>보고</h4>{(related.data.reports ?? []).map(row => <p key={row.public_id}><a href={`/activity-reports?record=${encodeURIComponent(row.public_id)}`}>{row.report_date} · {row.status}</a></p>)}<h4>계약 (MOCK)</h4>{(related.data.contracts ?? []).map(row => <p key={row.public_id}><a href={`/contracts?record=${encodeURIComponent(row.public_id)}`}>{row.contract_name} · {row.status} · MOCK</a></p>)}</>}</section>
    </> : <p>{opportunities.isPending ? '불러오는 중...' : '기회를 찾을 수 없습니다.'}</p>}</section>}</div>
    {!registering && current && <section className="hq-sales-card"><h2>제안 제품</h2><p>제품 단가를 참고해 제안 단가와 수량을 입력합니다. 합계는 저장 즉시 계산됩니다.</p>
      {canProduct && <button disabled={command.busy || !catalog.data} onClick={() => { command.clear(); setProductPicker(true); }}>제품 검색·복수 선택</button>}
      {productPicker && canProduct && <HqOpportunityProductPicker key={current.public_id} catalog={catalog.data ?? []} busy={command.busy} error={command.error} money={money} onClose={() => setProductPicker(false)} onReload={command.errorStatus === 409 ? () => void reloadLatest() : undefined}
        onSave={async items => { const saved = await mutate('POST', `/api/opportunities/${current.public_id}/products/batch`, { items }, '선택한 제품을 추가했습니다.'); if (saved) setProductPicker(false); }} />}
      <div className="hq-sales-products">{(current.products ?? []).map((line: Row, lineIndex: number) => { const draft = lineEdit[line.public_id] ?? productLineDraft(line); const clearLine = () => setLineEdit(previous => { const next = { ...previous }; delete next[line.public_id]; return next; }); return <div key={line.public_id} className="hq-sales-product"><strong>{line.item_name}</strong>{canProduct && <span>{[-1,1].map(delta=><button key={delta} type="button" aria-label={`${line.item_name} ${delta<0?'위로':'아래로'}`} disabled={command.busy||lineIndex+delta<0||lineIndex+delta>=current.products.length} onClick={async()=>{const ids=current.products.map((p:Row)=>p.public_id);[ids[lineIndex],ids[lineIndex+delta]]=[ids[lineIndex+delta],ids[lineIndex]];await mutate('POST',`/api/opportunities/${current.public_id}/products/reorder`,{productPublicIds:ids},'제품 순서를 저장했습니다.');}}>{delta<0?'↑':'↓'}</button>)}</span>}<label>수량<input disabled={!canProduct || command.busy} type="number" min={1} max={9999} value={draft.quantity} onChange={e => setLineEdit({ ...lineEdit, [line.public_id]: { ...draft, quantity: Number(e.target.value) } })} /></label><label>제안 단가<input disabled={!canProduct || command.busy} type="number" min={0} value={draft.proposedUnitPrice} onChange={e => setLineEdit({ ...lineEdit, [line.public_id]: { ...draft, proposedUnitPrice: Number(e.target.value) } })} /></label><details className="hq-sales-line-extra"><summary>제품 추가 속성</summary><div className="hq-sales-fields">{([['productAmount','제품금액'],['goodsAmount','상품금액'],['surchargeRate','할증율 (%)'],['discountRate','할인율 (%)']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="any" disabled={!canProduct||command.busy} value={draft[key]} onChange={e=>setLineEdit({...lineEdit,[line.public_id]:{...draft,[key]:Number(e.target.value)}})}/></label>)}<label>제품 설명<textarea disabled={!canProduct||command.busy} maxLength={4000} value={draft.description} onChange={e=>setLineEdit({...lineEdit,[line.public_id]:{...draft,description:e.target.value}})}/></label></div><p>별도 기재 속성입니다. 합계는 수량 × 제안 단가로 계산됩니다.</p></details><span>{money(draft.quantity * draft.proposedUnitPrice)}</span>{canProduct && <><button disabled={command.busy} onClick={async () => { if (await mutate('PATCH', `/api/opportunities/${current.public_id}/products/${line.public_id}`, draft, '제품을 수정했습니다.')) clearLine(); }}>수정</button><button disabled={command.busy} onClick={async () => { if (await mutate('DELETE', `/api/opportunities/${current.public_id}/products/${line.public_id}`, {}, '제품을 삭제했습니다.')) clearLine(); }}>삭제</button></>}</div>; })}</div>
      {canProduct && <form className="hq-sales-fields" onSubmit={async e => { e.preventDefault(); if (await mutate('POST', `/api/opportunities/${current.public_id}/products`, product, '제품을 추가했습니다.')) setProductTouched(false); }}><label>제품<select disabled={command.busy} value={product.packagePublicId} onChange={e => { const row = catalog.data?.find(x => x.public_id === e.target.value); setProductTouched(true); setProduct({ ...product, packagePublicId: e.target.value, proposedUnitPrice: Number(row?.base_price ?? 0) }); }}><option value="">선택</option>{catalog.data?.map(row => <option key={row.public_id} value={row.public_id}>{row.item_name} · {money(row.base_price)}</option>)}</select></label><label>수량<input disabled={command.busy} type="number" min={1} max={9999} value={product.quantity} onChange={e => { setProductTouched(true); setProduct({ ...product, quantity: Number(e.target.value) }); }} /></label><label>제안 단가<input disabled={command.busy} type="number" min={0} value={product.proposedUnitPrice} onChange={e => { setProductTouched(true); setProduct({ ...product, proposedUnitPrice: Number(e.target.value) }); }} /></label><button disabled={command.busy || !product.packagePublicId}>제품 추가</button></form>}
    </section>}
  </main>;
}

export function HqPipelineView() {
  const { session } = useHqMock(); const { globalization } = useGlobalization();
  const pipeline = useQuery({ queryKey: ['hq-sales', 'pipeline', session?.user.userId], queryFn: () => apiGet<{ byStage: Row[]; forecast: Row[]; overdueFollowUpCount:number; mockToday:string }>('/api/opportunities/pipeline/funnel'), retry: false });
  const data = pipeline.isError ? undefined : pipeline.data;
  const stageLabels:Record<string,string>={NEEDS_ANALYSIS:'니즈파악',PROPOSAL:'제안',NEGOTIATION:'협상',CLOSED_WON:'수주 성공',CLOSED_LOST:'수주 실패'};
  const forecastLabels:Record<string,string>={PIPELINE:'진행 중',BEST_CASE:'최선 예상',COMMIT:'확정 예상',OMITTED:'제외'};
  return <main className="hq-sales-page hq-pipeline-page"><header><WorkspaceHeading icon={ChartNoAxesCombined}>Pipeline / Funnel</WorkspaceHeading><p>현재 조회 권한 범위의 기회를 단계와 예상 범주별로 집계합니다.</p></header>
    {pipeline.error && <div role="alert" className="hq-sales-error"><p>{pipeline.error instanceof ApiError && pipeline.error.statusCode === 403 ? '파이프라인 조회 권한이 없습니다.' : '파이프라인 정보를 불러오지 못했습니다.'}</p><button type="button" disabled={pipeline.isFetching} onClick={() => void pipeline.refetch()}>파이프라인 다시 조회</button></div>}
    {pipeline.isPending && <p role="status">파이프라인을 불러오는 중입니다.</p>}
    {data && <section className="hq-sales-card"><h2>후속조치 기한 초과 (MOCK)</h2><p>{data.overdueFollowUpCount}건 · 목업 기준일 {data.mockToday} 전 기한의 진행 예정 건</p></section>}
    {data && <section className="hq-sales-stats">{data.byStage.map(row => <article className="hq-sales-card" key={`${row.stage}-${row.currency}`}><h2><span className="pipeline-desktop-label">{row.stage}</span><span className="pipeline-mobile-label">{stageLabels[row.stage] ?? row.stage}</span> · {row.currency}</h2><strong>{row.opportunity_count}건</strong><p>{formatCurrency(Number(row.amount || 0), globalization.locale, row.currency || 'KRW')}</p></article>)}{!data.byStage.length && <p className="hq-sales-card">조회 가능한 단계별 기회가 없습니다.</p>}</section>}
    {data && <section className="hq-sales-card"><h2>예상 범주</h2>{data.forecast.map(row => <div className="hq-sales-row" key={`${row.forecast_category}-${row.currency}`}><strong><span className="pipeline-desktop-label">{row.forecast_category}</span><span className="pipeline-mobile-label">{forecastLabels[row.forecast_category] ?? row.forecast_category}</span> · {row.currency}</strong><span>{row.opportunity_count}건</span><span>{formatCurrency(Number(row.amount || 0), globalization.locale, row.currency || 'KRW')}</span></div>)}{!data.forecast.length && <p>조회 가능한 예상 범주가 없습니다.</p>}</section>}
  </main>;
}

export function HqContractsPage() {
  const { session } = useHqMock(), perms = session?.user.permissions, command = useSalesCommand(); const { globalization } = useGlobalization();
  const contracts = useQuery({ queryKey: ['hq-sales', 'contracts', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/contracts'), retry: false });
  const opportunities = useQuery({ queryKey: ['hq-sales', 'opportunities', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/opportunities'), retry: false });
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('record') ?? '';
  const setSelectedId = (id: string) => setSearchParams(previous => { const next = new URLSearchParams(previous); if (id) next.set('record', id); else next.delete('record'); return next; });
  const current = selectedId ? contracts.data?.find(row => row.public_id === selectedId) : undefined;
  const [registering, setRegistering] = useState(false);
  const money = (value: number, currency?: string) => typeof value === 'number' && Number.isFinite(value) ? formatCurrency(value, globalization.locale, currency || current?.currency || 'KRW') : '확인 불가';
  const createDateBaseline = useRef(today());
  const [create, setCreate] = useState({ opportunityPublicId: '', contractName: '', contractDate: createDateBaseline.current, productAmount: 0, goodsAmount: 0, packageClassification: '', specialTerms: '' });
  const [productContracts,setProductContracts]=useState<Array<{productLineId:string;contractName:string;productAmount:number;goodsAmount:number;contractDate:string;packageClassification:string;specialTerms:string}>>([]);
  const [productContractVersion,setProductContractVersion]=useState<number|null>(null);
  const [plans, setPlans] = useState<PlanInput[]>([newPlan()]); const [changePlans, setChangePlans] = useState<PlanInput[]>([newPlan()]);
  const [pendingRequest, setPendingRequest] = useState('');
  const [relatedTab, setRelatedTab] = useState('collections');
  const [contractSearch, setContractSearch] = useState(''), [statusFilter, setStatusFilter] = useState('');
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmSales, setConfirmSales] = useState(false);
  const [planDialog, setPlanDialog] = useState<'view' | 'initial' | 'change' | null>(null);
  const [planDialogVersion, setPlanDialogVersion] = useState<number | null>(null);
  const planBaseline = useRef('');
  const [confirmDiscardPlan,setConfirmDiscardPlan]=useState(false);
  const [contractDraft,setContractDraft]=useState<{contractName:string;contractDate:string;packageClassification:string;productAmount:number;goodsAmount:number;specialTerms:string;description:string}|null>(null);
  const [contractDraftBaseline,setContractDraftBaseline]=useState('');
  const [discardContractDraft,setDiscardContractDraft]=useState(false);
  const [contractDraftVersion,setContractDraftVersion]=useState<number|null>(null);
  const [deletePlanId,setDeletePlanId]=useState('');
  useEffect(() => { setDeletePlanId(''); }, [selectedId]);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [orderDialog, setOrderDialog] = useState(false), [orderBusy, setOrderBusy] = useState(false);
  const details = useQuery({ queryKey: ['hq-sales', 'contract-details', current?.public_id, session?.user.userId], enabled: Boolean(current), queryFn: async () => {
    const id = current!.public_id;
    const [plan, actual, reconciliation, sales] = await Promise.all([apiGet<Row[]>(`/api/contracts/${id}/collection-plans`), apiGet<Row[]>(`/api/contracts/${id}/collections`), apiGet<Row>(`/api/contracts/${id}/reconciliation`), apiGet<Row[]>(`/api/contracts/${id}/sales`)]);
    return { plan, actual, reconciliation, sales };
  }, retry: false });
  useEffect(() => { if (current) { setPlans([newPlan(Number(current.contract_amount))]); setChangePlans([newPlan(Number(current.contract_amount))]); } }, [current?.public_id]);
  useEffect(() => { if (!planDialog && typeof details.data?.reconciliation?.outstandingAmount === 'number') setChangePlans([newPlan(details.data.reconciliation.outstandingAmount)]); }, [details.data?.reconciliation?.outstandingAmount, current?.public_id, planDialog]);
  const available = (opportunities.data ?? []).filter(row => row.stage === 'CLOSED_WON' && !row.contract_created_yn && row.erp_approved_yn);
  const canPlan = editable(perms, 'COLLECTION.PLAN.WRITE', current, session?.user.userId);
  const canRequest = editable(perms, 'CONTRACT.ERP_REQUEST', current, session?.user.userId);
  const currentPlans = details.data?.plan.filter(row => row.is_current) ?? [];
  const planTable = <>{currentPlans.length > 0 && <div className="hq-sales-scroll contract-plan-table"><table><thead><tr><th>버전</th><th>회차</th><th>유형</th><th>방법</th><th>금액</th><th>예정일</th><th>ERP 동기화</th></tr></thead><tbody>{currentPlans.map(row => <tr key={row.public_id}><td>{row.plan_version}</td><td>{row.installment_no}</td><td>{row.adjustment_type}</td><td>{row.collection_method}</td><td>{receiptAmountLabel(row.amount, row.currency, money)}</td><td>{row.planned_date}</td><td>{row.erp_sync_status}</td></tr>)}</tbody></table></div>}{currentPlans.length > 0 && <ContractPlanCards rows={currentPlans} amountLabel={(value,currency)=>receiptAmountLabel(value,currency,money)}/>}{!currentPlans.length && <p>저장된 수금계획이 없습니다.</p>}</>;
  const openPlan = (mode: 'view' | 'initial' | 'change') => {
    command.clear(); setConfirmDiscardPlan(false);
    setPlanDialogVersion(typeof current?.version === 'number' ? current.version : null);
    if (mode === 'initial') { const next=currentPlans.length ? currentPlans.map(row => ({ publicId: row.public_id, installmentNo: Number(row.installment_no), collectionMethod: String(row.collection_method), amount: Number(row.amount), plannedDate: String(row.planned_date).slice(0, 10) })) : [newPlan(Number(current?.contract_amount ?? 0))]; planBaseline.current=JSON.stringify(next); setPlans(next); }
    if (mode === 'change') { const next=[newPlan(Number(details.data?.reconciliation.outstandingAmount ?? 0))]; planBaseline.current=JSON.stringify(next); setChangePlans(next); }
    setPlanDialog(mode);
  };
  const closePlan = () => { if(command.busy)return; const value=planDialog==='initial'?JSON.stringify(plans):planDialog==='change'?JSON.stringify(changePlans):planBaseline.current; if(value!==planBaseline.current) setConfirmDiscardPlan(true); else setPlanDialog(null); };
  const planForm = (rows: PlanInput[], setRows: (rows: PlanInput[]) => void, target: number) => <fieldset disabled={command.busy} style={{border:0,padding:0,margin:0}}>
    {rows.map((row, index) => <div className="hq-sales-plan" key={index}><label>회차<input type="number" min={1} value={row.installmentNo} onChange={e => setRows(rows.map((p, i) => i === index ? { ...p, installmentNo: Number(e.target.value) } : p))} /></label><label>방법<ContractCollectionMethod value={row.collectionMethod} onChange={value => setRows(rows.map((p, i) => i === index ? { ...p, collectionMethod: value } : p))} /></label><label>금액<input type="number" min={planDialog === 'initial' ? undefined : 0.01} step="any" value={row.amount} onChange={e => setRows(rows.map((p, i) => i === index ? { ...p, amount: Number(e.target.value) } : p))} /></label><label>예정일<input type="date" value={row.plannedDate} onChange={e => setRows(rows.map((p, i) => i === index ? { ...p, plannedDate: e.target.value } : p))} /></label><button type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))} disabled={rows.length === 1}>삭제</button></div>)}
    <p>합계 {money(rows.reduce((s, r) => s + Number(r.amount), 0))} / 필요 금액 {money(target)} / 차이 {planDifference(target, rows.map(row => Number(row.amount))).direction} {money(planDifference(target, rows.map(row => Number(row.amount))).amount)}</p><button type="button" onClick={() => setRows([...rows, newPlan(0, Math.max(...rows.map(r => r.installmentNo)) + 1)])}>회차 추가</button>
  </fieldset>;
  return <main className="hq-sales-page hq-contract-page"><header><WorkspaceHeading icon={FileSignature}>계약 / 수금계획</WorkspaceHeading><p>MOCK · 실제 ERP 및 금융 시스템에 연결하지 않은 가상 데이터입니다. 계약 요청, 승인과 수금 결과를 구분합니다.</p></header><Feedback command={command} />
    <button onClick={() => setGlobalSearch(true)}>전역검색</button>{globalSearch && <HqGlobalSearch onClose={() => setGlobalSearch(false)} />}
    {current && contractDraft && <HqModal title="계약 정보 편집" busy={command.busy} onClose={() => {if(command.busy)return; if(JSON.stringify(contractDraft)!==contractDraftBaseline)setDiscardContractDraft(true);else setContractDraft(null);}}>
      <p>제품·상품 금액은 독립적으로 저장되며 계약 금액을 자동 계산하지 않습니다.</p><Feedback command={command}/>
      <fieldset disabled={command.busy}>
      <label>계약명<input value={contractDraft.contractName} onChange={e=>setContractDraft({...contractDraft,contractName:e.target.value})}/></label>
      <label>계약일자<input type="date" value={contractDraft.contractDate} onChange={e=>setContractDraft({...contractDraft,contractDate:e.target.value})}/></label>
      <label>패키지 구분<input value={contractDraft.packageClassification} onChange={e=>setContractDraft({...contractDraft,packageClassification:e.target.value})}/></label>
      <label>제품 금액<input type="number" min="0" value={contractDraft.productAmount} onChange={e=>setContractDraft({...contractDraft,productAmount:Number(e.target.value)})}/></label>
      <label>상품 금액<input type="number" min="0" value={contractDraft.goodsAmount} onChange={e=>setContractDraft({...contractDraft,goodsAmount:Number(e.target.value)})}/></label>
      <label>특약사항<textarea value={contractDraft.specialTerms} onChange={e=>setContractDraft({...contractDraft,specialTerms:e.target.value})}/></label>
      <label>설명<textarea value={contractDraft.description} onChange={e=>setContractDraft({...contractDraft,description:e.target.value})}/></label>
      </fieldset>
      {discardContractDraft && <div role="alert"><p>저장하지 않은 입력을 버리시겠습니까?</p><button onClick={()=>setDiscardContractDraft(false)}>계속 편집</button><button onClick={()=>{setDiscardContractDraft(false);setContractDraft(null)}}>입력 버리기</button></div>}
      <button className="contract-primary" disabled={command.busy||contractDraftVersion===null||!contractDraft.contractName.trim()||!contractDraft.contractDate} onClick={async()=>{const baseline=JSON.parse(contractDraftBaseline) as typeof contractDraft;const changes=Object.fromEntries(Object.entries(contractDraft).filter(([key,value])=>value!==baseline[key as keyof typeof baseline]));if(!Object.keys(changes).length){setContractDraft(null);return;}const result=await command.run(()=>apiPatch(`/api/contracts/${current.public_id}`,{...changes,expectedVersion:contractDraftVersion}),'계약 정보를 저장했습니다.');if(result)setContractDraft(null);}}>저장</button>
      <button disabled={command.busy} onClick={()=>{if(JSON.stringify(contractDraft)!==contractDraftBaseline)setDiscardContractDraft(true);else setContractDraft(null)}}>취소</button>
    </HqModal>}
    {current && planDialog && <HqModal title={planDialog === 'view' ? '수금계획 조회' : planDialog === 'initial' ? '최초 수금계획 편집' : '변경 수금계획 편집'} wide busy={command.busy} onClose={closePlan}>
      <p>{current.contract_name} · 계약 금액 {money(current.contract_amount)} · 계약잔액 {contractBalanceLabel(details.data?.reconciliation.outstandingAmount, money)}</p>
      {planDialog !== 'view' && <p>회차별 수금 방법과 예정일을 선택하고 금액 합계를 맞춰 주세요.</p>}
      <Feedback command={command} />
      {confirmDiscardPlan && <div role="alert" className="hq-sales-error"><p>저장하지 않은 수금계획 입력을 버리시겠습니까?</p><button type="button" onClick={()=>setConfirmDiscardPlan(false)}>계속 편집</button><button type="button" onClick={()=>{setConfirmDiscardPlan(false);setPlanDialog(null)}}>입력 버리기</button></div>}
      {command.errorStatus === 409 && planDialog !== 'view' && <p role="status">다른 변경이 발생했습니다. 입력 내용은 유지됩니다. 최신 정보를 확인하려면 입력을 폐기해야 합니다. <button type="button" onClick={async () => { if (!window.confirm('입력한 계획을 폐기하고 최신 정보를 불러오시겠습니까?')) return; await Promise.all([contracts.refetch(), details.refetch()]); command.clear(); setPlanDialog(null); }}>최신 정보 다시 불러오기</button></p>}
      {planDialog === 'view' ? planTable : planDialog === 'initial' ? <>{planForm(plans, setPlans, Number(current.contract_amount))}<button disabled={command.busy || planDialogVersion === null || plans.some(row => !row.plannedDate || !row.collectionMethod.trim() || !Number.isFinite(row.amount)) || Math.abs(plans.reduce((sum, row) => sum + Number(row.amount), 0) - Number(current.contract_amount)) >= 0.005} onClick={async () => { const result = await command.run(() => apiPost(`/api/contracts/${current.public_id}/collection-plans`, { rows: plans, expectedVersion: planDialogVersion }), '최초 수금계획을 저장했습니다.'); if (result) setPlanDialog(null); }}>최초 계획 저장</button></> : <>{planForm(changePlans, setChangePlans, Number(details.data?.reconciliation.outstandingAmount ?? 0))}<button disabled={command.busy || planDialogVersion === null || currentPlans.some(row => row.erp_sync_status === 'REQUESTING') || changePlans.some(row => !row.plannedDate || !row.collectionMethod.trim() || !Number.isFinite(row.amount) || row.amount <= 0) || Math.abs(changePlans.reduce((sum, row) => sum + Number(row.amount), 0) - Number(details.data?.reconciliation.outstandingAmount ?? 0)) >= 0.005} onClick={async () => { const result = await command.run(() => apiPost<{ requestId: string }>(`/api/contracts/${current.public_id}/collection-plans/change`, { rows: changePlans, expectedVersion: planDialogVersion }), '변경 계획을 ERP에 요청했습니다.'); if (result) { setPendingRequest(result.requestId); setPlanDialog(null); } }}>변경 계획 전송</button></>}
      <button disabled={command.busy} onClick={closePlan}>{planDialog === 'view' ? '닫기' : '취소'}</button>
    </HqModal>}
    {current && orderDialog && <HqModal title={`${current.contract_name} · 주문`} wide busy={orderBusy} onClose={() => setOrderDialog(false)}><HqOrdersPage key={current.public_id} contractContext={current.public_id} onBusy={setOrderBusy} /></HqModal>}
    {current && confirmSales && <HqModal title="매출현황 조회" busy={details.isFetching} onClose={() => setConfirmSales(false)}><p>{current.contract_name} 계약의 매출 현황을 조회합니다.</p>{details.error && <p role="alert">{String(details.error)}</p>}<button disabled={details.isFetching} onClick={async () => { const result = await details.refetch(); if (!result.error) { setRelatedTab('collections'); setConfirmSales(false); } }}>{details.isFetching ? '조회 중…' : '다음'}</button><button disabled={details.isFetching} onClick={() => setConfirmSales(false)}>취소</button></HqModal>}
    {!selectedId && !registering && perms?.includes('COLLECTION.READ') && <><button onClick={() => setShowAllPlans(!showAllPlans)}>{showAllPlans ? '전체 수금계획 닫기' : '전체 수금계획 보기'}</button>{showAllPlans && <HqCollectionPlanList money={money} />}</>}
    {(contracts.error || opportunities.error || details.error) && <p role="alert" className="hq-sales-error">{String(contracts.error ?? opportunities.error ?? details.error)}</p>}
    {confirmCreate && <HqModal title="계약 생성 확인" busy={command.busy} onClose={() => setConfirmCreate(false)}><p>{available.find(row => row.public_id === create.opportunityPublicId)?.opportunity_name} 기회로 계약을 생성합니다.</p><p>{productContracts.length > 1 ? `제품별 계약 ${productContracts.length}건` : `계약 금액: ${money(create.productAmount + create.goodsAmount)}`}</p><Feedback command={command} /><button disabled={command.busy} onClick={async () => { const result = productContracts.length > 1 ? await command.run(() => apiPost<Row[]>(`/api/opportunities/${create.opportunityPublicId}/contracts`, {rows:productContracts,expectedVersion:productContractVersion}), '제품별 계약을 생성했습니다.') : await command.run(() => apiPost<Row>('/api/contracts', { ...create, contractName: create.contractName.trim() || undefined, packageClassification: create.packageClassification.trim() || undefined }), '계약을 생성했습니다.'); const row=Array.isArray(result)?result[0]:result; if (row) { setSelectedId(row.public_id); setRegistering(false); setConfirmCreate(false); setProductContracts([]); setCreate({ ...create, opportunityPublicId: '', contractName: '', productAmount: 0, goodsAmount: 0 }); } }}>생성 확인</button><button disabled={command.busy} onClick={() => setConfirmCreate(false)}>취소</button></HqModal>}
    {perms?.includes('CONTRACT.WRITE') && !selectedId && !registering && <button className="contract-create-action" type="button" onClick={() => setRegistering(true)}>계약 등록</button>}
    {perms?.includes('CONTRACT.WRITE') && registering && <form className="hq-sales-card hq-sales-fields" onSubmit={e => { e.preventDefault(); command.clear(); setConfirmCreate(true); }}><h2>계약 생성</h2>
      <label>승인 거래처의 수주 기회<select required value={create.opportunityPublicId} onChange={e => { const row = available.find(x => x.public_id === e.target.value); setCreate({ ...create, opportunityPublicId: e.target.value, ...contractOpportunityDefaults(row ? { amount: row.amount, products: row.products, special_terms: row.special_terms } : undefined) });setProductContractVersion(row?.version??null);setProductContracts((row?.products??[]).map((p:Row)=>({productLineId:p.public_id,contractName:String(p.item_name??'제품 계약'),productAmount:Number(p.amount??0),goodsAmount:0,contractDate:today(),packageClassification:'',specialTerms:''}))); }}><option value="">선택</option>{available.map(row => <option key={row.public_id} value={row.public_id}>{row.account_name} · {row.opportunity_name} · {money(row.amount, row.currency || 'KRW')}</option>)}</select></label>
      {productContracts.length>1 && <><p>제품별로 계약을 각각 생성합니다. 각 제품의 금액 구분과 특약을 확인하세요.</p>{productContracts.map((line,index)=><fieldset key={line.productLineId} disabled={command.busy}><legend>{index+1}번 제품</legend><label>계약명<input value={line.contractName} onChange={e=>setProductContracts(productContracts.map((r,i)=>i===index?{...r,contractName:e.target.value}:r))}/></label><label>제품 금액<input type="number" min="0" value={line.productAmount} onChange={e=>setProductContracts(productContracts.map((r,i)=>i===index?{...r,productAmount:Number(e.target.value)}:r))}/></label><label>상품 금액<input type="number" min="0" value={line.goodsAmount} onChange={e=>setProductContracts(productContracts.map((r,i)=>i===index?{...r,goodsAmount:Number(e.target.value)}:r))}/></label><label>패키지 구분<input value={line.packageClassification} onChange={e=>setProductContracts(productContracts.map((r,i)=>i===index?{...r,packageClassification:e.target.value}:r))}/></label><label>특약<textarea value={line.specialTerms} onChange={e=>setProductContracts(productContracts.map((r,i)=>i===index?{...r,specialTerms:e.target.value}:r))}/></label></fieldset>)}</>}
      {productContracts.length<=1 && <>
      <label>계약명<input value={create.contractName} onChange={e => setCreate({ ...create, contractName: e.target.value })} /></label><label>계약일<input type="date" required value={create.contractDate} onChange={e => setCreate({ ...create, contractDate: e.target.value })} /></label>
      <p className="hq-sales-wide">기회 제품의 금액 구분이 없거나 합계가 일치하지 않으면 전체 금액이 제품 금액으로 표시됩니다. 저장 전 확인해 주세요.</p><label>제품 금액<input type="number" min={0} value={create.productAmount} onChange={e => setCreate({ ...create, productAmount: Number(e.target.value) })} /></label><label>상품 금액<input type="number" min={0} value={create.goodsAmount} onChange={e => setCreate({ ...create, goodsAmount: Number(e.target.value) })} /></label>
      <label>패키지 분류<input value={create.packageClassification} onChange={e => setCreate({ ...create, packageClassification: e.target.value })} /></label><label className="hq-sales-wide">특약<textarea value={create.specialTerms} onChange={e => setCreate({ ...create, specialTerms: e.target.value })} /></label></>}<button disabled={command.busy || !create.opportunityPublicId}>계약 생성</button><button type="button" disabled={command.busy} onClick={() => { if ((create.opportunityPublicId || create.contractName || create.contractDate !== createDateBaseline.current || create.productAmount || create.goodsAmount || create.packageClassification || create.specialTerms) && !window.confirm('저장하지 않은 계약 입력을 버리시겠습니까?')) return; createDateBaseline.current = today(); setCreate({ opportunityPublicId: '', contractName: '', contractDate: createDateBaseline.current, productAmount: 0, goodsAmount: 0, packageClassification: '', specialTerms: '' }); setRegistering(false); }}>목록으로</button>
    </form>}
    <div className="hq-sales-columns" style={{gridTemplateColumns: '1fr'}}>{!selectedId && !registering && <section className="hq-sales-card"><h2>계약 목록</h2>
      <label>계약 검색<input value={contractSearch} onChange={e => setContractSearch(e.target.value)} placeholder="계약명·거래처·ERP 번호" /></label>
      <label>계약 상태<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">전체</option>{Array.from(new Set((contracts.data ?? []).map(row => String(row.status)))).map(status => <option key={status}>{status}</option>)}</select></label>
      {contracts.isLoading && <p>계약을 불러오는 중입니다.</p>}{contracts.error && <button type="button" onClick={() => void contracts.refetch()}>계약 목록 다시 시도</button>}{!contracts.isLoading && !contracts.error && !(contracts.data ?? []).some(row => (!statusFilter || row.status === statusFilter) && `${row.contract_name} ${row.account_name} ${row.erp_contract_no ?? ''}`.toLocaleLowerCase().includes(contractSearch.trim().toLocaleLowerCase())) && <p>조건에 맞는 계약이 없습니다.</p>}
      {contracts.data?.filter(row => (!statusFilter || row.status === statusFilter) && `${row.contract_name} ${row.account_name} ${row.erp_contract_no ?? ''}`.toLocaleLowerCase().includes(contractSearch.trim().toLocaleLowerCase())).map(row => <button type="button" className="hq-sales-row" aria-current={row.public_id === current?.public_id} key={row.public_id} onClick={() => { setSelectedId(row.public_id); setPendingRequest(''); }}><strong>{row.contract_name}</strong><span>{row.account_name} · {row.status}</span><span>{money(row.contract_amount, row.currency || 'KRW')}</span></button>)}</section>}
      {selectedId && <section className="hq-sales-card"><div className="contract-detail-heading"><button type="button" disabled={command.busy} onClick={() => { setSelectedId(''); setPendingRequest(''); }}>목록으로</button><h2>계약 상세</h2></div>{current ? <><dl className="hq-sales-summary"><div><dt><BriefcaseBusiness size={16} aria-hidden="true" />기회</dt><dd>{current.opportunity_name}</dd></div><div><dt><CircleDollarSign size={16} aria-hidden="true" />계약 금액</dt><dd>{money(current.contract_amount)}</dd></div><div><dt><FileSignature size={16} aria-hidden="true" />ERP 계약번호</dt><dd>{field(current.erp_contract_no)}</dd></div><div><dt><Database size={16} aria-hidden="true" />ERP 상태</dt><dd>{current.status} · {current.integration_status}</dd></div></dl>
        <ContractObservedFields row={current} money={money}/>
        {editable(perms,'CONTRACT.WRITE',current,session?.user.userId) && ['DRAFT','ERP_FAILED'].includes(current.status) && typeof current.product_amount==='number' && typeof current.goods_amount==='number' && <button type="button" onClick={()=>{const draft={contractName:String(current.contract_name??''),contractDate:String(current.contract_date??''),packageClassification:String(current.package_classification??''),productAmount:current.product_amount,goodsAmount:current.goods_amount,specialTerms:String(current.special_terms??''),description:String(current.description??'')};command.clear();setContractDraft(draft);setContractDraftBaseline(JSON.stringify(draft));setContractDraftVersion(current.version);setDiscardContractDraft(false);}}>계약 정보 편집</button>}
        {canRequest && ['DRAFT', 'ERP_FAILED'].includes(current.status) && <button disabled={command.busy || !currentPlans.length || details.data?.reconciliation.complete !== true} onClick={async () => { const result = await command.run(() => apiPost<{ requestId: string }>(`/api/contracts/${current.public_id}/erp-request`, { idempotencyKey: `contract:${current.public_id}:${current.version}`, expectedVersion: current.version }), 'ERP 계약 등록을 요청했습니다. 승인 결과를 기다리세요.'); if (result) setPendingRequest(result.requestId); }}>ERP 계약 등록 요청</button>}
        {pendingRequest && <p role="status">요청 ID: {pendingRequest}</p>}
        <div className="hq-contract-detail-actions">
        {editable(perms, 'ORDER.WRITE', current, session?.user.userId) && current.status === 'ERP_APPROVED' && !current.close_yn && <button onClick={() => setOrderDialog(true)}>주문 작성</button>}
        {perms?.includes('SALES.READ') && <button disabled={details.isFetching} onClick={() => setConfirmSales(true)}>매출현황 조회</button>}
        </div>
        {perms?.includes('INTERFACE.MANAGE') && pendingRequest && <button disabled={command.busy} onClick={() => void command.run(() => apiPost('/api/hq/interfaces/advance', { requestId: pendingRequest, scenario: 'SUCCESS' }), 'ERP 계약 승인 결과를 반영했습니다.')}>모의 ERP 결과 반영</button>}
      </> : <p>{contracts.isLoading ? '계약을 불러오는 중입니다.' : '계약을 찾을 수 없습니다.'}</p>}</section>}</div>
    {current && <div role="tablist" aria-label="계약 관련정보"><button role="tab" aria-selected={relatedTab === 'collections'} onClick={() => setRelatedTab('collections')}>수금 &amp; 매출정보</button>{perms?.includes('ORDER.READ') && <button role="tab" aria-selected={relatedTab === 'orders'} onClick={() => setRelatedTab('orders')}>주문 &amp; 반품정보</button>}<button role="tab" aria-selected={relatedTab === 'files'} onClick={() => setRelatedTab('files')}>파일</button></div>}
    {current && relatedTab === 'files' && <ContractFiles key={current.public_id} contractId={current.public_id} writable={editable(perms,'CONTRACT.WRITE',current,session?.user.userId)} />}
    {current && relatedTab === 'orders' && perms?.includes('ORDER.READ') && <HqContractOrders contractId={current.public_id} money={money} />}
    {current && relatedTab === 'collections' && <><section className="hq-sales-card"><h2>수금계획</h2>{planTable}<div className="hq-contract-detail-actions"><button onClick={() => openPlan('view')}>수금계획 조회</button>
      {canPlan && ['DRAFT', 'ERP_FAILED'].includes(current.status) && <button disabled={details.data?.reconciliation.complete !== true} onClick={() => openPlan('initial')}>최초 수금계획 편집</button>}
      {canPlan && current.status === 'ERP_APPROVED' && Number(details.data?.reconciliation.outstandingAmount ?? 0) > 0 && <button onClick={() => openPlan('change')}>변경 수금계획 편집</button>}</div>
      {canPlan && ['DRAFT', 'ERP_FAILED'].includes(current.status) && currentPlans.map(plan => <div key={plan.public_id}><button type="button" disabled={command.busy || details.data?.reconciliation.complete !== true} onClick={() => setDeletePlanId(plan.public_id)}>{plan.installment_no}회차 삭제</button>{deletePlanId === plan.public_id && <div role="alert"><p>{plan.installment_no}회차를 삭제하시겠습니까? 삭제 후 계획 합계를 다시 맞춰야 할 수 있습니다.</p><button type="button" disabled={command.busy} onClick={async () => { const result = await command.run(() => apiDelete(`/api/contracts/${current.public_id}/collection-plans/${plan.public_id}`, {expectedVersion:current.version}), '수금계획을 삭제했습니다.'); if (result) setDeletePlanId(''); }}>삭제 확인</button><button type="button" disabled={command.busy} onClick={() => setDeletePlanId('')}>취소</button></div>}</div>)}
      {details.data?.reconciliation.complete === false && <p role="status">계획·수금 정보의 접근 범위 또는 통화가 불완전해 합계 확인과 변경을 보류합니다.</p>}
      <details><summary>계획 이력</summary>{details.data?.plan.filter(row => !row.is_current).map(row => <p key={row.public_id}>v{row.plan_version} / {row.installment_no}회 / {receiptAmountLabel(row.amount, row.currency, money)} / {row.planned_date} / {row.adjustment_type}</p>)}</details>
    </section><section className="hq-sales-card"><h2>수금 및 정산 · MOCK</h2><p>출처: 격리 ERP 목업 · 기준 시각 {details.data?.reconciliation.asOf ?? '확인 불가'}</p><dl className="hq-sales-summary"><div><dt>계약 금액</dt><dd>{contractBalanceLabel(details.data?.reconciliation.contractAmount, money)}</dd></div><div><dt>실제 수금</dt><dd>{contractBalanceLabel(details.data?.reconciliation.actualTotal, money)}</dd></div><div><dt>계약잔액</dt><dd>{contractBalanceLabel(details.data?.reconciliation.outstandingAmount, money)}</dd></div><div><dt>초과 수금</dt><dd>{contractBalanceLabel(details.data?.reconciliation.overCollectionAmount, money)}</dd></div><div><dt>계획 보정</dt><dd>{details.data?.reconciliation.correctionRequired == null ? '확인 불가' : details.data.reconciliation.correctionRequired ? '필요' : '정상'}</dd></div></dl><p>계약잔액은 계약금액에서 누적 수금을 뺀 값이며 기한 경과 미수금과 다릅니다. 기한 경과 미수의 원천 기준은 확인되지 않았습니다.</p>
      <h3>실수금</h3>{details.data?.actual.length ? details.data.actual.map(row => <p key={row.public_id}>{row.erp_collection_no} · {receiptAmountLabel(row.amount, row.currency, money)} · {row.collected_at}</p>) : <p>{details.data?.reconciliation.complete === false ? '조회 가능한 수금 결과가 없습니다.' : '수금 결과가 없습니다.'}</p>}
      <h3>매출 결과</h3>{details.data?.sales.length ? details.data.sales.map(row => <p key={row.public_id}>{row.erp_sales_no} · {money(row.amount)} · {row.sales_date}</p>) : <p>매출 결과가 없습니다.</p>}</section></>}
  </main>;
}
