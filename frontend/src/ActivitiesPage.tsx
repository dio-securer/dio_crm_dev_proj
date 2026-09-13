import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ActivityCalendarItem, AccountSummary, LeadSummary } from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from './api';
import { useGlobalization } from './market/globalization-context';

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
  const { t } = useTranslation();
  const { featureEnabled } = useGlobalization();
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
  const directEnabled = featureEnabled('DIRECT_WORK');
  const gpsEnabled = featureEnabled('GPS_CHECKIN');

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
    e.preventDefault(); setMessage('');
    try {
      await apiPost('/api/activities/plans', {
        relatedType, relatedPublicId, plannedAt, visitPurpose: visitPurpose || undefined,
        directWorkType: directEnabled ? (directWorkType || undefined) : undefined,
        directWorkReason: directEnabled ? (directWorkReason || undefined) : undefined
      });
      setMessage(t('activity.planCreated'));
      await qc.invalidateQueries({ queryKey: ['activity-calendar'] });
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  async function check(action: 'check-in'|'check-out', publicId: string) {
    setMessage(t('activity.gpsChecking'));
    try {
      const gps = await position();
      const r = await apiPost<any>(`/api/activities/${publicId}/${action}`, gps);
      setMessage(action === 'check-in' ? `${t('activity.checkIn')} · ${r.distanceM ?? '-'}m` : t('activity.checkOut'));
      await qc.invalidateQueries({ queryKey: ['activity-calendar'] });
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  async function updateConsultation(publicId: string) {
    const text = window.prompt(t('activity.consultationPrompt'));
    if (text == null) return;
    try { await apiPatch(`/api/activities/${publicId}`, { consultationContent: text }); setMessage(t('activity.consultationSaved')); }
    catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  async function loadMap() {
    setMessage(t('activity.gpsChecking'));
    try {
      const gps = await position();
      const r = await apiGet<any>(`/api/activities/map/today?date=${today}&latitude=${gps.latitude}&longitude=${gps.longitude}&radiusKm=10`);
      setMapResult(r); setMessage(t('activity.nearbyLoaded',{count:r.nearbyHospitals?.length ?? 0}));
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <section style={box}>
      <h2>{t('activity.title')}</h2>
      <form onSubmit={createPlan} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <label>{t('activity.target')}<br/><select style={input} value={relatedType} onChange={e => { setRelatedType(e.target.value as 'LEAD'|'ACCOUNT'); setRelatedPublicId(''); }}><option value="LEAD">Lead</option><option value="ACCOUNT">Account</option></select></label>
        <label>{t('activity.hospital')}<br/><select style={{ ...input, minWidth: 240 }} required value={relatedPublicId} onChange={e => setRelatedPublicId(e.target.value)}><option value="">{t('common.selectNone')}</option>{targets.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>{t('activity.schedule')}<br/><input style={input} type="datetime-local" required value={plannedAt} onChange={e => setPlannedAt(e.target.value)} /></label>
        <label>{t('activity.purpose')}<br/><input style={input} value={visitPurpose} onChange={e => setVisitPurpose(e.target.value)} /></label>
        {directEnabled&&<><label>{t('activity.direct')}<br/><select style={input} value={directWorkType} onChange={e => setDirectWorkType(e.target.value)}><option value="">{t('activity.none')}</option><option value="DIRECT_WORK">{t('activity.directWork')}</option><option value="DIRECT_LEAVE">{t('activity.directLeave')}</option></select></label>{directWorkType&&<label>{t('activity.reason')}<br/><input style={input} required value={directWorkReason} onChange={e=>setDirectWorkReason(e.target.value)}/></label>}</>}
        <button type="submit" style={input}>{t('activity.register')}</button>
      </form>
      <p style={{ color: '#667085', fontSize: 13 }}>{t('activity.eventHint')}</p>
    </section>
    <section style={box}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}><h2>{t('activity.today')}</h2><button onClick={loadMap}>{t('activity.nearby')}</button></div>
      {calendar.isLoading&&<p>{t('common.loading')}</p>}
      {(calendar.data??[]).map(a=><div key={a.activity_public_id} style={{padding:'12px 0',borderBottom:'1px solid #eef1f5'}}><b>{a.related_name_snapshot}</b> · {t(`status.${a.status}`,{defaultValue:a.status})}<br/><small>{new Date(a.start_at).toLocaleString()} · {a.visit_purpose||'-'}</small><div style={{marginTop:8,display:'flex',gap:8}}>{gpsEnabled&&a.status==='PLANNED'&&<button onClick={()=>check('check-in',a.activity_public_id)}>{t('activity.checkIn')}</button>}{a.status==='IN_PROGRESS'&&<><button onClick={()=>updateConsultation(a.activity_public_id)}>{t('activity.consultation')}</button><button onClick={()=>check('check-out',a.activity_public_id)}>{t('activity.checkOut')}</button></>}</div></div>)}
      {!calendar.isLoading&&!(calendar.data??[]).length&&<p>{t('activity.noToday')}</p>}
    </section>
    {mapResult&&<section style={box}><h2>{t('activity.mapTitle')}</h2><p style={{color:'#667085'}}>{t('activity.mapHint')}</p>{(mapResult.nearbyHospitals??[]).slice(0,30).map((h:any)=><div key={`${h.related_type}-${h.public_id}`} style={{padding:'7px 0',borderBottom:'1px solid #eef1f5'}}>{h.name} · {h.related_type} · <b>{h.distance_m}m</b> <span style={{color:'#667085'}}>{h.address}</span></div>)}</section>}
    {message&&<div style={{...box,background:'#f8fafc'}}>{message}</div>}
  </div>;
}
