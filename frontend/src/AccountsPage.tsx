import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AccountSummary } from '@dio-crm/contracts';
import { apiGet, apiPost } from './api';
import { useGlobalization } from './market/globalization-context';

export function AccountsPage() {
  const { t } = useTranslation();
  const { featureEnabled } = useGlobalization();
  const [search, setSearch] = useState('');
  const [message,setMessage]=useState('');
  const query = useQuery({
    queryKey: ['accounts', search],
    queryFn: () => apiGet<AccountSummary[]>(`/api/accounts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });
  const requestErp=async(publicId:string)=>{
    try{const r=await apiPost<{requestId:string}>(`/api/erp-accounts/${publicId}/request`);setMessage(t('account.queueCreated',{requestId:r.requestId}));await query.refetch();}
    catch(e){setMessage(String(e));}
  };
  const erpEnabled=featureEnabled('ERP_ACCOUNT_APPROVAL');
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h2 style={{ marginBottom: 4 }}>{t('account.title')}</h2><small>{t('account.subtitle')}</small></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('account.search')} style={{ padding: 9, minWidth: 260 }} />
      </div>
      {message&&<p style={{background:'#f6f8fa',padding:10}}>{message}</p>}
      {query.isError && <p style={{ background: '#fff4e5', padding: 12 }}>{t('account.apiPending')}</p>}
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead><tr><th>{t('account.name')}</th><th>{t('account.businessNo')}</th><th>{t('common.status')}</th><th>{t('account.erpCode')}</th><th>{t('account.erpApproved')}</th><th>{t('account.integration')}</th>{erpEnabled&&<th>{t('account.erpRegistration')}</th>}</tr></thead>
          <tbody>{(query.data ?? []).map(x => <tr key={x.public_id}>
            <td>{x.account_name}</td><td>{x.business_no ?? '-'}</td><td>{x.account_status}</td>
            <td>{x.erp_customer_code ?? '-'}</td><td>{x.erp_approved_yn ? t('account.approved') : t('account.notApproved')}</td><td>{x.integration_status}</td>
            {erpEnabled&&<td><button disabled={x.integration_status==='REQUESTING'||x.erp_approved_yn} onClick={()=>requestErp(x.public_id)}>{t('account.request')}</button></td>}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
