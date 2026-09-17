import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AccountSummary } from '@dio-crm/contracts';
import {
  ACCOUNT_STAT_CODES, ACCOUNT_TYPE_CODES, ERP_APPROVAL_CODES,
  accountTypeName, tradeStatusName, type AccountInterfaceField
} from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from './api';
import { useGlobalization } from './market/globalization-context';
import {
  ACCOUNT_STATUSES, CRM_FORM_KEY, FORM_SECTIONS, emptyForm, erpMissingCodes, fieldsByCodes,
  formFromAccount, listVisibleAccounts, toWritePayload, type AccountFormInput, type AccountScope
} from './account-model';
import { listSandboxAccounts, saveSandboxAccount, setSandboxAccountOwner } from './account-sandbox';
import { AccountListPanel } from './features/account/AccountListPanel';
import { AccountDetailHeader } from './features/account/AccountDetailHeader';
import { AccountActivityQuickAdd } from './features/account/AccountActivityQuickAdd';
import { AccountQuickCreatePanel } from './features/account/AccountQuickCreatePanel';
import { AccountErpWorkflowPanel } from './features/account/AccountErpWorkflowPanel';
import { AccountTabNav, type AccountTabId } from './features/account/AccountTabNav';
import {
  ACCOUNT_OWNER_NAMES,
  accountOwnerOverride,
  accountQuickDraftToForm,
  saveAccountProfileSupplement,
  type AccountQuickCreateDraft
} from './features/account/account-quick-create';
import { requestAccountErpMock } from './features/account/account-erp-mock';
import { loadAccountPageState, saveAccountPageState } from './features/account/account-view-state';
import {
  AccountActivitiesPanel,
  AccountContactsPanel,
  AccountOpportunitiesPanel,
  AccountRelatedPanel,
  AccountRelationKpis
} from './features/account/AccountRelationsView';
import { accountCountry } from './features/account/account-list-model';
import {
  AbDetailFooter, AbInfoGrid, AbMobileFab, AbSectionAccordion, countryFlag
} from './ui/ab-workspace';
import './styles/lead-workspace.css';
import './styles/account-quick-erp.css';

type AccountTab = AccountTabId;
const PAGE_STATE_KEY = 'dio-crm:account:view:hq:v1';
const LIST_STATE_KEY = 'dio-crm:account:list:hq:v1';
const QUICK_DRAFT_KEY = 'dio-crm:account:quick:hq:v1';
const DEFAULT_PAGE_STATE = { scope: 'managed' as AccountScope, selectedId: null, tab: 'summary' as AccountTab, mobileDetailOpen: false };

export function AccountsPage() {
  const { t } = useTranslation();
  const { featureEnabled } = useGlobalization();
  const restored = React.useMemo(() => loadAccountPageState(PAGE_STATE_KEY, DEFAULT_PAGE_STATE), []);
  const [scope, setScope] = useState<AccountScope>(restored.scope);
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [relationTick, setRelationTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(restored.selectedId);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(restored.mobileDetailOpen);
  const [form, setForm] = useState<AccountFormInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => Object.fromEntries(FORM_SECTIONS.map(section => [section.id, true])));
  const [accountTab, setAccountTab] = useState<AccountTab>(restored.tab);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDesktop, setEditingDesktop] = useState(false);
  const [activityComposerOpen, setActivityComposerOpen] = useState(false);
  const erpEnabled = featureEnabled('ERP_ACCOUNT_APPROVAL');

  const query = useQuery({
    queryKey: ['accounts', scope],
    enabled: !localMode,
    queryFn: () => apiGet<AccountSummary[]>(`/api/accounts?scope=${scope}`),
    retry: false
  });

  React.useEffect(() => {
    if (query.isError && !localMode) {
      setLocalMode(true);
      setMessage('');
    }
  }, [query.isError, localMode]);

  const sandbox = localMode || Boolean(query.isError);
  const rows = useMemo(() => {
    const source = sandbox ? listSandboxAccounts('', scope) : listVisibleAccounts(query.data ?? [], '', scope);
    return source.map(row => {
      const owner = accountOwnerOverride(row.public_id);
      return owner ? { ...row, owner_name: owner } : row;
    });
  }, [sandbox, scope, query.data, localTick]);
  const selected = rows.find(x => x.public_id === selectedId) ?? null;

  React.useEffect(() => {
    saveAccountPageState(PAGE_STATE_KEY, { scope, selectedId, tab: accountTab, mobileDetailOpen });
  }, [scope, selectedId, accountTab, mobileDetailOpen]);

  React.useEffect(() => {
    if (selected && !form.accountName) setForm(formFromAccount(selected));
  }, [selected, form.accountName]);

  const setField = (key: keyof AccountFormInput, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const changeScope = (value: AccountScope) => {
    setScope(value);
    setSelectedId(null);
    setMobileDetailOpen(false);
    setEditingDesktop(false);
    setAccountTab('summary');
    setForm(emptyForm());
  };

  const openCreate = () => {
    setDrawerOpen(true);
    setMessage('');
  };

  const openDetail = (row: AccountSummary) => {
    setSelectedId(row.public_id);
    setForm(formFromAccount(row));
    setAccountTab('summary');
    setEditingDesktop(false);
    setMobileDetailOpen(true);
    setOpenSections(Object.fromEntries(FORM_SECTIONS.map(section => [section.id, section.id === 'basic'])));
  };

  const relationChanged = (toastKey?: string) => {
    setRelationTick(value => value + 1);
    setLocalTick(value => value + 1);
    if (toastKey) setMessage(t(toastKey));
  };

  const saveQuickCreate = async (draft: AccountQuickCreateDraft) => {
    setSaving(true);
    try {
      const quickForm = accountQuickDraftToForm(draft);
      let publicId = '';
      if (sandbox) {
        const saved = saveSandboxAccount(null, quickForm);
        const owned = draft.ownerCode ? setSandboxAccountOwner(saved.public_id, ACCOUNT_OWNER_NAMES[draft.ownerCode]) : saved;
        publicId = owned.public_id;
        setLocalTick(value => value + 1);
      } else {
        const created = await apiPost<AccountSummary>('/api/accounts', toWritePayload(quickForm));
        publicId = created.public_id;
        await query.refetch();
      }
      saveAccountProfileSupplement(publicId, draft);
      setSelectedId(publicId);
      setForm(quickForm);
      setAccountTab('summary');
      setEditingDesktop(false);
      setMobileDetailOpen(true);
      setDrawerOpen(false);
      setMessage(t('account.createDone'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!form.accountName.trim()) {
      setMessage(t('account.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (sandbox) {
        const saved = saveSandboxAccount(selectedId, form);
        setLocalTick(n => n + 1);
        setSelectedId(saved.public_id);
      } else if (selectedId) {
        await apiPatch(`/api/accounts/${selectedId}`, toWritePayload(form));
        await query.refetch();
      }
      setMessage(t('account.updateDone'));
      setEditingDesktop(false);
      setMobileDetailOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const requestErp = async (publicId: string) => {
    const row = rows.find(x => x.public_id === publicId);
    if (row) {
      const missing = erpMissingCodes(row);
      if (missing.length) {
        setMessage(t('account.erpMissing', { fields: missing.join(', ') }));
        return;
      }
    }
    try {
      if (sandbox) {
        const workflow = requestAccountErpMock(publicId);
        setLocalTick(n => n + 1);
        setMessage(t('account.queueCreated', { requestId: workflow.requestId || '-' }));
        return;
      }
      const result = await apiPost<{ requestId: string }>(`/api/erp-accounts/${publicId}/request`);
      setMessage(t('account.queueCreated', { requestId: result.requestId }));
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const erpWorkflowChanged = (messageKey: string, options?: Record<string, unknown>) => {
    setLocalTick(value => value + 1);
    setMessage(t(messageKey, options));
  };

  const fieldInput = (field: Pick<AccountInterfaceField, 'code' | 'crmField'>, disabled = false) => {
    if (field.code === 'trade_bc_nm') return <div className="readonly-value">{tradeStatusName(selected?.erp_trade_code) || '-'}</div>;
    if (field.code === 'co_cd') return <div className="readonly-value">{selected?.company_code || 'DIO'}</div>;
    const crmField = field.crmField ?? '';
    const key = CRM_FORM_KEY[crmField];
    if (!key) {
      const row = selected;
      const raw = row && crmField ? (row as Record<string, unknown>)[crmField] : '';
      if (crmField === 'erp_trade_code') {
        const code = String(raw || '');
        return <div className="readonly-value">{code ? `${code} ${tradeStatusName(code)}` : '-'}</div>;
      }
      if (crmField === 'erp_approval_code') return <div className="readonly-value">{ERP_APPROVAL_CODES[String(raw || '') as keyof typeof ERP_APPROVAL_CODES] || String(raw || '-')}</div>;
      if (crmField === 'erp_customer_code') return <div className="readonly-value">{String(raw || '-')}</div>;
      return <div className="readonly-value">{String(raw || '-')}</div>;
    }
    const value = form[key];
    if (key === 'accountType') return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}>{Object.entries(ACCOUNT_TYPE_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>;
    if (key === 'useYn') return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}><option value="1">{t('account.yes')}</option><option value="0">{t('account.no')}</option></select>;
    if (key === 'churnRiskYn') return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}><option value="1">{t('account.churnYes')}</option><option value="0">{t('account.churnNo')}</option></select>;
    if (key === 'accountStatCode') return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}>{Object.entries(ACCOUNT_STAT_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>;
    if (key === 'openDate') return <input type="date" value={value} disabled={disabled} onChange={e => setField(key, e.target.value)} />;
    return <input value={value} disabled={disabled} onChange={e => setField(key, e.target.value)} />;
  };

  const interfaceDisplay = (row: AccountSummary, field: AccountInterfaceField) => {
    if (field.code === 'co_cd') return row.company_code || 'DIO';
    if (field.code === 'trade_bc_nm') return tradeStatusName(row.erp_trade_code) || '-';
    if (field.code === 'trade_bc') {
      const code = row.erp_trade_code;
      return code ? `${code} ${tradeStatusName(code)}` : '-';
    }
    if (field.code === 'sal_kd') return accountTypeName(row.account_type) || '-';
    if (field.code === 'appr_bc') return ERP_APPROVAL_CODES[(row.erp_approval_code || '') as keyof typeof ERP_APPROVAL_CODES] || row.erp_approval_code || '-';
    if (field.code === 'use_yn') return row.use_yn === '0' ? t('account.no') : row.use_yn === '1' ? t('account.yes') : '-';
    if (field.code === 'mgt_yn') return row.churn_risk_yn ? t('account.churnYes') : t('account.churnNo');
    if (field.code === 'stat_bc') return ACCOUNT_STAT_CODES[(row.account_stat_code || '') as keyof typeof ACCOUNT_STAT_CODES] || row.account_stat_code || '-';
    if (!field.crmField) return '-';
    const raw = row[field.crmField];
    if (raw == null || raw === '') return '-';
    const text = String(raw);
    if (field.code === 'tel') return <a href={`tel:${text}`}>{text}</a>;
    if (field.code === 'email') return <a href={`mailto:${text}`}>{text}</a>;
    if (field.code === 'homepage') return <a href={/^https?:\/\//i.test(text) ? text : `https://${text}`} target="_blank" rel="noreferrer">{text}</a>;
    return text;
  };

  const formSections = (compact = false) => (
    <div className={`account-form-sections${compact ? ' compact' : ''}`}>
      <label className="full">{t('account.name')}<input value={form.accountName} onChange={e => setField('accountName', e.target.value)} required /></label>
      <label>{t('account.crmStatus')}<select value={form.accountStatus} onChange={e => setField('accountStatus', e.target.value)}>{ACCOUNT_STATUSES.map(status => <option key={status} value={status}>{t(`account.statuses.${status}`)}</option>)}</select></label>
      <label>{t('account.grade')}<select value={form.accountGrade} onChange={e => setField('accountGrade', e.target.value)}><option value="GENERAL">{t('account.grades.GENERAL')}</option><option value="KEY">{t('account.grades.KEY')}</option></select></label>
      {FORM_SECTIONS.map(section => (
        <fieldset key={section.id}>
          <legend>{t(section.titleKey)}</legend>
          <div className="account-form-grid">
            {fieldsByCodes(section.codes).map(field => field && (
              <label key={field.code} className={field.group === 'address' && field.code !== 'zip_cd' ? 'full' : ''}>
                {field.nameKo}{field.requiredOut ? ' *' : ''}
                {fieldInput(field, false)}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );

  const renderDesktopTab = () => {
    if (!selected) return null;
    if (accountTab === 'summary') {
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
        <AccountRelationKpis accountId={selected.public_id} tick={relationTick} onNavigate={target => setAccountTab(target)} />
      </>;
    }
    if (accountTab === 'contacts') return <AccountContactsPanel accountId={selected.public_id} tick={relationTick} onChanged={() => relationChanged('account.toast.contactAdded')} />;
    if (accountTab === 'opportunities') return <AccountOpportunitiesPanel accountId={selected.public_id} tick={relationTick} />;
    if (accountTab === 'activity') return <AccountActivitiesPanel accountId={selected.public_id} tick={relationTick} onAddActivity={() => setActivityComposerOpen(true)} />;
    if (accountTab === 'related') return <AccountRelatedPanel accountId={selected.public_id} tick={relationTick} onAddActivity={() => setActivityComposerOpen(true)} />;

    const sectionMap: Partial<Record<AccountTab, string>> = { trade: 'erp', manage: 'manage', address: 'address', erp: 'erp' };
    const sectionId = sectionMap[accountTab];
    if (!sectionId) return null;
    const section = FORM_SECTIONS.find(item => item.id === sectionId);
    if (!section) return null;
    const content = <AbSectionAccordion id={sectionId} title={t(`account.tabs.${accountTab}`)} open onToggle={() => undefined}>
      {editingDesktop ? formSections(true) : <dl className="mob-summary">{fieldsByCodes(section.codes).map(field => field && <div key={field.code}><dt>{field.nameKo}</dt><dd>{interfaceDisplay(selected, field)}</dd></div>)}</dl>}
    </AbSectionAccordion>;
    if (accountTab === 'erp' && sandbox) return <><AccountErpWorkflowPanel account={selected} tick={localTick} onChanged={erpWorkflowChanged} />{content}</>;
    return content;
  };

  const detailPane = <article className="lead-v2-detail-pane">
    {!selected && <div className="lead-v2-empty-detail">{t('account.empty.detail')}</div>}
    {selected && <>
      <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('account.back')}</button>
      <AccountDetailHeader
        account={selected}
        onEdit={() => setEditingDesktop(value => !value)}
        onAddActivity={() => setActivityComposerOpen(true)}
        onErpRequest={(erpEnabled || sandbox) ? () => void requestErp(selected.public_id) : undefined}
        erpRequestDisabled={selected.erp_approved_yn || ['REQUESTING', 'REVIEWING'].includes(selected.integration_status)}
      />
      <AccountTabNav activeTab={accountTab} onChange={setAccountTab} />
      <div className="lead-v2-detail-content">{renderDesktopTab()}</div>
      <AbDetailFooter draftLabel={t('account.actions.saveDraft')} saveLabel={t('common.save')} onDraft={() => setMessage(t('account.toast.draftSaved'))} onSave={() => void save()} saving={saving} />
    </>}
  </article>;

  return <section className={`lead-v2 ab-workspace account-desktop-ab${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
    <header className="lead-v2-page-header">
      <div><div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · ACCOUNT</span></div><h2>{t('account.title')}</h2><p>{t('account.manageSubtitle')}</p></div>
      <div className="lead-v2-header-actions"><button type="button" className="lead-v2-button primary" onClick={openCreate}>+ {t('account.actions.create')}</button></div>
    </header>
    {sandbox && <p className="notice info">{t('account.localMode')}</p>}
    <AccountListPanel rows={rows} loading={query.isLoading && !sandbox} selectedId={selectedId} scope={scope} onScopeChange={changeScope} onSelect={openDetail} detail={detailPane} stateStorageKey={LIST_STATE_KEY} />
    <AbMobileFab label={t('account.actions.create')} onClick={openCreate} />
    {selected && <AccountActivityQuickAdd open={activityComposerOpen} accountId={selected.public_id} ownerName={selected.owner_name ?? '-'} onClose={() => setActivityComposerOpen(false)} onSaved={() => relationChanged('account.toast.activityAdded')} />}
    <AccountQuickCreatePanel open={drawerOpen} saving={saving} storageKey={QUICK_DRAFT_KEY} onClose={() => setDrawerOpen(false)} onSubmit={saveQuickCreate} onDraftSaved={() => setMessage(t('account.toast.quickDraftSaved'))} />
    {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
  </section>;
}
