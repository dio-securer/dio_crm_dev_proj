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
  const rows=query.data ?? [];
  const approved=rows.filter(x=>x.erp_approved_yn).length;
  const requesting=rows.filter(x=>x.integration_status==='REQUESTING').length;
  const pending=Math.max(0,rows.length-approved-requesting);

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div><span className="page-kicker">CRM · ACCOUNT</span><h2>{t('account.title')}</h2><small>{t('account.subtitle')}</small></div>
        <div className="page-actions"><input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('account.search')} /></div>
      </div>

      <div className="kpi-grid" aria-label={t('account.title')}>
        <article className="kpi-card"><span>{t('account.title')}</span><strong>{rows.length}</strong></article>
        <article className="kpi-card"><span>{t('account.approved')}</span><strong>{approved}</strong></article>
        <article className="kpi-card"><span>{t('account.integration')}</span><strong>{requesting}</strong></article>
        <article className="kpi-card"><span>{t('account.notApproved')}</span><strong>{pending}</strong></article>
      </div>

      {message&&<p className="notice info">{message}</p>}
      {query.isError && <p className="notice warning">{t('account.apiPending')}</p>}
      <div className="data-card">
        <div className="data-card-header"><div><strong>{t('account.title')}</strong><small>{rows.length}</small></div></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{t('account.name')}</th><th>{t('account.businessNo')}</th><th>{t('common.status')}</th><th>{t('account.erpCode')}</th><th>{t('account.erpApproved')}</th><th>{t('account.integration')}</th>{erpEnabled&&<th>{t('account.erpRegistration')}</th>}</tr></thead>
            <tbody>
              {query.isLoading && <tr><td colSpan={erpEnabled?7:6}>{t('common.loading')}</td></tr>}
              {!query.isLoading&&rows.length===0&&<tr><td colSpan={erpEnabled?7:6}>{t('common.noData')}</td></tr>}
              {rows.map(x => <tr key={x.public_id}>
                <td><strong>{x.account_name}</strong></td><td>{x.business_no ?? '-'}</td><td><span className="status-pill">{x.account_status}</span></td>
                <td>{x.erp_customer_code ?? '-'}</td><td><span className={`status-pill ${x.erp_approved_yn?'success':'neutral'}`}>{x.erp_approved_yn ? t('account.approved') : t('account.notApproved')}</span></td><td>{x.integration_status}</td>
                {erpEnabled&&<td><button disabled={x.integration_status==='REQUESTING'||x.erp_approved_yn} onClick={()=>requestErp(x.public_id)}>{t('account.request')}</button></td>}
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
