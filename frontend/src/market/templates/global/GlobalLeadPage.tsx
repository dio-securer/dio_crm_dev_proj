import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountSummary, LeadStatus, LeadSummary } from '@dio-crm/contracts';
import { API_LEAD_STEPS } from '../../../features/lead/lead-model';
import { createSandboxLead, listSandboxLeads } from '../../../features/lead/lead-sandbox';
import { apiGet, apiPatch, apiPost } from '../../../api';
import {
  AbDetailFooter, AbEntityBadges, AbMobileFab, AbSectionAccordion, AbStepProgress, countryFlag
} from '../../../ui/ab-workspace';
import '../../../styles/lead-workspace.css';

type ListFilter = 'all' | 'inProgress' | 'converted';
type SectionId = 'basic' | 'keyman' | 'system' | 'activity' | 'conversion';

type LeadDetail = LeadSummary & {
  keyman_name?: string | null;
  keyman_type?: string | null;
  keyman_mobile?: string | null;
  keyman_email?: string | null;
  main_system?: string | null;
  sub_system?: string | null;
  contact_exclude_reason?: string | null;
};

const STATUS_FLOW: LeadStatus[] = ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING'];

function stepIndex(status: LeadStatus): number {
  if (status === 'CONTACT_EXCLUDED') return -1;
  const idx = API_LEAD_STEPS.indexOf(status as typeof API_LEAD_STEPS[number]);
  return idx >= 0 ? idx : 0;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="lead-v2-info-row"><span>{label}</span><strong>{value || '-'}</strong></div>;
}

export function GlobalLeadPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [selectedId, setSelectedId] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    basic: true, keyman: false, system: false, activity: false, conversion: false
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
  const [quickAddress, setQuickAddress] = useState('');
  const [draft, setDraft] = useState({ keymanName: '', keymanType: '', keymanMobile: '', keymanEmail: '', mainSystem: '', subSystem: '' });

  const leads = useQuery({
    queryKey: ['global-leads', search],
    enabled: !localMode,
    queryFn: () => apiGet<LeadSummary[]>(`/api/leads${search ? `?search=${encodeURIComponent(search)}` : ''}`),
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

  const filteredRows = useMemo(() => {
    const rows = localMode ? listSandboxLeads(search) : (leads.data ?? []);
    if (listFilter === 'inProgress') return rows.filter(row => row.status !== 'CONVERTED' && row.status !== 'CONTACT_EXCLUDED');
    if (listFilter === 'converted') return rows.filter(row => row.status === 'CONVERTED');
    return rows;
  }, [leads.data, listFilter, localMode, localTick, search]);

  const selected = useMemo(() => filteredRows.find(row => row.public_id === selectedId) ?? null, [filteredRows, selectedId]);
  const selectedDetail = detail.data;

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

  const selectLead = (publicId: string) => {
    setSelectedId(publicId);
    setOpenSections({ basic: true, keyman: false, system: false, activity: false, conversion: false });
    setMobileDetailOpen(true);
    setMessage('');
  };

  const stepLabels = API_LEAD_STEPS.map(step => ({ id: step, label: t(`lead.steps.${step}`) }));

  function resetQuickForm() {
    setQuickHospital('');
    setQuickCountry('US');
    setQuickPhone('');
    setQuickContact('');
    setQuickAddress('');
  }

  function openQuickCreate() {
    setDrawerOpen(true);
    setMessage('');
  }

  async function createLead(openDetail: boolean) {
    if (!quickHospital.trim() || !quickPhone.trim() || !quickCountry.trim() || !quickContact.trim()) {
      setMessage(t('lead.quick.required'));
      return;
    }
    const payload = {
      hospitalName: quickHospital.trim(),
      country: quickCountry.trim(),
      phone: quickPhone.trim(),
      contactName: quickContact.trim(),
      address: quickAddress.trim(),
      ownerName: quickContact.trim()
    };
    let created: LeadSummary;
    try {
      created = await apiPost<LeadSummary>('/api/leads', {
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
    setMobileDetailOpen(openDetail);
    setOpenSections({ basic: true, keyman: true, system: false, activity: false, conversion: false });
    setMessage(t('lead.toast.created'));
  }

  async function move(toStatus: LeadStatus) {
    if (!selected) return;
    try {
      await apiPost(`/api/leads/${selected.public_id}/status`, {
        toStatus,
        reason: toStatus === 'CONTACT_EXCLUDED' ? reason || undefined : undefined
      });
      setMessage(t('lead.toast.statusUpdated'));
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
      const result = await apiPost<{ accountPublicId: string; opportunityPublicId: string }>(
        `/api/leads/${selected.public_id}/convert`,
        {
          accountMode: mode,
          existingAccountPublicId: mode === 'EXISTING' ? existingAccountId : undefined,
          opportunityName: opportunityName.trim() || undefined
        }
      );
      setMessage(t('lead.toast.converted', { defaultValue: `Converted: ${result.accountPublicId}` }));
      setOpportunityName('');
      setExistingAccountId('');
      await qc.invalidateQueries({ queryKey: ['global-leads'] });
      await qc.invalidateQueries({ queryKey: ['global-lead-accounts'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const renderConceptBDetail = () => {
    if (!selected) return null;
    const d = selectedDetail;
    const region = [selected.sido, selected.sigungu].filter(Boolean).join(' ') || 'GLOBAL';
    return (
      <>
        <div className="ab-basic-panel">
          <h4>{t('lead.sections.basic')}</h4>
          <InfoRow label={t('lead.fields.hospitalName')} value={selected.hospital_name} />
          <InfoRow label={t('lead.fields.phone')} value={selected.phone} />
          <InfoRow label={t('lead.fields.country')} value={<span className="ab-list-country"><i>{countryFlag(region)}</i>{region}</span>} />
          <InfoRow label={t('lead.fields.address')} value={selected.address} />
          <InfoRow label={t('lead.fields.businessNo')} value={selected.business_no} />
          <InfoRow label={t('lead.fields.owner')} value={selected.owner_name} />
        </div>
        <div className="ab-sections">
          <AbSectionAccordion id="keyman" title={t('lead.sections.keyman')} open={openSections.keyman} onToggle={() => toggleSection('keyman')} incomplete={!draft.keymanName}>
            <div className="lead-v2-form">
              <label><span>{t('lead.fields.keymanName')}</span><input value={draft.keymanName} onChange={e => setDraft(p => ({ ...p, keymanName: e.target.value }))} /></label>
              <label><span>{t('lead.fields.keymanType')}</span><input value={draft.keymanType} onChange={e => setDraft(p => ({ ...p, keymanType: e.target.value }))} /></label>
              <label><span>{t('lead.fields.keymanMobile')}</span><input value={draft.keymanMobile} onChange={e => setDraft(p => ({ ...p, keymanMobile: e.target.value }))} /></label>
              <label><span>{t('lead.fields.keymanEmail')}</span><input value={draft.keymanEmail} onChange={e => setDraft(p => ({ ...p, keymanEmail: e.target.value }))} /></label>
            </div>
          </AbSectionAccordion>
          <AbSectionAccordion id="system" title={t('lead.sections.system')} open={openSections.system} onToggle={() => toggleSection('system')} incomplete={!draft.mainSystem}>
            <div className="lead-v2-form">
              <label><span>{t('lead.fields.mainSystem')}</span><input value={draft.mainSystem} onChange={e => setDraft(p => ({ ...p, mainSystem: e.target.value }))} /></label>
              <label><span>{t('lead.fields.subSystem')}</span><input value={draft.subSystem} onChange={e => setDraft(p => ({ ...p, subSystem: e.target.value }))} /></label>
            </div>
          </AbSectionAccordion>
          <AbSectionAccordion id="activity" title={t('lead.sections.activity')} open={openSections.activity} onToggle={() => toggleSection('activity')}>
            <p className="lead-v2-empty-inline">{t('lead.empty.activity')}</p>
          </AbSectionAccordion>
          <AbSectionAccordion id="conversion" title={t('lead.sections.conversion')} open={openSections.conversion} onToggle={() => toggleSection('conversion')}>
            {selected.status === 'KEYMAN_MEETING' ? (
              <div className="lead-v2-form">
                <input value={opportunityName} onChange={e => setOpportunityName(e.target.value)} placeholder={t('lead.fields.expectedAmount', { defaultValue: 'Opportunity name' })} />
                <button type="button" className="lead-v2-button primary" onClick={() => void convert('NEW')}>{t('lead.actions.convert')}</button>
                <select value={existingAccountId} onChange={e => setExistingAccountId(e.target.value)}>
                  <option value="">{t('common.selectNone')}</option>
                  {(accounts.data ?? []).map(account => <option key={account.public_id} value={account.public_id}>{account.account_name}</option>)}
                </select>
                <button type="button" className="lead-v2-button secondary" onClick={() => void convert('EXISTING')}>{t('lead.actions.convert')}</button>
              </div>
            ) : (
              <p className="lead-v2-empty-inline">{t('lead.status.KEYMAN_MEETING')} {t('lead.sections.conversion')}</p>
            )}
            {d?.contact_exclude_reason && <InfoRow label={t('lead.fields.excludeReason')} value={d.contact_exclude_reason} />}
          </AbSectionAccordion>
        </div>
      </>
    );
  };

  return (
    <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
      <header className="lead-v2-page-header">
        <div>
          <div className="lead-v2-title-line"><span className="lead-v2-kicker">GLOBAL · LEAD</span></div>
          <h2>{t('lead.title')}</h2>
          <p>{t('lead.subtitle')}</p>
        </div>
        <div className="lead-v2-header-actions">
          <button type="button" className="lead-v2-button primary" onClick={openQuickCreate}>+ {t('lead.actions.create')}</button>
        </div>
      </header>

      <div className="lead-v2-filter-tabs">
        {(['all', 'inProgress', 'converted'] as ListFilter[]).map(id => (
          <button key={id} type="button" className={listFilter === id ? 'active' : ''} onClick={() => setListFilter(id)}>{t(`lead.filters.${id}`)}</button>
        ))}
      </div>

      <div className="lead-v2-toolbar">
        <label className="lead-v2-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('lead.searchPlaceholder')} /></label>
      </div>

      <div className="lead-v2-workspace">
        <aside className="lead-v2-list-pane">
          <div className="lead-v2-list-header"><div><strong>{t('lead.listTitle')}</strong><span>{t('lead.count', { count: filteredRows.length })}</span></div></div>
          <div className="lead-v2-list-columns">
            <span>{t('lead.columns.hospitalName')}</span><span>{t('lead.columns.status')}</span><span>{t('lead.columns.owner')}</span><span>{t('lead.columns.phone')}</span>
          </div>
          <div className="lead-v2-list-body">
            {leads.isLoading && !localMode && <p className="lead-v2-empty-inline">{t('common.loading')}</p>}
            {(!leads.isLoading || localMode) && !filteredRows.length && <p className="lead-v2-empty-inline">{t('lead.empty.list')}</p>}
            {filteredRows.map(row => {
              const region = [row.sido, row.sigungu].filter(Boolean).join(' ') || 'GLOBAL';
              return (
                <button type="button" key={row.public_id} onClick={() => selectLead(row.public_id)} className={`lead-v2-row global-lead-row${row.public_id === selectedId ? ' selected' : ''}`}>
                  <span className="lead-v2-lead-cell"><strong>{row.hospital_name}</strong><small>{row.business_no || '-'}</small><em className="ab-list-country"><i>{countryFlag(region)}</i>{region}</em></span>
                  <span><i className="lead-v2-pill stage-NEW">{t(`lead.status.${row.status}`)}</i></span>
                  <span className="lead-v2-owner">{row.owner_name ?? '-'}</span>
                  <span className="lead-v2-date">{row.phone ?? '-'}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="lead-v2-detail-pane">
          {!selected && <div className="lead-v2-empty-detail">{t('lead.empty.detail')}</div>}
          {selected && <>
            <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('lead.actions.back')}</button>
            <div className="lead-v2-detail-header">
              <div className="lead-v2-detail-identity">
                <div className="lead-v2-name-line"><h3>{selected.hospital_name}</h3></div>
                <p>{selected.owner_name ?? '-'} · {selected.phone ?? '-'}</p>
                <AbEntityBadges badges={[
                  { label: t(`lead.status.${selected.status}`), tone: selected.status === 'CONVERTED' ? 'success' : 'info' },
                  { label: selected.business_no || '-', tone: 'neutral' }
                ]} />
              </div>
            </div>
            <AbStepProgress
              steps={stepLabels}
              currentIndex={Math.max(0, stepIndex(selected.status))}
              mobileLabel={`${Math.max(0, stepIndex(selected.status)) + 1}/${API_LEAD_STEPS.length}`}
            />
            <div className="lead-v2-status-actions">
              {STATUS_FLOW.map(status => <button key={status} type="button" className="lead-v2-button ghost" onClick={() => void move(status)} disabled={selected.status === 'CONVERTED'}>{t(`lead.status.${status}`)}</button>)}
              <button type="button" className="lead-v2-button ghost" onClick={() => void move('CONTACT_EXCLUDED')} disabled={selected.status === 'CONVERTED'}>{t('lead.actions.exclude')}</button>
            </div>
            <input className="lead-v2-inline-input" value={reason} onChange={e => setReason(e.target.value)} placeholder={t('lead.fields.excludeReason')} />
            <div className="lead-v2-detail-content">{renderConceptBDetail()}</div>
            <AbDetailFooter
              draftLabel={t('lead.actions.saveDraft')}
              saveLabel={t('lead.actions.save')}
              onDraft={() => setMessage(t('lead.toast.draftSaved'))}
              onSave={() => void saveSections()}
            />
          </>}
        </article>
      </div>
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
