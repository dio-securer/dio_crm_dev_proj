import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountSummary, ActivityCalendarItem, ActivityMapHospital, LeadSummary } from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from '../../../api';

const card: React.CSSProperties = { border: '1px solid #dfe4ea', borderRadius: 12, padding: 16, background: '#fff' };

function localDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function currentPosition(): Promise<{ latitude: number; longitude: number; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyM: position.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export function GlobalActivityPage() {
  const qc = useQueryClient();
  const today = localDate();
  const [mode, setMode] = useState<'MAP' | 'LOG'>('MAP');
  const [relatedType, setRelatedType] = useState<'LEAD' | 'ACCOUNT'>('LEAD');
  const [relatedPublicId, setRelatedPublicId] = useState('');
  const [plannedAt, setPlannedAt] = useState(`${today}T09:00`);
  const [visitPurpose, setVisitPurpose] = useState('');
  const [search, setSearch] = useState('');
  const [mapRows, setMapRows] = useState<ActivityMapHospital[]>([]);
  const [message, setMessage] = useState('');

  const calendar = useQuery({
    queryKey: ['global-activity-calendar', today],
    queryFn: () => apiGet<ActivityCalendarItem[]>(`/api/activities/calendar?from=${today}&to=${today}`)
  });
  const leads = useQuery({ queryKey: ['global-activity-leads'], queryFn: () => apiGet<LeadSummary[]>('/api/leads') });
  const accounts = useQuery({ queryKey: ['global-activity-accounts'], queryFn: () => apiGet<AccountSummary[]>('/api/accounts?scope=managed') });

  const targets = useMemo(() => {
    const source = relatedType === 'LEAD'
      ? (leads.data ?? []).map(row => ({ id: row.public_id, name: row.hospital_name, address: row.address ?? '' }))
      : (accounts.data ?? []).map(row => ({ id: row.public_id, name: row.account_name, address: row.hospital_address || row.address || '' }));
    const q = search.trim().toLowerCase();
    return source.filter(row => !q || `${row.name} ${row.address}`.toLowerCase().includes(q)).slice(0, 100);
  }, [relatedType, leads.data, accounts.data, search]);

  async function loadMap() {
    try {
      const gps = await currentPosition();
      const result = await apiGet<{ nearbyHospitals: ActivityMapHospital[] }>(
        `/api/activities/map/today?date=${today}&latitude=${gps.latitude}&longitude=${gps.longitude}&radiusKm=10`
      );
      setMapRows(result.nearbyHospitals ?? []);
      setMessage(`Nearby hospitals loaded: ${result.nearbyHospitals?.length ?? 0}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPost('/api/activities/plans', {
        relatedType,
        relatedPublicId,
        plannedAt,
        visitPurpose: visitPurpose.trim() || undefined
      });
      setMessage('Activity plan created. Direct work/direct leave is not used in the GLOBAL activity baseline.');
      await qc.invalidateQueries({ queryKey: ['global-activity-calendar'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function check(action: 'check-in' | 'check-out', publicId: string) {
    try {
      const gps = await currentPosition();
      await apiPost(`/api/activities/${publicId}/${action}`, gps);
      setMessage(action === 'check-in' ? 'IN completed.' : 'OUT completed.');
      await qc.invalidateQueries({ queryKey: ['global-activity-calendar'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function editConsultation(publicId: string) {
    const text = window.prompt('Consultation content');
    if (text == null) return;
    try {
      await apiPatch(`/api/activities/${publicId}`, { consultationContent: text });
      setMessage('Consultation content saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function chooseMapTarget(row: ActivityMapHospital) {
    setRelatedType(row.related_type);
    setRelatedPublicId(row.public_id);
    setMode('LOG');
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <span className="page-kicker">GLOBAL · ACTIVITY</span>
          <h2>Sales Activity</h2>
          <small>Activity Plan → Map or Activity Log → GPS IN/OUT → Activity Report → Approval</small>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className={mode === 'MAP' ? 'button-primary' : ''} onClick={() => setMode('MAP')}>Sales Activity Map</button>
        <button type="button" className={mode === 'LOG' ? 'button-primary' : ''} onClick={() => setMode('LOG')}>Sales Activity Log</button>
      </div>

      {mode === 'MAP' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div><h3>Today / Nearby hospitals</h3><p style={{ color: '#667085' }}>Uses current device location. Select a marker-equivalent row to continue registration.</p></div>
              <button type="button" onClick={() => void loadMap()}>Load nearby</button>
            </div>
            {mapRows.map(row => (
              <button key={`${row.related_type}-${row.public_id}`} type="button" onClick={() => chooseMapTarget(row)} style={{ width: '100%', textAlign: 'left', padding: 10, marginBottom: 6 }}>
                <strong>{row.name}</strong> · {row.related_type} · {row.distance_m}m<br/><small>{row.address || '-'}</small>
              </button>
            ))}
            {!mapRows.length && <p>No map results loaded.</p>}
          </section>
        </div>
      )}

      {mode === 'LOG' && (
        <section style={card}>
          <h3>Activity Plan / Search registration</h3>
          <form onSubmit={event => void createPlan(event)} style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <select value={relatedType} onChange={event => { setRelatedType(event.target.value as 'LEAD' | 'ACCOUNT'); setRelatedPublicId(''); }}>
                <option value="LEAD">Lead</option><option value="ACCOUNT">Account</option>
              </select>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Lead / Account (max 100 results)" style={{ minWidth: 280 }} />
              <select required value={relatedPublicId} onChange={event => setRelatedPublicId(event.target.value)} style={{ minWidth: 300 }}>
                <option value="">Select target</option>
                {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input type="datetime-local" required value={plannedAt} onChange={event => setPlannedAt(event.target.value)} />
              <input value={visitPurpose} onChange={event => setVisitPurpose(event.target.value)} placeholder="Visit purpose" style={{ minWidth: 280 }} />
              <button type="submit" className="button-primary">Save Activity Plan</button>
            </div>
          </form>
          <p style={{ color: '#667085' }}>GLOBAL baseline intentionally omits Direct Work / Direct Leave.</p>
        </section>
      )}

      <section style={{ ...card, marginTop: 16 }}>
        <h3>Today's activities</h3>
        {(calendar.data ?? []).map(activity => (
          <div key={activity.activity_public_id} style={{ padding: '10px 0', borderBottom: '1px solid #eef1f5' }}>
            <strong>{activity.related_name_snapshot}</strong> · {activity.status}<br/>
            <small>{new Date(activity.start_at).toLocaleString()} · {activity.visit_purpose || '-'}</small>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {activity.status === 'PLANNED' && <button type="button" onClick={() => void check('check-in', activity.activity_public_id)}>IN</button>}
              {activity.status === 'IN_PROGRESS' && <><button type="button" onClick={() => void editConsultation(activity.activity_public_id)}>Consultation</button><button type="button" onClick={() => void check('check-out', activity.activity_public_id)}>OUT</button></>}
            </div>
          </div>
        ))}
        {!calendar.isLoading && !(calendar.data ?? []).length && <p>No activity scheduled for today.</p>}
      </section>
      {message && <p className="notice info">{message}</p>}
    </section>
  );
}
