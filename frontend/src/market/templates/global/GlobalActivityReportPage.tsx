import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '../../../api';

const card: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 12, padding: 16, background: '#fff' };

function localDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function GlobalActivityReportPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(localDate());
  const [draft, setDraft] = useState<any>(null);
  const [message, setMessage] = useState('');
  const reports = useQuery({ queryKey: ['global-activity-reports'], queryFn: () => apiGet<any[]>('/api/activity-reports') });

  async function prepare() {
    try {
      const result = await apiPost<any>('/api/activity-reports/prepare', { reportDate: date });
      setDraft(result);
      setMessage('Activity report prepared. Completed activities and the next five days of plans are resolved by the report service.');
      await qc.invalidateQueries({ queryKey: ['global-activity-reports'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function editItem(publicId: string, itemId: number, current: string | null) {
    const text = window.prompt('Consultation content', current ?? '');
    if (text == null) return;
    try {
      await apiPatch(`/api/activity-reports/${publicId}/items/${itemId}`, { consultationContent: text });
      setMessage('Report item updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function requestApproval(publicId: string) {
    try {
      await apiPost(`/api/activity-reports/${publicId}/request-approval`);
      setMessage('Approval requested. A report with any activity missing OUT cannot be submitted.');
      await qc.invalidateQueries({ queryKey: ['global-activity-reports'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <span className="page-kicker">GLOBAL · ACTIVITY</span>
          <h2>Activity Report</h2>
          <small>Completed activities + next 5 days plan → edit consultation → request approval</small>
        </div>
      </div>

      <section style={card}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
          <button type="button" className="button-primary" onClick={() => void prepare()}>Prepare report</button>
        </div>
        <p style={{ color: '#667085' }}>Approval actor/organization for GLOBAL is intentionally not hard-coded in M7. M5 records it as an unresolved workflow GAP.</p>
      </section>

      {draft && (
        <section style={{ ...card, marginTop: 16 }}>
          <h3>{draft.report_date} · {draft.status}</h3>
          {(draft.items ?? []).map((item: any) => (
            <div key={item.report_item_id} style={{ padding: '9px 0', borderBottom: '1px solid #eef1f5' }}>
              <strong>{item.item_type}</strong> · {item.related_name_snapshot} · {item.visit_purpose_snapshot || '-'}<br/>
              <small>{item.consultation_snapshot || 'No consultation content'}</small>
              {['DRAFT', 'REQUESTED'].includes(draft.status) && <button type="button" style={{ marginLeft: 8 }} onClick={() => void editItem(draft.public_id, item.report_item_id, item.consultation_snapshot)}>Edit</button>}
            </div>
          ))}
          {draft.status === 'DRAFT' && <button type="button" className="button-primary" style={{ marginTop: 10 }} onClick={() => void requestApproval(draft.public_id)}>Request approval</button>}
        </section>
      )}

      <section style={{ ...card, marginTop: 16 }}>
        <h3>Report status</h3>
        {(reports.data ?? []).map(report => (
          <div key={report.public_id} style={{ padding: '9px 0', borderBottom: '1px solid #eef1f5' }}>
            <strong>{report.report_date}</strong> · {report.status}
            {report.status === 'DRAFT' && <button type="button" style={{ marginLeft: 8 }} onClick={() => void requestApproval(report.public_id)}>Request approval</button>}
          </div>
        ))}
        {!reports.isLoading && !(reports.data ?? []).length && <p>No report data.</p>}
      </section>
      {message && <p className="notice info">{message}</p>}
    </section>
  );
}
