import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeadSummary } from '@dio-crm/contracts';
import { apiGet } from './api';

const statusLabel: Record<string, string> = {
  NEW: '신규등록', FIRST_VISIT: '초도방문', KEYMAN_MEETING: '키맨미팅', CONTACT_EXCLUDED: '컨택제외', CONVERTED: '변환'
};

export function LeadsPage() {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['leads', search],
    queryFn: () => apiGet<LeadSummary[]>(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h2 style={{ marginBottom: 4 }}>신규병원 / Lead</h2><small>심평원 신규병원 → 담당자 자동할당 → 단계관리 → Convert</small></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="병원명/사업자번호 검색" style={{ padding: 9, minWidth: 260 }} />
      </div>
      {query.isError && <p style={{ background: '#fff4e5', padding: 12 }}>API 연결 전입니다. DEV DB/Auth 연결 후 실제 Lead가 표시됩니다.</p>}
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead><tr><th>병원명</th><th>상태</th><th>담당자</th><th>지역</th><th>전화</th><th>사업자번호</th></tr></thead>
          <tbody>{(query.data ?? []).map(x => <tr key={x.public_id}>
            <td>{x.hospital_name}</td><td>{statusLabel[x.status] ?? x.status}</td><td>{x.owner_name ?? '-'}</td>
            <td>{[x.sido, x.sigungu].filter(Boolean).join(' ')}</td><td>{x.phone ?? '-'}</td><td>{x.business_no ?? '-'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
