import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api';
import { HqModal } from './customer-shared';
import { useHqMock } from './HqMockProvider';

const sources = [
  { name: '리드', path: '/api/leads', route: '/leads?lead=', permission: 'LEAD.READ', field: 'hospital_name' },
  { name: '거래처', path: '/api/accounts', route: '/accounts?record=', permission: 'ACCOUNT.READ', field: 'account_name' },
  { name: '영업기회', path: '/api/opportunities', route: '/opportunities?record=', permission: 'OPPORTUNITY.READ', field: 'opportunity_name' },
  { name: '계약', path: '/api/contracts', route: '/contracts?record=', permission: 'CONTRACT.READ', field: 'contract_name' },
];
type Row = Record<string, unknown> & { public_id: string };
export function HqGlobalSearch({ onClose }: { onClose: () => void }) {
  const { session } = useHqMock(), [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['hq-global-search', session?.user.userId], retry: false, queryFn: async () => {
    const allowed = sources.filter(source => session?.user.permissions.includes(source.permission));
    const results = await Promise.allSettled(allowed.map(source => apiGet<Row[]>(source.path)));
    return allowed.map((source, index) => { const result = results[index]; return { ...source, rows: result.status === 'fulfilled' ? result.value : [], error: result.status === 'rejected' ? String(result.reason) : '' }; });
  } });
  const term = search.trim().toLocaleLowerCase();
  return <HqModal title="전역검색" onClose={onClose} wide><label>통합 검색어<input value={search} onChange={event => setSearch(event.target.value)} placeholder="이름·거래처·ERP 번호·식별자" /></label>
    <p>리드, 거래처, 영업기회, 계약 중 조회 권한이 있는 기록을 검색합니다.</p>
    {query.isPending && <p>불러오는 중…</p>}{query.error && <p role="alert">{String(query.error)}</p>}
    {term && query.data?.map(source => { const rows = source.rows.filter(row => [row[source.field], row.account_name, row.erp_customer_code, row.erp_contract_no, row.public_id].some(value => String(value ?? '').toLocaleLowerCase().includes(term)));
      return <section key={source.path}><h3>{source.name} ({rows.length})</h3>{source.error ? <p role="alert">{source.error}</p> : rows.length ? rows.map(row => <p key={row.public_id}><Link to={`${source.route}${row.public_id}`} onClick={onClose}>{String(row[source.field] || row.public_id)}</Link> · {String(row.status ?? row.stage ?? '')}<small> · {String(row.erp_contract_no ?? row.erp_customer_code ?? row.public_id)}</small></p>) : <p>조회 결과가 없습니다.</p>}</section>;
    })}
    <button onClick={onClose}>닫기</button>
  </HqModal>;
}
