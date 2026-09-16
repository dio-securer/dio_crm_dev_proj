import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountInterfaceField, AccountSummary } from '@dio-crm/contracts';
import { ACCOUNT_STAT_CODES, ACCOUNT_TYPE_CODES, tradeStatusName } from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from '../../../api';
import {
  CRM_FORM_KEY,
  emptyForm,
  formFromAccount,
  toWritePayload,
  type AccountFormInput,
  type AccountScope
} from '../../../account-model';
import { listSandboxAccounts, saveSandboxAccount } from '../../../account-sandbox';
import { AccountListPanel } from '../../../features/account/AccountListPanel';
import { AccountDetailHeader } from '../../../features/account/AccountDetailHeader';
import { AccountActivityQuickAdd } from '../../../features/account/AccountActivityQuickAdd';
import {
  AccountActivitiesPanel,
  AccountContactsPanel,
  AccountOpportunitiesPanel,
  AccountRelatedPanel,
  AccountRelationKpis
} from '../../../features/account/AccountRelationsView';
import { accountCountry } from '../../../features/account/account-list-model';
import { GLOBAL_ACCOUNT_FIELD_PROFILE } from '../../field-profiles/GLOBAL_ACCOUNT';
import { effectiveAccountFields, visibleAccountSections } from '../../field-profiles/field-profile-resolver';
import {
  AbDetailFooter, AbInfoGrid, AbMobileFab, AbSectionAccordion, countryFlag
} from '../../../ui/ab-workspace';
import '../../../styles/lead-workspace.css';

type AccountTab = 'summary' | 'contacts' | 'opportunities' | 'activity' | 'trade' | 'manage' | 'address' | 'erp' | 'related';

export function GlobalAccountPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scope, setScope] = useState<AccountScope>('managed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<AccountTab>('summary');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<AccountFormInput>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [relationTick, setRelationTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activityComposerOpen, setActivityComposerOpen] = useState(false);

  const query = useQuery({
    queryKey: ['global-accounts', scope],
    enabled: !localMode,
    queryFn: () => apiGet<AccountSummary[]>(`/api/accounts?scope=${scope}`),
    retry: false
  });

  React.useEffect(() => {
    if (query.isError) setLocalMode(true);
  }, [query.isError]);

  const rows = useMemo(() => (
    localMode ? listSandboxAccounts('', scope) : (query.data ?? [])
  ), [localMode, localTick, query.data, scope]);
  const selected = useMemo(() => rows.find(row => row.public_id === selectedId) ?? null, [rows, selectedId]);
  const sections = visibleAccountSections(GLOBAL_ACCOUNT_FIELD_PROFILE);
  const tabs: AccountTab[] = ['summary', 'contacts', 'opportunities', 'activity', 'trade', 'manage', 'address', 'erp', 'related'];

  function changeScope(value: AccountScope) {
    setScope(value);
    setSelectedId(null);
    setMobileDetailOpen(false);
    setEditing(false);
    setTab('summary');
  }

  function select(row: AccountSummary) {
    setSelectedId(row.public_id);
    setForm(formFromAccount(row));
    setEditing(false);
    setTab('summary');
    setMobileDetailOpen(true);
    setMessage('');
    setOpenSections(Object.fromEntries(sections.map(section => [section.code, section.code === 'basic'])));
  }

  function openQuickCreate() {
    setSelectedId(null);
    setForm(emptyForm());
    setDrawerOpen(true);
    setMessage('');
  }

  function setField(key: keyof AccountFormInput, value: string) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function relationChanged(toastKey?: string) {
    setRelationTick(value => value + 1);
    setLocalTick(value => value + 1);
    if (toastKey) setMessage(t(toastKey));
  }

  function displayValue(row: AccountSummary, field: AccountInterfaceField) {
    if (field.code === 'co_cd') return row.company_code || '-';
    if (field.code === 'trade_bc_nm') return tradeStatusName(row.erp_trade_code) || '-';
    if (!field.crmField) return '-';
    const value = row[field.crmField];
    if (value == null || value === '') return '-';
    return typeof value === 'boolean' ? (value ? 'Y' : 'N') : String(value);
  }

  function fieldControl(field: AccountInterfaceField, readonly: boolean) {
    if (readonly || !field.crmField || !CRM_FORM_KEY[field.crmField]) {
      return <div className="readonly-value">{selected ? displayValue(selected, field) : '-'}</div>;
    }
    const key = CRM_FORM_KEY[field.crmField]!;
    const value = form[key];
    if (key === 'accountType') return <select value={value} onChange={event => setField(key, event.target.value)}>{Object.keys(ACCOUNT_TYPE_CODES).map(code => <option key={code} value={code}>{code}</option>)}</select>;
    if (key === 'useYn') return <select value={value} onChange={event => setField(key, event.target.value)}><option value="1">{t('account.yes')}</option><option value="0">{t('account.no')}</option></select>;
    if (key === 'churnRiskYn') return <select value={value} onChange={event => setField(key, event.target.value)}><option value="0">{t('account.churnNo')}</option><option value="1">{t('account.churnYes')}</option></select>;
    if (key === 'accountStatCode') return <select value={value} onChange={event => setField(key, event.target.value)}>{Object.keys(ACCOUNT_STAT_CODES).map(code => <option key={code} value={code}>{code}</option>)}</select>;
    return <input value={value} onChange={event => setField(key, event.target.value)} />;
  }

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    if (!form.accountName.trim() || !form.phone.trim()) {
      setMessage(t('account.quick.required'));
      return;
    }
    setSaving(true);
    try {
      if (selectedId) await apiPatch(`/api/accounts/${selectedId}`, toWritePayload(form));
      else {
        const created = await apiPost<AccountSummary>('/api/accounts', toWritePayload(form));
        setSelectedId(created.public_id);
      }
      setMessage(selectedId ? t('account.updateDone') : t('account.createDone'));
      setEditing(false);
      setDrawerOpen(false);
      setMobileDetailOpen(true);
      await qc.invalidateQueries({ queryKey: ['global-accounts'] });
    } catch {
      try {
        const saved = saveSandboxAccount(selectedId, form);
        setLocalMode(true);
        setLocalTick(n => n + 1);
        setSelectedId(saved.public_id);
        setMessage(selectedId ? t('account.updateDone') : t('account.createDone'));
        setEditing(false);
        setDrawerOpen(false);
        setMobileDetailOpen(true);
      } catch (sandboxError) {
        setMessage(sandboxError instanceof Error ? sandboxError.message : String(sandboxError));
      }
    } finally {
      setSaving(false);
    }
  }

  const renderSectionFields = (sectionCode: string) => {
    const section = sections.find(item => item.code === sectionCode);
    if (!section) return null;
    return <div className="account-form-grid">
      {effectiveAccountFields(section).map(({ field, rule }) => (
        <label key={field.code} className={field.group === 'address' && field.code !== 'zip_cd' ? 'full' : ''}>
          {t(`account.sections.${section.code}`, { defaultValue: section.code })}{field.nameEn}{rule.required ? ' *' : ''}
          {editing ? fieldControl(field, rule.readonly) : <div className="readonly-value">{selected ? displayValue(selected, field) : '-'}</div>}
        </label>
      ))}
    </div>;
  };

  const renderTab = () => {
    if (!selected) return null;
    if (tab === 'summary') {
      const country = accountCountry(selected);
      return <>
        <AbInfoGrid columns={2} items={[
          { label: t('account.fields.accountName'), value: selected.account_name },
          { label: t('account.fields.accountCode'), value: selected.erp_customer_code || '-' },
          { label: t('account.fields.country'), value: <span className="ab-list-country"><i>{countryFlag(country)}</i>{country}</span> },
          { label: t('account.crmStatus'), value: t(`account.statuses.${selected.account_status}`, { defaultValue: selected.account_status }) },
          { label: t('account.grade'), value: t(`account.grades.${selected.account_grade || 'GENERAL'}`, { defaultValue: selected.account_grade || '-' }) },
          { label: t('account.owner'), value: selected.owner_name ?? '-' },
          { label: t('account.phone'), value: selected.phone ?? '-' },
          { label: t('account.integration'), value: t(`account.integrationStatus.${selected.integration_status}`, { defaultValue: selected.integration_status }) }
        ]} />
        <AccountRelationKpis accountId={selected.public_id} tick={relationTick} onNavigate={target => setTab(target)} />
      </>;
    }
    if (tab === 'contacts') return <AccountContactsPanel accountId={selected.public_id} tick={relationTick} onChanged={() => relationChanged('account.toast.contactAdded')} />;
    if (tab === 'opportunities') return <AccountOpportunitiesPanel accountId={selected.public_id} tick={relationTick} />;
    if (tab === 'activity') return <AccountActivitiesPanel accountId={selected.public_id} tick={relationTick} onAddActivity={() => setActivityComposerOpen(true)} />;
    const sectionMap: Partial<Record<AccountTab, string>> = { trade: 'erp', manage: 'manage', address: 'address', erp: 'erp' };
    if (tab === 'related') return <AccountRelatedPanel accountId={selected.public_id} tick={relationTick} onAddActivity={() => setActivityComposerOpen(true)} />;
    const sectionCode = sectionMap[tab];
    if (!sectionCode) return null;
    const section = sections.find(item => item.code === sectionCode);
    if (!section) return null;
    return <AbSectionAccordion id={sectionCode} title={t(`account.tabs.${tab}`)} open={openSections[sectionCode] ?? true} onToggle={() => setOpenSections(prev => ({ ...prev, [sectionCode]: !prev[sectionCode] }))}>{renderSectionFields(section.code)}</AbSectionAccordion>;
  };

  const detailPane = <article className="lead-v2-detail-pane">
    {!selected && <div className="lead-v2-empty-detail">{t('account.empty.detail')}</div>}
    {selected && <>
      <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('account.back')}</button>
      <AccountDetailHeader account={selected} onEdit={() => setEditing(value => !value)} onAddActivity={() => setActivityComposerOpen(true)} />
      <nav className="lead-v2-tabs">{tabs.map(item => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(`account.tabs.${item}`)}</button>)}</nav>
      <div className="lead-v2-detail-content">{renderTab()}</div>
      <AbDetailFooter draftLabel={t('account.actions.saveDraft')} saveLabel={t('common.save')} onDraft={() => setMessage(t('account.toast.draftSaved'))} onSave={() => void save()} saving={saving} />
    </>}
  </article>;

  return <section className={`lead-v2 ab-workspace${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="lead-v2-page-header"><div><div className="lead-v2-title-line"><span className="lead-v2-kicker">GLOBAL · ACCOUNT</span></div><h2>{t('account.title')}</h2><p>{t('account.subtitle')}</p></div><div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={openQuickCreate}>+ {t('account.actions.create')}</button></div></header>
    <AccountListPanel rows={rows} loading={query.isLoading && !localMode} selectedId={selectedId} scope={scope} onScopeChange={changeScope} onSelect={select} detail={detailPane} />
    <AbMobileFab label={t('account.actions.create')} onClick={openQuickCreate} />
    {selected && <AccountActivityQuickAdd open={activityComposerOpen} accountId={selected.public_id} ownerName={selected.owner_name ?? '-'} onClose={() => setActivityComposerOpen(false)} onSaved={() => relationChanged('account.toast.activityAdded')} />}
    {drawerOpen && <div className="lead-v2-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}><aside className="lead-v2-drawer" onMouseDown={e => e.stopPropagation()}><div className="lead-v2-drawer-header"><div><strong>{t('account.quick.title')}</strong><p>{t('account.quick.help')}</p></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('app.close')}>×</button></div><form className="lead-v2-form" onSubmit={e => void save(e)}><label><span>{t('account.fields.accountName')} *</span><input value={form.accountName} onChange={e => setField('accountName', e.target.value)} required /></label><label><span>{t('account.fields.accountType')} *</span><select value={form.accountType} onChange={e => setField('accountType', e.target.value)}>{Object.keys(ACCOUNT_TYPE_CODES).map(code => <option key={code} value={code}>{code}</option>)}</select></label><label><span>{t('account.phone')} *</span><input value={form.phone} onChange={e => setField('phone', e.target.value)} inputMode="tel" /></label><label><span>{t('account.fields.address')}</span><input value={form.hospitalAddress} onChange={e => setField('hospitalAddress', e.target.value)} /></label><div className="lead-v2-drawer-actions"><button type="submit" className="lead-v2-button primary">{t('account.quick.create')}</button><button type="button" className="lead-v2-button ghost" onClick={() => setDrawerOpen(false)}>{t('common.cancel')}</button></div></form></aside></div>}
    {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
  </section>;
}
