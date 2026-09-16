import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalization } from './market/globalization-context';
import {
  API_LEAD_STEPS,
  LEAD_SOURCES,
  LEAD_STAGES,
  MOCK_LEAD_OWNERS,
  type LeadRecord,
  type LeadSource,
  type LeadStage
} from './features/lead/lead-model';
import { changeMockLeadStage, createMockLead, loadMockLeads, resetMockLeads } from './features/lead/lead-mock-service';
import {
  AbDataList,
  AbDetailFooter,
  AbEmptyState,
  AbEntityBadges,
  AbListToolbar,
  AbMobileFab,
  AbPagination,
  AbSectionAccordion,
  AbStepProgress,
  AbWorkspace,
  countryFlag,
  type AbDataColumn
} from './ui/ab-workspace';
import './styles/lead-workspace.css';

type SectionId = 'keyman' | 'hospitalScale' | 'system' | 'activity' | 'conversion';
type ListFilter = 'all' | 'inProgress' | 'converted' | 'excluded';
type LastActivityFilter = 'ALL' | '7' | '30' | 'NONE';

function formatDate(value: string | undefined, locale: string, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }
  ).format(date);
}

function mockStageToStep(stage: LeadStage): number {
  if (stage === 'NEW') return 0;
  if (stage === 'CONTACTED' || stage === 'CONSULTING') return 1;
  if (stage === 'PROPOSAL' || stage === 'REVIEW' || stage === 'NEGOTIATION') return 2;
  if (stage === 'CONVERTED') return 3;
  return 0;
}

function matchesLastActivity(value: string | undefined, filter: LastActivityFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'NONE') return !value;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const ageDays = (Date.now() - timestamp) / 86400000;
  return ageDays >= 0 && ageDays <= Number(filter);
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
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'ALL'>('ALL');
  const [lastActivityFilter, setLastActivityFilter] = useState<LastActivityFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    keyman: false, hospitalScale: false, system: false, activity: false, conversion: false
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickOrganization, setQuickOrganization] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickCountry, setQuickCountry] = useState('KR');
  const [quickAddress, setQuickAddress] = useState('');
  const [quickSource, setQuickSource] = useState<LeadSource>('WEB');
  const [quickOwner, setQuickOwner] = useState('USER001');

  const countries = useMemo(() => [...new Set(rows.map(row => row.country).filter(Boolean))].sort(), [rows]);
  const regions = useMemo(() => [...new Set(rows.filter(row => countryFilter === 'ALL' || row.country === countryFilter).map(row => row.region).filter(Boolean))].sort(), [rows, countryFilter]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return rows
      .filter(row => {
        if (!keyword) return true;
        const keyman = row.contacts.map(contact => contact.name).join(' ');
        return [row.leadNo, row.leadName, row.organizationName, row.phone ?? '', row.ownerName, keyman]
          .some(value => value.toLocaleLowerCase().includes(keyword));
      })
      .filter(row => {
        if (listFilter === 'inProgress') return row.stage !== 'CONVERTED' && row.stage !== 'DISQUALIFIED';
        if (listFilter === 'converted') return row.stage === 'CONVERTED';
        if (listFilter === 'excluded') return row.stage === 'DISQUALIFIED';
        return true;
      })
      .filter(row => stageFilter === 'ALL' || row.stage === stageFilter)
      .filter(row => ownerFilter === 'ALL' || row.ownerUserId === ownerFilter)
      .filter(row => countryFilter === 'ALL' || row.country === countryFilter)
      .filter(row => regionFilter === 'ALL' || row.region === regionFilter)
      .filter(row => sourceFilter === 'ALL' || row.source === sourceFilter)
      .filter(row => matchesLastActivity(row.lastActivityAt, lastActivityFilter))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, search, listFilter, stageFilter, ownerFilter, countryFilter, regionFilter, sourceFilter, lastActivityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = rows.find(row => row.leadId === selectedId) ?? null;

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const money = (value?: number) => value == null
    ? '-'
    : new Intl.NumberFormat(i18n.language, { style: 'currency', currency: globalization.currencyCode, maximumFractionDigits: 0 }).format(value);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const selectLead = (leadId: string) => {
    setSelectedId(leadId);
    setOpenSections({ keyman: false, hospitalScale: false, system: false, activity: true, conversion: false });
    setMobileDetailOpen(true);
  };

  const toggleSection = (id: SectionId) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  const stepLabels = API_LEAD_STEPS.map(step => ({ id: step, label: t(`lead.steps.${step}`) }));

  const updateStage = (stage: LeadStage) => {
    if (!selected) return;
    const next = changeMockLeadStage(rows, selected.leadId, stage);
    setRows(next);
    notify(t('lead.toast.statusUpdated'));
  };

  const createLead = (openDetail: boolean) => {
    if (!quickName.trim() || !quickOrganization.trim() || !quickPhone.trim()) {
      notify(t('lead.quick.required'));
      return;
    }
    const next = createMockLead(rows, {
      leadName: quickName,
      organizationName: quickOrganization,
      phone: quickPhone,
      country: quickCountry,
      address: quickAddress,
      source: quickSource,
      ownerUserId: quickOwner
    });
    setRows(next);
    setSelectedId(next[0].leadId);
    setDrawerOpen(false);
    setQuickName('');
    setQuickOrganization('');
    setQuickPhone('');
    setQuickCountry('KR');
    setQuickAddress('');
    setQuickSource('WEB');
    setQuickOwner('USER001');
    setPage(1);
    setMobileDetailOpen(openDetail);
    setOpenSections({ keyman: true, hospitalScale: false, system: false, activity: false, conversion: false });
    notify(t('lead.toast.created'));
  };

  const resetFilters = () => {
    setSearch('');
    setListFilter('all');
    setStageFilter('ALL');
    setOwnerFilter('ALL');
    setCountryFilter('ALL');
    setRegionFilter('ALL');
    setSourceFilter('ALL');
    setLastActivityFilter('ALL');
    setPage(1);
  };

  const resetMock = () => {
    const next = resetMockLeads();
    setRows(next);
    setSelectedId(next[0]?.leadId ?? '');
    resetFilters();
    setMobileDetailOpen(false);
    notify(t('lead.toast.reset'));
  };

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    setPage(clamped);
    const first = filteredRows[(clamped - 1) * pageSize];
    if (first) setSelectedId(first.leadId);
  };

  const changePageSize = (nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
    if (filteredRows[0]) setSelectedId(filteredRows[0].leadId);
  };

  const listColumns: AbDataColumn[] = [
    { key: 'lead', label: t('lead.columns.lead'), width: 'minmax(180px,1.6fr)', mobileRole: 'primary', className: 'primary-cell' },
    { key: 'country', label: t('lead.columns.country'), width: '105px' },
    { key: 'stage', label: t('lead.columns.stage'), width: '88px', mobileRole: 'badge' },
    { key: 'owner', label: t('lead.columns.owner'), width: '92px' },
    { key: 'phone', label: t('lead.columns.phone'), width: '108px' },
    { key: 'lastActivity', label: t('lead.columns.lastActivity'), width: '94px' },
    { key: 'nextAction', label: t('lead.columns.nextAction'), width: 'minmax(125px,1fr)' }
  ];

  const renderConceptBDetail = (lead: LeadRecord) => (
    <>
      <div className="ab-basic-panel">
        <h4>{t('lead.sections.basic')}</h4>
        <InfoRow label={t('lead.fields.hospitalName')} value={lead.organizationName} />
        <InfoRow label={t('lead.fields.contactName')} value={lead.leadName} />
        <InfoRow label={t('lead.fields.phone')} value={lead.phone} />
        <InfoRow label={t('lead.fields.country')} value={<span className="ab-list-country"><i>{countryFlag(lead.country)}</i>{lead.country}</span>} />
        <InfoRow label={t('lead.fields.region')} value={lead.region} />
        <InfoRow label={t('lead.fields.address')} value={lead.address} />
        <InfoRow label={t('lead.fields.owner')} value={lead.ownerName} />
      </div>
      <div className="ab-sections">
        <AbSectionAccordion id="keyman" title={t('lead.sections.keyman')} hint={lead.contacts.length ? `${lead.contacts.length}` : undefined} open={openSections.keyman} onToggle={() => toggleSection('keyman')} incomplete={!lead.contacts.length}>
          <div className="lead-v2-contact-list">
            {lead.contacts.map(contact => (
              <div className="lead-v2-contact lead-v2-contact-wide" key={contact.id}>
                <span>{contact.name.slice(0, 1)}</span>
                <div><strong>{contact.name}</strong><small>{contact.role}</small><em>{[contact.phone, contact.email].filter(Boolean).join(' · ')}</em></div>
              </div>
            ))}
            {!lead.contacts.length && <p className="lead-v2-empty-inline">{t('lead.empty.keyman')}</p>}
          </div>
        </AbSectionAccordion>
        <AbSectionAccordion id="hospitalScale" title={t('lead.sections.hospitalScale')} hint="—" open={openSections.hospitalScale} onToggle={() => toggleSection('hospitalScale')} incomplete>
          <InfoRow label={t('lead.fields.bedCount')} value="-" />
        </AbSectionAccordion>
        <AbSectionAccordion id="system" title={t('lead.sections.system')} open={openSections.system} onToggle={() => toggleSection('system')} incomplete>
          <InfoRow label={t('lead.fields.mainSystem')} value="-" />
          <InfoRow label={t('lead.fields.subSystem')} value="-" />
        </AbSectionAccordion>
        <AbSectionAccordion id="activity" title={t('lead.sections.activity')} hint={lead.activities.length ? `${lead.activities.length}` : undefined} open={openSections.activity} onToggle={() => toggleSection('activity')}>
          <div className="lead-v2-timeline">
            {lead.activities.map(activity => (
              <div className="lead-v2-timeline-item" key={activity.id}>
                <ActivityGlyph type={activity.type} />
                <div><span>{formatDate(activity.occurredAt, i18n.language, true)}</span><strong>{activity.title}</strong><small>{activity.summary}</small></div>
              </div>
            ))}
            {!lead.activities.length && <p className="lead-v2-empty-inline">{t('lead.empty.activity')}</p>}
          </div>
        </AbSectionAccordion>
        <AbSectionAccordion id="conversion" title={t('lead.sections.conversion')} open={openSections.conversion} onToggle={() => toggleSection('conversion')}>
          <p className="lead-v2-empty-inline">{t('lead.opportunityCount', { count: lead.opportunityCount })}</p>
          <button type="button" className="lead-v2-button primary" onClick={() => notify(t('lead.toast.converted'))}>{t('lead.actions.convert')}</button>
        </AbSectionAccordion>
      </div>
    </>
  );

  const listPane = (
    <>
      <div className="lead-v2-list-header"><div><strong>{t('lead.listTitle')}</strong><span>{t('lead.count', { count: filteredRows.length })}</span></div></div>
      <AbDataList
        columns={listColumns}
        rows={pagedRows}
        rowKey={lead => lead.leadId}
        selectedKey={selectedId}
        onRowClick={lead => selectLead(lead.leadId)}
        ariaLabel={t('lead.listTitle')}
        empty={<AbEmptyState title={t('lead.empty.search')} />}
        renderCells={lead => [
          <span className="ab-primary-stack" title={`${lead.organizationName} · ${lead.leadName} · ${lead.leadNo}`}><strong>{lead.organizationName}</strong><small>{lead.leadName}</small><em>{lead.leadNo}</em></span>,
          <span className="ab-cell-stack" title={`${lead.country} · ${lead.region}`}><strong className="ab-lead-country"><i>{countryFlag(lead.country)}</i>{lead.country}</strong><small>{lead.region}</small></span>,
          <i className={`lead-v2-pill stage-${lead.stage}`}>{t(`leadV2.stage.${lead.stage}`)}</i>,
          <span className="lead-v2-owner"><b>{lead.ownerName.slice(0, 1)}</b>{lead.ownerName}</span>,
          <span title={lead.phone}>{lead.phone ?? '-'}</span>,
          <span>{formatDate(lead.lastActivityAt, i18n.language)}</span>,
          <span className="ab-next-action-cell" title={lead.nextAction}><strong>{lead.nextAction ?? '-'}</strong><small>{formatDate(lead.nextActionAt, i18n.language)}</small></span>
        ]}
      />
      <AbPagination
        page={currentPage}
        pageSize={pageSize}
        totalItems={filteredRows.length}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        rowsPerPageLabel={t('lead.pagination.rowsPerPage')}
        previousLabel={t('lead.pagination.previous')}
        nextLabel={t('lead.pagination.next')}
        pageStatus={t('lead.pagination.pageStatus', { page: currentPage, pages: totalPages, count: filteredRows.length })}
      />
    </>
  );

  const detailPane = (
    <>
      {!selected && <div className="lead-v2-empty-detail">{t('lead.empty.detail')}</div>}
      {selected && <>
        <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('lead.actions.back')}</button>
        <div className="lead-v2-detail-header">
          <div className="lead-v2-detail-identity">
            <span>{selected.leadNo}</span>
            <div className="lead-v2-name-line"><h3>{selected.organizationName}</h3><i className={`lead-v2-pill stage-${selected.stage}`}>{t(`leadV2.stage.${selected.stage}`)}</i></div>
            <p>{selected.leadName} · <span className="ab-list-country"><i>{countryFlag(selected.country)}</i>{selected.country} · {selected.region}</span></p>
            <AbEntityBadges badges={[
              { label: t(`leadV2.stage.${selected.stage}`), tone: 'info' },
              { label: t(`lead.interest.${selected.interestLevel}`), tone: 'neutral' }
            ]} />
            <small>{t('lead.lastUpdated', { date: formatDate(selected.updatedAt, i18n.language, true) })}</small>
          </div>
          <div className="lead-v2-detail-actions">
            {selected.phone ? <a className="lead-v2-action-button" href={`tel:${selected.phone}`}>☎ <span>{t('lead.actions.call')}</span></a> : <button type="button" className="lead-v2-action-button" disabled>☎ <span>{t('lead.actions.call')}</span></button>}
            {selected.email ? <a className="lead-v2-action-button" href={`mailto:${selected.email}`}>✉ <span>{t('lead.actions.email')}</span></a> : <button type="button" className="lead-v2-action-button" disabled>✉ <span>{t('lead.actions.email')}</span></button>}
            <button type="button" className="lead-v2-action-button convert" onClick={() => notify(t('lead.toast.converted'))}>→ <span>{t('lead.actions.convert')}</span></button>
          </div>
        </div>
        <AbStepProgress steps={stepLabels} currentIndex={mockStageToStep(selected.stage)} mobileLabel={`${mockStageToStep(selected.stage) + 1}/${API_LEAD_STEPS.length}`} />
        <div className="lead-v2-summary-strip">
          <div><span>{t('lead.fields.owner')}</span><strong>{selected.ownerName}</strong></div>
          <div><span>{t('lead.fields.interest')}</span><strong>{t(`lead.interest.${selected.interestLevel}`)}</strong></div>
          <div><span>{t('lead.fields.expectedAmount')}</span><strong>{money(selected.expectedAmount)}</strong></div>
          <label><span>{t('lead.fields.stage')}</span><select value={selected.stage} onChange={event => updateStage(event.target.value as LeadStage)}>{LEAD_STAGES.map(stage => <option key={stage} value={stage}>{t(`leadV2.stage.${stage}`)}</option>)}</select></label>
        </div>
        <div className="lead-v2-detail-content">{renderConceptBDetail(selected)}</div>
        <AbDetailFooter draftLabel={t('lead.actions.saveDraft')} saveLabel={t('lead.actions.save')} onDraft={() => notify(t('lead.toast.draftSaved'))} onSave={() => notify(t('lead.toast.saved'))} />
      </>}
    </>
  );

  return (
    <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
      <header className="lead-v2-page-header">
        <div>
          <div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · LEAD</span><span className="lead-v2-mock-badge">{t('lead.mockMode')}</span></div>
          <h2>{t('lead.title')}</h2>
          <p>{t('lead.subtitle')}</p>
        </div>
        <div className="lead-v2-header-actions">
          <button type="button" className="lead-v2-button ghost" onClick={resetMock}>{t('lead.actions.resetMock')}</button>
          <button type="button" className="lead-v2-button primary" onClick={() => setDrawerOpen(true)}>+ {t('lead.actions.create')}</button>
        </div>
      </header>

      <div className="lead-v2-filter-tabs">
        {(['all', 'inProgress', 'converted', 'excluded'] as ListFilter[]).map(id => (
          <button key={id} type="button" className={listFilter === id ? 'active' : ''} onClick={() => { setListFilter(id); setPage(1); }}>{t(`lead.filters.${id}`)}</button>
        ))}
      </div>

      <AbListToolbar
        searchValue={search}
        onSearchChange={value => { setSearch(value); setPage(1); }}
        searchPlaceholder={t('lead.searchPlaceholder')}
        onReset={resetFilters}
        resetLabel={t('lead.actions.resetFilters')}
        filters={<>
          <select value={stageFilter} onChange={event => { setStageFilter(event.target.value as LeadStage | 'ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allStage')}</option>{LEAD_STAGES.map(stage => <option value={stage} key={stage}>{t(`leadV2.stage.${stage}`)}</option>)}</select>
          <select value={ownerFilter} onChange={event => { setOwnerFilter(event.target.value); setPage(1); }}><option value="ALL">{t('lead.filters.allOwner')}</option>{MOCK_LEAD_OWNERS.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select>
          <select value={countryFilter} onChange={event => { setCountryFilter(event.target.value); setRegionFilter('ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allCountry')}</option>{countries.map(country => <option key={country} value={country}>{country}</option>)}</select>
          <select value={regionFilter} onChange={event => { setRegionFilter(event.target.value); setPage(1); }}><option value="ALL">{t('lead.filters.allRegion')}</option>{regions.map(region => <option key={region} value={region}>{region}</option>)}</select>
          <select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value as LeadSource | 'ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allSource')}</option>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`lead.source.${source}`)}</option>)}</select>
          <select value={lastActivityFilter} onChange={event => { setLastActivityFilter(event.target.value as LastActivityFilter); setPage(1); }}><option value="ALL">{t('lead.filters.allLastActivity')}</option><option value="7">{t('lead.filters.last7Days')}</option><option value="30">{t('lead.filters.last30Days')}</option><option value="NONE">{t('lead.filters.noActivity')}</option></select>
        </>}
      />

      <AbWorkspace list={listPane} detail={detailPane} />
      <AbMobileFab label={t('lead.actions.create')} onClick={() => setDrawerOpen(true)} />

      {drawerOpen && (
        <div className="lead-v2-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <aside className="lead-v2-drawer" onMouseDown={event => event.stopPropagation()}>
            <div className="lead-v2-drawer-header"><div><strong>{t('lead.quick.title')}</strong><p>{t('lead.quick.help')}</p></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('app.close')}>×</button></div>
            <div className="lead-v2-form">
              <label><span>{t('lead.fields.hospitalName')} *</span><input value={quickOrganization} onChange={event => setQuickOrganization(event.target.value)} /></label>
              <label><span>{t('lead.fields.country')} *</span><input value={quickCountry} onChange={event => setQuickCountry(event.target.value)} /></label>
              <label><span>{t('lead.fields.phone')} *</span><input value={quickPhone} onChange={event => setQuickPhone(event.target.value)} inputMode="tel" /></label>
              <label><span>{t('lead.fields.contactName')} *</span><input value={quickName} onChange={event => setQuickName(event.target.value)} /></label>
              <label><span>{t('lead.fields.address')}</span><input value={quickAddress} onChange={event => setQuickAddress(event.target.value)} /></label>
              <label><span>{t('lead.fields.source')}</span><select value={quickSource} onChange={event => setQuickSource(event.target.value as LeadSource)}>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`lead.source.${source}`)}</option>)}</select></label>
              <label><span>{t('lead.fields.owner')} *</span><select value={quickOwner} onChange={event => setQuickOwner(event.target.value)}>{MOCK_LEAD_OWNERS.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>
            </div>
            <div className="lead-v2-drawer-actions">
              <button type="button" className="lead-v2-button primary" onClick={() => createLead(false)}>{t('lead.quick.create')}</button>
              <button type="button" className="lead-v2-button secondary" onClick={() => createLead(true)}>{t('lead.quick.createDetail')}</button>
              <button type="button" className="lead-v2-button ghost" onClick={() => setDrawerOpen(false)}>{t('lead.actions.cancel')}</button>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="lead-v2-toast" role="status">✓ {toast}</div>}
    </section>
  );
}
