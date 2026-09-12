import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountSummary } from '@dio-crm/contracts';
import { apiGet, apiPost } from './api';

export function AccountsPage() {
  const [search, setSearch] = useState('');
  const [message,setMessage]=useState('');
  const query = useQuery({
    queryKey: ['accounts', search],
    queryFn: () => apiGet<AccountSummary[]>(`/api/accounts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });
  const requestErp=async(publicId:string)=>{
    try{const r=await apiPost<{requestId:string}>(`/api/erp-accounts/${publicId}/request`);setMessage(`ERP 거래처 요청 Queue 생성: ${r.requestId}`);await query.refetch();}
    catch(e){setMessage(String(e));}
  };
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h2 style={{ marginBottom: 4 }}>거래처 / Account</h2><small>Lead Convert 결과, ERP 거래처 승인상태, 중복/병합 기준 조회</small></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="거래처명/사업자번호 검색" style={{ padding: 9, minWidth: 260 }} />
      </div>
      {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
      {query.isError && <p style={{ background: '#fff4e5', padding: 12 }}>API 연결 전입니다. DEV DB/Auth 연결 후 실제 Account가 표시됩니다.</p>}
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead><tr><th>거래처명</th><th>사업자번호</th><th>상태</th><th>ERP 코드</th><th>ERP 승인</th><th>연동상태</th><th>ERP 등록</th></tr></thead>
          <tbody>{(query.data ?? []).map(x => <tr key={x.public_id}>
            <td>{x.account_name}</td><td>{x.business_no ?? '-'}</td><td>{x.account_status}</td>
            <td>{x.erp_customer_code ?? '-'}</td><td>{x.erp_approved_yn ? '승인' : '미승인'}</td><td>{x.integration_status}</td>
            <td><button disabled={x.integration_status==='REQUESTING'||x.erp_approved_yn} onClick={()=>requestErp(x.public_id)}>등록요청</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
