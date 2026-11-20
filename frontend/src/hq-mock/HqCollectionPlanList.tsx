import './collection-plans.css';
import {filterCollectionPlans} from './collection-plan-filters';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '../api';
import { useHqMock } from './HqMockProvider';
import { receiptAmountLabel } from './contract-feedback';

type Plan = { public_id: string; contract_public_id: string; contract_name: string; installment_no: number;
  planned_date: string; collection_method: string; amount: number; currency?: string; correction_required_yn: boolean; erp_sync_status: string };
export function HqCollectionPlanList({ money }: { money: (amount: number, currency?: string) => string }) {
  const { session } = useHqMock();
  const [corrections, setCorrections] = useState(false), [search, setSearch] = useState('');
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[sort,setSort]=useState<'date-asc'|'date-desc'>('date-asc');
  const query = useQuery({ queryKey: ['hq-sales', 'all-collection-plans', session?.user.userId], queryFn: () => apiGet<Plan[]>('/api/collection-plans'), retry: false });
  const rows = filterCollectionPlans(query.data ?? [],{search,corrections,from,to,sort});
  return <section className="hq-sales-card hq-collection-list"><h2>전체 수금계획</h2><div className="hq-sales-fields">
    <label>수금계획 목록<select value={corrections ? 'corrections' : 'all'} onChange={e => setCorrections(e.target.value === 'corrections')}><option value="all">전체</option><option value="corrections">수정필요</option></select></label>
    <label>수금계획 계약 검색<input value={search} onChange={e => setSearch(e.target.value)} /></label>
    <label>예정일 시작<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>예정일 종료<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>예정일 정렬<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="date-asc">빠른 날짜순</option><option value="date-desc">늦은 날짜순</option></select></label><button onClick={()=>{setSearch('');setCorrections(false);setFrom('');setTo('');setSort('date-asc');}}>조회 조건 초기화</button><button disabled={query.isFetching} onClick={() => void query.refetch()}>계획 목록 새로 고침</button></div>
    {from && to && from>to && <p role="alert">예정일 종료는 시작일 이후여야 합니다.</p>}{query.error && <p role="alert">{String(query.error)}</p>}{query.isPending ? <p>불러오는 중…</p> : query.data && !query.error && <>
    <p>{rows.length}건 · 현재 유효한 회차</p><div className="hq-sales-scroll"><table><thead><tr><th>계약</th><th>회차</th><th>예정일</th><th>금액</th><th>수금 방법</th><th>수정필요</th><th>ERP 상태</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.public_id}><td><Link to={`/contracts?record=${row.contract_public_id}`}>{row.contract_name}</Link></td><td>{row.installment_no}</td><td>{row.planned_date}</td><td>{receiptAmountLabel(row.amount, row.currency, money)}</td><td>{row.collection_method || '—'}</td><td>{row.correction_required_yn ? '필요' : '—'}</td><td>{row.erp_sync_status}</td></tr>)}</tbody></table></div>
    <div className="hq-plan-cards">{rows.map(row=><article key={row.public_id}><Link to={`/contracts?record=${row.contract_public_id}`}>{row.contract_name}</Link><strong>{receiptAmountLabel(row.amount,row.currency,money)}</strong><dl><div><dt>회차 · 예정일</dt><dd>{row.installment_no}회 · {row.planned_date}</dd></div><div><dt>수금 방법</dt><dd>{row.collection_method||'—'}</dd></div><div><dt>ERP 상태</dt><dd>{row.erp_sync_status}</dd></div><div><dt>수정필요</dt><dd>{row.correction_required_yn?'필요':'—'}</dd></div></dl></article>)}</div>{!rows.length && <p>조회 결과가 없습니다.</p>}</>}
  </section>;
}
