import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountSummary, LeadStatus } from '@dio-crm/contracts';
import { listSandboxAccounts } from '../../../account-sandbox';
import {
  API_LEAD_STEPS,
  LEAD_SOURCES,
  type LeadActivityInput,
  type LeadActivityType,
  type LeadConversionResult,
  type LeadSource
} from '../../../features/lead/lead-model';
import {
  addLeadActivitySupplement,
  applyLeadSupplement,
  createSandboxLead,
  getLeadSupplement,
  listSandboxLeads,
  saveLeadConversionSupplement,
  saveLeadHospitalScaleSupplement,
  updateSandboxLeadStatus,
  type SandboxLeadSummary
} from '../../../features/lead/lead-sandbox';
import {
  convertLeadToMock,
  recordExternalLeadConversion,
  type LeadConversionOptions
} from '../../../features/lead/lead-conversion-mock';
import { LeadActivitySection } from '../../../features/lead/LeadActivitySection';
import { LeadHospitalScaleForm } from '../../../features/lead/LeadHospitalScaleForm';
import { LeadConversionPanel } from '../../../features/lead/LeadConversionPanel';
import { LeadQuickCreatePanel, type LeadQuickCreateValue } from '../../../features/lead/LeadQuickCreatePanel';
import { apiGet, apiPatch, apiPost } from '../../../api';
import {
  AbDataList,
  AbDetailFooter,
  AbDetailHeader,
  AbDetailTabs,
  AbEmptyState,
  AbEntityBadges,
  AbListToolbar,
  AbMobileFab,
  AbNextAction,
  AbPagination,
  AbQuickActions,
  AbSectionAccordion,
  AbStepProgress,
  AbWorkspace,
  countryFlag,
  type AbDataColumn
} from '../../../ui/ab-workspace';
import '../../../styles/lead-workspace.css';

type ListFilter = 'all' | 'inProgress' | 'converted' | 'excluded';
type DetailTab = 'overview' | 'activity' | 'keyman' | 'system' | 'conversion';
type SectionId = 'basic' | 'nextAction' | 'recentActivity' | 'activity' | 'keyman' | 'hospitalScale' | 'system' | 'conversion';
type LastActivityFilter = 'ALL' | '7' | '30' | 'NONE';
type LeadListRecord = SandboxLeadSummary;
type QuickActivityType = Extract<LeadActivityType, 'CALL' | 'VISIT' | 'MEETING' | 'NOTE'>;

type LeadDetail = LeadListRecord & {
  keyman_name?: string | null;
  keyman_type?: string | null;
  keyman_mobile?: string | null;
  keyman_email?: string | null;
  main_system?: string | null;
  sub_system?: string | null;
  contact_exclude_reason?: string | null;
};

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONTACT_EXCLUDED', 'CONVERTED'];

function stepIndex(status: LeadStatus): number {
  if (status === 'CONTACT_EXCLUDED') return -1;
  const idx = API_LEAD_STEPS.indexOf(status as typeof API_LEAD_STEPS[number]);
  return idx >= 0 ? idx : 0;
}

function nextStatus(status: LeadStatus): LeadStatus | null {
  if (status === 'NEW') return 'FIRST_VISIT';
  if (status === 'FIRST_VISIT') return 'KEYMAN_MEETING';
  return null;
}

function formatDate(value: string | null | undefined, locale: string, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }
  ).format(date);
}

function matchesLastActivity(value: string | null | undefined, filter: LastActivityFilter) {
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

export function GlobalLeadPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'ALL'>('ALL');
  const [lastActivityFilter, setLastActivityFilter] = useState<LastActivityFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [preferredActivityType, setPreferredActivityType] = useState<QuickActivityType | null>(null);
  const [supplementTick, setSupplementTick] = useState(0);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    basic: true, nextAction: true, recentActivity: true, activity: true, keyman: true, hospitalScale: true, system: true, conversion: true
  });
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState({ keymanName: '', keymanType: '', keymanMobile: '', keymanEmail: '', mainSystem: '', subSystem: '' });

  const leads = useQuery({
    queryKey: ['global-leads', search],
    enabled: !localMode,
    queryFn: () => apiGet<LeadListRecord[]>(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    retry: false
  });
  const accounts = useQuery({
    queryKey: ['global-lead-accounts'],
    queryFn: () => apiGet<AccountSummary[]>('/api/accounts?scope=managed'),
    retry: false
  });
  const detail = useQuery({
    queryKey: ['global-lead-detail', selectedId],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${selectedId}`),
    enabled: Boolean(selectedId) && !localMode,
    retry: false
  });

  React.useEffect(() => { if (leads.isError) setLocalMode(true); }, [leads.isError]);

  const sourceRows = useMemo<LeadListRecord[]>(() => {
    const base = localMode ? listSandboxLeads(search) : (leads.data ?? []);
    return base.map(applyLeadSupplement);
  }, [leads.data, localMode, localTick, search, supplementTick]);

  const owners = useMemo(() => [...new Set(sourceRows.map(row => row.owner_name).filter((value): value is string => Boolean(value)))].sort(), [sourceRows]);
  const countries = useMemo(() => [...new Set(sourceRows.map(row => row.sido || 'GLOBAL'))].sort(), [sourceRows]);
  const regions = useMemo(() => [...new Set(sourceRows.filter(row => countryFilter === 'ALL' || (row.sido || 'GLOBAL') === countryFilter).map(row => row.sigungu).filter((value): value is string => Boolean(value)))].sort(), [sourceRows, countryFilter]);
  const sandboxAccounts = useMemo(() => listSandboxAccounts('', 'all'), [localTick, supplementTick]);
  const conversionAccounts = useMemo(() => {
    const source = !localMode && (accounts.data?.length ?? 0) > 0 ? accounts.data ?? [] : sandboxAccounts;
    return source.map(account => ({ id: account.public_id, name: account.account_name }));
  }, [accounts.data, localMode, sandboxAccounts]);

  const filteredRows = useMemo(() => sourceRows
    .filter(row => listFilter === 'inProgress' ? row.status !== 'CONVERTED' && row.status !== 'CONTACT_EXCLUDED' : listFilter === 'converted' ? row.status === 'CONVERTED' : listFilter === 'excluded' ? row.status === 'CONTACT_EXCLUDED' : true)
    .filter(row => statusFilter === 'ALL' || row.status === statusFilter)
    .filter(row => ownerFilter === 'ALL' || row.owner_name === ownerFilter)
    .filter(row => countryFilter === 'ALL' || (row.sido || 'GLOBAL') === countryFilter)
    .filter(row => regionFilter === 'ALL' || row.sigungu === regionFilter)
    .filter(row => sourceFilter === 'ALL' || row.lead_source === sourceFilter)
    .filter(row => matchesLastActivity(row.last_activity_at, lastActivityFilter)),
  [sourceRows, listFilter, statusFilter, ownerFilter, countryFilter, regionFilter, sourceFilter, lastActivityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = sourceRows.find(row => row.public_id === selectedId) ?? null;
  const selectedDetail = detail.data;
  const supplement = useMemo(() => selected ? getLeadSupplement(selected.public_id) : null, [selected?.public_id, supplementTick]);

  React.useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [page, currentPage]);
  React.useEffect(() => {
    if (!selectedDetail) return;
    setDraft({
      keymanName: selectedDetail.keyman_name ?? '',
      keymanType: selectedDetail.keyman_type ?? '',
      keymanMobile: selectedDetail.keyman_mobile ?? '',
      keymanEmail: selectedDetail.keyman_email ?? '',
      mainSystem: selectedDetail.main_system ?? '',
      subSystem: selectedDetail.sub_system ?? ''
    });
  }, [selectedDetail]);

  const toggleSection = (id: SectionId) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  const stepLabels = API_LEAD_STEPS.map(step => ({ id: step, label: t(`lead.steps.${step}`) }));

  const openActivityTab = (type?: QuickActivityType) => {
    setPreferredActivityType(type ?? null);
    setActiveTab('activity');
    setOpenSections(prev => ({ ...prev, activity: true }));
  };

  const selectDetailTab = (id: string) => {
    const tab = id as DetailTab;
    setActiveTab(tab);
    if (tab !== 'activity') setPreferredActivityType(null);
    const sectionByTab: Record<DetailTab, SectionId> = {
      overview: 'basic', activity: 'activity', keyman: 'keyman', system: 'hospitalScale', conversion: 'conversion'
    };
    setOpenSections(prev => ({ ...prev, [sectionByTab[tab]]: true }));
  };

  const selectLead = (publicId: string) => {
    const row = sourceRows.find(item => item.public_id === publicId);
    setSelectedId(publicId);
    setActiveTab('overview');
    setPreferredActivityType(null);
    setMobileDetailOpen(true);
    setMessage('');
    setReason('');
    if (localMode && row) {
      setDraft({ keymanName: row.contact_name ?? '', keymanType: '', keymanMobile: row.phone ?? '', keymanEmail: '', mainSystem: '', subSystem: '' });
    }
  };

  function resetFilters() {
    setSearch('');
    setListFilter('all');
    setStatusFilter('ALL');
    setOwnerFilter('ALL');
    setCountryFilter('ALL');
    setRegionFilter('ALL');
    setSourceFilter('ALL');
    setLastActivityFilter('ALL');
    setPage(1);
  }

  function goToPage(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    setPage(clamped);
    const first = filteredRows[(clamped - 1) * pageSize];
    if (first) setSelectedId(first.public_id);
  }

  function changePageSize(nextSize: number) {
    setPageSize(nextSize);
    setPage(1);
    if (filteredRows[0]) setSelectedId(filteredRows[0].public_id);
  }

  function saveHospitalScale(value: NonNullable<typeof supplement>['hospitalScale']) {
    if (!selected) return;
    saveLeadHospitalScaleSupplement(selected.public_id, value);
    setSupplementTick(value => value + 1);
    setMessage(t('lead.toast.hospitalScaleSaved'));
  }

  function addActivity(input: LeadActivityInput) {
    if (!selected) return;
    addLeadActivitySupplement(selected.public_id, selected.owner_name ?? '-', input);
    setSupplementTick(value => value + 1);
    setLocalTick(value => value + 1);
    setPreferredActivityType(null);
    setMessage(t('lead.toast.activityAdded'));
  }

  async function createLeadFromQuick(value: LeadQuickCreateValue, draftMode: boolean) {
    const payload = {
      hospitalName: value.hospitalName,
      country: value.country,
      phone: value.phone,
      contactName: value.contactName,
      address: value.address,
      ownerName: value.ownerValue,
      leadSource: value.source
    };
    let created: LeadListRecord;
    try {
      created = await apiPost<LeadListRecord>('/api/leads', {
        hospitalName: payload.hospitalName,
        phone: payload.phone,
        address: payload.address || null,
        sido: payload.country,
        keymanName: payload.contactName
      });
      await qc.invalidateQueries({ queryKey: ['global-leads'] });
    } catch {
      created = createSandboxLead(payload);
      setLocalMode(true);
      setLocalTick(n => n + 1);
    }
    setSelectedId(created.public_id);
    setPage(1);
    setActiveTab('overview');
    setMobileDetailOpen(true);
    setDraft({ keymanName: payload.contactName, keymanType: '', keymanMobile: payload.phone, keymanEmail: '', mainSystem: '', subSystem: '' });
    setMessage(draftMode ? t('lead.toast.draftSaved') : t('lead.toast.created'));
    return true;
  }

  async function move(toStatus: LeadStatus) {
    if (!selected || selected.status === 'CONVERTED') return;
    if (localMode) {
      updateSandboxLeadStatus(selected.public_id, toStatus);
      setLocalTick(value => value + 1);
      setMessage(toStatus === 'CONTACT_EXCLUDED' ? t('lead.toast.excluded') : t('lead.toast.statusUpdated'));
      setReason('');
      return;
    }
    try {
      await apiPost(`/api/leads/${selected.public_id}/status`, {
        toStatus,
        reason: toStatus === 'CONTACT_EXCLUDED' ? reason || undefined : undefined
      });
      setMessage(toStatus === 'CONTACT_EXCLUDED' ? t('lead.toast.excluded') : t('lead.toast.statusUpdated'));
      setReason('');
      await qc.invalidateQueries({ queryKey: ['global-leads'] });
      await qc.invalidateQueries({ queryKey: ['global-lead-detail', selected.public_id] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveSections() {
    if (!selected) return;
    if (localMode) {
      setMessage(t('lead.toast.saved'));
      return;
    }
    try {
      await apiPatch(`/api/leads/${selected.public_id}`, {
        keymanName: draft.keymanName || null,
        keymanType: draft.keymanType || null,
        keymanMobile: draft.keymanMobile || null,
        keymanEmail: draft.keymanEmail || null,
        mainSystem: draft.mainSystem || null,
        subSystem: draft.subSystem || null
      });
      setMessage(t('lead.toast.saved'));
      await qc.invalidateQueries({ queryKey: ['global-lead-detail', selected.public_id] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function convertLead(options: LeadConversionOptions) {
    if (!selected) return;
    if (selected.status === 'CONVERTED' || supplement?.conversion) throw new Error('LEAD_ALREADY_CONVERTED');

    if (!localMode) {
      try {
        const apiResult = await apiPost<{ accountPublicId: string; opportunityPublicId?: string }>(`/api/leads/${selected.public_id}/convert`, {
          accountMode: options.accountMode,
          existingAccountPublicId: options.accountMode === 'EXISTING' ? options.existingAccountId : undefined,
          opportunityName: options.createOpportunity ? options.opportunityName : undefined
        });
        const apiAccount = (accounts.data ?? []).find(account => account.public_id === apiResult.accountPublicId);
        const result: LeadConversionResult = {
          accountId: apiResult.accountPublicId,
          accountName: apiAccount?.account_name ?? selected.hospital_name,
          opportunityId: apiResult.opportunityPublicId,
          convertedAt: new Date().toISOString()
        };
        recordExternalLeadConversion(selected.public_id, result);
        saveLeadConversionSupplement(selected.public_id, result);
        setSupplementTick(value => value + 1);
        setMessage(t('lead.toast.converted'));
        await qc.invalidateQueries({ queryKey: ['global-leads'] });
        await qc.invalidateQueries({ queryKey: ['global-lead-accounts'] });
        return;
      } catch {
        // Mock fallback below keeps the demo workflow usable when conversion API is unavailable.
      }
    }

    const result = convertLeadToMock({
      leadId: selected.public_id,
      organizationName: selected.hospital_name,
      contactName: draft.keymanName || selected.contact_name || selected.hospital_name,
      phone: selected.phone,
      email: draft.keymanEmail,
      address: selected.address,
      country: selected.sido,
      ownerName: selected.owner_name ?? '-'
    }, options);
    saveLeadConversionSupplement(selected.public_id, result);
    setSupplementTick(value => value + 1);
    setLocalTick(value => value + 1);
    setMessage(t('lead.toast.converted'));
  }

  const listColumns: AbDataColumn[] = [
    { key: 'hospital', label: t('lead.columns.hospitalName'), width: 'minmax(180px,1.55fr)', mobileRole: 'primary', className: 'primary-cell' },
    { key: 'country', label: t('lead.columns.country'), width: '105px' },
    { key: 'status', label: t('lead.columns.status'), width: '94px', mobileRole: 'badge' },
    { key: 'owner', label: t('lead.columns.owner'), width: '95px' },
    { key: 'phone', label: t('lead.columns.phone'), width: '112px' },
    { key: 'lastActivity', label: t('lead.columns.lastActivity'), width: '94px' },
    { key: 'nextAction', label: t('lead.columns.nextAction'), width: 'minmax(125px,1fr)' }
  ];

  const renderDetailTab = () => {
    if (!selected) return null;
    const d = selectedDetail;

    if (activeTab === 'overview') return <div className="ab-overview-grid">
      <AbSectionAccordion id="basic" title={t('lead.sections.basic')} open={openSections.basic} onToggle={() => toggleSection('basic')}>
        <InfoRow label={t('lead.fields.hospitalName')} value={selected.hospital_name} />
        <InfoRow label={t('lead.fields.contactName')} value={draft.keymanName || selected.contact_name} />
        <InfoRow label={t('lead.fields.phone')} value={selected.phone} />
        <InfoRow label={t('lead.fields.address')} value={selected.address} />
        <InfoRow label={t('lead.fields.businessNo')} value={selected.business_no} />
        <InfoRow label={t('lead.fields.owner')} value={selected.owner_name} />
      </AbSectionAccordion>
      <AbSectionAccordion id="nextAction" title={t('lead.sections.nextAction')} open={openSections.nextAction} onToggle={() => toggleSection('nextAction')} incomplete={!selected.next_action && selected.status !== 'CONVERTED'}>
        <AbNextAction label={t('lead.fields.nextAction')} title={selected.next_action ?? '-'} due={formatDate(selected.next_action_at, i18n.language, true)} action={selected.status !== 'CONVERTED' ? <button type="button" className="lead-v2-button ghost" onClick={() => openActivityTab()}>{t('lead.tabs.activity')}</button> : undefined} />
      </AbSectionAccordion>
      <AbSectionAccordion id="recentActivity" title={t('lead.sections.recentActivity')} hint={supplement?.activities.length ? `${Math.min(supplement.activities.length, 3)}` : undefined} open={openSections.recentActivity} onToggle={() => toggleSection('recentActivity')}>
        <LeadActivitySection activities={supplement?.activities ?? []} onSubmit={addActivity} limit={3} quickAdd={false} />
      </AbSectionAccordion>
    </div>;

    if (activeTab === 'activity') return <AbSectionAccordion id="activity" title={t('lead.sections.activity')} hint={supplement?.activities.length ? `${supplement.activities.length}` : undefined} open={openSections.activity} onToggle={() => toggleSection('activity')}>
      <LeadActivitySection activities={supplement?.activities ?? []} onSubmit={addActivity} preferredType={preferredActivityType} />
    </AbSectionAccordion>;

    if (activeTab === 'keyman') return <AbSectionAccordion id="keyman" title={t('lead.sections.keyman')} open={openSections.keyman} onToggle={() => toggleSection('keyman')} incomplete={!draft.keymanName}>
      <div className="lead-v2-form">
        <label><span>{t('lead.fields.keymanName')}</span><input value={draft.keymanName} onChange={e => setDraft(p => ({ ...p, keymanName: e.target.value }))} /></label>
        <label><span>{t('lead.fields.keymanType')}</span><input value={draft.keymanType} onChange={e => setDraft(p => ({ ...p, keymanType: e.target.value }))} /></label>
        <label><span>{t('lead.fields.keymanMobile')}</span><input value={draft.keymanMobile} onChange={e => setDraft(p => ({ ...p, keymanMobile: e.target.value }))} /></label>
        <label><span>{t('lead.fields.keymanEmail')}</span><input value={draft.keymanEmail} onChange={e => setDraft(p => ({ ...p, keymanEmail: e.target.value }))} /></label>
      </div>
    </AbSectionAccordion>;

    if (activeTab === 'system') return <div className="ab-overview-grid">
      <AbSectionAccordion id="hospitalScale" title={t('lead.sections.hospitalScale')} open={openSections.hospitalScale} onToggle={() => toggleSection('hospitalScale')}>
        {supplement && <>
          <div className="lead-hospital-summary">
            <div><span>{t('lead.fields.doctorCount')}</span><strong>{supplement.hospitalScale.doctorCount ?? '-'}</strong></div>
            <div><span>{t('lead.fields.chairCount')}</span><strong>{supplement.hospitalScale.chairCount ?? '-'}</strong></div>
            <div><span>{t('lead.fields.staffCount')}</span><strong>{supplement.hospitalScale.staffCount ?? '-'}</strong></div>
            <div><span>{t('lead.fields.mainSpecialty')}</span><strong>{supplement.hospitalScale.mainSpecialty || '-'}</strong></div>
          </div>
          <LeadHospitalScaleForm value={supplement.hospitalScale} onSave={saveHospitalScale} />
        </>}
      </AbSectionAccordion>
      <AbSectionAccordion id="system" title={t('lead.sections.system')} open={openSections.system} onToggle={() => toggleSection('system')} incomplete={!draft.mainSystem}>
        <div className="lead-v2-form">
          <label><span>{t('lead.fields.mainSystem')}</span><input value={draft.mainSystem} onChange={e => setDraft(p => ({ ...p, mainSystem: e.target.value }))} /></label>
          <label><span>{t('lead.fields.subSystem')}</span><input value={draft.subSystem} onChange={e => setDraft(p => ({ ...p, subSystem: e.target.value }))} /></label>
        </div>
      </AbSectionAccordion>
    </div>;

    return <AbSectionAccordion id="conversion" title={t('lead.sections.conversion')} open={openSections.conversion} onToggle={() => toggleSection('conversion')}>
      <LeadConversionPanel
        entityKey={selected.public_id}
        canConvert={selected.status === 'KEYMAN_MEETING'}
        converted={selected.status === 'CONVERTED'}
        result={supplement?.conversion ?? null}
        accounts={conversionAccounts}
        defaultOpportunityName={t('lead.conversion.defaultOpportunityName', { account: selected.hospital_name })}
        blockedMessage={selected.status !== 'CONVERTED' ? t('lead.conversion.requiresKeymanMeeting') : undefined}
        onConvert={convertLead}
        onExclude={() => move('CONTACT_EXCLUDED')}
        excludeDisabled={selected.status === 'CONVERTED' || selected.status === 'CONTACT_EXCLUDED'}
      />
      {selected.status !== 'CONVERTED' && selected.status !== 'CONTACT_EXCLUDED' && <label className="lead-conversion-field lead-conversion-exclude-reason"><span>{t('lead.fields.excludeReason')}</span><input value={reason} onChange={event => setReason(event.target.value)} /></label>}
      {d?.contact_exclude_reason && <InfoRow label={t('lead.fields.excludeReason')} value={d.contact_exclude_reason} />}
    </AbSectionAccordion>;
  };

  const listPane = <>
    <div className="lead-v2-list-header"><div><strong>{t('lead.listTitle')}</strong><span>{t('lead.count', { count: filteredRows.length })}</span></div></div>
    {leads.isLoading && !localMode ? <AbEmptyState tone="loading" title={t('common.loading')} /> : <AbDataList
      columns={listColumns}
      rows={pagedRows}
      rowKey={row => row.public_id}
      selectedKey={selectedId}
      onRowClick={row => selectLead(row.public_id)}
      ariaLabel={t('lead.listTitle')}
      empty={<AbEmptyState title={t('lead.empty.search')} />}
      renderCells={row => {
        const region = [row.sido, row.sigungu].filter(Boolean).join(' ') || 'GLOBAL';
        return [
          <span className="ab-primary-stack" title={`${row.hospital_name} · ${row.public_id}`}><strong>{row.hospital_name}</strong><small>{row.contact_name || row.business_no || row.public_id}</small><em>{row.lead_source ? t(`lead.source.${row.lead_source}`) : '-'}</em></span>,
          <span className="ab-cell-stack" title={region}><strong className="ab-lead-country"><i>{countryFlag(row.sido)}</i>{row.sido || 'GLOBAL'}</strong><small>{row.sigungu || '-'}</small></span>,
          <i className="lead-v2-pill stage-NEW">{t(`lead.status.${row.status}`)}</i>,
          <span>{row.owner_name ?? '-'}</span>,
          <span>{row.phone ?? '-'}</span>,
          <span>{formatDate(row.last_activity_at, i18n.language)}</span>,
          <span className="ab-next-action-cell"><strong>{row.next_action ?? '-'}</strong><small>{formatDate(row.next_action_at, i18n.language)}</small></span>
        ];
      }}
    />}
    <AbPagination page={currentPage} pageSize={pageSize} totalItems={filteredRows.length} onPageChange={goToPage} onPageSizeChange={changePageSize} rowsPerPageLabel={t('lead.pagination.rowsPerPage')} previousLabel={t('lead.pagination.previous')} nextLabel={t('lead.pagination.next')} pageStatus={t('lead.pagination.pageStatus', { page: currentPage, pages: totalPages, count: filteredRows.length })} />
  </>;

  const detailPane = <>{!selected && <div className="lead-v2-empty-detail">{t('lead.empty.detail')}</div>}{selected && <>
    <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('lead.actions.back')}</button>
    <AbDetailHeader
      eyebrow={selected.public_id}
      title={selectedDetail?.keyman_name || selected.contact_name || selected.hospital_name}
      subtitle={<><strong>{selected.hospital_name}</strong> · <span className="ab-list-country"><i>{countryFlag(selected.sido)}</i>{selected.sido || 'GLOBAL'}{selected.sigungu ? ` · ${selected.sigungu}` : ''}</span></>}
      badges={<AbEntityBadges badges={[
        { label: t(`lead.status.${selected.status}`), tone: selected.status === 'CONVERTED' ? 'success' : selected.status === 'CONTACT_EXCLUDED' ? 'warning' : 'info' },
        ...(selected.business_no ? [{ label: selected.business_no, tone: 'neutral' as const }] : [])
      ]} />}
      meta={<div className="ab-detail-meta-list">
        <div className="ab-detail-meta-item"><span>{t('lead.fields.owner')}</span><strong>{selected.owner_name ?? '-'}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('lead.fields.lastActivity')}</span><strong>{formatDate(selected.last_activity_at, i18n.language, true)}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('lead.fields.nextAction')}</span><strong>{selected.next_action ?? '-'}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('lead.fields.source')}</span><strong>{selected.lead_source ? t(`lead.source.${selected.lead_source}`) : '-'}</strong></div>
      </div>}
      actions={<AbQuickActions ariaLabel={t('lead.quickActionsLabel')} actions={[
        { id: 'call', label: t('lead.actions.call'), icon: '☎', href: selected.phone ? `tel:${selected.phone}` : undefined, disabled: !selected.phone },
        { id: 'email', label: t('lead.actions.email'), icon: '✉', href: draft.keymanEmail ? `mailto:${draft.keymanEmail}` : undefined, disabled: !draft.keymanEmail },
        { id: 'meeting', label: t('lead.actions.meeting'), icon: '◷', onClick: () => openActivityTab('MEETING') },
        { id: 'activity', label: t('lead.actions.addActivity'), icon: '＋', onClick: () => openActivityTab(), tone: 'primary' },
        { id: 'more', label: t('lead.actions.more'), icon: '•••', onClick: () => selectDetailTab('conversion') }
      ]} />}
    />
    <AbStepProgress steps={stepLabels} currentIndex={Math.max(0, stepIndex(selected.status))} mobileLabel={selected.status === 'CONTACT_EXCLUDED' ? t('lead.status.CONTACT_EXCLUDED') : `${Math.max(0, stepIndex(selected.status)) + 1}/${API_LEAD_STEPS.length}`} />
    {selected.status === 'CONTACT_EXCLUDED' && <div className="ab-detail-terminal"><strong>{t('lead.status.CONTACT_EXCLUDED')}</strong></div>}
    {nextStatus(selected.status) && <div className="lead-v2-status-actions"><button type="button" className="lead-v2-button primary" onClick={() => void move(nextStatus(selected.status)!)}>{t('lead.actions.nextStatus')} · {t(`lead.status.${nextStatus(selected.status)!}`)}</button></div>}
    <AbDetailTabs ariaLabel={t('lead.detailTitle')} activeId={activeTab} onChange={selectDetailTab} tabs={[
      { id: 'overview', label: t('lead.tabs.overview') },
      { id: 'activity', label: t('lead.tabs.activity'), count: supplement?.activities.length ?? 0 },
      { id: 'keyman', label: t('lead.tabs.keyman'), count: draft.keymanName ? 1 : 0 },
      { id: 'system', label: t('lead.tabs.system') },
      { id: 'conversion', label: t('lead.tabs.conversion'), count: supplement?.conversion ? 1 : undefined }
    ]} />
    <div className="ab-tab-panel" id={`ab-tab-panel-${activeTab}`} role="tabpanel">{renderDetailTab()}</div>
    <AbDetailFooter draftLabel={t('lead.actions.saveDraft')} saveLabel={t('lead.actions.save')} onDraft={() => setMessage(t('lead.toast.draftSaved'))} onSave={() => void saveSections()} />
  </>}</>;

  return <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="lead-v2-page-header">
      <div><div className="lead-v2-title-line"><span className="lead-v2-kicker">GLOBAL · LEAD</span></div><h2>{t('lead.title')}</h2><p>{t('lead.subtitle')}</p></div>
      <div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={() => { setDrawerOpen(true); setMessage(''); }}>+ {t('lead.actions.create')}</button></div>
    </header>
    <div className="lead-v2-filter-tabs">{(['all', 'inProgress', 'converted', 'excluded'] as ListFilter[]).map(id => <button key={id} type="button" className={listFilter === id ? 'active' : ''} onClick={() => { setListFilter(id); setPage(1); }}>{t(`lead.filters.${id}`)}</button>)}</div>
    <AbListToolbar searchValue={search} onSearchChange={value => { setSearch(value); setPage(1); }} searchPlaceholder={t('lead.searchPlaceholder')} onReset={resetFilters} resetLabel={t('lead.actions.resetFilters')} filters={<>
      <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value as LeadStatus | 'ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allStage')}</option>{LEAD_STATUSES.map(status => <option key={status} value={status}>{t(`lead.status.${status}`)}</option>)}</select>
      <select value={ownerFilter} onChange={event => { setOwnerFilter(event.target.value); setPage(1); }}><option value="ALL">{t('lead.filters.allOwner')}</option>{owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}</select>
      <select value={countryFilter} onChange={event => { setCountryFilter(event.target.value); setRegionFilter('ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allCountry')}</option>{countries.map(country => <option key={country} value={country}>{country}</option>)}</select>
      <select value={regionFilter} onChange={event => { setRegionFilter(event.target.value); setPage(1); }}><option value="ALL">{t('lead.filters.allRegion')}</option>{regions.map(region => <option key={region} value={region}>{region}</option>)}</select>
      <select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value as LeadSource | 'ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allSource')}</option>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`lead.source.${source}`)}</option>)}</select>
      <select value={lastActivityFilter} onChange={event => { setLastActivityFilter(event.target.value as LastActivityFilter); setPage(1); }}><option value="ALL">{t('lead.filters.allLastActivity')}</option><option value="7">{t('lead.filters.last7Days')}</option><option value="30">{t('lead.filters.last30Days')}</option><option value="NONE">{t('lead.filters.noActivity')}</option></select>
    </>} />
    <AbWorkspace list={listPane} detail={detailPane} />
    <AbMobileFab label={t('lead.actions.create')} onClick={() => setDrawerOpen(true)} />
    <LeadQuickCreatePanel
      open={drawerOpen}
      defaultCountry="US"
      ownerOptions={owners.map(owner => ({ value: owner, label: owner }))}
      closeLabel={t('app.close')}
      onClose={() => setDrawerOpen(false)}
      onSubmit={createLeadFromQuick}
    />
    {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
  </section>;
}
