import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from './api';

const box: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 12, padding: 16, background: '#fff' };

export function DirectWorkPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const items = useQuery({ queryKey: ['direct-work'], queryFn: () => apiGet<any[]>('/api/direct-work') });

  async function request(publicId: string) {
    try { await apiPost(`/api/direct-work/${publicId}/request-approval`); setMessage(t('directWork.requestDone')); await qc.invalidateQueries({ queryKey: ['direct-work'] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function decide(publicId: string, step: 'branch'|'division', action: 'APPROVE'|'REJECT') {
    const comment = action === 'REJECT' ? window.prompt(t('directWork.rejectReason')) ?? undefined : undefined;
    if (action === 'REJECT' && !comment) return;
    const actor = step === 'branch' ? t('report.branchApprove') : t('report.divisionApprove');
    const actionLabel = action === 'APPROVE' ? t('common.approve') : t('common.reject');
    try {
      await apiPost(`/api/direct-work/${publicId}/decision/${step}`, { action, comment });
      setMessage(t('directWork.decisionDone',{actor,action:actionLabel}));
      await qc.invalidateQueries({ queryKey: ['direct-work'] });
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={box}>
      <h2>{t('directWork.title')}</h2>
      <p style={{ color: '#667085' }}>{t('directWork.subtitle')}</p>
      {(items.data ?? []).map(d => <div key={d.public_id} style={{ padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
        <b>{d.related_name_snapshot}</b> · {d.work_type} · <b>{t(`status.${d.status}`,{defaultValue:d.status})}</b><br/>
        <small>{d.reason} · {t('directWork.activity')} {t(`status.${d.activity_status}`,{defaultValue:d.activity_status})} · {t('directWork.erp')} {d.erp_sync_status}</small>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          {['DRAFT','BRANCH_REJECTED','DIVISION_REJECTED'].includes(d.status) && <button onClick={() => request(d.public_id)}>{t('directWork.request')}</button>}
          {d.status === 'REQUESTED' && <><button onClick={() => decide(d.public_id,'branch','APPROVE')}>{t('directWork.branchApprove')}</button><button onClick={() => decide(d.public_id,'branch','REJECT')}>{t('directWork.branchReject')}</button></>}
          {d.status === 'BRANCH_APPROVED' && <><button onClick={() => decide(d.public_id,'division','APPROVE')}>{t('directWork.divisionApprove')}</button><button onClick={() => decide(d.public_id,'division','REJECT')}>{t('directWork.divisionReject')}</button></>}
        </div>
      </div>)}
      {!items.isLoading && !(items.data ?? []).length && <p>{t('directWork.empty')}</p>}
    </section>
    {message && <div style={{ ...box, background: '#f8fafc' }}>{message}</div>}
  </div>;
}
