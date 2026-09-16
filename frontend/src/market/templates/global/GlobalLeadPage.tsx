import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountSummary, LeadStatus } from '@dio-crm/contracts';
import { API_LEAD_STEPS, LEAD_SOURCES, type LeadSource } from '../../../features/lead/lead-model';
import { createSandboxLead, listSandboxLeads, type SandboxLeadSummary } from '../../../features/lead/lead-sandbox';
import { apiGet, apiPatch, apiPost } from '../../../api';
import {
  AbActivityTimeline,
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

type DetailTab = 'overview' | 'activity' | 'keyman' | 'system' | 'conversion';
type ListFilter = 'all' | 'inProgress' | 'converted' | 'excluded';
type SectionId = 'basic' | 'nextAction' | 'recentActivity' | 'tagsNote' | 'activity' | 'keyman' | 'hospitalScale' | 'system' | 'conversion';
type LastActivityFilter = 'ALL' | '7' | '30' | 'NONE';
type LeadListRecord = SandboxLeadSummary;

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
const EMPTY_DRAFT = { keymanName: '', keymanType: '', keymanMobile: '', keymanEmail: '', mainSystem: '', subSystem: '' };

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
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    basic: true,
    nextAction: true,
    recentActivity: true,
    tagsNote: false,
    activity: true,
    keyman: true,
    hospitalScale: true,
    system: true,
    conversion: true
  });
  const [reason, setReason] = useState('');
  const [existingAccountId, setExistingAccountId] = useState('');
  const [opportunityName, setOpportunityName] = useState('');
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickHospital, setQuickHospital] = useState('');
  const [quickCountry, setQuickCountry] = useState('US');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickContact, setQuickContact] = useState('');
  const [quickOwner, setQuickOwner] = useState('');
  const [quickSource, setQuickSource] = useState<LeadSource>('WEB');
  const [quickAddress, setQuickAddress] = useState('');
  const [draft, setDraft] = useState(EMPTY_DRAFT);

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

  React.useEffect(() => {
    if (leads.isError) setLocalMode(true);
  }, [leads.isError]);

  const sourceRows = useMemo<LeadListRecord[]>(() => (
    localMode ? listSandboxLeads(search) : (leads.data ?? [])
  ), [leads.data, localMode, localTick, search]);

  const owners = useMemo(() => [...new Set(sourceRows.map(row => row.owner_name).filter((value): value is string => Boolean(value)))].sort(), [sourceRows]);
  const countries = useMemo(() => [...new Set(sourceRows.map(row => row.sido || 'GLOBAL'))].sort(), [sourceRows]);
  const regions = useMemo(() => [...new Set(sourceRows.filter(row => countryFilter === 'ALL' || (row.sido || 'GLOBAL') === countryFilter).map(row => row.sigungu).filter((value): value is string => Boolean(value)))].sort(), [sourceRows, countryFilter]);

  const filteredRows = useMemo(() => sourceRows
    .filter(row => {
      if (listFilter === 'inProgress') return row.status !== 'CONVERTED' && row.status !== 'CONTACT_EXCLUDED';
      if (listFilter === 'converted') return row.status === 'CONVERTED';
      if (listFilter === 'excluded') return row.status === 'CONTACT_EXCLUDED';
      return true;
    })
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
  const selected = useMemo(() => sourceRows.find(row => row.public_id === selectedId) ?? null, [sourceRows, selectedId]);
  const selectedDetail = detail.data;

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

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

  const openActivityTab = () => {
    setActiveTab('activity');
    setOpenSections(prev => ({ ...prev, activity: true }));
  };

  const selectDetailTab = (id: string) => {
    const tab = id as DetailTab;
    setActiveTab(tab);
    const sectionByTab: Record<DetailTab, SectionId> = {
      overview: 'basic',
      activity: 'activity',
      keyman: 'keyman',
      system: 'hospitalScale',
      conversion: 'conversion'
    };
    setOpenSections(prev => ({ ...prev, [sectionByTab[tab]]: true }));
  };

  const selectLead = (publicId: string) => {
    setSelectedId(publicId);
    setActiveTab('overview');
    setDraft(EMPTY_DRAFT);
    setOpenSections(prev => ({ ...prev, basic: true, nextAction: true, recentActivity: true }));
    setMobileDetailOpen(true);
    setMessage('');
    setReason('');
  };

  const stepLabels = API_LEAD_STEPS.map(step => ({ id: step, label: t(`lead.steps.${step}`) }));

  function resetQuickForm() {
    setQuickHospital('');
    setQuickCountry('US');
    setQuickPhone('');
    setQuickContact('');
    setQuickOwner('');
    setQuickSource('WEB');
    setQuickAddress('');
  }

  function openQuickCreate() {
    setDrawerOpen(true);
    setMessage('');
  }

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

  async function createLead(openDetail: boolean) {
    if (!quickHospital.trim() || !quickPhone.trim() || !quickCountry.trim() || !quickContact.trim() || !quickOwner.trim()) {
      setMessage(t('lead.quick.required'));
      return;
    }
    const payload = {
      hospitalName: quickHospital.trim(),
      country: quickCountry.trim(),
      phone: quickPhone.trim(),
      contactName: quickContact.trim(),
      address: quickAddress.trim(),
      ownerName: quickOwner.trim(),
      leadSource: quickSource
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
    setDrawerOpen(false);
    resetQuickForm();
    setDraft(EMPTY_DRAFT);
    setPage(1);
    setActiveTab('overview');
    setMobileDetailOpen(openDetail);
    setOpenSections(prev => ({ ...prev, basic: true, nextAction: true, recentActivity: true, keyman: true }));
    setMessage(t('lead.toast.created'));
  }

  async function move(toStatus: LeadStatus) {
    if (!selected) return;
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

  async function convert(mode: 'NEW' | 'EXISTING') {
    if (!selected) return;
    if (mode === 'EXISTING' && !existingAccountId) {
      setMessage(t('lead.quick.required'));
      return;
    }
    try {
      const result = await apiPost<{ accountPublicId: string; opportunityPublicId: string }>(`/api/leads/${selected.public_id}/convert`, {
        accountMode: mode,
        existingAccountPublicId: mode === 'EXISTING' ? existingAccountId : undefined,
        opportunityName: opportunityName.trim() || undefined
      });
      setMessage(t('lead.toast.converted', { accountId: result.accountPublicId }));
      setOpportunityName('');
      setExistingAccountId('');
      await qc.invalidateQueries({ queryKey: ['global-leads'] });
      await qc.invalidateQueries({ queryKey: ['global-lead-accounts'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
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
    const region = [selected.sido, selected.sigungu].filter(Boolean).join(' ') || 'GLOBAL';

    if (activeTab === 'overview') {
      const recentItems = selected.last_activity_at ? [{
        id: `last-${selected.public_id}`,
        typeLabel: t('lead.fields.lastActivity'),
        timeLabel: formatDate(selected.last_activity_at, i18n.language, true),
        title: t('lead.sections.recentActivity'),
        owner: selected.owner_name ?? '-'
      }] : [];
      return (
        <div className="ab-overview-grid">
          <AbSectionAccordion id="basic" title={t('lead.sections.basic')} open={openSections.basic} onToggle={() => toggleSection('basic')}>
            <InfoRow label={t('lead.fields.hospitalName')} value={selected.hospital_name} />
            <InfoRow label={t('lead.fields.phone')} value={selected.phone} />
            <InfoRow label={t('lead.fields.country')} value={<span className="ab-list-country"><i>{countryFlag(selected.sido)}</i>{region}</span>} />
            <InfoRow label={t('lead.fields.address')} value={selected.address} />
            <InfoRow label={t('lead.fields.businessNo')} value={selected.business_no} />
            <InfoRow label={t('lead.fields.owner')} value={selected.owner_name} />
            <InfoRow label={t('lead.fields.source')} value={selected.lead_source ? t(`lead.source.${selected.lead_source}`) : '-'} />
          </AbSectionAccordion>

          <AbSectionAccordion id="nextAction" title={t('lead.sections.nextAction')} open={openSections.nextAction} onToggle={() => toggleSection('nextAction')} incomplete={!selected.next_action}>
            <AbNextAction
              label={t('lead.fields.nextAction')}
              title={selected.next_action ?? '-'}
              due={formatDate(selected.next_action_at, i18n.language, true)}
              action={<button type="button" className="lead-v2-button ghost" onClick={openActivityTab}>{t('lead.tabs.activity')}</button>}
            />
          </AbSectionAccordion>

          <AbSectionAccordion id="recentActivity" title={t('lead.sections.recentActivity')} open={openSections.recentActivity} onToggle={() => toggleSection('recentActivity')}>
            <AbActivityTimeline items={recentItems} empty={<p className="lead-v2-empty-inline">{t('lead.empty.activity')}</p>} />
          </AbSectionAccordion>

          <AbSectionAccordion id="tagsNote" title={`${t('lead.sections.tags')} / ${t('lead.sections.note')}`} open={openSections.tagsNote} onToggle={() => toggleSection('tagsNote')}>
            <div className="ab-tag-list"><span>-</span></div>
            <div className="ab-note-box">-</div>
          </AbSectionAccordion>
        </div>
      );
    }

    if (activeTab === 'activity') {
      return (
        <AbSectionAccordion id="activity" title={t('lead.sections.activity')} open={openSections.activity} onToggle={() => toggleSection('activity')}>
          <AbEmptyState title={t('lead.empty.activity')} />
        </AbSectionAccordion>
      );
    }

    if (activeTab === 'keyman') {
      return (
        <AbSectionAccordion id="keyman" title={t('lead.sections.keyman')} open={openSections.keyman} onToggle={() => toggleSection('keyman')} incomplete={!draft.keymanName}>
          <div className="lead-v2-form">
            <label><span>{t('lead.fields.keymanName')}</span><input value={draft.keymanName} onChange={e => setDraft(p => ({ ...p, keymanName: e.target.value }))} /></label>
            <label><span>{t('lead.fields.keymanType')}</span><input value={draft.keymanType} onChange={e => setDraft(p => ({ ...p, keymanType: e.target.value }))} /></label>
            <label><span>{t('lead.fields.keymanMobile')}</span><input value={draft.keymanMobile} onChange={e => setDraft(p => ({ ...p, keymanMobile: e.target.value }))} /></label>
            <label><span>{t('lead.fields.keymanEmail')}</span><input value={draft.keymanEmail} onChange={e => setDraft(p => ({ ...p, keymanEmail: e.target.value }))} /></label>
          </div>
        </AbSectionAccordion>
      );
    }

    if (activeTab === 'system') {
      return (
        <div className="ab-overview-grid">
          <AbSectionAccordion id="hospitalScale" title={t('lead.sections.hospitalScale')} open={openSections.hospitalScale} onToggle={() => toggleSection('hospitalScale')} incomplete>
            <InfoRow label={t('lead.fields.organizationType')} value="-" />
            <InfoRow label={t('lead.fields.bedCount')} value="-" />
          </AbSectionAccordion>
          <AbSectionAccordion id="system" title={t('lead.sections.system')} open={openSections.system} onToggle={() => toggleSection('system')} incomplete={!draft.mainSystem}>
            <div className="lead-v2-form">
              <label><span>{t('lead.fields.mainSystem')}</span><input value={draft.mainSystem} onChange={e => setDraft(p => ({ ...p, mainSystem: e.target.value }))} /></label>
              <label><span>{t('lead.fields.subSystem')}</span><input value={draft.subSystem} onChange={e => setDraft(p => ({ ...p, subSystem: e.target.value }))} /></label>
            </div>
          </AbSectionAccordion>
        </div>
      );
    }

    return (
      <AbSectionAccordion id="conversion" title={t('lead.sections.conversion')} open={openSections.conversion} onToggle={() => toggleSection('conversion')}>
        {selected.status === 'KEYMAN_MEETING' ? (
          <div className="lead-v2-form">
            <label><span>{t('lead.conversion.opportunityName')}</span><input value={opportunityName} onChange={e => setOpportunityName(e.target.value)} placeholder={t('lead.conversion.opportunityName')} /></label>
            <button type="button" className="lead-v2-button primary" onClick={() => void convert('NEW')}>{t('lead.conversion.createNewAccount')}</button>
            <label><span>{t('lead.conversion.existingAccount')}</span><select value={existingAccountId} onChange={e => setExistingAccountId(e.target.value)}>
              <option value="">{t('common.selectNone')}</option>
              {(accounts.data ?? []).map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}
            </select></label>
            <button type="button" className="lead-v2-button secondary" onClick={() => void convert('EXISTING')}>{t('lead.conversion.linkExistingAccount')}</button>
          </div>
        ) : <p className="lead-v2-empty-inline">{t('lead.conversion.requiresKeymanMeeting')}</p>}

        {selected.status !== 'CONVERTED' && selected.status !== 'CONTACT_EXCLUDED' && <div className="lead-v2-form">
          <label><span>{t('lead.fields.excludeReason')}</span><input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('lead.fields.excludeReason')} /></label>
          <button type="button" className="lead-v2-button ghost" onClick={() => void move('CONTACT_EXCLUDED')}>{t('lead.actions.exclude')}</button>
        </div>}
        {d?.contact_exclude_reason && <InfoRow label={t('lead.fields.excludeReason')} value={d.contact_exclude_reason} />}
      </AbSectionAccordion>
    );
  };

  const listPane = (
    <>
      <div className="lead-v2-list-header"><div><strong>{t('lead.listTitle')}</strong><span>{t('lead.count', { count: filteredRows.length })}</span></div></div>
      {leads.isLoading && !localMode ? <AbEmptyState tone="loading" title={t('common.loading')} /> : (
        <AbDataList
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
              <span className="ab-primary-stack" title={`${row.hospital_name} · ${row.public_id}`}><strong>{row.hospital_name}</strong><small>{row.business_no || row.public_id}</small><em>{row.lead_source ? t(`lead.source.${row.lead_source}`) : '-'}</em></span>,
              <span className="ab-cell-stack" title={region}><strong className="ab-lead-country"><i>{countryFlag(row.sido)}</i>{row.sido || 'GLOBAL'}</strong><small>{row.sigungu || '-'}</small></span>,
              <i className="lead-v2-pill stage-NEW">{t(`lead.status.${row.status}`)}</i>,
              <span>{row.owner_name ?? '-'}</span>,
              <span title={row.phone ?? undefined}>{row.phone ?? '-'}</span>,
              <span>{formatDate(row.last_activity_at, i18n.language)}</span>,
              <span className="ab-next-action-cell"><strong>{row.next_action ?? '-'}</strong><small>{formatDate(row.next_action_at, i18n.language)}</small></span>
            ];
          }}
        />
      )}
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
        <AbDetailHeader
          eyebrow={selected.public_id}
          title={selectedDetail?.keyman_name || selected.owner_name || selected.hospital_name}
          subtitle={<><strong>{selected.hospital_name}</strong> · <span className="ab-list-country"><i>{countryFlag(selected.sido)}</i>{selected.sido || 'GLOBAL'}{selected.sigungu ? ` · ${selected.sigungu}` : ''}</span></>}
          badges={<AbEntityBadges badges={[
            { label: t(`lead.status.${selected.status}`), tone: selected.status === 'CONVERTED' ? 'success' : 'info' },
            ...(selected.business_no ? [{ label: selected.business_no, tone: 'neutral' as const }] : [])
          ]} />}
          meta={<div className="ab-detail-meta-list">
            <div className="ab-detail-meta-item"><span>{t('lead.fields.owner')}</span><strong>{selected.owner_name ?? '-'}</strong></div>
            <div className="ab-detail-meta-item"><span>{t('lead.fields.lastActivity')}</span><strong>{formatDate(selected.last_activity_at, i18n.language, true)}</strong></div>
            <div className="ab-detail-meta-item"><span>{t('lead.fields.nextAction')}</span><strong>{selected.next_action ?? '-'}</strong></div>
            <div className="ab-detail-meta-item"><span>{t('lead.fields.source')}</span><strong>{selected.lead_source ? t(`lead.source.${selected.lead_source}`) : '-'}</strong></div>
          </div>}
          actions={<AbQuickActions
            ariaLabel={t('lead.quickActionsLabel')}
            actions={[
              { id: 'call', label: t('lead.actions.call'), icon: '☎', href: selected.phone ? `tel:${selected.phone}` : undefined, disabled: !selected.phone },
              { id: 'email', label: t('lead.actions.email'), icon: '✉', href: draft.keymanEmail ? `mailto:${draft.keymanEmail}` : undefined, disabled: !draft.keymanEmail },
              { id: 'meeting', label: t('lead.actions.meeting'), icon: '◷', onClick: openActivityTab },
              { id: 'activity', label: t('lead.actions.addActivity'), icon: '＋', onClick: openActivityTab, tone: 'primary' },
              { id: 'more', label: t('lead.actions.more'), icon: '•••', onClick: () => selectDetailTab('conversion') }
            ]}
          />}
        />

        <AbStepProgress
          steps={stepLabels}
          currentIndex={stepIndex(selected.status)}
          mobileLabel={selected.status === 'CONTACT_EXCLUDED' ? t('lead.status.CONTACT_EXCLUDED') : `${stepIndex(selected.status) + 1}/${API_LEAD_STEPS.length}`}
        />
        {selected.status === 'CONTACT_EXCLUDED' && <div className="ab-detail-terminal"><strong>{t('lead.status.CONTACT_EXCLUDED')}</strong></div>}

        {nextStatus(selected.status) && <div className="lead-v2-status-actions">
          <button type="button" className="lead-v2-button primary" onClick={() => void move(nextStatus(selected.status)!)}>{t('lead.actions.nextStatus')} · {t(`lead.status.${nextStatus(selected.status)!}`)}</button>
        </div>}

        <AbDetailTabs
          ariaLabel={t('lead.detailTitle')}
          activeId={activeTab}
          onChange={selectDetailTab}
          tabs={[
            { id: 'overview', label: t('lead.tabs.overview') },
            { id: 'activity', label: t('lead.tabs.activity') },
            { id: 'keyman', label: t('lead.tabs.keyman'), count: draft.keymanName ? 1 : 0 },
            { id: 'system', label: t('lead.tabs.system') },
            { id: 'conversion', label: t('lead.tabs.conversion') }
          ]}
        />
        <div className="ab-tab-panel" id={`ab-tab-panel-${activeTab}`} role="tabpanel">{renderDetailTab()}</div>
        <AbDetailFooter draftLabel={t('lead.actions.saveDraft')} saveLabel={t('lead.actions.save')} onDraft={() => setMessage(t('lead.toast.draftSaved'))} onSave={() => void saveSections()} />
      </>}
    </>
  );

  return (
    <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
      <header className="lead-v2-page-header">
        <div>
          <div className="lead-v2-title-line"><span className="lead-v2-kicker">GLOBAL · LEAD</span></div>
          <h2>{t('lead.title')}</h2>
          <p>{t('lead.subtitle')}</p>
        </div>
        <div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={openQuickCreate}>+ {t('lead.actions.create')}</button></div>
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
          <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value as LeadStatus | 'ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allStage')}</option>{LEAD_STATUSES.map(status => <option key={status} value={status}>{t(`lead.status.${status}`)}</option>)}</select>
          <select value={ownerFilter} onChange={event => { setOwnerFilter(event.target.value); setPage(1); }}><option value="ALL">{t('lead.filters.allOwner')}</option>{owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}</select>
          <select value={countryFilter} onChange={event => { setCountryFilter(event.target.value); setRegionFilter('ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allCountry')}</option>{countries.map(country => <option key={country} value={country}>{country}</option>)}</select>
          <select value={regionFilter} onChange={event => { setRegionFilter(event.target.value); setPage(1); }}><option value="ALL">{t('lead.filters.allRegion')}</option>{regions.map(region => <option key={region} value={region}>{region}</option>)}</select>
          <select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value as LeadSource | 'ALL'); setPage(1); }}><option value="ALL">{t('lead.filters.allSource')}</option>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`lead.source.${source}`)}</option>)}</select>
          <select value={lastActivityFilter} onChange={event => { setLastActivityFilter(event.target.value as LastActivityFilter); setPage(1); }}><option value="ALL">{t('lead.filters.allLastActivity')}</option><option value="7">{t('lead.filters.last7Days')}</option><option value="30">{t('lead.filters.last30Days')}</option><option value="NONE">{t('lead.filters.noActivity')}</option></select>
        </>}
      />

      <AbWorkspace list={listPane} detail={detailPane} />
      <AbMobileFab label={t('lead.actions.create')} onClick={openQuickCreate} />

      {drawerOpen && (
        <div className="lead-v2-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <aside className="lead-v2-drawer" onMouseDown={event => event.stopPropagation()}>
            <div className="lead-v2-drawer-header"><div><strong>{t('lead.quick.title')}</strong><p>{t('lead.quick.help')}</p></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('app.close')}>×</button></div>
            <div className="lead-v2-form">
              <label><span>{t('lead.fields.hospitalName')} *</span><input value={quickHospital} onChange={event => setQuickHospital(event.target.value)} /></label>
              <label><span>{t('lead.fields.country')} *</span><input value={quickCountry} onChange={event => setQuickCountry(event.target.value)} /></label>
              <label><span>{t('lead.fields.phone')} *</span><input value={quickPhone} onChange={event => setQuickPhone(event.target.value)} inputMode="tel" /></label>
              <label><span>{t('lead.fields.contactName')} *</span><input value={quickContact} onChange={event => setQuickContact(event.target.value)} /></label>
              <label><span>{t('lead.fields.owner')} *</span><input value={quickOwner} onChange={event => setQuickOwner(event.target.value)} /></label>
              <label><span>{t('lead.fields.source')}</span><select value={quickSource} onChange={event => setQuickSource(event.target.value as LeadSource)}>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`lead.source.${source}`)}</option>)}</select></label>
              <label><span>{t('lead.fields.address')}</span><input value={quickAddress} onChange={event => setQuickAddress(event.target.value)} /></label>
            </div>
            <div className="lead-v2-drawer-actions">
              <button type="button" className="lead-v2-button primary" onClick={() => void createLead(false)}>{t('lead.quick.create')}</button>
              <button type="button" className="lead-v2-button secondary" onClick={() => void createLead(true)}>{t('lead.quick.createDetail')}</button>
              <button type="button" className="lead-v2-button ghost" onClick={() => setDrawerOpen(false)}>{t('lead.actions.cancel')}</button>
            </div>
          </aside>
        </div>
      )}

      {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
    </section>
  );
}
