import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalization } from './market/globalization-context';
import {
  LEAD_INTERESTS,
  LEAD_SOURCES,
  LEAD_STAGES,
  MOCK_LEAD_OWNERS,
  type LeadInterest,
  type LeadRecord,
  type LeadSource,
  type LeadStage
} from './features/lead/lead-model';
import { changeMockLeadStage, createMockLead, loadMockLeads, resetMockLeads } from './features/lead/lead-mock-service';
import './styles/lead-workspace.css';

type LeadTab = 'overview' | 'activity' | 'contacts' | 'opportunities' | 'notes' | 'attachments';

function formatDate(value: string | undefined, locale: string, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }
  ).format(date);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="lead-v2-info-row"><span>{label}</span><strong>{value || '-'}</strong></div>;
}

function ActivityGlyph({ type }: { type: string }) {
  const glyph = type === 'CALL' ? '☎' : type === 'EMAIL' ? '✉' : type === 'MEETING' ? '●' : '◆';
  return <span className={`lead-v2-activity-glyph type-${type}`}>{glyph}</span>;
}

export function LeadsPage() {
  const { t, i18n } = useTranslation();
  const { globalization } = useGlobalization();
  const [rows, setRows] = useState<LeadRecord[]>(() => loadMockLeads());
  const [selectedId, setSelectedId] = useState(() => loadMockLeads()[0]?.leadId ?? '');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'ALL'>('ALL');
  const [interestFilter, setInterestFilter] = useState<LeadInterest | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [tab, setTab] = useState<LeadTab>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickOrganization, setQuickOrganization] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickSource, setQuickSource] = useState<LeadSource>('WEB');
  const [quickOwner, setQuickOwner] = useState('USER001');

  const selected = rows.find(row => row.leadId === selectedId) ?? rows[0];

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return rows
      .filter(row => !keyword || [row.leadName, row.organizationName, row.phone ?? ''].some(value => value.toLocaleLowerCase().includes(keyword)))
      .filter(row => stageFilter === 'ALL' || row.stage === stageFilter)
      .filter(row => interestFilter === 'ALL' || row.interestLevel === interestFilter)
      .filter(row => ownerFilter === 'ALL' || row.ownerUserId === ownerFilter)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, search, stageFilter, interestFilter, ownerFilter]);

  const money = (value?: number) => value == null
    ? '-'
    : new Intl.NumberFormat(i18n.language, { style: 'currency', currency: globalization.currencyCode, maximumFractionDigits: 0 }).format(value);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const selectLead = (leadId: string) => {
    setSelectedId(leadId);
    setTab('overview');
    setMobileDetailOpen(true);
  };

  const updateStage = (stage: LeadStage) => {
    if (!selected) return;
    const next = changeMockLeadStage(rows, selected.leadId, stage);
    setRows(next);
    notify(t('leadV2.toast.stageUpdated'));
  };

  const createLead = (openDetail: boolean) => {
    if (!quickName.trim() || !quickOrganization.trim()) {
      notify(t('leadV2.quick.required'));
      return;
    }
    const next = createMockLead(rows, {
      leadName: quickName,
      organizationName: quickOrganization,
      phone: quickPhone,
      source: quickSource,
      ownerUserId: quickOwner
    });
    setRows(next);
    setSelectedId(next[0].leadId);
    setDrawerOpen(false);
    setQuickName('');
    setQuickOrganization('');
    setQuickPhone('');
    setQuickSource('WEB');
    setQuickOwner('USER001');
    setMobileDetailOpen(openDetail);
    setTab('overview');
    notify(t('leadV2.toast.created'));
  };

  const resetMock = () => {
    const next = resetMockLeads();
    setRows(next);
    setSelectedId(next[0]?.leadId ?? '');
    setSearch('');
    setStageFilter('ALL');
    setInterestFilter('ALL');
    setOwnerFilter('ALL');
    setMobileDetailOpen(false);
    setTab('overview');
    notify(t('leadV2.toast.reset'));
  };

  const renderOverview = (lead: LeadRecord) => (
    <div className="lead-v2-overview-grid">
      <section className="lead-v2-card lead-v2-basic-card">
        <div className="lead-v2-card-title"><strong>{t('leadV2.sections.basic')}</strong></div>
        <InfoRow label={t('leadV2.fields.organization')} value={lead.organizationName} />
        <InfoRow label={t('leadV2.fields.organizationType')} value={lead.organizationType} />
        <InfoRow label={t('leadV2.fields.phone')} value={lead.phone} />
        <InfoRow label={t('leadV2.fields.email')} value={lead.email} />
        <InfoRow label={t('leadV2.fields.region')} value={lead.region} />
        <InfoRow label={t('leadV2.fields.address')} value={lead.address} />
        <InfoRow label={t('leadV2.fields.source')} value={t(`leadV2.source.${lead.source}`)} />
        <InfoRow label={t('leadV2.fields.expectedAmount')} value={money(lead.expectedAmount)} />
      </section>

      <section className="lead-v2-card">
        <div className="lead-v2-card-title"><strong>{t('leadV2.sections.recentActivity')}</strong></div>
        <div className="lead-v2-timeline">
          {lead.activities.slice(0, 4).map(activity => (
            <div className="lead-v2-timeline-item" key={activity.id}>
              <ActivityGlyph type={activity.type} />
              <div><span>{formatDate(activity.occurredAt, i18n.language, true)}</span><strong>{activity.title}</strong><small>{activity.summary}</small><em>{activity.ownerName}</em></div>
            </div>
          ))}
          {lead.activities.length === 0 && <p className="lead-v2-empty-inline">{t('leadV2.empty.activity')}</p>}
        </div>
      </section>

      <section className="lead-v2-card lead-v2-next-card">
        <div className="lead-v2-card-title"><strong>{t('leadV2.sections.nextAction')}</strong></div>
        <div className="lead-v2-next-action"><span>→</span><div><strong>{lead.nextAction || '-'}</strong><small>{formatDate(lead.nextActionAt, i18n.language, true)}</small></div></div>
      </section>

      <section className="lead-v2-card">
        <div className="lead-v2-card-title"><strong>{t('leadV2.sections.contacts')}</strong></div>
        <div className="lead-v2-contact-list">
          {lead.contacts.map(contact => <div className="lead-v2-contact" key={contact.id}><span>{contact.name.slice(0, 1)}</span><div><strong>{contact.name}</strong><small>{contact.role}</small><em>{contact.phone ?? contact.email ?? '-'}</em></div></div>)}
          {lead.contacts.length === 0 && <p className="lead-v2-empty-inline">{t('leadV2.empty.contacts')}</p>}
        </div>
      </section>

      <section className="lead-v2-card">
        <div className="lead-v2-card-title"><strong>{t('leadV2.sections.tags')}</strong></div>
        <div className="lead-v2-tags">{lead.tags.length ? lead.tags.map(tag => <span key={tag}>#{tag}</span>) : <span>-</span>}</div>
      </section>

      <section className="lead-v2-card">
        <div className="lead-v2-card-title"><strong>{t('leadV2.sections.note')}</strong></div>
        <p className="lead-v2-note">{lead.noteSummary || '-'}</p>
      </section>
    </div>
  );

  const renderTab = (lead: LeadRecord) => {
    if (tab === 'overview') return renderOverview(lead);
    if (tab === 'activity') return <section className="lead-v2-card lead-v2-wide-card"><div className="lead-v2-card-title"><strong>{t('leadV2.sections.recentActivity')}</strong></div><div className="lead-v2-timeline">{lead.activities.map(activity => <div className="lead-v2-timeline-item" key={activity.id}><ActivityGlyph type={activity.type} /><div><span>{formatDate(activity.occurredAt, i18n.language, true)}</span><strong>{activity.title}</strong><small>{activity.summary}</small><em>{activity.ownerName}</em></div></div>)}{lead.activities.length === 0 && <p className="lead-v2-empty-inline">{t('leadV2.empty.activity')}</p>}</div></section>;
    if (tab === 'contacts') return <section className="lead-v2-card lead-v2-wide-card"><div className="lead-v2-card-title"><strong>{t('leadV2.sections.contacts')}</strong></div><div className="lead-v2-contact-list">{lead.contacts.map(contact => <div className="lead-v2-contact lead-v2-contact-wide" key={contact.id}><span>{contact.name.slice(0, 1)}</span><div><strong>{contact.name}</strong><small>{contact.role}</small><em>{[contact.phone, contact.email].filter(Boolean).join(' · ')}</em></div></div>)}{lead.contacts.length === 0 && <p className="lead-v2-empty-inline">{t('leadV2.empty.contacts')}</p>}</div></section>;
    if (tab === 'opportunities') return <section className="lead-v2-card lead-v2-wide-card"><div className="lead-v2-card-title"><strong>{t('leadV2.sections.opportunities')}</strong></div><p className="lead-v2-placeholder-count">{t('leadV2.opportunityCount', { count: lead.opportunityCount })}</p>{lead.opportunityCount === 0 && <p className="lead-v2-empty-inline">{t('leadV2.empty.opportunities')}</p>}</section>;
    if (tab === 'notes') return <section className="lead-v2-card lead-v2-wide-card"><div className="lead-v2-card-title"><strong>{t('leadV2.sections.note')}</strong></div><p className="lead-v2-note">{lead.noteSummary || '-'}</p></section>;
    return <section className="lead-v2-card lead-v2-wide-card"><div className="lead-v2-card-title"><strong>{t('leadV2.sections.attachments')}</strong></div><p className="lead-v2-empty-inline">{t('leadV2.empty.attachments')}</p></section>;
  };

  return (
    <section className={`lead-v2${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
      <header className="lead-v2-page-header">
        <div>
          <div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · LEAD</span><span className="lead-v2-mock-badge">{t('leadV2.mockMode')}</span></div>
          <h2>{t('leadV2.title')}</h2>
          <p>{t('leadV2.subtitle')}</p>
        </div>
        <div className="lead-v2-header-actions"><button type="button" className="lead-v2-button ghost" onClick={resetMock}>{t('leadV2.resetMock')}</button><button type="button" className="lead-v2-button primary" onClick={() => setDrawerOpen(true)}>{t('leadV2.newLead')}</button></div>
      </header>

      <div className="lead-v2-toolbar">
        <label className="lead-v2-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('leadV2.searchPlaceholder')} /></label>
        <select value={stageFilter} onChange={event => setStageFilter(event.target.value as LeadStage | 'ALL')}><option value="ALL">{t('leadV2.filters.allStage')}</option>{LEAD_STAGES.map(stage => <option value={stage} key={stage}>{t(`leadV2.stage.${stage}`)}</option>)}</select>
        <select value={interestFilter} onChange={event => setInterestFilter(event.target.value as LeadInterest | 'ALL')}><option value="ALL">{t('leadV2.filters.allInterest')}</option>{LEAD_INTERESTS.map(level => <option value={level} key={level}>{t(`leadV2.interest.${level}`)}</option>)}</select>
        <select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="ALL">{t('leadV2.filters.allOwner')}</option>{MOCK_LEAD_OWNERS.map(owner => <option value={owner.id} key={owner.id}>{owner.name}</option>)}</select>
      </div>

      <div className="lead-v2-workspace">
        <aside className="lead-v2-list-pane">
          <div className="lead-v2-list-header"><div><strong>{t('leadV2.listTitle')}</strong><span>{t('leadV2.count', { count: filteredRows.length })}</span></div></div>
          <div className="lead-v2-list-columns"><span>{t('leadV2.columns.lead')}</span><span>{t('leadV2.columns.interest')}</span><span>{t('leadV2.columns.stage')}</span><span>{t('leadV2.columns.owner')}</span><span>{t('leadV2.columns.recent')}</span></div>
          <div className="lead-v2-list-body">
            {filteredRows.map(lead => <button type="button" key={lead.leadId} onClick={() => selectLead(lead.leadId)} className={`lead-v2-row${lead.leadId === selected?.leadId ? ' selected' : ''}`}>
              <span className="lead-v2-lead-cell"><strong>{lead.leadName}</strong><small>{lead.organizationName}</small><em>{lead.region}</em></span>
              <span><i className={`lead-v2-pill interest-${lead.interestLevel}`}>{t(`leadV2.interest.${lead.interestLevel}`)}</i></span>
              <span><i className={`lead-v2-pill stage-${lead.stage}`}>{t(`leadV2.stage.${lead.stage}`)}</i></span>
              <span className="lead-v2-owner"><b>{lead.ownerName.slice(0, 1)}</b>{lead.ownerName}</span>
              <span className="lead-v2-date">{formatDate(lead.lastActivityAt ?? lead.updatedAt, i18n.language)}</span>
            </button>)}
          </div>
        </aside>

        <article className="lead-v2-detail-pane">
          {!selected && <div className="lead-v2-empty-detail">{t('leadV2.empty.selection')}</div>}
          {selected && <>
            <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('leadV2.actions.back')}</button>
            <div className="lead-v2-detail-header">
              <div className="lead-v2-detail-identity"><span>{selected.leadNo}</span><div className="lead-v2-name-line"><h3>{selected.leadName}</h3><i className={`lead-v2-pill stage-${selected.stage}`}>{t(`leadV2.stage.${selected.stage}`)}</i></div><p>{selected.organizationName} · {selected.region}</p><small>{t('leadV2.lastUpdated', { date: formatDate(selected.updatedAt, i18n.language, true) })}</small></div>
              <div className="lead-v2-detail-actions">
                {selected.phone ? <a className="lead-v2-action-button" href={`tel:${selected.phone}`}>☎ <span>{t('leadV2.actions.call')}</span></a> : <button type="button" className="lead-v2-action-button" disabled>☎ <span>{t('leadV2.actions.call')}</span></button>}
                {selected.email ? <a className="lead-v2-action-button" href={`mailto:${selected.email}`}>✉ <span>{t('leadV2.actions.email')}</span></a> : <button type="button" className="lead-v2-action-button" disabled>✉ <span>{t('leadV2.actions.email')}</span></button>}
                <button type="button" className="lead-v2-action-button" onClick={() => notify(t('leadV2.toast.meetingPlanned'))}>□ <span>{t('leadV2.actions.meeting')}</span></button>
                <button type="button" className="lead-v2-action-button convert" onClick={() => notify(t('leadV2.toast.conversionPlanned'))}>→ <span>{t('leadV2.actions.convert')}</span></button>
              </div>
            </div>

            <div className="lead-v2-summary-strip">
              <div><span>{t('leadV2.fields.owner')}</span><strong>{selected.ownerName}</strong></div>
              <div><span>{t('leadV2.fields.interest')}</span><strong>{t(`leadV2.interest.${selected.interestLevel}`)}</strong></div>
              <div><span>{t('leadV2.fields.expectedAmount')}</span><strong>{money(selected.expectedAmount)}</strong></div>
              <label><span>{t('leadV2.fields.stage')}</span><select value={selected.stage} onChange={event => updateStage(event.target.value as LeadStage)}>{LEAD_STAGES.map(stage => <option key={stage} value={stage}>{t(`leadV2.stage.${stage}`)}</option>)}</select></label>
            </div>

            <nav className="lead-v2-tabs">{(['overview', 'activity', 'contacts', 'opportunities', 'notes', 'attachments'] as LeadTab[]).map(item => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(`leadV2.tabs.${item}`)}</button>)}</nav>
            <div className="lead-v2-detail-content">{renderTab(selected)}</div>
          </>}
        </article>
      </div>

      {drawerOpen && <div className="lead-v2-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
        <aside className="lead-v2-drawer" onMouseDown={event => event.stopPropagation()}>
          <div className="lead-v2-drawer-header"><div><strong>{t('leadV2.quick.title')}</strong><p>{t('leadV2.quick.help')}</p></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('app.close')}>×</button></div>
          <div className="lead-v2-form">
            <label><span>{t('leadV2.quick.name')} *</span><input value={quickName} onChange={event => setQuickName(event.target.value)} /></label>
            <label><span>{t('leadV2.quick.organization')} *</span><input value={quickOrganization} onChange={event => setQuickOrganization(event.target.value)} /></label>
            <label><span>{t('leadV2.quick.phone')}</span><input value={quickPhone} onChange={event => setQuickPhone(event.target.value)} inputMode="tel" /></label>
            <label><span>{t('leadV2.quick.source')}</span><select value={quickSource} onChange={event => setQuickSource(event.target.value as LeadSource)}>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`leadV2.source.${source}`)}</option>)}</select></label>
            <label><span>{t('leadV2.quick.owner')} *</span><select value={quickOwner} onChange={event => setQuickOwner(event.target.value)}>{MOCK_LEAD_OWNERS.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
          </div>
          <div className="lead-v2-drawer-actions"><button type="button" className="lead-v2-button primary" onClick={() => createLead(false)}>{t('leadV2.quick.create')}</button><button type="button" className="lead-v2-button secondary" onClick={() => createLead(true)}>{t('leadV2.quick.createDetail')}</button><button type="button" className="lead-v2-button ghost" onClick={() => setDrawerOpen(false)}>{t('leadV2.quick.cancel')}</button></div>
        </aside>
      </div>}

      {toast && <div className="lead-v2-toast" role="status">✓ {toast}</div>}
    </section>
  );
}
