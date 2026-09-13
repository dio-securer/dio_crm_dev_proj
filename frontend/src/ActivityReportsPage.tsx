import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPatch, apiPost } from './api';

const box: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 12, padding: 16, background: '#fff' };
function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ActivityReportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [date, setDate] = useState(localDate());
  const [draft, setDraft] = useState<any>(null);
  const [message, setMessage] = useState('');
  const reports = useQuery({ queryKey: ['activity-reports'], queryFn: () => apiGet<any[]>('/api/activity-reports') });

  async function prepare() {
    try {
      const r = await apiPost<any>('/api/activity-reports/prepare', { reportDate: date });
      setDraft(r); setMessage(t('report.prepared'));
      await qc.invalidateQueries({ queryKey: ['activity-reports'] });
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function requestApproval(publicId: string) {
    try { await apiPost(`/api/activity-reports/${publicId}/request-approval`); setMessage(t('report.requestDone')); await qc.invalidateQueries({ queryKey: ['activity-reports'] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function approve(publicId: string, step: 'branch'|'division') {
    const actor = step === 'branch' ? t('report.branchApprove') : t('report.divisionApprove');
    try { await apiPost(`/api/activity-reports/${publicId}/approve/${step}`, {}); setMessage(t('report.approvalDone',{actor})); await qc.invalidateQueries({ queryKey: ['activity-reports'] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function editItem(publicId: string, itemId: number, current: string | null) {
    const text = window.prompt(t('report.editPrompt'), current ?? '');
    if (text == null) return;
    try { await apiPatch(`/api/activity-reports/${publicId}/items/${itemId}`, { consultationContent: text }); setMessage(t('report.itemSaved')); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={box}>
      <h2>{t('report.writeTitle')}</h2>
      <div style={{ display: 'flex', gap: 8 }}><input type="date" value={date} onChange={e => setDate(e.target.value)} /><button onClick={prepare}>{t('report.prepare')}</button></div>
      <p style={{ color: '#667085' }}>{t('report.hint')}</p>
      {draft && <div>
        <h3>{draft.report_date} · {t(`status.${draft.status}`,{defaultValue:draft.status})}</h3>
        {(draft.items ?? []).map((i: any) => <div key={i.report_item_id} style={{ padding: '8px 0', borderBottom: '1px solid #eef1f5' }}>
          <b>{i.item_type}</b> · {i.related_name_snapshot} · {i.visit_purpose_snapshot || '-'}<br/>
          <small>{i.consultation_snapshot || t('report.noConsultation')}</small>{['DRAFT','REQUESTED'].includes(draft.status) && <button style={{ marginLeft: 8 }} onClick={() => editItem(draft.public_id, i.report_item_id, i.consultation_snapshot)}>{t('report.edit')}</button>}
        </div>)}
        {draft.status === 'DRAFT' && <button style={{ marginTop: 10 }} onClick={() => requestApproval(draft.public_id)}>{t('report.request')}</button>}
      </div>}
    </section>

    <section style={box}>
      <h2>{t('report.queueTitle')}</h2>
      {(reports.data ?? []).map(r => <div key={r.public_id} style={{ padding: '10px 0', borderBottom: '1px solid #eef1f5' }}>
        <b>{r.report_date}</b> · {t(`status.${r.status}`,{defaultValue:r.status})}
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          {r.status === 'DRAFT' && <button onClick={() => requestApproval(r.public_id)}>{t('report.request')}</button>}
          {r.status === 'REQUESTED' && <button onClick={() => approve(r.public_id, 'branch')}>{t('report.branchApprove')}</button>}
          {r.status === 'BRANCH_APPROVED' && <button onClick={() => approve(r.public_id, 'division')}>{t('report.divisionApprove')}</button>}
        </div>
      </div>)}
    </section>
    {message && <div style={{ ...box, background: '#f8fafc' }}>{message}</div>}
  </div>;
}
