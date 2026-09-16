import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AccountSummary } from '@dio-crm/contracts';
import {
  ACCOUNT_STAT_CODES, ACCOUNT_TYPE_CODES, DESKTOP_TABLE_FIELDS, ERP_APPROVAL_CODES,
  accountTypeName, tradeStatusName, type AccountInterfaceField
} from '@dio-crm/contracts';
import { apiGet, apiPatch, apiPost } from './api';
import { useGlobalization } from './market/globalization-context';
import {
  ACCOUNT_STATUSES, CRM_FORM_KEY, FORM_SECTIONS, emptyForm, erpMissingCodes, fieldsByCodes,
  formFromAccount, listVisibleAccounts, toWritePayload, type AccountFormInput, type AccountScope
} from './account-model';
import { listSandboxAccounts, requestSandboxErp, saveSandboxAccount } from './account-sandbox';
import {
  AbDetailFooter, AbEntityBadges, AbInfoGrid, AbKpiRow, AbMobileFab, AbSectionAccordion, countryFlag
} from './ui/ab-workspace';
import './styles/lead-workspace.css';

type AccountTab = 'summary' | 'contacts' | 'trade' | 'manage' | 'address' | 'erp' | 'related';
type LocalContact = { id: string; name: string; role: string; phone: string; email: string };

function statusClass(status: string) {
  if (status === 'ACTIVE' || status === 'NEW') return 'success';
  if (status === 'CHURN_RISK' || status === 'NON_TRADING_OPP') return 'warning';
  if (status === 'CHURNED' || status === 'CLOSED') return 'danger';
  return 'neutral';
}

export function AccountsPage() {
  const { t } = useTranslation();
  const { featureEnabled } = useGlobalization();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<AccountScope>('managed');
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [form, setForm] = useState<AccountFormInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FORM_SECTIONS.map(section => [section.id, true]))
  );
  const [accountTab, setAccountTab] = useState<AccountTab>('summary');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDesktop, setEditingDesktop] = useState(false);
  const [contacts, setContacts] = useState<LocalContact[]>([]);
  const [contactDraft, setContactDraft] = useState({ name: '', role: '', phone: '', email: '' });
  const erpEnabled = featureEnabled('ERP_ACCOUNT_APPROVAL');
  const accountTabs: AccountTab[] = ['summary', 'contacts', 'trade', 'manage', 'address', 'erp', 'related'];

  const query = useQuery({
    queryKey: ['accounts', search, scope],
    enabled: !localMode,
    queryFn: () => apiGet<AccountSummary[]>(`/api/accounts?scope=${scope}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
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
    const source = sandbox ? listSandboxAccounts(search, scope) : listVisibleAccounts(query.data ?? [], search, scope);
    return source;
  }, [sandbox, search, scope, query.data, localTick]);
  const selected = rows.find(x => x.public_id === selectedId) ?? null;

  const setField = (key: keyof AccountFormInput, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  };
  const openDetail = (row: AccountSummary) => {
    setSelectedId(row.public_id);
    setForm(formFromAccount(row));
    setAccountTab('summary');
    setEditingDesktop(false);
    setMobileDetailOpen(true);
    setOpenSections(Object.fromEntries(FORM_SECTIONS.map(section => [section.id, section.id === 'basic'])));
  };

  const addContact = () => {
    if (!contactDraft.name.trim()) return;
    setContacts(prev => [...prev, { id: `C${Date.now()}`, ...contactDraft }]);
    setContactDraft({ name: '', role: '', phone: '', email: '' });
    setMessage(t('contact.toast.added'));
  };

  const renderDesktopTab = () => {
    if (!selected) return null;
    if (accountTab === 'summary') {
      return (
        <>
          <AbInfoGrid columns={2} items={[
            { label: t('account.fields.accountName'), value: selected.account_name },
            { label: t('account.fields.accountCode'), value: selected.erp_customer_code || '-' },
            { label: t('account.fields.country'), value: <span className="ab-list-country"><i>{countryFlag('KR')}</i>KR</span> },
            { label: t('account.crmStatus'), value: t(`account.statuses.${selected.account_status}`, { defaultValue: selected.account_status }) },
            { label: t('account.grade'), value: t(`account.grades.${selected.account_grade || 'GENERAL'}`, { defaultValue: selected.account_grade || '-' }) },
            { label: t('account.owner'), value: selected.owner_name ?? '-' },
            { label: t('account.phone'), value: selected.phone ?? '-' },
            { label: t('account.integration'), value: t(`account.integrationStatus.${selected.integration_status}`, { defaultValue: selected.integration_status }) }
          ]} />
          <AbKpiRow items={[
            { label: t('account.related.contracts'), value: 3, linkLabel: t('account.actions.viewRelated') },
            { label: t('account.related.opportunities'), value: 5, linkLabel: t('account.actions.viewRelated') },
            { label: t('account.related.activities'), value: 7, linkLabel: t('account.actions.viewRelated') }
          ]} />
        </>
      );
    }
    if (accountTab === 'contacts') {
      return (
        <AbSectionAccordion id="contacts" title={t('account.tabs.contacts')} open onToggle={() => undefined}>
          <div className="lead-v2-form">
            <label><span>{t('contact.fields.name')}</span><input value={contactDraft.name} onChange={e => setContactDraft(p => ({ ...p, name: e.target.value }))} /></label>
            <label><span>{t('contact.fields.role')}</span><input value={contactDraft.role} onChange={e => setContactDraft(p => ({ ...p, role: e.target.value }))} /></label>
            <label><span>{t('contact.fields.phone')}</span><input value={contactDraft.phone} onChange={e => setContactDraft(p => ({ ...p, phone: e.target.value }))} /></label>
            <label><span>{t('contact.fields.email')}</span><input value={contactDraft.email} onChange={e => setContactDraft(p => ({ ...p, email: e.target.value }))} /></label>
            <button type="button" className="lead-v2-button secondary" onClick={addContact}>{t('contact.actions.add')}</button>
          </div>
          <div className="lead-v2-contact-list">
            {contacts.map(contact => (
              <div className="lead-v2-contact" key={contact.id}><span>{contact.name.slice(0, 1)}</span><div><strong>{contact.name}</strong><small>{contact.role}</small><em>{contact.phone || contact.email}</em></div></div>
            ))}
            {!contacts.length && <p className="lead-v2-empty-inline">{t('contact.empty')}</p>}
          </div>
        </AbSectionAccordion>
      );
    }
    const sectionMap: Partial<Record<AccountTab, string>> = { trade: 'erp', manage: 'manage', address: 'address', erp: 'erp' };
    if (accountTab === 'related') {
      return (
        <AbSectionAccordion id="related" title={t('account.tabs.related')} open onToggle={() => undefined}>
          <p className="lead-v2-empty-inline">{t('account.empty.related')}</p>
        </AbSectionAccordion>
      );
    }
    const sectionId = sectionMap[accountTab];
    if (!sectionId) return null;
    const section = FORM_SECTIONS.find(item => item.id === sectionId);
    if (!section) return null;
    return (
      <AbSectionAccordion
        id={sectionId}
        title={t(`account.tabs.${accountTab}`)}
        open
        onToggle={() => undefined}
      >
        {editingDesktop ? formSections(true) : (
          <dl className="mob-summary">
            {fieldsByCodes(section.codes).map(field => field && (
              <div key={field.code}><dt>{field.nameKo}</dt><dd>{interfaceDisplay(selected, field)}</dd></div>
            ))}
          </dl>
        )}
      </AbSectionAccordion>
    );
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
      } else {
        const created = await apiPost<AccountSummary>('/api/accounts', toWritePayload(form));
        await query.refetch();
        setSelectedId(created.public_id);
      }
      setMessage(selectedId ? t('account.updateDone') : t('account.createDone'));
      setDrawerOpen(false);
      setEditingDesktop(false);
      setMobileDetailOpen(true);
    } catch (e) {
      setMessage(String(e));
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
        requestSandboxErp(publicId);
        setLocalTick(n => n + 1);
        setMessage(t('account.queueCreated', { requestId: 'LOCAL-TEST' }));
        return;
      }
      const r = await apiPost<{ requestId: string }>(`/api/erp-accounts/${publicId}/request`);
      setMessage(t('account.queueCreated', { requestId: r.requestId }));
      await query.refetch();
    } catch (e) {
      setMessage(String(e));
    }
  };

  const fieldInput = (field: Pick<AccountInterfaceField, 'code' | 'crmField'>, disabled = false) => {
    if (field.code === 'trade_bc_nm') {
      return <div className="readonly-value">{tradeStatusName(selected?.erp_trade_code) || '-'}</div>;
    }
    if (field.code === 'co_cd') {
      return <div className="readonly-value">{selected?.company_code || 'DIO'}</div>;
    }
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
    if (key === 'accountType') {
      return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}>{Object.entries(ACCOUNT_TYPE_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>;
    }
    if (key === 'useYn') {
      return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}><option value="1">{t('account.yes')}</option><option value="0">{t('account.no')}</option></select>;
    }
    if (key === 'churnRiskYn') {
      return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}><option value="1">{t('account.churnYes')}</option><option value="0">{t('account.churnNo')}</option></select>;
    }
    if (key === 'accountStatCode') {
      return <select value={value} disabled={disabled} onChange={e => setField(key, e.target.value)}>{Object.entries(ACCOUNT_STAT_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>;
    }
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
      <label>{t('account.crmStatus')}
        <select value={form.accountStatus} onChange={e => setField('accountStatus', e.target.value)}>
          {ACCOUNT_STATUSES.map(status => <option key={status} value={status}>{t(`account.statuses.${status}`)}</option>)}
        </select>
      </label>
      <label>{t('account.grade')}
        <select value={form.accountGrade} onChange={e => setField('accountGrade', e.target.value)}>
          <option value="GENERAL">{t('account.grades.GENERAL')}</option>
          <option value="KEY">{t('account.grades.KEY')}</option>
        </select>
      </label>
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

  return (
    <section className={`lead-v2 ab-workspace account-desktop-ab${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
      <header className="lead-v2-page-header">
        <div>
          <div className="lead-v2-title-line"><span className="lead-v2-kicker">CRM · ACCOUNT</span></div>
          <h2>{t('account.title')}</h2>
          <p>{t('account.manageSubtitle')}</p>
        </div>
        <div className="lead-v2-header-actions">
          <button type="button" className="lead-v2-button primary" onClick={openCreate}>+ {t('account.actions.create')}</button>
        </div>
      </header>

      <div className="lead-v2-filter-tabs">
        {([['managed', 'account.filters.managed'], ['mine', 'account.filters.mine'], ['all', 'account.filters.all']] as const).map(([id, key]) => (
          <button type="button" key={id} className={scope === id ? 'active' : ''} onClick={() => setScope(id)}>{t(key)}</button>
        ))}
      </div>

      <div className="lead-v2-toolbar">
        <label className="lead-v2-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('account.searchPlaceholder')} /></label>
      </div>

      {sandbox && <p className="notice info">{t('account.localMode')}</p>}

      <div className="lead-v2-workspace">
        <aside className="lead-v2-list-pane">
          <div className="lead-v2-list-header"><div><strong>{t('account.listTitle')}</strong><span>{t('account.count', { count: rows.length })}</span></div></div>
          <div className="lead-v2-list-body">
            {query.isLoading && !sandbox && <p className="lead-v2-empty-inline">{t('common.loading')}</p>}
            {!query.isLoading && !rows.length && <p className="lead-v2-empty-inline">{t('account.empty.list')}</p>}
            {rows.map(row => (
              <button type="button" key={row.public_id} className={`lead-v2-row global-lead-row${selectedId === row.public_id ? ' selected' : ''}`} onClick={() => openDetail(row)}>
                <span className="lead-v2-lead-cell"><strong>{row.account_name}</strong><small>{row.business_no || row.erp_customer_code || '-'}</small><em className="ab-list-country"><i>{countryFlag('KR')}</i>KR</em></span>
                <span><i className={`lead-v2-pill stage-${statusClass(row.account_status)}`}>{t(`account.statuses.${row.account_status}`, { defaultValue: row.account_status })}</i></span>
                <span className="lead-v2-owner">{row.owner_name ?? '-'}</span>
                <span className="lead-v2-date">{row.phone ?? '-'}</span>
              </button>
            ))}
          </div>
        </aside>

        <article className="lead-v2-detail-pane">
          {!selected && <div className="lead-v2-empty-detail">{t('account.empty.detail')}</div>}
          {selected && <>
            <button type="button" className="lead-v2-mobile-back" onClick={() => setMobileDetailOpen(false)}>← {t('account.back')}</button>
            <div className="lead-v2-detail-header">
              <div className="lead-v2-detail-identity">
                <div className="lead-v2-name-line"><h3>{selected.account_name}</h3></div>
                <p>{selected.owner_name ?? '-'} · {selected.phone ?? '-'}</p>
                <AbEntityBadges badges={[
                  { label: t(`account.grades.${selected.account_grade || 'GENERAL'}`, { defaultValue: 'A' }), tone: 'info' },
                  { label: selected.erp_approved_yn ? t('account.badges.erpLinked') : t('account.badges.erpPending'), tone: selected.erp_approved_yn ? 'success' : 'warning' },
                  { label: t(`account.statuses.${selected.account_status}`, { defaultValue: selected.account_status }), tone: 'neutral' }
                ]} />
              </div>
              <div className="lead-v2-detail-actions">
                <button type="button" className="lead-v2-action-button" onClick={() => setEditingDesktop(v => !v)}>{t('account.edit')}</button>
                {editingDesktop && <button type="button" className="lead-v2-action-button convert" onClick={() => void save()}>{t('common.save')}</button>}
                {(erpEnabled || sandbox) && (
                  <button type="button" className="lead-v2-action-button" onClick={() => void requestErp(selected.public_id)} disabled={selected.erp_approved_yn || selected.integration_status === 'REQUESTING'}>{t('account.actions.erpRequest')}</button>
                )}
              </div>
            </div>
            <nav className="lead-v2-tabs">{accountTabs.map(item => <button type="button" key={item} className={accountTab === item ? 'active' : ''} onClick={() => setAccountTab(item)}>{t(`account.tabs.${item}`)}</button>)}</nav>
            <div className="lead-v2-detail-content">{renderDesktopTab()}</div>
            <AbDetailFooter
              draftLabel={t('account.actions.saveDraft')}
              saveLabel={t('common.save')}
              onDraft={() => setMessage(t('account.toast.draftSaved'))}
              onSave={() => void save()}
              saving={saving}
            />
          </>}
        </article>
      </div>

      <AbMobileFab label={t('account.actions.create')} onClick={openCreate} />

      {drawerOpen && (
        <div className="lead-v2-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <aside className="lead-v2-drawer" onMouseDown={e => e.stopPropagation()}>
            <div className="lead-v2-drawer-header"><div><strong>{t('account.quick.title')}</strong><p>{t('account.quick.help')}</p></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('app.close')}>×</button></div>
            <form className="lead-v2-form" onSubmit={e => void save(e)}>
              <label><span>{t('account.fields.accountName')} *</span><input value={form.accountName} onChange={e => setField('accountName', e.target.value)} required /></label>
              <label><span>{t('account.fields.accountType')} *</span>{fieldInput({ code: 'sal_kd', crmField: 'account_type' })}</label>
              <label><span>{t('account.phone')} *</span><input value={form.phone} onChange={e => setField('phone', e.target.value)} /></label>
              <label><span>{t('account.fields.address')}</span><input value={form.hospitalAddress} onChange={e => setField('hospitalAddress', e.target.value)} /></label>
              <div className="lead-v2-drawer-actions">
                <button type="submit" className="lead-v2-button primary">{t('account.quick.create')}</button>
                <button type="button" className="lead-v2-button ghost" onClick={() => setDrawerOpen(false)}>{t('common.cancel')}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {message && <div className="lead-v2-toast" role="status">✓ {message}</div>}
    </section>
  );
}
