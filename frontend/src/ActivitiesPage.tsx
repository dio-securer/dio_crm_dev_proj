import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActivityCalendarItem, AccountSummary, LeadSummary } from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from './api';

const box: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 12, padding: 16, background: '#fff' };
const input: React.CSSProperties = { padding: '8px 10px', border: '1px solid #ccd3dd', borderRadius: 8, minWidth: 160 };

function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function position(): Promise<{ latitude: number; longitude: number; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export function ActivitiesPage() {
  const qc = useQueryClient();
  const today = localDate();
  const [relatedType, setRelatedType] = useState<'LEAD'|'ACCOUNT'>('LEAD');
  const [relatedPublicId, setRelatedPublicId] = useState('');
  const [plannedAt, setPlannedAt] = useState(`${today}T09:00`);
  const [visitPurpose, setVisitPurpose] = useState('');
  const [directWorkType, setDirectWorkType] = useState('');
  const [directWorkReason, setDirectWorkReason] = useState('');
  const [message, setMessage] = useState('');
  const [mapResult, setMapResult] = useState<any>(null);

  const calendar = useQuery({
    queryKey: ['activity-calendar', today],
    queryFn: () => apiGet<ActivityCalendarItem[]>(`/api/activities/calendar?from=${today}&to=${today}`)
  });
  const leads = useQuery({ queryKey: ['activity-leads'], queryFn: () => apiGet<LeadSummary[]>('/api/leads') });
  const accounts = useQuery({ queryKey: ['activity-accounts'], queryFn: () => apiGet<AccountSummary[]>('/api/accounts') });

  const targets = useMemo(() => relatedType === 'LEAD'
    ? (leads.data ?? []).map(x => ({ id: x.public_id, name: x.hospital_name }))
    : (accounts.data ?? []).map(x => ({ id: x.public_id, name: x.account_name })), [relatedType, leads.data, accounts.data]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      await apiPost('/api/activities/plans', {
        relatedType, relatedPublicId, plannedAt, visitPurpose: visitPurpose || undefined,
        directWorkType: directWorkType || undefined,
        directWorkReason: directWorkReason || undefined
      });
      setMessage('활동계획이 등록되었습니다.');
      await qc.invalidateQueries({ queryKey: ['activity-calendar'] });
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  async function check(action: 'check-in'|'check-out', publicId: string) {
    setMessage('위치 확인 중...');
    try {
      const gps = await position();
      const r = await apiPost<any>(`/api/activities/${publicId}/${action}`, gps);
      setMessage(action === 'check-in' ? `IN 완료 · 병원과 약 ${r.distanceM ?? '-'}m` : 'OUT 완료');
      await qc.invalidateQueries({ queryKey: ['activity-calendar'] });
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  async function updateConsultation(publicId: string) {
    const text = window.prompt('상담내용을 입력하세요.');
    if (text == null) return;
    try {
      await apiPatch(`/api/activities/${publicId}`, { consultationContent: text });
      setMessage('상담내용을 저장했습니다.');
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  async function loadMap() {
    setMessage('현재 위치 확인 중...');
    try {
      const gps = await position();
      const r = await apiGet<any>(`/api/activities/map/today?date=${today}&latitude=${gps.latitude}&longitude=${gps.longitude}&radiusKm=10`);
      setMapResult(r);
      setMessage(`주변 병원 ${r.nearbyHospitals?.length ?? 0}건을 조회했습니다.`);
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={box}>
      <h2>활동계획</h2>
      <form onSubmit={createPlan} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <label>대상<br/><select style={input} value={relatedType} onChange={e => { setRelatedType(e.target.value as 'LEAD'|'ACCOUNT'); setRelatedPublicId(''); }}>
          <option value="LEAD">Lead</option><option value="ACCOUNT">Account</option>
        </select></label>
        <label>병원<br/><select style={{ ...input, minWidth: 240 }} required value={relatedPublicId} onChange={e => setRelatedPublicId(e.target.value)}>
          <option value="">선택</option>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        <label>방문일정<br/><input style={input} type="datetime-local" required value={plannedAt} onChange={e => setPlannedAt(e.target.value)} /></label>
        <label>방문목적<br/><input style={input} value={visitPurpose} onChange={e => setVisitPurpose(e.target.value)} /></label>
        <label>직출/직퇴<br/><select style={input} value={directWorkType} onChange={e => setDirectWorkType(e.target.value)}>
          <option value="">없음</option><option value="DIRECT_WORK">직출</option><option value="DIRECT_LEAVE">직퇴</option>
        </select></label>
        {directWorkType && <label>사유<br/><input style={input} required value={directWorkReason} onChange={e => setDirectWorkReason(e.target.value)} /></label>}
        <button type="submit" style={input}>등록</button>
      </form>
      <p style={{ color: '#667085', fontSize: 13 }}>Event 종료시간은 방문일정 + 1시간으로 자동 생성됩니다. 동일 대상/동일 일자 중복계획은 차단됩니다.</p>
    </section>

    <section style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><h2>오늘 활동</h2><button onClick={loadMap}>주변 병원 조회</button></div>
      {calendar.isLoading && <p>불러오는 중...</p>}
      {(calendar.data ?? []).map(a => <div key={a.activity_public_id} style={{ padding: '12px 0', borderBottom: '1px solid #eef1f5' }}>
        <b>{a.related_name_snapshot}</b> <span style={{ color: '#667085' }}>· {a.status}</span><br/>
        <small>{new Date(a.start_at).toLocaleString()} · {a.visit_purpose || '방문목적 미입력'}</small>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          {a.status === 'PLANNED' && <button onClick={() => check('check-in', a.activity_public_id)}>GPS IN</button>}
          {a.status === 'IN_PROGRESS' && <><button onClick={() => updateConsultation(a.activity_public_id)}>상담정보</button><button onClick={() => check('check-out', a.activity_public_id)}>OUT</button></>}
          {a.direct_work_type && <span>직출/직퇴: {a.direct_work_type} / {a.direct_work_status}</span>}
        </div>
      </div>)}
      {!calendar.isLoading && !(calendar.data ?? []).length && <p>오늘 활동계획이 없습니다.</p>}
    </section>

    {mapResult && <section style={box}>
      <h2>지도 데이터 — 반경 10km</h2>
      <p style={{ color: '#667085' }}>실제 지도 Provider 연결 전 Baseline입니다. GPS 거리순으로 병원을 표시합니다.</p>
      {(mapResult.nearbyHospitals ?? []).slice(0, 30).map((h: any) => <div key={`${h.related_type}-${h.public_id}`} style={{ padding: '7px 0', borderBottom: '1px solid #eef1f5' }}>
        {h.name} · {h.related_type} · <b>{h.distance_m}m</b> <span style={{ color: '#667085' }}>{h.address}</span>
      </div>)}
    </section>}

    {message && <div style={{ ...box, background: '#f8fafc' }}>{message}</div>}
  </div>;
}
