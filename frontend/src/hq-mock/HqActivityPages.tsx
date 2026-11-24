import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, ClipboardList, MapPin, Plus, ChevronLeft } from 'lucide-react';
import { WorkspaceHeading } from './WorkspaceHeading';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError, apiGet, apiPatch, apiPost } from '../api';
import { opportunityRequestKeys } from './opportunity-retry';
import { filterReports } from './report-filters';
import { useHqMock } from './HqMockProvider';
import { HqModal } from './customer-shared';
import { configAnchor } from './config-anchor';
import './hq-activity.css';

type Row = Record<string, any> & { public_id: string; status: string };
type Plan = { relatedType: 'LEAD' | 'ACCOUNT' | 'OPPORTUNITY'; relatedPublicId: string; plannedAt: string; visitPurpose: string; directWorkType: string; directWorkReason: string };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const initialPlan = (): Plan => ({ relatedType: 'ACCOUNT', relatedPublicId: '', plannedAt: `${today()}T09:00`, visitPurpose: '', directWorkType: '', directWorkReason: '' });
const errorText = (value: unknown) => value instanceof Error ? value.message : String(value);
const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleString() : '—';

function useActivityCommand(keys: string[][]) {
  const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const run = async <T,>(operation: () => Promise<T>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { const result = await operation(); setNotice(message); await Promise.all(keys.map(key => qc.invalidateQueries({ queryKey: key }))); return result; }
    catch (reason) { setError(errorText(reason)); throw reason; }
    finally { setBusy(false); }
  };
  return { run, busy, error, notice, setError };
}
function Feedback({ error, notice }: { error: string; notice: string }) {
  return <>{error && <p role="alert" className="hq-act-error">{error}</p>}{notice && <p role="status" className="hq-act-notice">{notice}</p>}</>;
}
function permission(list: string[] | undefined, name: string) { return Boolean(list?.includes(name)); }

export function HqActivitiesPage() {
  const [routeParams, setRouteParams] = useSearchParams();
  const linkedRecord = routeParams.get('record') ?? '';
  const { t } = useTranslation(); const { session } = useHqMock(); const perms = session?.user.permissions;
  const [screen, setScreen] = useState<'browse' | 'register' | 'detail'>('browse');
  const [view, setView] = useState<'list' | 'day' | 'month' | 'map'>('list'); const [day, setDay] = useState(today()); const [plan, setPlan] = useState(initialPlan);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('');
  const [bulk, setBulk] = useState<Plan[]>([initialPlan(), initialPlan()]); const [selectedId, setSelectedId] = useState('');
  useEffect(() => { if (linkedRecord) { setSelectedId(linkedRecord); setScreen('detail'); } }, [linkedRecord]);
  const [consultation, setConsultation] = useState(''); const [map, setMap] = useState<any>(null); const [gpsHint, setGpsHint] = useState('');
  const consultationBaseline = useRef('');
  const initializedActivity = useRef(''); const checkPending = useRef(false); const [checking, setChecking] = useState(false);
  const planBaseline = useRef(plan); const bulkBaseline = useRef(bulk);
  const month = day.slice(0, 7); const from = view === 'month' ? `${month}-01` : day;
  const to = view === 'month' ? `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}` : day;
  const key = ['hq-activity-calendar', session?.user.userId ?? 0, from, to];
  const calendar = useQuery({ queryKey: key, queryFn: () => apiGet<Row[]>(`/api/activities/calendar?from=${from}&to=${to}`), retry: false });
  const listParams = new URLSearchParams(); if (search.trim()) listParams.set('search', search.trim()); if (statusFilter) listParams.set('status', statusFilter);
  const activities = useQuery({ queryKey: ['hq-activities-list', session?.user.userId, search, statusFilter], queryFn: () => apiGet<Row[]>(`/api/activities?${listParams}`), retry: false });
  const selectedQuery = useQuery({ queryKey: ['hq-activity-detail', session?.user.userId, selectedId], queryFn: () => apiGet<Row>(`/api/activities/${selectedId}`), enabled: screen === 'detail' && Boolean(selectedId), retry: false });
  const leads = useQuery({ queryKey: ['hq-activity-leads', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/leads'), retry: false });
  const accounts = useQuery({ queryKey: ['hq-activity-accounts', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/accounts'), retry: false });
  const opportunities = useQuery({ queryKey: ['hq-activity-opportunities', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/opportunities'), retry: false });
  const selected = selectedQuery.isFetching || selectedQuery.isError ? undefined : selectedQuery.data;
  useEffect(() => { if (selected && initializedActivity.current !== selected.public_id) { initializedActivity.current = selected.public_id; consultationBaseline.current = String(selected.consultation_content ?? ''); setConsultation(consultationBaseline.current); } }, [selected]);
  const command = useActivityCommand([['hq-activity-calendar'], ['hq-activities-list'], ['hq-activity-detail'], ['hq-direct-work'], ['hq-reports']]);
  const openActivity = (row: Row) => { initializedActivity.current = ''; setSelectedId(row.public_id); consultationBaseline.current = String(row.consultation_content ?? ''); setConsultation(consultationBaseline.current); setScreen('detail'); };
  const backToList = () => {
    if (screen === 'detail' && consultation !== consultationBaseline.current && !window.confirm(t('hqActivity.discardConsultation'))) return;
    if (screen === 'register' && (JSON.stringify(plan) !== JSON.stringify(planBaseline.current) || JSON.stringify(bulk) !== JSON.stringify(bulkBaseline.current))) {
      if (!window.confirm(t('hqActivity.discardPlan'))) return;
      setPlan(planBaseline.current); setBulk(bulkBaseline.current);
    }
    setScreen('browse'); setSelectedId(''); if (linkedRecord) setRouteParams({}, { replace: true });
  };
  const targets = (type: Plan['relatedType']) => (type === 'LEAD' ? leads.data : type === 'ACCOUNT' ? accounts.data : opportunities.data) ?? [];
  const name = (row: Row) => row.hospital_name ?? row.account_name ?? row.opportunity_name ?? row.public_id;
  const target = (type: Plan['relatedType'], id: string) => targets(type).find(row => row.public_id === id);
  const updateBulk = (index: number, value: Plan) => setBulk(rows => rows.map((row, i) => i === index ? value : row));
  const planForm = (value: Plan, change: (next: Plan) => void) => <div className="hq-act-plan-fields">
    <label>{t('hqActivity.targetType')}<select value={value.relatedType} onChange={e => change({ ...value, relatedType: e.target.value as Plan['relatedType'], relatedPublicId: '' })}>
      <option value="ACCOUNT">{t('hqActivity.account')}</option><option value="LEAD">{t('hqActivity.lead')}</option><option value="OPPORTUNITY">{t('hqActivity.opportunity')}</option></select></label>
    <label><span>{t('hqActivity.target')}<span className="hq-act-required" aria-hidden="true">필수</span></span><select required value={value.relatedPublicId} onChange={e => change({ ...value, relatedPublicId: e.target.value })}>
      <option value="">{t('common.selectNone')}</option>{targets(value.relatedType).map(row => <option key={row.public_id} value={row.public_id}>{name(row)}</option>)}</select></label>
    <label><span>{t('hqActivity.plannedAt')}<span className="hq-act-required" aria-hidden="true">필수</span></span><input type="datetime-local" required value={value.plannedAt} onChange={e => change({ ...value, plannedAt: e.target.value })} /></label>
    <label>{t('hqActivity.purpose')}<input maxLength={500} value={value.visitPurpose} onChange={e => change({ ...value, visitPurpose: e.target.value })} /></label>
    <label>{t('hqActivity.directType')}<select value={value.directWorkType} onChange={e => change({ ...value, directWorkType: e.target.value, directWorkReason: '' })}>
      <option value="">{t('activity.none')}</option><option value="DIRECT_WORK">{t('activity.directWork')}</option><option value="DIRECT_LEAVE">{t('activity.directLeave')}</option></select></label>
    {value.directWorkType && <label><span>{t('hqActivity.reason')}<span className="hq-act-required" aria-hidden="true">필수</span></span><input required maxLength={500} value={value.directWorkReason} onChange={e => change({ ...value, directWorkReason: e.target.value })} /></label>}
  </div>;
  const payload = (value: Plan) => ({ ...value, directWorkType: value.directWorkType || undefined, directWorkReason: value.directWorkType ? value.directWorkReason : undefined });
  async function savePlan(e: React.FormEvent) { e.preventDefault(); try { await command.run(() => apiPost('/api/activities/plans', payload(plan)), t('hqActivity.planSaved')); setDay(plan.plannedAt.slice(0, 10)); planBaseline.current = initialPlan(); setPlan(planBaseline.current); setSearch(''); setStatusFilter(''); setScreen('browse'); setView('list'); } catch { /* feedback above */ } }
  async function saveBulk(e: React.FormEvent) { e.preventDefault(); try { await command.run(() => apiPost('/api/activities/plans/bulk', { plans: bulk.map(payload) }), t('hqActivity.bulkSaved')); setDay(bulk[0].plannedAt.slice(0, 10)); bulkBaseline.current = [initialPlan(), initialPlan()]; setBulk(bulkBaseline.current); setSearch(''); setStatusFilter(''); setScreen('browse'); setView('list'); } catch { /* feedback above */ } }
  async function locate(fallback?: Row) {
    if (!navigator.geolocation) { setGpsHint(t('hqActivity.gpsUnavailable')); if (fallback?.target_latitude != null) return { latitude: Number(fallback.target_latitude), longitude: Number(fallback.target_longitude), isMocked: true }; throw new Error(t('hqActivity.gpsUnavailable')); }
    try { const point = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, enableHighAccuracy: true })); setGpsHint(''); return { latitude: point.coords.latitude, longitude: point.coords.longitude, accuracyM: point.coords.accuracy }; }
    catch { setGpsHint(t('hqActivity.gpsDenied')); throw new Error(t('hqActivity.gpsDenied')); }
  }
  async function check(row: Row, action: 'check-in' | 'check-out', mocked = false) {
    if (action === 'check-out' && consultation !== consultationBaseline.current) { command.setError(t('hqActivity.saveBeforeOut')); return; }
    if (checkPending.current || command.busy) return;
    checkPending.current = true; setChecking(true);
    try { const gps = mocked ? { latitude: Number(row.target_latitude), longitude: Number(row.target_longitude), isMocked: true } : await locate(row);
      await command.run(() => apiPost(`/api/activities/${row.public_id}/${action}`, gps), action === 'check-in' ? t('hqActivity.checkedIn') : t('hqActivity.checkedOut')); }
    catch (error) { command.setError(errorText(error)); }
    finally { checkPending.current = false; setChecking(false); }
  }
  async function saveConsultation() { if (!selected) return; try { await command.run(() => apiPatch(`/api/activities/${selected.public_id}`, { consultationContent: consultation }), t('hqActivity.consultationSaved')); consultationBaseline.current = consultation; } catch { /* feedback above */ } }
  async function loadMap() { try { const gps = await locate(); const result = await apiGet<any>(`/api/activities/map/today?date=${day}&latitude=${gps.latitude}&longitude=${gps.longitude}`); setMap(result); }
    catch (error) { command.setError(errorText(error)); } }
  const byDay = useMemo(() => (calendar.data ?? []).reduce<Record<string, Row[]>>((groups, row) => {
    const key = String(row.planned_date); (groups[key] ??= []).push(row); return groups;
  }, {}), [calendar.data]);
  const monthDays = useMemo(() => Array.from({ length: Number(to.slice(-2)) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`), [month, to]);
  const mapPoints = useMemo(() => {
    if (!map) return [] as { id: string; x: number; y: number; name: string; own: boolean }[];
    const points = [{ public_id: 'me', latitude: map.userLocation.latitude, longitude: map.userLocation.longitude, name: t('hqActivity.currentLocation'), own: true },
      ...(map.nearbyHospitals ?? []).slice(0, 25).map((row: Row) => ({ ...row, own: false }))];
    const lats = points.map(row => Number(row.latitude)), lngs = points.map(row => Number(row.longitude));
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return points.map(row => ({ id: row.public_id, name: String(row.name), own: row.own,
      x: 25 + (Number(row.longitude) - minLng) / (maxLng - minLng || 1) * 350,
      y: 215 - (Number(row.latitude) - minLat) / (maxLat - minLat || 1) * 190 }));
  }, [map, t]);
  return <main className="hq-act-page hq-activity-primary">
    <header><WorkspaceHeading icon={CalendarCheck}>{t('activity.title')}</WorkspaceHeading><p>{t('hqActivity.flow')}</p></header>
    {screen !== 'browse' && <div className="hq-act-actions activity-back-standalone"><button type="button" disabled={command.busy || checking} onClick={backToList}><ChevronLeft className="hq-act-button-icon" size={17} aria-hidden="true"/>{t('hqActivity.backToList')}</button></div>}
    {screen === 'register' && permission(perms, 'ACTIVITY.WRITE') && <section className="hq-act-card"><div className="activity-detail-heading"><h2>{t('hqActivity.singlePlan')}</h2><button type="button" className="activity-tablet-back" disabled={command.busy || checking} onClick={backToList}>목록으로</button></div><form onSubmit={savePlan}>{planForm(plan, setPlan)}<button className="hq-act-primary-action" disabled={command.busy}>{t('activity.register')}</button></form></section>}
    {screen === 'register' && permission(perms, 'ACTIVITY.WRITE') && <section className="hq-act-card hq-act-desktop"><h2>{t('hqActivity.bulkPlan')}</h2><form onSubmit={saveBulk}>{bulk.map((row, index) => <div key={index} className="hq-act-bulk-row"><strong>{index + 1}</strong>{planForm(row, value => updateBulk(index, value))}<button type="button" disabled={bulk.length === 1} onClick={() => setBulk(items => items.filter((_, i) => i !== index))}>{t('hqActivity.remove')}</button></div>)}<div className="hq-act-actions"><button type="button" disabled={bulk.length >= 100} onClick={() => setBulk(items => [...items, initialPlan()])}>{t('hqActivity.add')}</button><button disabled={command.busy}>{t('hqActivity.bulkSave')}</button></div></form></section>}
    {screen === 'register' && permission(perms, 'ACTIVITY.WRITE') && <p className="hq-act-mobile-only">{t('hqActivity.bulkPcOnly')}</p>}
    {screen === 'browse' && <section className="hq-act-card"><div className="hq-act-toolbar"><h2>{t(view === 'list' ? 'hqActivity.list' : 'hqActivity.schedule')}</h2>{view !== 'list' && <label>{t('hqActivity.date')}<input type="date" value={day} onChange={e => setDay(e.target.value)} /></label>}<div className="hq-act-tabs" role="tablist">{(['list', 'day', 'month', 'map'] as const).map(tab => <button key={tab} type="button" role="tab" aria-selected={view === tab} onClick={() => setView(tab)}>{t(`hqActivity.${tab}`)}</button>)}</div>{permission(perms, 'ACTIVITY.WRITE') && <button type="button" className="hq-act-primary-action" onClick={() => setScreen('register')}><Plus className="hq-act-button-icon" size={17} aria-hidden="true"/>{t('hqActivity.openRegistration')}</button>}</div>
      {view === 'list' && <><div className="hq-act-actions"><label>{t('hqActivity.searchActivities')}<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>{t('hqActivity.statusFilter')}<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">{t('hqActivity.allStatuses')}</option>{['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => <option key={status} value={status}>{t(`status.${status}`, { defaultValue: status })}</option>)}</select></label></div>
        {activities.isLoading && <p role="status">{t('common.loading')}</p>}{activities.isError && <div role="alert"><p>{errorText(activities.error)}</p><button type="button" disabled={activities.isFetching} onClick={() => void activities.refetch()}>{t('hqActivity.retryCalendar')}</button></div>}
        {!activities.isLoading && !activities.isError && activities.data?.length === 0 && <p>{t('hqActivity.noActivities')}</p>}
        {!activities.isLoading && !activities.isError && (activities.data ?? []).map(row => <button type="button" key={row.public_id} className="hq-act-schedule-row" onClick={() => openActivity(row)}><strong>{row.related_name_snapshot}</strong><span>{dateLabel(row.planned_at)} · {t(`status.${row.status}`, { defaultValue: row.status })}</span><span>{row.visit_purpose || '—'}</span></button>)}
      </>}
      {calendar.isLoading && (view === 'day' || view === 'month') && <p role="status">{t('common.loading')}</p>}
      {calendar.isError && (view === 'day' || view === 'month') && <div role="alert"><p>{errorText(calendar.error)}</p><button type="button" disabled={calendar.isFetching} onClick={() => void calendar.refetch()}>{t('hqActivity.retryCalendar')}</button></div>}
      {view === 'map' ? <><p>{t('hqActivity.mapMock')}</p><button type="button" onClick={loadMap}>{t('hqActivity.loadMap')}</button>{map && <><svg className="hq-act-map" viewBox="0 0 400 240" role="img" aria-label={t('hqActivity.mapMock')}><rect width="400" height="240" fill="#e9f3f4" />{mapPoints.map((point, i) => <g key={point.id}><title>{point.name}</title><circle cx={point.x} cy={point.y} r={point.own ? 10 : 7} fill={point.own ? '#a73721' : '#087d7a'} /><text x={point.x + 11} y={point.y + 4} fontSize="10">{point.own ? t('hqActivity.currentLocation') : i}</text></g>)}</svg><ol>{(map.nearbyHospitals ?? []).map((h: Row) => <li key={h.public_id}>{h.name} · {h.distance_m}m</li>)}</ol></>}</>
        : !calendar.isLoading && !calendar.isError && view === 'month' ? <div className="hq-act-month" role="grid" aria-label={t('hqActivity.month')}>
          {monthDays.map(key => <div key={key} role="gridcell" data-date={key} className="hq-act-month-day"><strong>{key.slice(-2)}</strong>{(byDay[key] ?? []).map(row => <button type="button" key={row.public_id} data-activity-id={row.public_id} onClick={() => openActivity(row)}>{row.related_name_snapshot}</button>)}</div>)}
        </div> : !calendar.isLoading && !calendar.isError && view === 'day' ? Object.entries(byDay).map(([key, rows]) => <div key={key}><h3>{key}</h3>{rows.map(row => <button type="button" key={row.public_id} className="hq-act-schedule-row" onClick={() => openActivity(row)}><strong>{row.related_name_snapshot}</strong><span>{dateLabel(row.planned_at)} · {t(`status.${row.status}`, { defaultValue: row.status })}</span><span>{row.visit_purpose || '—'}</span></button>)}</div>) : null}
      {!calendar.isLoading && !calendar.isError && calendar.data?.length === 0 && (view === 'day' || view === 'month') && <p>{t(view === 'month' ? 'hqActivity.noMonth' : 'hqActivity.noDay')}</p>}
    </section>}
    {screen === 'detail' && selectedQuery.isFetching && <p role="status">{t('common.loading')}</p>}
    {screen === 'detail' && selectedQuery.isError && <div role="alert"><p>{errorText(selectedQuery.error)}</p><button type="button" onClick={() => void selectedQuery.refetch()}>{t('hqActivity.retryCalendar')}</button></div>}
    {screen === 'detail' && !selectedQuery.isFetching && !selectedQuery.isError && !selected && <p>{t('hqActivity.activityUnavailable')}</p>}
    {screen === 'detail' && selected && <section className="hq-act-card" data-hq-screen="SCR-ACT-002"><div className="activity-detail-heading"><h2>{t('hqActivity.detail')}</h2><button type="button" className="activity-tablet-back" disabled={command.busy || checking} onClick={backToList}>목록으로</button></div><dl className="hq-act-detail"><div><dt>{t('hqActivity.target')}</dt><dd>{selected.related_name_snapshot}{selected.related_type === 'OPPORTUNITY' && <Link to={`/opportunities?record=${encodeURIComponent(selected.related_public_id)}`}> 영업기회 원본 보기</Link>}</dd></div><div><dt>{t('hqActivity.owner')}</dt><dd>{selected.owner_user_id}</dd></div><div><dt>{t('hqActivity.plannedAt')}</dt><dd>{dateLabel(selected.planned_at)}</dd></div><div><dt>IN</dt><dd>{dateLabel(selected.in_at)}</dd></div><div><dt>OUT</dt><dd>{dateLabel(selected.out_at)}</dd></div></dl>
      {selected.status === 'PLANNED' && permission(perms, 'ACTIVITY.CHECKIN') && selected.owner_user_id === session?.user.userId && <div className="hq-act-actions"><button disabled={checking || command.busy || selected.target_latitude == null || selected.target_longitude == null} onClick={() => check(selected, 'check-in')}>IN (GPS)</button>{selected.target_latitude != null && <button disabled={checking || command.busy} onClick={() => check(selected, 'check-in', true)}>{t('hqActivity.mockLocation')}</button>}</div>}
      {selected.status === 'IN_PROGRESS' && <><label>{t('activity.consultation')}<textarea value={consultation} maxLength={10000} disabled={checking || command.busy} readOnly={!permission(perms, 'ACTIVITY.WRITE') || selected.owner_user_id !== session?.user.userId} onChange={e => setConsultation(e.target.value)} /></label><div className="hq-act-actions">
        {permission(perms, 'ACTIVITY.WRITE') && selected.owner_user_id === session?.user.userId && <button disabled={checking || command.busy} onClick={saveConsultation}>{t('hqActivity.saveConsultation')}</button>}
        {permission(perms, 'ACTIVITY.CHECKOUT') && selected.owner_user_id === session?.user.userId && <><button disabled={checking || command.busy} onClick={() => check(selected, 'check-out')}>OUT (GPS)</button>{selected.target_latitude != null && <button disabled={checking || command.busy} onClick={() => check(selected, 'check-out', true)}>{t('hqActivity.mockLocationOut')}</button>}</>}
      </div></>}
      {selected.status === 'COMPLETED' && <section><h3>{t('activity.consultation')}</h3><p>{selected.consultation_content || '—'}</p>{permission(perms, 'ACTIVITY.REPORT') && <a href="/activity-reports">{t('hqActivity.goToReports')}</a>}</section>}
      {selected.target_latitude == null && <p>{t('hqActivity.noTargetCoordinates')}</p>}{gpsHint && <p role="status">{gpsHint}</p>}
      <h3>{t('hqActivity.history')}</h3><ul>{(selected.history ?? []).map((item: Row, i: number) => <li key={i}>{dateLabel(item.at)} · {item.action}</li>)}</ul></section>}
    <Feedback error={command.error} notice={command.notice} />
  </main>;
}

export function HqActivityReportsPage() {
  const [routeParams, setRouteParams] = useSearchParams();
  const linkedRecord = routeParams.get('record') ?? '';
  const { t } = useTranslation(); const { session } = useHqMock(); const [day, setDay] = useState(today()); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [reportStatus,setReportStatus]=useState(''); const [reportOrg,setReportOrg]=useState(''); const [reportOwner,setReportOwner]=useState('');
  const reportDateInput = useRef<HTMLInputElement>(null);
  const reportTrigger = useRef<HTMLButtonElement | null>(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(''); const [comment, setComment] = useState(''); const [itemText, setItemText] = useState<Record<number, string>>({}); const [itemPurpose,setItemPurpose]=useState<Record<number,string>>({});
  const [accompanyDraft,setAccompanyDraft]=useState<Record<string,boolean>>({});
  const reportKeys = useRef(opportunityRequestKeys()); const reportMutationPending = useRef(false); const [reportConflict, setReportConflict] = useState(false);
  useEffect(() => { if (linkedRecord) setSelectedId(linkedRecord); }, [linkedRecord]);
  useEffect(() => { if (!selectedId) reportTrigger.current?.focus(); }, [selectedId]);
  const invalidPeriod = Boolean(from && to && from > to);
  const reportQuery = new URLSearchParams(); if(from)reportQuery.set('from',from);if(to)reportQuery.set('to',to);if(reportStatus)reportQuery.set('status',reportStatus);if(reportOrg)reportQuery.set('organizationId',reportOrg);if(reportOwner)reportQuery.set('ownerUserId',reportOwner);
  const reports = useQuery({ queryKey: ['hq-reports','list', session?.user.userId,from,to,reportStatus,reportOrg,reportOwner], queryFn: () => apiGet<Row[]>(`/api/activity-reports?${reportQuery}`), enabled:!invalidPeriod, retry: false });
  const reportOptions = useQuery({queryKey:['hq-reports','filter-options',session?.user.userId],queryFn:()=>apiGet<Row[]>('/api/activity-reports'),retry:false});
  const selectedQuery = useQuery({ queryKey: ['hq-report-detail', selectedId, session?.user.userId], queryFn: () => apiGet<Row>(`/api/activity-reports/${selectedId}`), enabled: !!selectedId, retry: false });
  const selected = selectedQuery.data;
  const command = useActivityCommand([['hq-reports'], ['hq-report-detail']]);
  const hasUnsavedItems = (selected?.items ?? []).some((item: Row) => itemText[item.report_item_id] !== undefined && itemText[item.report_item_id] !== String(item.consultation_snapshot ?? '') || itemPurpose[item.report_item_id] !== undefined && itemPurpose[item.report_item_id] !== String(item.visit_purpose_snapshot ?? ''));
  const guardLinkedNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => { if ((hasUnsavedItems || comment.trim()) && !window.confirm(t('hqActivity.discardReport'))) event.preventDefault(); };
  const closeReport = () => { if ((hasUnsavedItems || comment.trim()) && !window.confirm(t('hqActivity.discardReport'))) return; setSelectedId(''); setItemText({}); setItemPurpose({}); setComment(''); setReportConflict(false); if (linkedRecord) setRouteParams({}, { replace: true }); };
  const visible = filterReports(reports.isError || invalidPeriod ? [] : reports.data ?? [],{from,to,status:reportStatus,organization:reportOrg,owner:reportOwner});
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const approvalState = (status: string, step: 'branch' | 'division') => {
    if (status === 'DRAFT') return '미요청';
    if (step === 'branch') return status === 'REQUESTED' ? '대기' : status === 'BRANCH_REJECTED' ? '반려' : '승인';
    return status === 'FINAL_APPROVED' ? '승인' : status === 'DIVISION_REJECTED' ? '반려' : '대기';
  };
  const userId = session?.user.userId;
  const canBranch = selected?.status === 'REQUESTED' && selected.branch_approver_user_id === userId && permission(session?.user.permissions, 'ACTIVITY.REPORT.APPROVE.BRANCH');
  const canDivision = selected?.status === 'BRANCH_APPROVED' && selected.division_approver_user_id === userId && permission(session?.user.permissions, 'ACTIVITY.REPORT.APPROVE.DIVISION');
  const step = canBranch ? 'branch' : canDivision ? 'division' : null;
  async function prepare() { const reportDate = reportDateInput.current?.value ?? day; if (!reportDate) return; try { const row = await command.run(() => apiPost<Row>('/api/activity-reports/prepare', { reportDate }), t('report.prepared')); setDay(reportDate); setSelectedId(row.public_id); } catch { /* feedback above */ } }
  async function reportMutation(method:'POST'|'PATCH', path:string, body:Record<string,unknown>, message:string):Promise<boolean> {
    if (!selected || reportMutationPending.current) return false;
    reportMutationPending.current=true;setReportConflict(false);
    const version=Number(selected.version), key=reportKeys.current.get(method,path,body,version);
    try {await command.run(()=>method==='POST'?apiPost(path,{...body,expectedVersion:version,idempotencyKey:key}):apiPatch(path,{...body,expectedVersion:version,idempotencyKey:key}),message);reportKeys.current.done(method,path,body,version);return true;}
    catch(reason){setReportConflict(reason instanceof ApiError && reason.statusCode===409);return false;}
    finally {reportMutationPending.current=false;}
  }
  async function submit() { if (!selected) return; if (hasUnsavedItems) { command.setError(t('hqActivity.saveReportBeforeRequest')); return; } await reportMutation('POST',`/api/activity-reports/${selected.public_id}/request-approval`,{},t('report.requestDone')); }
  async function saveItem(itemId: number) { if (!selected) return; const item=selected.items?.find((row:Row)=>row.report_item_id===itemId); await reportMutation('PATCH',`/api/activity-reports/${selected.public_id}/items/${itemId}`,{ consultationContent: itemText[itemId] ?? item?.consultation_snapshot ?? '', visitPurpose:itemPurpose[itemId] ?? item?.visit_purpose_snapshot ?? '' },t('report.itemSaved')); }
  async function saveAccompaniment(itemId:number, accompany:boolean) { if (!selected || !step || reportMutationPending.current) return; const key=`${step}-${itemId}`;setAccompanyDraft(values=>({...values,[key]:accompany}));await reportMutation('POST',`/api/activity-reports/${selected.public_id}/items/${itemId}/accompany/${step}`,{accompany},'동행 여부를 저장했습니다.');setAccompanyDraft(values=>{const next={...values};delete next[key];return next}); }
  async function reloadReport() { if ((hasUnsavedItems || comment.trim()) && !window.confirm('입력을 버리고 최신 보고서를 불러오시겠습니까?')) return; const result=await selectedQuery.refetch(); if (!result.error) { setItemText({});setItemPurpose({});setComment('');setReportConflict(false);command.setError(''); } }
  async function decision(action: 'comment' | 'approve' | 'reject') { if (!selected || !step) return; try { await command.run(() => apiPost(`/api/activity-reports/${selected.public_id}/${action}/${step}`, { comment }), t(action === 'comment' ? 'hqActivity.commentSaved' : action === 'reject' ? 'hqActivity.rejected' : 'report.approvalDone', { actor: step === 'branch' ? '지점장' : '본부장' })); setComment(''); } catch { /* feedback above */ } }
  return <main className="hq-act-page hq-report-page"><header><WorkspaceHeading icon={ClipboardList}>{t('report.writeTitle')}</WorkspaceHeading><p>{t('hqActivity.reportFlow')}</p></header>
    {permission(session?.user.permissions, 'ACTIVITY.WRITE') && <section className="hq-act-card hq-report-prepare"><h2>{t('report.writeTitle')}</h2><label>{t('hqActivity.date')}<input ref={reportDateInput} type="date" value={day} onChange={e => setDay(e.target.value)} /></label><button disabled={command.busy || !day} onClick={e => { reportTrigger.current = e.currentTarget; void prepare(); }}>{t('report.prepare')}</button></section>}
    <section className="hq-act-card hq-report-queue"><h2>{t('report.queueTitle')}</h2><p>현재 조회 권한 범위의 보고서입니다. 미작성 건수는 대상자·근무일 기준이 확정되지 않아 집계하지 않습니다.</p><div className="hq-act-actions"><label>{t('hqActivity.from')}<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></label><label>{t('hqActivity.to')}<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></label><label>보고 상태<select value={reportStatus} onChange={e=>{setReportStatus(e.target.value);setPage(1)}}><option value="">전체</option>{['DRAFT','REQUESTED','BRANCH_APPROVED','BRANCH_REJECTED','DIVISION_REJECTED','FINAL_APPROVED'].map(status=><option key={status} value={status}>{t(`status.${status}`,{defaultValue:status})}</option>)}</select></label><label>소속 조직<select value={reportOrg} onChange={e=>{setReportOrg(e.target.value);setPage(1)}}><option value="">전체</option>{Array.from(new Set((reportOptions.data??[]).filter(row=>row.organization_id!=null).map(row=>String(row.organization_id)))).map(id=><option key={id} value={id}>{(reportOptions.data??[]).find(row=>String(row.organization_id)===id)?.organization_name || `ID ${id}`}</option>)}</select></label><label>보고 담당자<select value={reportOwner} onChange={e=>{setReportOwner(e.target.value);setPage(1)}}><option value="">전체</option>{Array.from(new Set((reportOptions.data??[]).map(row=>String(row.reporter_user_id??row.owner_user_id)).filter(id=>id!=='undefined'))).map(id=><option key={id} value={id}>{(reportOptions.data??[]).find(row=>String(row.reporter_user_id??row.owner_user_id)===id)?.reporter_name || `ID ${id}`}</option>)}</select></label></div>
      <button disabled={invalidPeriod || reports.isFetching} onClick={() => void reports.refetch()}>조회</button>
      {invalidPeriod && <p role="alert">종료일은 시작일보다 빠를 수 없습니다.</p>}
      {reports.isError && <p role="alert">{errorText(reports.error)}</p>}
      {!reports.isLoading && !reports.isError && !invalidPeriod && <p role="status">총 {visible.length}건{visible.length === 0 ? ' · 조회된 보고서가 없습니다.' : ''}</p>}
      {pageRows.map(row => {
        const results: Row[] = (row.items ?? []).filter((item: Row) => item.item_type === 'RESULT');
        const ins = results.map(item => item.in_at_snapshot).filter(Boolean).sort();
        const outs = results.map(item => item.out_at_snapshot).filter(Boolean).sort();
        return <div className="hq-act-list-row" key={row.public_id}><div><strong>{row.report_date}</strong> · {t(`status.${row.status}`, { defaultValue: row.status })}<p>담당자 {row.reporter_name || `ID ${row.reporter_user_id ?? row.owner_user_id}`} · 소속 {row.organization_name ?? (row.organization_id == null ? '—' : `ID ${row.organization_id}`)} · 방문 거래처 {row.visit_account_count ?? 0}곳 (목업 기준)</p><p>활동 결과 {results.length}건 · 활동 계획 {(row.items ?? []).filter((item: Row) => item.item_type === 'PLAN').length}건 · 지점 {approvalState(String(row.status), 'branch')} · 본부 {approvalState(String(row.status), 'division')}</p><p>첫 IN: {dateLabel(ins[0])} · 마지막 OUT: {dateLabel(outs[outs.length - 1])}</p><small>보고 ID {row.public_id}</small></div><button aria-label={`${row.report_date} 담당자 ${row.reporter_user_id ?? row.owner_user_id} 상세 열기`} onClick={e => { reportTrigger.current = e.currentTarget; setSelectedId(row.public_id); setComment(''); setItemText({}); setItemPurpose({}); }}>{t('hqActivity.openDetail')}</button></div>;
      })}
      {visible.length > pageSize && <nav className="hq-act-actions" aria-label="활동보고 페이지"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage} / {pageCount} 페이지</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>다음</button></nav>}
    </section>
    {selectedQuery.error && <p role="alert">{errorText(selectedQuery.error)}</p>}
    {selected && <HqModal title={t('hqActivity.reportDetail')} wide busy={command.busy} onClose={closeReport}><section className="hq-act-card" data-hq-screen="SCR-REP-003"><p>{selected.report_date} · {t(`status.${selected.status}`, { defaultValue: selected.status })} · {t('hqActivity.owner')} {selected.reporter_user_id ?? selected.owner_user_id}</p><p>보고 내용 수정은 보고 초안에만 반영됩니다. 원본 활동 변경 여부와 범위는 정책 확인이 필요합니다.</p><Feedback error={command.error} notice={command.notice} />{reportConflict && <p role="alert">보고서가 변경되었거나 요청이 충돌했습니다. 입력은 유지됩니다. <button type="button" onClick={()=>void reloadReport()}>최신 보고서 불러오기</button></p>}{!selected.items?.length && <p>이 보고서에 포함된 활동이 없습니다.</p>}
      {(['RESULT', 'PLAN'] as const).map(type => <section key={type}><h3>{type === 'RESULT' ? '활동 결과' : '활동 계획'}</h3>{type === 'PLAN' && <p>동행 선택은 목업 검토 항목이며 재제출 후에도 유지됩니다. 법인별 적용 정책은 미확정입니다.</p>}{!(selected.items ?? []).some((item: Row) => item.item_type === type) && <p>해당 활동이 없습니다.</p>}{(selected.items ?? []).filter((item: Row) => item.item_type === type).map((item: Row) => <div className="hq-act-list-row" key={item.report_item_id}><div><strong>{item.related_name_snapshot}</strong>{item.related_type === 'OPPORTUNITY' && <Link onClick={guardLinkedNavigation} to={`/opportunities?record=${encodeURIComponent(item.related_public_id)}`}> 영업기회 원본 보기</Link>} · {dateLabel(item.planned_at_snapshot)}<br/>{item.visit_purpose_snapshot}{type === 'RESULT' && <p>IN: {dateLabel(item.in_at_snapshot)} · OUT: {dateLabel(item.out_at_snapshot)}</p>}</div>
        {selected.owner_user_id === userId && ['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'].includes(selected.status) ? <><label>방문 목적<input disabled={command.busy} maxLength={500} value={itemPurpose[item.report_item_id] ?? item.visit_purpose_snapshot ?? ''} onChange={e=>setItemPurpose(values=>({...values,[item.report_item_id]:e.target.value}))}/></label><textarea aria-label={t('activity.consultation')} disabled={command.busy} value={itemText[item.report_item_id] ?? item.consultation_snapshot ?? ''} onChange={e => setItemText(values => ({ ...values, [item.report_item_id]: e.target.value }))} /><button disabled={command.busy} onClick={() => saveItem(item.report_item_id)}>{t('report.edit')}</button></> : <p>{item.consultation_snapshot || '—'}</p>}
        {type === 'PLAN' && <div><p>지점장 동행: {item.branch_accompany_yn === undefined ? '미선택' : item.branch_accompany_yn ? '예정' : '안 함'} · 본부장 동행: {item.division_accompany_yn === undefined ? '미선택' : item.division_accompany_yn ? '예정' : '안 함'} (MOCK)</p>{step && <label>{step === 'branch' ? '지점장' : '본부장'} 동행 예정<input type="checkbox" checked={accompanyDraft[`${step}-${item.report_item_id}`] ?? Boolean(item[step === 'branch' ? 'branch_accompany_yn' : 'division_accompany_yn'])} disabled={command.busy} onChange={event=>void saveAccompaniment(item.report_item_id,event.target.checked)} /></label>}</div>}
      </div>)}</section>)}
      {selected.owner_user_id === userId && ['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'].includes(selected.status) && <button disabled={command.busy} onClick={submit}>{t('report.request')}</button>}
      <section><h3>연결된 후속조치 (현재 원본)</h3><p>보고서 제출본과 별도로 현재 후속조치 상태를 표시합니다.</p>{!(selected.followUps ?? []).length && <p>조회 가능한 후속조치가 없습니다.</p>}{(selected.followUps ?? []).map((follow: Row)=><p key={follow.public_id}>{follow.title} · {follow.due_date} · {follow.status === 'OPEN' ? '진행 예정' : '완료'} <Link onClick={guardLinkedNavigation} to={`/opportunities?record=${encodeURIComponent(follow.opportunity_public_id)}&followUp=${encodeURIComponent(follow.public_id)}`}>후속조치 원본 보기</Link></p>)}</section>
      {(selected.branch_comment || selected.division_comment) && <dl><dt>지점장 의견</dt><dd>{selected.branch_comment || '없음'}</dd><dt>본부장 의견</dt><dd>{selected.division_comment || '없음'}</dd></dl>}
      {step && <div className="hq-act-decision"><label>{t('hqActivity.approvalComment')}<textarea disabled={command.busy} value={comment} onChange={e => setComment(e.target.value)} /></label><div className="hq-act-actions"><button onClick={() => decision('comment')} disabled={command.busy || !comment.trim()}>{t('hqActivity.saveComment')}</button><button className="hq-report-approve" disabled={command.busy} onClick={() => decision('approve')}>{t('hqActivity.completeApproval')}</button><button className="hq-report-reject" onClick={() => decision('reject')} disabled={command.busy || !comment.trim() && !selected[step === 'branch' ? 'branch_comment' : 'division_comment']}>{t('common.reject')}</button></div></div>}
      <h3>제출 회차</h3>{!(selected.submission_snapshots ?? []).length && <p>고정된 제출본이 없습니다. 이전 저장 데이터의 제출 이력은 별도 확인이 필요합니다.</p>}{(selected.submission_snapshots ?? []).map((snapshot: Row)=><details key={snapshot.snapshot_public_id}><summary>{snapshot.approval_round}회차 · 제출 {dateLabel(snapshot.submitted_at)} · {snapshot.timezone}</summary>{(snapshot.items ?? []).map((item: Row)=><p key={item.activity_public_id}>{item.item_type === 'RESULT' ? '결과' : '계획'} · {item.related_name_snapshot} · {item.visit_purpose_snapshot || '—'} · {item.consultation_snapshot || '—'}</p>)}</details>)}
      <h3>{t('hqActivity.history')}</h3><ul>{(selected.history ?? []).map((item: Row, i: number) => <li key={i}>{dateLabel(item.at)} · {item.action} · {item.comment ?? ''}</li>)}</ul></section></HqModal>}
    {!selected && <Feedback error={command.error} notice={command.notice} />}
  </main>;
}

export function HqDirectWorkPage() {
  const { t } = useTranslation(); const { session } = useHqMock(); const [selectedId, setSelectedId] = useState(''); const [comment, setComment] = useState('');
  const [reassignUser, setReassignUser] = useState(''); const [reassignReason, setReassignReason] = useState('');
  const items = useQuery({ queryKey: ['hq-direct-work', session?.user.userId], queryFn: () => apiGet<Row[]>('/api/direct-work'), retry: false, refetchInterval: 1500 });
  const selectedQuery = useQuery({ queryKey: ['hq-direct-work-detail', selectedId, session?.user.userId], queryFn: () => apiGet<Row>(`/api/direct-work/${selectedId}`), enabled: !!selectedId, retry: false, refetchInterval: 1500 });
  const selected = selectedQuery.data; const command = useActivityCommand([['hq-direct-work'], ['hq-direct-work-detail'], ['hq-activity-calendar']]);
  const userId = session?.user.userId;
  const owner = selected?.owner_user_id === userId;
  const branch = selected?.status === 'REQUESTED' && selected.branch_approver_user_id === userId && permission(session?.user.permissions, 'DIRECT_WORK.APPROVE.BRANCH');
  const division = selected?.status === 'BRANCH_APPROVED' && selected.division_approver_user_id === userId && permission(session?.user.permissions, 'DIRECT_WORK.APPROVE.DIVISION');
  const step = branch ? 'branch' : division ? 'division' : null;
  const reassignStep = selected?.status === 'REQUESTED' ? 'BRANCH' : selected?.status === 'BRANCH_APPROVED' ? 'DIVISION' : null;
  const mayReassign = permission(session?.user.permissions, 'DIRECT_WORK.MANAGE') && Boolean(reassignStep);
  const approvers = useQuery({ queryKey: ['hq-direct-work-approvers', reassignStep, session?.user.userId],
    queryFn: () => apiGet<{ userId: number; name: string }[]>(`/api/direct-work/approvers?step=${reassignStep}`), enabled: mayReassign, retry: false });
  async function request() { if (!selected) return; try { await command.run(() => apiPost(`/api/direct-work/${selected.public_id}/request-approval`, {}), t('directWork.requestDone')); } catch { /* feedback above */ } }
  async function decide(action: 'APPROVE' | 'REJECT') { if (!selected || !step) return; try { await command.run(() => apiPost(`/api/direct-work/${selected.public_id}/decision/${step}`, { action, comment }), t('directWork.decisionDone', { actor: step, action })); setComment(''); } catch { /* feedback above */ } }
  async function retry() { if (!selected) return; try { await command.run(() => apiPost(`/api/direct-work/${selected.public_id}/erp/retry`, { idempotencyKey: crypto.randomUUID() }), t('hqActivity.erpRetryQueued')); } catch { /* feedback above */ } }
  async function reassign() { if (!selected || !reassignStep) return; try {
    await command.run(() => apiPost(`/api/direct-work/${selected.public_id}/reassign`, { step: reassignStep, approverUserId: Number(reassignUser), reason: reassignReason }), t('hqActivity.reassigned'));
    setReassignUser(''); setReassignReason('');
  } catch { /* feedback above */ } }
  return <main className="hq-act-page hq-direct-page"><header><WorkspaceHeading icon={MapPin}>{t('directWork.title')}</WorkspaceHeading><p>{t('hqActivity.directFlow')}</p></header><section className="hq-act-card"><h2>{t('directWork.title')}</h2>{items.isError && <p role="alert">{errorText(items.error)}</p>}
    {(items.data ?? []).map(row => <div className="hq-act-list-row" key={row.public_id}><span>{row.work_date} · <span {...configAnchor('directWork.type', 'list.type')}>{row.work_type ?? row.direct_work_type}</span> · {t(`status.${row.status}`, { defaultValue: row.status })} · ERP {row.erp_sync_status ?? row.integration_status}</span><button data-testid="direct-work-open" onClick={() => { setSelectedId(row.public_id); setComment(''); }}>{t('hqActivity.openDetail')}</button></div>)}</section>
    {selected && <section className="hq-act-card" data-hq-screen="SCR-DW-002" {...configAnchor('section:directWork.detail', 'detail.section')}><h2>{t('hqActivity.directDetail')}</h2><dl className="hq-act-detail"><div><dt>{t('hqActivity.target')}</dt><dd>{selected.related_name_snapshot || selected.activity_public_id}</dd></div><div {...configAnchor('directWork.reason', 'detail.reason')}><dt>{t('hqActivity.reason')}</dt><dd>{selected.reason}</dd></div><div><dt>{t('hqActivity.owner')}</dt><dd>{selected.owner_user_id}</dd></div><div><dt>{t('directWork.activity')}</dt><dd>{selected.activity_public_id}</dd></div><div {...configAnchor('directWork.status', 'detail.status')}><dt>{t('hqActivity.approvalState')}</dt><dd>{selected.status}</dd></div><div {...configAnchor('directWork.erpStatus', 'detail.erpStatus')}><dt>ERP</dt><dd>{selected.erp_sync_status ?? selected.integration_status} · {selected.erp_reference_no ?? '—'}</dd></div></dl>
      {owner && ['DRAFT', 'BRANCH_REJECTED', 'DIVISION_REJECTED'].includes(selected.status) && <button {...configAnchor('DW.request', 'detail.request')} onClick={request}>{t('directWork.request')}</button>}
      {step && <div className="hq-act-decision"><label {...configAnchor('directWork.comment', 'detail.comment')}>{t('hqActivity.approvalComment')}<textarea value={comment} onChange={e => setComment(e.target.value)} /></label><div className="hq-act-actions" {...configAnchor('directWork.decision', 'detail.decision')}><button {...configAnchor(step === 'branch' ? 'DW.decision.branch' : 'DW.decision.division', `detail.${step}.approve`)} onClick={() => decide('APPROVE')}>{t('common.approve')}</button><button {...configAnchor(step === 'branch' ? 'DW.decision.branch' : 'DW.decision.division', `detail.${step}.reject`)} onClick={() => decide('REJECT')} disabled={!comment.trim()}>{t('common.reject')}</button></div></div>}
      {mayReassign && <div className="hq-act-decision"><h3>{t('hqActivity.reassign')}</h3><span {...configAnchor('directWork.reassignStep', 'detail.reassign.step')}>{reassignStep}</span><label {...configAnchor('directWork.approverUserId', 'detail.reassign.approver')}>{t('hqActivity.newApprover')}<select value={reassignUser} onChange={e => setReassignUser(e.target.value)}><option value="">{t('common.selectNone')}</option>{(approvers.data ?? []).map(user => <option key={user.userId} value={user.userId}>{user.name}</option>)}</select></label><label {...configAnchor('directWork.reassignReason', 'detail.reassign.reason')}>{t('hqActivity.reason')}<input value={reassignReason} maxLength={500} onChange={e => setReassignReason(e.target.value)} /></label><button {...configAnchor('DW.reassign', 'detail.reassign.submit')} onClick={reassign} disabled={!reassignUser || !reassignReason.trim()}>{t('hqActivity.reassign')}</button></div>}
      {permission(session?.user.permissions, 'DIRECT_WORK.APPROVE.DIVISION') && ['FAILED', 'TIMED_OUT'].includes(selected.erp_sync_status) && <button {...configAnchor('DW.erpRetry', 'detail.erp.retry')} onClick={retry}>{t('hqActivity.retryErp')}</button>}
      <h3>{t('hqActivity.history')}</h3><ul>{(selected.history ?? []).map((item: Row, i: number) => <li key={i}>{dateLabel(item.at)} · {item.action} · {item.comment ?? item.requestId ?? ''}</li>)}</ul></section>}
    <Feedback error={command.error} notice={command.notice} />
  </main>;
}
