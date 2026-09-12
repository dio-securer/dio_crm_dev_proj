import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './api';

const box: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 12, padding: 16, background: '#fff' };

export function DirectWorkPage() {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const items = useQuery({ queryKey: ['direct-work'], queryFn: () => apiGet<any[]>('/api/direct-work') });

  async function request(publicId: string) {
    try { await apiPost(`/api/direct-work/${publicId}/request-approval`); setMessage('직출/직퇴 승인요청 완료'); await qc.invalidateQueries({ queryKey: ['direct-work'] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }
  async function decide(publicId: string, step: 'branch'|'division', action: 'APPROVE'|'REJECT') {
    const comment = action === 'REJECT' ? window.prompt('반려 사유') ?? undefined : undefined;
    if (action === 'REJECT' && !comment) return;
    try {
      await apiPost(`/api/direct-work/${publicId}/decision/${step}`, { action, comment });
      setMessage(`${step === 'branch' ? '지점장' : '본부장'} ${action === 'APPROVE' ? '승인' : '반려'} 완료`);
      await qc.invalidateQueries({ queryKey: ['direct-work'] });
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={box}>
      <h2>직출 / 직퇴 관리</h2>
      <p style={{ color: '#667085' }}>활동계획에서 직출/직퇴를 선택한 건이 표시됩니다. 승인 경로는 영업담당자 → 지점장 → 본부장입니다.</p>
      {(items.data ?? []).map(d => <div key={d.public_id} style={{ padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
        <b>{d.related_name_snapshot}</b> · {d.work_type} · <b>{d.status}</b><br/>
        <small>{d.reason} · 활동 {d.activity_status} · ERP {d.erp_sync_status}</small>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          {['DRAFT','BRANCH_REJECTED','DIVISION_REJECTED'].includes(d.status) && <button onClick={() => request(d.public_id)}>승인요청/재요청</button>}
          {d.status === 'REQUESTED' && <><button onClick={() => decide(d.public_id,'branch','APPROVE')}>지점장 승인</button><button onClick={() => decide(d.public_id,'branch','REJECT')}>지점장 반려</button></>}
          {d.status === 'BRANCH_APPROVED' && <><button onClick={() => decide(d.public_id,'division','APPROVE')}>본부장 승인</button><button onClick={() => decide(d.public_id,'division','REJECT')}>본부장 반려</button></>}
        </div>
      </div>)}
      {!items.isLoading && !(items.data ?? []).length && <p>직출/직퇴 건이 없습니다.</p>}
    </section>
    {message && <div style={{ ...box, background: '#f8fafc' }}>{message}</div>}
  </div>;
}
