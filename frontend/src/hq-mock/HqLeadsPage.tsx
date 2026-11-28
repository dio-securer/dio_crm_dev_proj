import React, { useEffect, useState } from 'react';
import { Phone, ClipboardPen, FileText, Link2, UserRound, Building2, MapPin, Hash, CalendarDays, PhoneCall, MoreHorizontal, ChevronDown, ChevronLeft, Search, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api';
import { useHqMock } from './HqMockProvider';
import { HqError, HqFields, HqModal, HqRecordSummary, HqRows, HqTabs, useHqCommand, useHqCustomerPolicy } from './customer-shared';
import { LEAD_FIELDS, LEAD_STAGES, displayValue, formFromRecord, formPayload, recordLabel, type ConversionOptions, type ConversionResult, type CustomerForm, type CustomerOwner, type CustomerRecord } from './customer-model';
import { configAnchor } from './config-anchor';
import { leadGridCandidates,leadLegacyDisplayColumns } from '@dio-crm/contracts/lead-grid-columns';
import { ButtonPresentationContext } from '../customization/ButtonPresentationContext';
import '../customization/button-presentation.css';
import { GridSortContext } from '../customization/GridDensityContext';
import { LeadConversionSummary } from './LeadConversionSummary';
import './lead-salesforce.css';
import { filterLeadActivities } from './lead-activity-filter';
import { LeadMobileCards } from './LeadMobileCards';
import { leadHistoryDetails } from './lead-history-display';

export function HqLeadsPage({ previewGridColumns = [], previewColumnOrder }: { previewGridColumns?: string[]; previewColumnOrder?:string[] }) {
  const { t,i18n } = useTranslation();
  const { session } = useHqMock();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('recent');
  const [stage, setStage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createGroups, setCreateGroups] = useState<string[]>(['basic']);
  const [form, setForm] = useState<CustomerForm>(() => formFromRecord(LEAD_FIELDS));
  const policy = useHqCustomerPolicy();
  const previewSort = React.useContext(GridSortContext);
  const command = useHqCommand();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['hq-leads', search, scope, stage], retry: false,
    queryFn: () => apiGet<CustomerRecord[]>(`/api/leads?search=${encodeURIComponent(search)}&scope=${scope}${stage ? `&status=${stage}` : ''}`) });
  const clock = useQuery({ queryKey: ['hq-clock'], queryFn: () => apiGet<{ now: string }>('/api/hq/status'), retry: false });
  const dateInSeoul = (value: unknown) => { const date = new Date(String(value ?? '')); return Number.isFinite(date.valueOf()) ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date) : ''; };
  const today = dateInSeoul(clock.data?.now);
  const recentTime = (row: CustomerRecord) => String(row.updated_at ?? row.created_at ?? row.source_updated_at ?? '');
  const rows = (query.data ?? []).filter(row => (scope !== 'mine' || row.owner_user_id === session?.user.userId) && (scope !== 'today' || Boolean(today && dateInSeoul(row.created_at) === today)) && (!stage || row.status === stage)).sort((a, b) => {if(!previewSort)return recentTime(b).localeCompare(recentTime(a)) || a.public_id.localeCompare(b.public_id);const left=String(a.updated_at??''),right=String(b.updated_at??'');if(!left||!right)return left? -1:right?1:a.public_id.localeCompare(b.public_id);return (previewSort==='asc'?left.localeCompare(right):right.localeCompare(left))||a.public_id.localeCompare(b.public_id);});
  const selectedId = params.get('lead');
  const open = (id: string) => {
    if (selectedId && selectedId !== id && !window.confirm('다른 리드를 열면 현재 화면에서 저장하지 않은 변경 사항이 사라집니다. 계속하시겠습니까?')) return;
    setParams(previous => { const next = new URLSearchParams(previous); next.set('lead', id); return next; });
  };
  const close = () => setParams(previous => { const next = new URLSearchParams(previous); next.delete('lead'); return next; });
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await command.run<CustomerRecord>('POST', '/api/leads', policy.writablePayload('lead', formPayload(LEAD_FIELDS, form)));
      await cache.invalidateQueries({ queryKey: ['hq-leads'] }); setCreating(false); open(result.public_id);
    } catch { /* Input remains available for correction and retry. */ }
  };
  const closeCreate = () => { if (JSON.stringify(form) === JSON.stringify(formFromRecord(LEAD_FIELDS)) || window.confirm('작성 중인 리드 정보가 저장되지 않았습니다. 닫으시겠습니까?')) setCreating(false); };
  return <div className={selectedId ? 'lead-responsive-workspace has-detail' : 'lead-responsive-workspace'}>
  <section className="hq-customer-page hq-lead-list" {...configAnchor('section:lead.list', 'section:lead.list.0')}>
    <div className="lead-list-top"><div className="page-header"><div><span className="page-kicker">CRM · LEAD</span><h2>{t('lead.title')}</h2><p>{t('hqCustomer.leadIntro')}</p></div>
      <button type="button" className="button-primary" {...configAnchor('LEAD.create', 'list.create')} disabled={!policy.has('LEAD.WRITE') || !policy.ready} onClick={() => { setForm(formFromRecord(LEAD_FIELDS)); setCreateGroups(['basic']); command.clearError(); setCreating(true); }}><Plus className="lead-list-new-icon" size={17} aria-hidden="true"/>{t('hqCustomer.newLead')}</button></div>
    <div className="hq-customer-toolbar"><span className="lead-list-search" {...configAnchor('LEAD.search', 'list.search.query')}><Search className="lead-list-search-icon" size={18} aria-hidden="true"/><input {...configAnchor('lead.search', 'list.search')} aria-label={t('lead.search')} placeholder={t('lead.search')} value={search} onChange={event => setSearch(event.target.value)} /></span>
      <label className="lead-list-filter"><span className="lead-list-filter-label">조회 범위</span><select {...configAnchor('lead.scope', 'list.scope', 'unsupported')} aria-label={t('hqCustomer.scope')} value={scope} onChange={event => setScope(event.target.value)}><option value="recent">{t('hqCustomer.recent')}</option><option value="today">{t('hqCustomer.today')}</option><option value="managed">{t('hqCustomer.managed')}</option><option value="mine">{t('hqCustomer.mine')}</option></select></label>
      <span className="lead-list-filter" {...configAnchor('lead.stageFilter', 'list.stageFilter', 'unsupported')}><span className="lead-list-filter-label">진행 상태</span><select {...configAnchor('lead.statusFilter', 'list.stageFilter')} aria-label={t('common.status')} value={stage} onChange={event => setStage(event.target.value)}><option value="">{t('hqCustomer.allStages')}</option>{LEAD_STAGES.map(value => <option key={value} value={value}>{t(`status.${value}`)}</option>)}</select></span>
    </div>
    </div><p className="hq-customer-filter-note">{t('hqCustomer.recentRule', { date: today || '—' })}</p>
    <HqError error={query.error ?? policy.error ?? clock.error} />
    {!previewColumnOrder && <LeadMobileCards rows={rows} onOpen={open} statusLabel={status => t(`status.${status}`)} />}
    <div className={!previewColumnOrder ? 'lead-desktop-table' : undefined}><HqRows rows={rows} configInstance="list.table" gridAnchor={{id:'section:lead.list',instance:'list.grid',label:'리드 목록 그리드'}} columnOrder={previewColumnOrder} columns={[
      ...(!previewColumnOrder ? [{ key: 'keyman_name', label: '이름', configId: 'lead.keymanSurname', render: (row: CustomerRecord) => <button className="hq-record-link" type="button" data-lead-id={row.public_id} {...configAnchor('LEAD.open', `list.table.open.${row.public_id}`)} onClick={() => open(row.public_id)}>{displayValue(row.keyman_name ?? row.hospital_name)}</button> }] : []),
      { key: 'hospital_name', label: previewColumnOrder ? t('lead.hospital') : '거래처', configId: 'lead.hospitalName', configName: 'hospitalName', render: row => previewColumnOrder ? <button className="hq-record-link" type="button" data-lead-id={row.public_id} {...configAnchor('LEAD.open', `list.table.open.${row.public_id}`)} onClick={() => open(row.public_id)}>{recordLabel(row)}</button> : displayValue(row.hospital_name) },
      ...(!previewColumnOrder ? [{ key: 'keyman_type', label: '연락처 유형', configId: 'lead.keymanType' }] : []),
      { key: 'phone', label: t('lead.phone'), configId: 'lead.phone' },
      ...(!previewColumnOrder ? [{ key: 'keyman_mobile', label: '휴대폰', configId: 'lead.keymanMobile' }, { key: 'keyman_email', label: '이메일', configId: 'lead.keymanEmail' }] : []),
      { key: 'status', label: t('common.status'), configId: 'lead.status', render: row => t(`status.${row.status}`) },
      { key: 'owner_name', label: t('lead.owner'), configId: 'lead.ownerName', configName: 'owner', render: row => displayValue(row.owner_name ?? row.owner_user_id) },
      { key: 'business_no', label: t('lead.businessNo'), configId: 'lead.businessNo', configName: 'businessNo' },
      ...leadLegacyDisplayColumns.filter(c=>previewColumnOrder?.includes(c.fieldId)).map(c=>({key:c.rowKey,label:(i18n.language.startsWith('ko')?{sido:'시·도',sigungu:'시·군·구',updatedAt:'최근 수정'}:{sido:'Province',sigungu:'District',updatedAt:'Updated'})[c.fieldKey as 'sido'|'sigungu'|'updatedAt'],configId:c.fieldId,configName:c.fieldKey})),
      ...previewGridColumns.flatMap(id => { const candidate = leadGridCandidates.find(item => item.fieldId === id); return candidate ? [{ key: candidate.rowKey, label: t(`hqCustomer.fields.${candidate.fieldKey}`), configId: candidate.fieldId, configName: candidate.fieldKey, headerConfig: true }] : []; })
    ]} /></div>
    {creating && <HqModal configId="POP.LEAD.CREATE" title={t('hqCustomer.newLead')} onClose={closeCreate} busy={command.busy} wide><form onInvalid={event => { const group = (event.target as HTMLElement).closest("fieldset"); const groups = Array.from(event.currentTarget.querySelectorAll("fieldset")); const name = ["basic", "keyman", "hospital", "exclusions"][groups.indexOf(group as HTMLFieldSetElement)]; if (name) setCreateGroups(current => current.includes(name) ? current : [...current, name]); }} onSubmit={event => void create(event)}>
      {['basic', 'keyman', 'hospital', 'exclusions'].map(group => <fieldset key={group} {...configAnchor(`section:lead.${group === 'exclusions' ? 'exclusion' : group}`, `section:lead.${group === 'exclusions' ? 'exclusion' : group}.0`)}><legend>{t(`hqCustomer.tabs.${group}`)}</legend><button type="button" className="lead-create-group-toggle" aria-expanded={createGroups.includes(group)} onClick={() => setCreateGroups(current => current.includes(group) ? (group === 'basic' && !String(form.hospitalName ?? '').trim() ? current : current.filter(item => item !== group)) : [...current, group])}>{t(`hqCustomer.tabs.${group}`)}<span aria-hidden="true">{createGroups.includes(group) ? "−" : "+"}</span></button><div className="lead-create-group-content" data-expanded={createGroups.includes(group)}><HqFields entity="lead" configInstance={`create.${group}`} fields={LEAD_FIELDS.filter(field => field.group === group)} form={form} onChange={setForm} disabled={command.busy} /></div></fieldset>)}
      <HqError error={command.error} /><footer><button type="button" onClick={closeCreate} disabled={command.busy}>{t('common.cancel')}</button><button type="submit" {...configAnchor('LEAD.create', 'create.submit')} className="button-primary" disabled={command.busy || !policy.can('LEAD.create', {}, formPayload(LEAD_FIELDS, form))}>{t('common.create')}</button></footer>
    </form></HqModal>}
  </section>
  {selectedId && <HqLeadDetail key={selectedId} publicId={selectedId} onBack={close} />}
  </div>;
}

function HqLeadDetail({ publicId, onBack }: { publicId: string; onBack: () => void }) {
  const buttonEmphasis = React.useContext(ButtonPresentationContext);
  const { t } = useTranslation();
  const cache = useQueryClient();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const [active, setActive] = useState('basic');
  const [feed, setFeed] = useState<'activity' | 'chatter'>('activity');
  const [mobileView, setMobileView] = useState<'overview' | 'information' | 'activity' | 'related'>('overview');
  const [mobileMore, setMobileMore] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['basic']);
  const [form, setForm] = useState<CustomerForm | null>(null);
  const [baseline, setBaseline] = useState<CustomerRecord | null>(null);
  const [selectedStage, setSelectedStage] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const query = useQuery({ queryKey: ['hq-lead', publicId], queryFn: () => apiGet<CustomerRecord>(`/api/leads/${publicId}`), retry: false });
  const history = useQuery({ queryKey: ['hq-lead-history', publicId], queryFn: () => apiGet<CustomerRecord[]>(`/api/leads/${publicId}/history`), retry: false });
  const options = useQuery({ queryKey: ['hq-lead-options'], queryFn: () => apiGet<{ owners: CustomerOwner[]; statuses: string[] }>('/api/leads/options'), retry: false });
  const row = query.data;
  useEffect(() => { if (row && form === null) { setForm(formFromRecord(LEAD_FIELDS, row)); setBaseline(row); setSelectedStage(String(row.status)); setOwnerUserId(String(row.owner_user_id)); } }, [row, form]);
  const refresh = async () => { await Promise.all([query.refetch(), history.refetch(), cache.invalidateQueries({ queryKey: ['hq-leads'] })]); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!row || !form || !baseline) return;
    setNotice('');
    try { const saved = await command.run<CustomerRecord>('PATCH', `/api/leads/${publicId}`, { ...policy.writablePayload('lead', formPayload(LEAD_FIELDS, form), baseline), expectedVersion: baseline.version }); setForm(formFromRecord(LEAD_FIELDS, saved)); setBaseline(saved); await refresh(); setNotice(t('hqCustomer.saved')); } catch { /* Preserve edited fields. */ }
  };
  const saveStage = async () => {
    if (!row) return;
    try { const saved = await command.run<CustomerRecord>('POST', `/api/leads/${publicId}/status`, { toStatus: selectedStage, reason, expectedVersion: row.version }); setSelectedStage(String(saved.status)); setReason(''); setBaseline(current => current?.version === row.version ? { ...current, version: saved.version, status: saved.status } : current); await refresh(); setNotice(t('hqCustomer.stageSaved')); } catch { /* A selected stage is not the persisted stage. */ }
  };
  const assign = async (event: React.FormEvent) => {
    event.preventDefault(); if (!row) return;
    try { const saved = await command.run<CustomerRecord>('POST', `/api/leads/${publicId}/assign-owner`, { ownerUserId: Number(ownerUserId), expectedVersion: row.version }); setBaseline(current => current?.version === row.version ? { ...current, version: saved.version, owner_user_id: saved.owner_user_id } : current); await refresh(); setOwnerOpen(false); setNotice(t('hqCustomer.saved')); } catch { /* Keep selection on failure. */ }
  };
  const remove = async () => { if (!row || !window.confirm(t('hqCustomer.deleteConfirm'))) return; try { await command.run('DELETE', `/api/leads/${publicId}`, { expectedVersion: row.version }); await cache.invalidateQueries({ queryKey: ['hq-leads'] }); onBack(); } catch { /* Show API refusal. */ } };
  if (!row || !form) return <section className="hq-customer-page"><button onClick={onBack}>{t('account.back')}</button><HqError error={query.error} />{query.isLoading && <p>{t('common.loading')}</p>}</section>;
  const editable = row.status !== 'CONVERTED' && policy.owns(row, 'LEAD.MANAGE') && policy.has('LEAD.WRITE');
  const forward: Record<string, string[]> = { NEW: ['FIRST_VISIT', 'CONTACT_EXCLUDED'], FIRST_VISIT: ['KEYMAN_MEETING', 'CONTACT_EXCLUDED'], KEYMAN_MEETING: ['CONTACT_EXCLUDED'], CONTACT_EXCLUDED: [], CONVERTED: [] };
  const reverse = selectedStage !== row.status && !(forward[String(row.status)] ?? []).includes(selectedStage);
  const stageInput = { toStatus: selectedStage, reason };
  const conversion = row.conversion as ConversionResult | undefined;
  const formDirty = Boolean(baseline && JSON.stringify(form) !== JSON.stringify(formFromRecord(LEAD_FIELDS, baseline)));
  const phone = String(row.phone || row.keyman_mobile || '').trim();
  const safePhone = /^[+\d\s().-]+$/.test(phone) ? phone : '';
  const ownerName = row.owner_name ?? options.data?.owners.find(owner => owner.userId === row.owner_user_id)?.name ?? '—';
  const showLeadArea = (view: 'activity' | 'information' | 'related') => { setMobileView(view); if (view === 'activity') setFeed('activity'); if (window.matchMedia('(min-width: 600px)').matches) document.getElementById(view === 'activity' ? 'lead-activity' : view === 'information' ? 'lead-information' : 'lead-related')?.scrollIntoView({ block: 'start' }); };
  const back = () => { if ((!formDirty && selectedStage === row.status && !reason.trim()) || window.confirm('저장하지 않은 리드 정보 또는 단계 선택이 있습니다. 목록으로 돌아가시겠습니까?')) onBack(); };
  return <section className="hq-customer-page hq-lead-detail" data-record-id={publicId} data-mobile-view={mobileView}>
    <div className="hq-customer-toolbar lead-detail-top"><button type="button" onClick={back} className="lead-detail-back"><ChevronLeft className="lead-detail-back-icon" size={19} aria-hidden="true"/><span>{t('account.back')}</span></button><span className="lead-mobile-title">DIO CRM <span>리드 상세</span></span><span className="hq-record-id">{publicId}</span><button type="button" className="lead-more-toggle" aria-expanded={mobileMore} onClick={() => setMobileMore(!mobileMore)}><MoreHorizontal aria-hidden="true" size={20}/><span className="lead-visually-hidden">더보기</span></button></div>
    <nav className="lead-mobile-sections" aria-label="리드 화면 구역">{([{key:'overview',label:'요약'},{key:'information',label:'상세 정보'},{key:'activity',label:'활동'},{key:'related',label:'관련 정보'}] as const).map(tab => <button type="button" key={tab.key} aria-current={mobileView === tab.key ? 'page' : undefined} onClick={() => { if(tab.key==='overview')setMobileView('overview'); else {if(tab.key==='information')setActive('basic');showLeadArea(tab.key);} }}>{tab.label}</button>)}</nav>
    <div className="page-header"><div><span className="lead-detail-mobile-icon" aria-hidden="true"><Building2 size={23}/></span><h2>{recordLabel(row)}</h2><p {...configAnchor('lead.ownerName', 'detail.header.owner')}>{t('lead.owner')}: {displayValue(ownerName)}</p><p className="lead-mobile-status-summary">{t(`status.${row.status}`)}</p><div className="lead-detail-mobile-facts">{safePhone && <span><Phone size={14} aria-hidden="true"/>{safePhone}</span>}{Boolean(row.address) && <span><MapPin size={14} aria-hidden="true"/>{displayValue(row.address)}</span>}</div></div><div className={`page-actions${mobileMore ? ' is-expanded' : ''}`}>
      {policy.can('LEAD.assignOwner', row) && editable && <button type="button" {...configAnchor('LEAD.assignOwner', 'detail.owner.open')} onClick={() => setOwnerOpen(true)}>{t('hqCustomer.assignOwner')}</button>}
      {policy.can('LEAD.convert', row, { accountMode: 'NEW', contactMode: 'SKIP', opportunityMode: 'SKIP' }) && editable && <button className="button-primary" type="button" {...configAnchor('LEAD.convert', 'detail.convert.open')} onClick={() => { if (formDirty) { setNotice('변경한 리드 정보를 저장한 뒤 전환해 주세요.'); return; } setConvertOpen(true); }}>{t('hqCustomer.convert')}</button>}
      {editable && row.status === 'NEW' && policy.can('LEAD.delete', row) && <button type="button" {...configAnchor('LEAD.delete', 'detail.delete')} onClick={() => void remove()}>{t('hqCustomer.delete')}</button>}
    </div></div>
    <nav className="lead-mobile-navigation" aria-label="리드 바로가기">{safePhone && <a href={`tel:${safePhone}`}><Phone aria-hidden="true" size={18}/>전화하기</a>}<button type="button" aria-pressed={mobileView === 'activity'} onClick={() => showLeadArea('activity')}><ClipboardPen aria-hidden="true" size={18}/>활동 등록</button><button type="button" aria-pressed={mobileView === 'information'} onClick={() => showLeadArea('information')}><FileText aria-hidden="true" size={18}/>정보 수정</button><button type="button" aria-pressed={mobileView === 'related'} onClick={() => showLeadArea('related')}><Link2 aria-hidden="true" size={18}/>관련 정보</button>{mobileView !== 'overview' && <button type="button" onClick={() => setMobileView('overview')}>요약</button>}</nav>
    <LeadMobileOverview row={row} onActivity={() => { setFeed('activity'); setMobileView('activity'); }} onInformation={() => setMobileView('information')} />
    <div className="lead-workspace"><aside id="lead-activity" className="lead-feed"><div className="lead-feed-tabs" role="tablist" aria-label="리드 활동"><button type="button" role="tab" aria-selected={feed === 'activity'} onClick={() => setFeed('activity')}>활동</button><button type="button" role="tab" aria-selected={feed === 'chatter'} onClick={() => setFeed('chatter')}>Chatter</button></div>{feed === 'activity' ? <><h3>활동 시간 표시 막대</h3><LeadActivities publicId={publicId} editable={editable} onChanged={async () => { setNotice(''); await refresh(); }} /></> : <p>이 레코드의 Chatter 연동은 제공되지 않습니다.</p>}</aside><div id="lead-information" className="lead-main"><section className="hq-stage-panel"><p><strong>{t('hqCustomer.savedStage')}: <span data-testid="saved-lead-stage" {...configAnchor('lead.status', 'detail.stage.saved')}>{t(`status.${row.status}`)}</span></strong></p>
      <div className="hq-stage-buttons" {...configAnchor('lead.targetStatus', 'detail.stage.choice')}>{LEAD_STAGES.map(value => <button type="button" key={value} aria-pressed={selectedStage === value} disabled={!editable || command.busy || value === 'CONVERTED'} onClick={() => { setSelectedStage(value); setNotice(''); }}>{t(`status.${value}`)}</button>)}</div>
      {editable && <div className="hq-customer-toolbar lead-stage-reason"><label {...configAnchor('lead.reason', 'detail.stage.reason')}><span>{t('hqCustomer.stageReason')}</span><input data-testid="stage-reason" value={reason} onChange={event => setReason(event.target.value)} /></label>
        <button type="button" data-testid="save-stage" {...configAnchor(reverse ? 'LEAD.reverse' : 'LEAD.changeStage', 'detail.stage.save')} className="button-primary" disabled={command.busy || selectedStage === row.status || !policy.can(reverse ? 'LEAD.reverse' : 'LEAD.changeStage', row, stageInput) || ((reverse || selectedStage === 'CONTACT_EXCLUDED') && !reason.trim())} onClick={() => void saveStage()}>{t('hqCustomer.saveStage')}</button>
        <small>{t('hqCustomer.selectedStage', { stage: t(`status.${selectedStage}`) })}</small></div>}
    </section>
    {conversion && <ConversionLinks result={conversion} />}
    {baseline && baseline.version !== row.version && <p className="notice warning">{t('hqCustomer.changedElsewhere')} <button type="button" onClick={() => { if (window.confirm(t('hqCustomer.discardReload'))) { setForm(formFromRecord(LEAD_FIELDS, row)); setBaseline(row); command.clearError(); } }}>{t('hqCustomer.reloadLatest')}</button></p>}
    {notice && <p className="hq-customer-success" role="status">{notice}</p>}<HqError error={command.error ?? policy.error} />
    <HqTabs configScreen="HQ_LEAD" active={active} onChange={setActive} tabs={[{ key: 'basic', label: '세부 사항' }, { key: 'hira', label: '심평원 인입정보' }, { key: 'marketing', label: '마케팅 정보' }, { key: 'history', label: 'History' }]} />
    {active === 'basic' && <form onSubmit={event => void save(event)} className="hq-customer-panel lead-details-form">
      {['basic', 'keyman', 'hospital', 'exclusions'].map(group => <section key={group} className="lead-detail-section" {...configAnchor(`section:lead.${group === 'exclusions' ? 'exclusion' : group}`, `section:lead.${group === 'exclusions' ? 'exclusion' : group}.1`)}><h3><button type="button" className="lead-section-toggle" aria-expanded={expandedGroups.includes(group)} onClick={() => setExpandedGroups(current => current.includes(group) ? current.filter(item => item !== group) : [...current, group])}>{t(`hqCustomer.tabs.${group}`)}<ChevronDown className="lead-section-chevron" size={19} strokeWidth={2.2} aria-hidden="true" /></button><span className="lead-section-heading">{t(`hqCustomer.tabs.${group}`)}</span></h3><div className={expandedGroups.includes(group) ? "lead-section-content is-expanded" : "lead-section-content"}><HqFields entity="lead" configInstance={`detail.${group}`} row={row} fields={LEAD_FIELDS.filter(field => field.group === group)} form={form} onChange={setForm} disabled={!editable || command.busy} /></div></section>)}
      {editable && <footer><button type="button" className="lead-discard-edit" disabled={command.busy || !formDirty} onClick={() => { if (baseline && window.confirm('변경한 리드 정보를 취소하시겠습니까?')) { setForm(formFromRecord(LEAD_FIELDS, baseline)); setNotice(''); command.clearError(); } }}>변경 취소</button><button type="submit" {...configAnchor('LEAD.save', 'detail.form.save')} className={buttonEmphasis ? `crm-button-emphasis-${buttonEmphasis}` : 'button-primary'} disabled={command.busy || !policy.can('LEAD.save', row, formPayload(LEAD_FIELDS, form))}>{t('common.save')}</button></footer>}
    </form>}
    {active === 'basic' && <LeadAdditional row={row} editable={editable} group="basic" onChanged={refresh} />}
    {active === 'hira' && <LeadAdditional row={row} editable={editable} group="hira" onChanged={refresh} />}
    {active === 'marketing' && <LeadAdditional row={row} editable={editable} group="marketing" onChanged={refresh} />}
    {active === 'hira' && <div className="hq-customer-panel" {...configAnchor('section:lead.hira', 'section:lead.hira.0')}><p>{t('hqCustomer.sourceReadOnly')}</p><HqRecordSummary row={row} configFields={{ provider_no: { id: 'lead.providerNo', instance: 'detail.hira.providerNo' }, encrypted_provider_no: { id: 'lead.encryptedProviderNo', instance: 'detail.hira.encryptedProviderNo' }, hira_sync_exclude_yn: { id: 'lead.hiraExcluded', instance: 'detail.hira.hiraExcludedSummary' } }} fields={[
      { key: 'provider_no', label: t('hqCustomer.fields.providerNo') }, { key: 'encrypted_provider_no', label: t('hqCustomer.fields.encryptedProviderNo') }, { key: 'source_system', label: t('hqCustomer.fields.source') }, { key: 'source_updated_at', label: t('hqCustomer.fields.sourceUpdatedAt') }, { key: 'hira_sync_exclude_yn', label: t('hqCustomer.fields.hiraExcluded') }, { key: 'manual_fields', label: t('hqCustomer.fields.manualFields') }, { key: 'open_date', label: '개원일자' }, { key: 'address', label: '병원 주소' }, { key: 'sido', label: '시도명' }, { key: 'sigungu', label: '시군구명' }, { key: 'latitude', label: '위도' }, { key: 'longitude', label: '경도' }
    ]} /></div>}
    {active === 'marketing' && <div className="hq-customer-panel" {...configAnchor('section:lead.marketing', 'section:lead.marketing.0')}><p>{t('hqCustomer.unconfirmedCalculation')}</p><HqRecordSummary row={row} configFields={{ engagement_score: { id: 'lead.engagementScore', instance: 'detail.marketing.engagementScore' }, hira_check_needed: { id: 'lead.hiraCheckNeeded', instance: 'detail.marketing.hiraCheckNeeded' } }} fields={[
      { key: 'engagement_score', label: t('hqCustomer.fields.engagementScore') }, { key: 'hira_check_needed', label: t('hqCustomer.fields.hiraCheckNeeded') }, { key: 'calculation_status', label: t('hqCustomer.fields.calculationStatus') }
    ]} /></div>}
    {active === 'history' && <div className="hq-customer-panel" {...configAnchor('section:lead.history', 'section:lead.history.0')}><HqError error={history.error} /><div {...configAnchor('lead.history', 'detail.history.table')}><HqRows rows={history.data ?? []} columns={[
      { key: 'at', label: t('common.date') }, { key: 'action', label: t('hqCustomer.action') }, { key: 'user_id', label: t('lead.owner') },
      { key: 'changes', label: t('hqCustomer.changes'), render: item => displayValue(leadHistoryDetails(item)) }
    ]} /></div></div>}
    </div><LeadRelated row={row} editable={editable} onChanged={refresh} /></div>
    {ownerOpen && <HqModal configId="POP.LEAD.OWNER" title={t('hqCustomer.assignOwner')} onClose={() => setOwnerOpen(false)} busy={command.busy}><form onSubmit={event => void assign(event)}><label {...configAnchor('lead.ownerUserId', 'owner.select')}>{t('lead.owner')}<select data-testid="lead-owner-select" value={ownerUserId} onChange={event => setOwnerUserId(event.target.value)}>{options.data?.owners.map(owner => <option key={owner.userId} value={owner.userId}>{owner.name}</option>)}</select></label><HqError error={command.error ?? options.error} /><footer><button type="submit" {...configAnchor('LEAD.assignOwner', 'owner.submit')} disabled={command.busy || !ownerUserId}>{t('common.save')}</button></footer></form></HqModal>}
    {convertOpen && <LeadConversion row={row} onClose={() => setConvertOpen(false)} onConverted={refresh} />}
  </section>;
}

type AdditionalGroup = 'basic' | 'hira' | 'marketing';
const additionalFields: Record<AdditionalGroup, { key: string; label: string; type: 'text' | 'number' | 'checkbox' }[]> = {
 basic: [{key:'leadSource',label:'리드 소스',type:'text'},{key:'interestProducts',label:'관심 품목',type:'text'},{key:'companyCode',label:'법인코드',type:'text'},{key:'duplicateSuspected',label:'중복 의심',type:'checkbox'},{key:'mql',label:'MQL',type:'checkbox'},{key:'staffCount',label:'스텝 수',type:'number'},{key:'payDoctorCount',label:'페이닥터 수',type:'number'},{key:'monthlyRevenue',label:'월 총 매출액',type:'number'},{key:'monthlyImplants',label:'월 임플란트 식립량',type:'number'},{key:'competitorRatio',label:'타사 사용 비율',type:'text'},{key:'systemNotes',label:'시스템 기타 상세',type:'text'},{key:'dentalLab',label:'기공실',type:'checkbox'},{key:'ctOwned',label:'CT',type:'checkbox'},{key:'oralScanner',label:'구강스캐너',type:'checkbox'},{key:'activator',label:'Activator',type:'checkbox'},{key:'printer3d',label:'3D프린터',type:'checkbox'},{key:'millingMachine',label:'밀링머신',type:'checkbox'}],
 hira: [{key:'hospitalType',label:'병원 유형',type:'text'},{key:'website',label:'웹사이트',type:'text'},{key:'specialistCount',label:'치과전문의 수',type:'number'},{key:'postalCode',label:'우편번호',type:'text'},{key:'sidoCode',label:'시도코드',type:'text'},{key:'sigunguCode',label:'시군구코드',type:'text'},{key:'dongName',label:'읍면동명',type:'text'},{key:'legalDongCode',label:'법정동코드',type:'text'}],
 marketing: [{key:'marketingScore',label:'Account Engagement Score',type:'number'},{key:'marketingLastActivity',label:'Account Engagement Last Activity',type:'text'},{key:'marketingBounced',label:'Account Engagement Hard Bounced',type:'checkbox'},{key:'marketingNotes',label:'Account Engagement Notes',type:'text'}]
};
function LeadAdditional({ row, editable, group, onChanged }: { row: CustomerRecord; editable: boolean; group: AdditionalGroup; onChanged: () => Promise<void> }) {
 const cache=useQueryClient(); const [values,setValues]=useState<Record<string, string | number | boolean | null>>({}); const [version,setVersion]=useState<number | null>(null); const [saved,setSaved]=useState(false); const command=useHqCommand();
 const initialValues=React.useRef<Record<string, string | number | boolean | null>>({});
 const query=useQuery({queryKey:['lead-additional',row.public_id,row.version],queryFn:()=>apiGet<{values:Record<string,string | number | boolean | null>; version:number}>(`/api/leads/${row.public_id}/additional`),retry:false});
 useEffect(()=>{if(query.data && (version===null || version!==query.data.version && JSON.stringify(values)===JSON.stringify(initialValues.current))){initialValues.current=query.data.values;setValues(query.data.values);setVersion(query.data.version);}},[query.data,version,values]);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();if(version===null)return;try{const input=Object.fromEntries(additionalFields[group].map(field=>[field.key,field.type==='checkbox'?Boolean(values[field.key]):field.type==='number'?(values[field.key]===''||values[field.key]==null?null:Number(values[field.key])):String(values[field.key]??'')]));const result=await command.run<{values:typeof values;version:number}>('PATCH',`/api/leads/${row.public_id}/additional`,{values:input,expectedVersion:version});initialValues.current=result.values;setValues(result.values);setVersion(result.version);cache.setQueryData(['lead-additional',row.public_id,result.version],result);setSaved(true);await onChanged();}catch{/* preserve inputs */}};
 return <form className="hq-customer-panel lead-details-form" onSubmit={event=>void submit(event)}><h3>{group==='basic'?'추가 병원 정보':group==='hira'?'심평원 추가 정보':'마케팅 추가 정보'}</h3><p>목업 입력 정보 · 외부 서비스와 동기화되지 않습니다.</p><HqError error={query.error??command.error}/>{Boolean(command.error) && <button type="button" onClick={() => { if (window.confirm('입력 중인 추가 정보를 버리고 최신 값을 불러오시겠습니까?')) { command.clearError(); void query.refetch().then(result => { if (result.data) { initialValues.current=result.data.values; setValues(result.data.values); setVersion(result.data.version); setSaved(false); } }); } }}>추가 정보 다시 불러오기</button>}<div className="hq-customer-fields">{additionalFields[group].map(field=><label key={field.key}><span>{field.label}</span>{field.type==='checkbox'?<input type="checkbox" checked={Boolean(values[field.key])} disabled={!editable||version===null} onChange={event=>{setSaved(false);setValues({...values,[field.key]:event.target.checked});}}/>:<input maxLength={field.key==='interestProducts'?255:undefined} type={field.type} min={field.type==='number'?0:undefined} value={String(values[field.key]??'')} disabled={!editable||version===null} onChange={event=>{setSaved(false);setValues({...values,[field.key]:event.target.value});}}/>}</label>)}</div>{saved&&<p role="status">저장되었습니다.</p>}{editable&&<footer><button type="submit" disabled={command.busy||version===null}>추가 정보 저장</button></footer>}</form>;
}

type RelatedItem = { public_id: string; name: string; latitude?: number; longitude?: number };
function LeadRelated({ row, editable, onChanged }: { row: CustomerRecord; editable: boolean; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState<'duplicates' | 'campaign' | 'coordinate' | null>(null);
  const [name, setName] = useState(''); const [latitude, setLatitude] = useState(''); const [longitude, setLongitude] = useState('');
  const command = useHqCommand();
  const related = useQuery({ queryKey: ['lead-related', row.public_id], queryFn: () => apiGet<{ campaigns: RelatedItem[]; coordinates: RelatedItem[] }>(`/api/leads/${row.public_id}/related`), retry: false });
  const duplicates = useQuery({ queryKey: ['lead-related-duplicates', row.public_id], queryFn: () => apiGet<ConversionOptions>(`/api/leads/${row.public_id}/conversion-options`), enabled: open === 'duplicates', retry: false });
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!open || open === 'duplicates') return; try { await command.run('POST', `/api/leads/${row.public_id}/related`, { kind: open, name: name.trim(), ...(open === 'coordinate' ? { latitude: Number(latitude), longitude: Number(longitude) } : {}) }); await Promise.all([related.refetch(), onChanged()]); setOpen(null); setName(''); setLatitude(''); setLongitude(''); } catch { /* retain input for retry */ } };
  return <aside id="lead-related" className="lead-related"><h3>관련 정보</h3><button type="button" onClick={() => setOpen('duplicates')}>중복된 항목 보기</button><small>목업 사업자번호 기준 후보</small><p>캠페인 내역 ({related.data?.campaigns.length ?? 0})</p>{related.data?.campaigns.map(item => <div key={item.public_id}>{item.name}</div>)}{editable && <button type="button" onClick={() => { command.clearError(); setOpen('campaign'); }}>캠페인에 추가</button>}<p>좌표 수정 요청 ({related.data?.coordinates.length ?? 0})</p>{related.data?.coordinates.map(item => <div key={item.public_id}>{item.name} ({item.latitude}, {item.longitude})</div>)}{editable && <button type="button" onClick={() => { command.clearError(); setOpen('coordinate'); }}>좌표 수정 요청</button>}<p>Engagement History</p><small>마케팅 연동 미연결</small><HqError error={related.error} />
    {open && <HqModal title={open === 'duplicates' ? '중복된 항목 보기' : open === 'campaign' ? '캠페인에 추가' : '좌표 수정 요청'} onClose={() => setOpen(null)} busy={command.busy}>
      {open === 'duplicates' ? <><p>사업자번호가 일치하는 접근 가능한 거래처 후보입니다. 실제 Salesforce 판정 기준과 다를 수 있습니다.</p><HqError error={duplicates.error} />{duplicates.isLoading ? <p>조회 중</p> : duplicates.data && (duplicates.data.duplicates.length ? <ul>{duplicates.data.duplicates.map(item => <li key={item.public_id}>{recordLabel(item)} · {displayValue(item.business_no)}</li>)}</ul> : <p>후보가 없습니다.</p>)}</> : <form onSubmit={event => void submit(event)}><label>{open === 'campaign' ? '캠페인 이름' : '요청 사유'}<input aria-label={open === 'campaign' ? '캠페인 이름' : '요청 사유'} required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>{open === 'coordinate' && <><label>위도<input aria-label="위도" type="number" step="any" min="-90" max="90" required value={latitude} onChange={event => setLatitude(event.target.value)} /></label><label>경도<input aria-label="경도" type="number" step="any" min="-180" max="180" required value={longitude} onChange={event => setLongitude(event.target.value)} /></label></>}<HqError error={command.error} /><footer><button type="button" onClick={() => setOpen(null)}>취소</button><button type="submit" disabled={command.busy || !name.trim()}>저장</button></footer></form>}
    </HqModal>}
  </aside>;
}

function LeadMobileOverview({ row, onActivity, onInformation }: { row: CustomerRecord; onActivity: () => void; onInformation: () => void }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const timeline = useQuery({ queryKey: ['lead-mock-timeline', row.public_id], queryFn: () => apiGet<{items:MockTimelineItem[]}>(`/api/leads/${row.public_id}/timeline`), enabled: policy.has('ACTIVITY.READ'), retry: false });
  const activities = [...(timeline.data?.items ?? [])].reverse();
  const nextActivity = [...activities].filter(item => item.status !== 'COMPLETED' && item.status !== 'CANCELED' && item.dueDate).sort((a,b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
  const fields = [{key:'hospital_name', label:t('lead.hospital')}, {key:'phone',label:t('lead.phone')}, {key:'address',label:t('hqCustomer.fields.address')}, {key:'business_no',label:t('lead.businessNo')}, {key:'keyman_name',label:t('hqCustomer.fields.keymanName')}].filter(field => Object.hasOwn(row, field.key));
  return <section className="lead-mobile-overview" aria-label="리드 요약">
    {policy.has('ACTIVITY.READ') && <div className="lead-overview-next"><span className="lead-overview-next-icon"><CalendarDays size={20} aria-hidden="true" /></span><div><h3>다음 활동</h3>{nextActivity ? <><strong>{nextActivity.subject}</strong><small>{nextActivity.dueDate}</small></> : <small>예정된 날짜가 있는 활동이 없습니다.</small>}</div><button type="button" onClick={onActivity} aria-label="활동 보기">›</button></div>}
    <div className="lead-overview-heading lead-progress-heading"><div><small>WORKFLOW</small><h3>진행 단계</h3></div><button type="button" onClick={onInformation}>상세 보기 ›</button></div>
    {row.status === 'CONTACT_EXCLUDED' ? <p className="lead-progress-excluded">현재 상태: {t('status.CONTACT_EXCLUDED')}</p> : <ol className="lead-progress">{(['NEW','FIRST_VISIT','KEYMAN_MEETING','CONVERTED'] as const).map((stage,index,stages)=>{const current=stages.indexOf(String(row.status) as typeof stage);return <li key={stage} className={index===current?'current':index<current?'completed':''}><span>{index<current?'✓':index+1}</span><small>{t(`status.${stage}`)}</small></li>;})}</ol>}
    <div className="lead-overview-heading"><h3>최근 활동</h3><button type="button" onClick={onActivity}>전체 보기 ›</button></div>
    <HqError error={timeline.error} />
    {!policy.has('ACTIVITY.READ') ? <p>활동을 볼 권한이 없습니다.</p> : timeline.isLoading ? <p>활동을 불러오는 중입니다.</p> : timeline.error ? null : activities.length ? <ul>{activities.slice(0,2).map(item => <li key={item.public_id}><span className="lead-overview-marker" aria-hidden="true">{item.kind === 'CALL' ? <PhoneCall size={18}/> : item.kind === 'EVENT' ? <CalendarDays size={18}/> : <ClipboardPen size={18}/>}</span><div><strong>{item.subject}</strong><small>{item.kind === 'TASK' ? '과업' : item.kind === 'CALL' ? '통화 기록' : '이벤트'}</small></div><time>{item.dueDate || ''}</time></li>)}</ul> : <p>등록된 시험 활동이 없습니다.</p>}
    <div className="lead-overview-heading lead-overview-info"><h3>기본 정보</h3><button type="button" onClick={onInformation}>정보 수정 ›</button></div>
    <dl>{fields.map(field => <div key={field.key}><dt>{field.key === 'hospital_name' ? <Building2 aria-hidden="true" size={16}/> : field.key === 'phone' ? <Phone aria-hidden="true" size={16}/> : field.key === 'address' ? <MapPin aria-hidden="true" size={16}/> : field.key === 'business_no' ? <Hash aria-hidden="true" size={16}/> : <UserRound aria-hidden="true" size={16}/>}<span>{field.label}</span></dt><dd>{displayValue(row[field.key])}</dd></div>)}</dl>
  </section>;
}

type MockTimelineItem = { public_id:string; version:number; kind:'TASK'|'CALL'|'EVENT'; subject:string; note:string; dueDate?:string; status?:string; priority?:string };
function LeadActivities({ publicId, editable, onChanged }: { publicId: string; editable:boolean; onChanged:()=>Promise<void> }) {
  const [status, setStatus] = useState('');
  const [editing,setEditing]=useState<MockTimelineItem|null>(null);
  const [kind,setKind]=useState<MockTimelineItem['kind']>('TASK');
  const [subject,setSubject]=useState(''),[note,setNote]=useState(''),[dueDate,setDueDate]=useState(''),[activityStatus,setActivityStatus]=useState('PLANNED'),[priority,setPriority]=useState('NORMAL'),[open,setOpen]=useState(false);
  const policy=useHqCustomerPolicy(),command=useHqCommand();
  const mock=useQuery({queryKey:['lead-mock-timeline',publicId],queryFn:()=>apiGet<{items:MockTimelineItem[]}>(`/api/leads/${publicId}/timeline`),retry:false,enabled:policy.has('ACTIVITY.READ')});
  const canWrite=editable&&policy.has('ACTIVITY.WRITE');
  const labels={TASK:'과업',CALL:'통화 기록',EVENT:'이벤트'};
  const begin=(next:MockTimelineItem['kind'],item?:MockTimelineItem)=>{setKind(next);setEditing(item??null);setSubject(item?.subject??'');setNote(item?.note??'');setDueDate(item?.dueDate??'');setActivityStatus(item?.status??'PLANNED');setPriority(item?.priority??'NORMAL');command.clearError();setOpen(true);};
  const save=async(event:React.FormEvent)=>{event.preventDefault();try{await command.run(editing?'PATCH':'POST',`/api/leads/${publicId}/timeline${editing?'/'+editing.public_id:''}`,editing?{subject,note,dueDate,status:activityStatus,priority,expectedVersion:editing.version}:{kind,subject,note,dueDate,status:activityStatus,priority});await Promise.all([mock.refetch(),onChanged()]);setOpen(false);}catch{/* preserve input */}};
  const remove=async(item:MockTimelineItem)=>{if(!window.confirm('이 시험 활동을 삭제하시겠습니까?'))return;try{await command.run('DELETE',`/api/leads/${publicId}/timeline/${item.public_id}`,{expectedVersion:item.version});await Promise.all([mock.refetch(),onChanged()]);}catch{/* show error */}};
  const query = useQuery({ queryKey: ['hq-lead-activities', publicId], queryFn: () => apiGet<CustomerRecord[]>(`/api/activities?relatedType=LEAD&relatedPublicId=${publicId}`), retry: false });
  const rows = filterLeadActivities(query.data ?? [], publicId, status);
  const mockItems = (mock.data?.items ?? []).filter(item => !status || (item.status ?? 'PLANNED') === status);
  return <div className="hq-customer-panel lead-timeline">{canWrite&&<div className="lead-activity-actions">{(['TASK','CALL','EVENT'] as const).map(k=><button key={k} type="button" onClick={()=>begin(k)}><span className="lead-activity-action-icon" aria-hidden="true">{k === 'TASK' ? <ClipboardPen size={17}/> : k === 'CALL' ? <PhoneCall size={17}/> : <CalendarDays size={17}/>}</span><span>새 {labels[k]}</span></button>)}</div>}<p>시험 활동은 목업에만 저장됩니다.</p><HqError error={mock.error??command.error}/>{mockItems.map(item=><details key={item.public_id}><summary>{labels[item.kind]} · {item.subject}</summary><p>{item.note||'—'}</p><p>날짜: {item.dueDate||'미정'} · 상태: {({PLANNED:'예정',COMPLETED:'완료',CANCELED:'취소'} as Record<string,string>)[item.status??'PLANNED']} · 우선순위: {({LOW:'낮음',NORMAL:'보통',HIGH:'높음'} as Record<string,string>)[item.priority??'NORMAL']}</p>{canWrite&&<><button type="button" onClick={()=>begin(item.kind,item)}>수정</button><button type="button" onClick={()=>void remove(item)}>삭제</button></>}</details>)}<label>활동 상태 <select aria-label="활동 상태" value={status} onChange={event => setStatus(event.target.value)}><option value="">전체</option><option value="PLANNED">예정</option><option value="COMPLETED">완료</option><option value="CANCELED">취소</option></select></label><HqError error={query.error} />{query.isLoading ? <p>활동을 불러오는 중입니다.</p> : !rows.length && !mockItems.length && !query.error && !mock.error ? <p>표시할 활동이 없습니다.</p> : rows.map(item => <details key={item.public_id}><summary>{displayValue(item.subject ?? item.visit_purpose)} <small>{displayValue(item.start_at ?? item.planned_at)}</small></summary><dl><dt>상태</dt><dd>{displayValue(item.status)}</dd><dt>설명</dt><dd>{displayValue(item.consultation_content ?? item.visit_purpose)}</dd></dl></details>)}{open&&<HqModal title={`${labels[kind]} ${editing?'수정':'등록'}`} onClose={()=>{if(!subject&&!note||window.confirm('입력한 내용을 버리시겠습니까?'))setOpen(false);}} busy={command.busy}><form onSubmit={event=>void save(event)}><label>제목<input required maxLength={200} value={subject} onChange={event=>setSubject(event.target.value)}/></label><label>내용<textarea maxLength={4000} value={note} onChange={event=>setNote(event.target.value)}/></label><label>날짜<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label><label>상태<select value={activityStatus} onChange={event=>setActivityStatus(event.target.value)}><option value="PLANNED">예정</option><option value="COMPLETED">완료</option><option value="CANCELED">취소</option></select></label><label>우선순위<select value={priority} onChange={event=>setPriority(event.target.value)}><option value="LOW">낮음</option><option value="NORMAL">보통</option><option value="HIGH">높음</option></select></label><HqError error={command.error}/><footer><button type="submit" disabled={command.busy||!subject.trim()}>저장</button></footer></form></HqModal>}</div>;
}

export function ConversionLinks({ result }: { result: ConversionResult }) {
  const { t } = useTranslation();
  return <div className="hq-conversion-result" data-testid="conversion-result"><strong>{t('hqCustomer.conversionDone')}</strong><dl>
    {result.accountPublicId && <div><dt>{t('common.account')}</dt><dd><Link data-testid="conversion-account-link" to={`/accounts?record=${result.accountPublicId}`}>{result.accountPublicId}</Link></dd></div>}
    {result.accountPublicId && result.contactPublicId && <div><dt>{t('hqCustomer.tabs.contacts')}</dt><dd><Link data-testid="conversion-contact-link" to={`/accounts?record=${result.accountPublicId}&tab=contacts&contact=${result.contactPublicId}`}>{result.contactPublicId}</Link></dd></div>}
    {result.accountPublicId && (result.opportunityPublicId ? <div><dt>{t('nav.opportunity')}</dt><dd><Link data-testid="conversion-opportunity-link" to={`/opportunities?record=${result.opportunityPublicId}`}>{result.opportunityPublicId}</Link></dd></div> : result.opportunityPublicId === null ? <div><dt>{t('nav.opportunity')}</dt><dd>{t('hqCustomer.skipped')}</dd></div> : null)}
  </dl></div>;
}
function LeadConversion({ row, onClose, onConverted }: { row: CustomerRecord; onClose: () => void; onConverted: () => Promise<void> }) {
  const { t } = useTranslation();
  const policy = useHqCustomerPolicy();
  const command = useHqCommand();
  const query = useQuery({ queryKey: ['hq-lead-conversion', row.public_id], queryFn: () => apiGet<ConversionOptions>(`/api/leads/${row.public_id}/conversion-options`), retry: false });
  const [accountMode, setAccountMode] = useState('NEW');
  const [accountId, setAccountId] = useState('');
  const [contactMode, setContactMode] = useState('NEW');
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState(String(row.keyman_name ?? ''));
  const [opportunityMode, setOpportunityMode] = useState('NEW');
  const [opportunityId, setOpportunityId] = useState('');
  const [opportunityName, setOpportunityName] = useState(String(row.hospital_name));
  const [ownerUserId, setOwnerUserId] = useState(String(row.owner_user_id));
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const selection = JSON.stringify([accountMode, accountId, contactMode, contactId, contactName, opportunityMode, opportunityId, opportunityName, ownerUserId, simulateFailure]);
  const initialSelection = React.useRef(selection);
  const closeConversion = () => { if (result || selection === initialSelection.current || window.confirm('변경한 전환 선택이 저장되지 않았습니다. 닫으시겠습니까?')) onClose(); };
  const contacts = (query.data?.contacts ?? []).filter(item => item.account_public_id === accountId);
  const opportunities = (query.data?.opportunities ?? []).filter(item => item.account_public_id === accountId);
  const payload = { accountMode, ...(accountMode === 'EXISTING' ? { existingAccountPublicId: accountId } : {}), contactMode,
    ...(contactMode === 'EXISTING' ? { existingContactPublicId: contactId } : contactMode === 'NEW' ? { contactName } : {}), opportunityMode,
    ...(opportunityMode === 'EXISTING' ? { existingOpportunityPublicId: opportunityId } : opportunityMode === 'NEW' ? { opportunityName } : {}), ownerUserId: Number(ownerUserId), simulateFailure, expectedVersion: row.version };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { const response = await command.run<ConversionResult>('POST', `/api/leads/${row.public_id}/convert`, payload); setResult(response); await onConverted(); } catch { /* Keep all conversion choices on transactional failure. */ } };
  return <HqModal configId="POP.LEAD.CONVERT" title={t('hqCustomer.convert')} onClose={closeConversion} busy={command.busy} wide>
    {result ? <><ConversionLinks result={result} /><footer><button type="button" onClick={onClose}>{t('app.close')}</button></footer></> : <form className="hq-conversion-form" onSubmit={event => void submit(event)}>
      {Boolean(query.data?.duplicates.length) && <div className="notice warning" data-testid="conversion-duplicates"><strong>{t('hqCustomer.duplicatesFound')}</strong><ul>{query.data!.duplicates.map(item => <li key={item.public_id}>{recordLabel(item)} · {displayValue(item.business_no)}</li>)}</ul></div>}
      <fieldset {...configAnchor('section:lead.conversion', 'section:lead.conversion.0')}><legend>{t('common.account')}</legend><label {...configAnchor('conversion.accountMode', 'convert.account.mode')}>{t('hqCustomer.accountMode')}<select data-testid="conversion-account-mode" value={accountMode} onChange={event => { setAccountMode(event.target.value); setAccountId(''); setContactId(''); setOpportunityId(''); if (event.target.value === 'NEW') { setContactMode('NEW'); setOpportunityMode('NEW'); } }}><option value="NEW">{t('hqCustomer.createNew')}</option><option value="EXISTING">{t('hqCustomer.useExisting')}</option></select></label>
        {accountMode === 'EXISTING' && <label {...configAnchor('conversion.existingAccountPublicId', 'convert.account.existing')}>{t('hqCustomer.existingAccount')}<select data-testid="conversion-account-id" required value={accountId} onChange={event => { setAccountId(event.target.value); setContactId(''); setOpportunityId(''); }}><option value="">{t('common.selectNone')}</option>{query.data?.accounts.map(item => <option key={item.public_id} value={item.public_id}>{recordLabel(item)}</option>)}</select></label>}
      </fieldset>
      <fieldset><legend>{t('hqCustomer.tabs.contacts')}</legend><label {...configAnchor('conversion.contactMode', 'convert.contact.mode')}>{t('hqCustomer.contactMode')}<select data-testid="conversion-contact-mode" value={contactMode} onChange={event => setContactMode(event.target.value)}><option value="NEW">{t('hqCustomer.createNew')}</option><option value="EXISTING" disabled={accountMode !== 'EXISTING'}>{t('hqCustomer.useExisting')}</option><option value="SKIP">{t('hqCustomer.skip')}</option></select></label>
        {contactMode === 'NEW' && <label {...configAnchor('conversion.contactName', 'convert.contact.name')}>{t('hqCustomer.fields.contactName')}<input data-testid="conversion-contact-name" required value={contactName} onChange={event => setContactName(event.target.value)} /></label>}
        {contactMode === 'EXISTING' && <label {...configAnchor('conversion.existingContactPublicId', 'convert.contact.existing')}>{t('hqCustomer.existingContact')}<select data-testid="conversion-contact-id" required value={contactId} onChange={event => setContactId(event.target.value)}><option value="">{t('common.selectNone')}</option>{contacts.map(item => <option key={item.public_id} value={item.public_id}>{recordLabel(item)}</option>)}</select></label>}
      </fieldset>
      <fieldset><legend>{t('nav.opportunity')}</legend><label {...configAnchor('conversion.opportunityMode', 'convert.opportunity.mode')}>{t('hqCustomer.opportunityMode')}<select data-testid="conversion-opportunity-mode" value={opportunityMode} onChange={event => setOpportunityMode(event.target.value)}><option value="NEW">{t('hqCustomer.createNew')}</option><option value="EXISTING" disabled={accountMode !== 'EXISTING'}>{t('hqCustomer.useExisting')}</option><option value="SKIP">{t('hqCustomer.skip')}</option></select></label>
        {opportunityMode === 'NEW' && <label {...configAnchor('conversion.opportunityName', 'convert.opportunity.name')}>{t('opportunity.name')}<input data-testid="conversion-opportunity-name" required value={opportunityName} onChange={event => setOpportunityName(event.target.value)} /></label>}
        {opportunityMode === 'EXISTING' && <label {...configAnchor('conversion.existingOpportunityPublicId', 'convert.opportunity.existing')}>{t('hqCustomer.existingOpportunity')}<select data-testid="conversion-opportunity-id" required value={opportunityId} onChange={event => setOpportunityId(event.target.value)}><option value="">{t('common.selectNone')}</option>{opportunities.map(item => <option key={item.public_id} value={item.public_id}>{recordLabel(item)}</option>)}</select></label>}
      </fieldset>
      <label {...configAnchor('conversion.ownerUserId', 'convert.owner')}>{t('lead.owner')}<select data-testid="conversion-owner" value={ownerUserId} onChange={event => setOwnerUserId(event.target.value)}>{query.data?.owners.map(owner => <option key={owner.userId} value={owner.userId}>{owner.name}</option>)}</select></label>
      <LeadConversionSummary account={accountMode === 'NEW' ? `${t('hqCustomer.createNew')} · ${displayValue(row.hospital_name)}` : `${t('hqCustomer.useExisting')} · ${displayValue(query.data?.accounts.find(item => item.public_id === accountId)?.account_name)}`} contact={contactMode === 'SKIP' ? t('hqCustomer.skip') : contactMode === 'NEW' ? `${t('hqCustomer.createNew')} · ${contactName}` : `${t('hqCustomer.useExisting')} · ${displayValue(contacts.find(item => item.public_id === contactId)?.contact_name)}`} opportunity={opportunityMode === 'SKIP' ? t('hqCustomer.skip') : opportunityMode === 'NEW' ? `${t('hqCustomer.createNew')} · ${opportunityName}` : `${t('hqCustomer.useExisting')} · ${displayValue(opportunities.find(item => item.public_id === opportunityId)?.opportunity_name)}`} owner={query.data?.owners.find(item => String(item.userId) === ownerUserId)?.name ?? '—'} />
      <label className="hq-checkbox-row"><input type="checkbox" data-testid="conversion-simulate-failure" checked={simulateFailure} onChange={event => setSimulateFailure(event.target.checked)} />{t('hqCustomer.simulateConversionFailure')}</label>
      <HqError error={command.error ?? query.error} />
      <footer><button type="button" onClick={closeConversion} disabled={command.busy}>{t('common.cancel')}</button><button type="submit" data-testid="confirm-conversion" {...configAnchor('LEAD.convert', 'convert.submit')} className="button-primary" disabled={command.busy || !query.data || !policy.can('LEAD.convert', row, payload)}>{t('hqCustomer.confirmConversion')}</button></footer>
    </form>}
  </HqModal>;
}


