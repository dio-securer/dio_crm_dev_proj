import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LeadSummary } from '@dio-crm/contracts';
import { apiGet } from './api';

export function LeadsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['leads', search],
    queryFn: () => apiGet<LeadSummary[]>(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });
  const rows = query.data ?? [];
  const converted = rows.filter(x => x.status === 'CONVERTED').length;
  const excluded = rows.filter(x => x.status === 'CONTACT_EXCLUDED').length;
  const active = Math.max(0, rows.length - converted - excluded);

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div><span className="page-kicker">CRM · LEAD</span><h2>{t('lead.title')}</h2><small>{t('lead.subtitle')}</small></div>
        <div className="page-actions"><input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('lead.search')} /></div>
      </div>

      <div className="kpi-grid" aria-label={t('lead.title')}>
        <article className="kpi-card"><span>{t('lead.title')}</span><strong>{rows.length}</strong></article>
        <article className="kpi-card"><span>{t('status.IN_PROGRESS')}</span><strong>{active}</strong></article>
        <article className="kpi-card"><span>{t('status.CONVERTED')}</span><strong>{converted}</strong></article>
        <article className="kpi-card"><span>{t('status.CONTACT_EXCLUDED')}</span><strong>{excluded}</strong></article>
      </div>

      {query.isError && <p className="notice warning">{t('lead.apiPending')}</p>}
      <div className="data-card">
        <div className="data-card-header"><div><strong>{t('lead.title')}</strong><small>{rows.length}</small></div></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{t('lead.hospital')}</th><th>{t('common.status')}</th><th>{t('lead.owner')}</th><th>{t('lead.region')}</th><th>{t('lead.phone')}</th><th>{t('lead.businessNo')}</th></tr></thead>
            <tbody>
              {query.isLoading && <tr><td colSpan={6}>{t('common.loading')}</td></tr>}
              {!query.isLoading && rows.length === 0 && <tr><td colSpan={6}>{t('common.noData')}</td></tr>}
              {rows.map(x => <tr key={x.public_id}>
                <td><strong>{x.hospital_name}</strong></td><td><span className="status-pill">{t(`status.${x.status}`, { defaultValue: x.status })}</span></td><td>{x.owner_name ?? '-'}</td>
                <td>{[x.sido, x.sigungu].filter(Boolean).join(' ') || '-'}</td><td>{x.phone ?? '-'}</td><td>{x.business_no ?? '-'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
