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
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h2 style={{ marginBottom: 4 }}>{t('lead.title')}</h2><small>{t('lead.subtitle')}</small></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('lead.search')} style={{ padding: 9, minWidth: 260 }} />
      </div>
      {query.isError && <p style={{ background: '#fff4e5', padding: 12 }}>{t('lead.apiPending')}</p>}
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead><tr><th>{t('lead.hospital')}</th><th>{t('common.status')}</th><th>{t('lead.owner')}</th><th>{t('lead.region')}</th><th>{t('lead.phone')}</th><th>{t('lead.businessNo')}</th></tr></thead>
          <tbody>{(query.data ?? []).map(x => <tr key={x.public_id}>
            <td>{x.hospital_name}</td><td>{t(`status.${x.status}`, { defaultValue: x.status })}</td><td>{x.owner_name ?? '-'}</td>
            <td>{[x.sido, x.sigungu].filter(Boolean).join(' ')}</td><td>{x.phone ?? '-'}</td><td>{x.business_no ?? '-'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
