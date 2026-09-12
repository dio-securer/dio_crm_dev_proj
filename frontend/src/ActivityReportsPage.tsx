import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const qc = useQueryClient();
  const [date, setDate] = useState(localDate());
  const [draft, setDraft] = useState<any>(null);
  const [message, setMessage] = useState('');
  const reports = useQuery({ queryKey: ['activity-reports'], queryFn: () => apiGet<any[]>('/api/activity-reports') });

  async function prepare() {
    try {
      const r = await apiPost<any>('/api/activity-reports/prepare', { reportDate: date });
      setDraft(r); setMessage('활동보고를 준비했습니다.');
      await qc.invalidateQueries({ queryKey: ['activity-reports'] });
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function requestApproval(publicId: string) {
    try { await apiPost(`/api/activity-reports/${publicId}/request-approval`); setMessage('승인요청 완료'); await qc.invalidateQueries({ queryKey: ['activity-reports'] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function approve(publicId: string, step: 'branch'|'division') {
    try { await apiPost(`/api/activity-reports/${publicId}/approve/${step}`, {}); setMessage(`${step === 'branch' ? '지점장' : '본부장'} 승인 완료`); await qc.invalidateQueries({ queryKey: ['activity-reports'] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function editItem(publicId: string, itemId: number, current: string | null) {
    const text = window.prompt('상담내용 수정', current ?? '');
    if (text == null) return;
    try { await apiPatch(`/api/activity-reports/${publicId}/items/${itemId}`, { consultationContent: text }); setMessage('보고 항목 저장'); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={box}>
      <h2>활동보고 작성</h2>
      <div style={{ display: 'flex', gap: 8 }}><input type="date" value={date} onChange={e => setDate(e.target.value)} /><button onClick={prepare}>보고 준비</button></div>
      <p style={{ color: '#667085' }}>선택일 완료 활동 + 이후 5일 활동계획을 구성합니다. 승인요청 시점 이후 생성된 활동은 해당 보고에 자동 추가되지 않습니다.</p>
      {draft && <div>
        <h3>{draft.report_date} · {draft.status}</h3>
        {(draft.items ?? []).map((i: any) => <div key={i.report_item_id} style={{ padding: '8px 0', borderBottom: '1px solid #eef1f5' }}>
          <b>{i.item_type}</b> · {i.related_name_snapshot} · {i.visit_purpose_snapshot || '-'}<br/>
          <small>{i.consultation_snapshot || '상담내용 없음'}</small>{['DRAFT','REQUESTED'].includes(draft.status) && <button style={{ marginLeft: 8 }} onClick={() => editItem(draft.public_id, i.report_item_id, i.consultation_snapshot)}>수정</button>}
        </div>)}
        {draft.status === 'DRAFT' && <button style={{ marginTop: 10 }} onClick={() => requestApproval(draft.public_id)}>승인요청</button>}
      </div>}
    </section>

    <section style={box}>
      <h2>활동보고 / 승인대기</h2>
      {(reports.data ?? []).map(r => <div key={r.public_id} style={{ padding: '10px 0', borderBottom: '1px solid #eef1f5' }}>
        <b>{r.report_date}</b> · {r.status}
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          {r.status === 'DRAFT' && <button onClick={() => requestApproval(r.public_id)}>승인요청</button>}
          {r.status === 'REQUESTED' && <button onClick={() => approve(r.public_id, 'branch')}>지점장 승인</button>}
          {r.status === 'BRANCH_APPROVED' && <button onClick={() => approve(r.public_id, 'division')}>본부장 승인</button>}
        </div>
      </div>)}
    </section>
    {message && <div style={{ ...box, background: '#f8fafc' }}>{message}</div>}
  </div>;
}
