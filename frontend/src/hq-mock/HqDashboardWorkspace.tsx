import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChartNoAxesCombined, UsersRound, CalendarCheck, BriefcaseBusiness, FileSignature, ShoppingCart, ReceiptText, WalletCards } from 'lucide-react';
import { WorkspaceHeading } from './WorkspaceHeading';
import { apiGet } from '../api';
import { useHqMock } from './HqMockProvider';
import { configAnchor } from './config-anchor';
import { HqModal } from './customer-shared';
import './hq-h06.css';

const labels = { leads: '리드', activities: '활동', pipeline: '기회', contracts: '계약', orders: '주문', sales: '매출', collections: '수금' };
const metricIcons = { leads: UsersRound, activities: CalendarCheck, pipeline: BriefcaseBusiness, contracts: FileSignature, orders: ShoppingCart, sales: ReceiptText, collections: WalletCards };
type Metric = keyof typeof labels;
type Units = Partial<Record<Metric, 'full' | 'million'>>;
type DashboardData = { asOf: string; periodBasis?: Partial<Record<Metric, string>>; topAccounts: { accountPublicId: string; accountName: string; salesAmount: number | null; currency?: string | null }[] } & Partial<Record<Metric, { count: number; amount?: number | null; currency?: string | null }>>;
const basisLabels: Record<string, string> = { created_at: '생성일', start_at: '활동 시작일', expected_close_date: '예상 마감일', contract_date: '계약일', sales_date: '매출일', collected_at: '수금일' };
const views: { id: string; name: string; keys: Metric[] }[] = [
  { id: 'sales', name: '판매 대시보드', keys: ['pipeline', 'contracts', 'orders', 'sales', 'collections'] },
  { id: 'activities', name: '활동 대시보드', keys: ['activities', 'leads'] },
  { id: 'customers', name: '고객 대시보드', keys: ['leads', 'sales', 'collections'] },
];
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const format = (amount: number, unit: Units[Metric], currency?: string | null) => currency && currency !== 'KRW' ? `${amount.toLocaleString('ko-KR')} ${currency}` : unit === 'million' ? `${(amount / 1000000).toLocaleString('ko-KR', {maximumFractionDigits: 2})}백만원` : `${amount.toLocaleString('ko-KR')}원`;

export function HqDashboardWorkspace() {
  const { session } = useHqMock();
  const [view, setView] = useState('sales'), [list, setList] = useState(false);
  const [from, setFrom] = useState(`${localDate().slice(0,7)}-01`), [to, setTo] = useState(localDate());
  const [units, setUnits] = useState<Units>({}), [draft, setDraft] = useState<Units>({});
  const [editing, setEditing] = useState(false), [widget, setWidget] = useState<Metric | null>(null);
  const [unit, setUnit] = useState<'full' | 'million'>('full'), [notice, setNotice] = useState('');
  const storageKey = `hq-dashboard-units:${session?.user.userId ?? 'none'}`;
  useEffect(() => {
    let loaded: Units = {};
    try { const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      for (const key of Object.keys(labels) as Metric[]) if (value?.[key] === 'full' || value?.[key] === 'million') loaded[key] = value[key];
    } catch { /* Invalid preferences fall back to full values. */ }
    setUnits(loaded); setDraft(loaded); setEditing(false); setWidget(null); setNotice('');
  }, [storageKey]);
  const valid = Boolean(from && to && from <= to);
  const query = useQuery({ queryKey: ['hq-h06','dashboard-workspace',session?.user.userId,from,to], enabled: Boolean(session) && valid,
    queryFn: () => apiGet<DashboardData>(`/api/analytics/dashboard?from=${from}&to=${to}`), retry: false });
  const selected = views.find(item => item.id === view)!;
  const applied = editing ? draft : units;
  return <main className="h06-page h06-dashboard-page"><WorkspaceHeading icon={ChartNoAxesCombined}>영업 분석</WorkspaceHeading>
    <div className="h06-fields"><button onClick={() => setList(!list)}>{list ? '대시보드로 돌아가기' : '대시보드 목록'}</button>
      <button disabled={query.isFetching || !valid} onClick={() => void query.refetch()}>새로 고침</button></div>
    {list ? <section className="h06-card"><h2>대시보드 목록</h2><table><thead><tr><th>대시보드 이름</th><th>폴더</th></tr></thead><tbody>{views.map(item => <tr key={item.id}><td><button onClick={() => {setView(item.id);setList(false);}}>{item.name}</button></td><td>본사 표준</td></tr>)}</tbody></table><p>목업 집계 API의 조회 권한과 기간 조건을 적용합니다.</p></section> : <>
      <h2>{selected.name}</h2><div className="h06-fields" {...configAnchor('section:analytics.filters', 'analytics.filters.0')}><label {...configAnchor('analytics.from', 'analytics.filters.from')}>시작일<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label {...configAnchor('analytics.to', 'analytics.filters.to')}>종료일<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      {!valid && <p role="alert">시작일과 종료일을 입력하고 날짜 순서를 확인하세요.</p>}
      {query.error && <p role="alert">{String(query.error)}</p>}
      {valid && !query.isError && <><p>기준 시각: {query.data?.asOf ?? '조회 중'}</p>
      {editing ? <div className="h06-fields"><button onClick={() => {try {localStorage.setItem(storageKey,JSON.stringify(draft));setUnits(draft);setEditing(false);setNotice('표시 설정을 이 브라우저의 현재 사용자 설정으로 저장했습니다.');} catch {setNotice('표시 설정을 저장하지 못했습니다.');}}}>대시보드 저장</button><button onClick={() => {setDraft(units);setEditing(false);setNotice('편집을 취소했습니다.');}}>편집 취소</button></div> : <button onClick={() => {setDraft(units);setEditing(true);setNotice('');}}>대시보드 편집</button>}
      {notice && <p role="status">{notice}</p>}
      <div className="h06-columns">{selected.keys.map(key => { const Icon = metricIcons[key]; return <section className="h06-card h06-metric" key={key}><h3><span className="h06-section-icon"><Icon size={19} aria-hidden="true" /></span>{labels[key]}</h3><strong>{query.data ? `${query.data[key]?.count ?? 0}건` : '조회 중'}</strong>{query.data?.[key]?.amount === null ? <p>통화 또는 권한 확인 필요</p> : query.data?.[key]?.amount !== undefined && <><p title={format(query.data[key]!.amount!, 'full', query.data[key]?.currency)}>{format(query.data[key]!.amount!,applied[key], query.data[key]?.currency)}</p>{editing && <button aria-label={`${labels[key]} 표시 단위 편집`} onClick={() => {setWidget(key);setUnit(draft[key] ?? 'full');}}>표시 단위 편집</button>}</>}{query.data?.periodBasis?.[key] && <small>기간 기준: {basisLabels[query.data.periodBasis[key]!] ?? query.data.periodBasis[key]}</small>}</section>; })}</div>
      <section className="h06-card"><h3>거래처별 매출</h3>{query.data?.topAccounts?.length ? query.data.topAccounts.map(row => <p key={row.accountPublicId}>{row.accountName} · {row.salesAmount == null ? '통화 확인 필요' : format(row.salesAmount, 'full', row.currency)}</p>) : <p>{query.isPending ? '조회 중' : '조회 결과가 없습니다.'}</p>}</section></>}
    </>}
    {widget && <HqModal title={`${labels[widget]} 표시 단위`} onClose={() => setWidget(null)}><label>표시 단위<select value={unit} onChange={e => setUnit(e.target.value as 'full' | 'million')}><option value="full">전체 숫자</option><option value="million">백만</option></select></label><p>미리보기: {query.data?.[widget]?.amount == null ? '확인 불가' : format(query.data[widget]!.amount!,unit,query.data[widget]?.currency)}</p><p>금액 데이터는 유지됩니다. 업데이트 후 대시보드 저장을 누르면 표시 설정이 저장됩니다.</p><button onClick={() => {setDraft({...draft,[widget]:unit});setWidget(null);}}>업데이트</button><button onClick={() => setWidget(null)}>취소</button></HqModal>}
  </main>;
}
