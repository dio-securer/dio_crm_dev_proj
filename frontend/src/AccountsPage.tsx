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
  ACCOUNT_STATUSES, CRM_FORM_KEY, FORM_SECTIONS, MOBILE_ACCOUNT_MQ, emptyForm, erpMissingCodes, fieldsByCodes,
  formFromAccount, listVisibleAccounts, toWritePayload, type AccountFormInput, type AccountScope
} from './account-model';
import { listSandboxAccounts, requestSandboxErp, saveSandboxAccount } from './account-sandbox';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_ACCOUNT_MQ).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_ACCOUNT_MQ);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

function statusClass(status: string) {
  if (status === 'ACTIVE' || status === 'NEW') return 'success';
  if (status === 'CHURN_RISK' || status === 'NON_TRADING_OPP') return 'warning';
  if (status === 'CHURNED' || status === 'CLOSED') return 'danger';
  return 'neutral';
}

function ActionIcon({ name }: { name: 'plan' | 'order' | 'erp' | 'edit' }) {
  const paths = {
    plan: <path d="M13 3 4 14h7l-1 7 9-11h-7z" />,
    order: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></>,
    erp: <path d="M13 3 4 14h7l-1 7 9-11h-7z" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ListFilterIcon() {
  return (
    <svg className="mob-filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function AccountsPage() {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const { featureEnabled } = useGlobalization();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<AccountScope>('managed');
  const [message, setMessage] = useState('');
  const [localMode, setLocalMode] = useState(false);
  const [localTick, setLocalTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'detail' | 'form'>('list');
  const [form, setForm] = useState<AccountFormInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FORM_SECTIONS.map(section => [section.id, true]))
  );
  const erpEnabled = featureEnabled('ERP_ACCOUNT_APPROVAL');

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
  const creating = screen === 'form' && !selectedId;

  const setField = (key: keyof AccountFormInput, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setScreen('form');
  };
  const openDetail = (row: AccountSummary) => {
    setSelectedId(row.public_id);
    setForm(formFromAccount(row));
    setScreen(mobile ? 'detail' : 'form');
    setOpenSections(Object.fromEntries(FORM_SECTIONS.map(section => [section.id, true])));
  };
  const openEdit = (row?: AccountSummary) => {
    const target = row ?? selected;
    if (!target) return openCreate();
    setSelectedId(target.public_id);
    setForm(formFromAccount(target));
    setScreen('form');
  };
  const closeScreen = () => {
    setScreen('list');
    setSelectedId(null);
    setForm(emptyForm());
  };

  React.useEffect(() => {
    if (screen === 'list') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [screen]);

  React.useEffect(() => {
    if (!mobile && screen === 'detail') setScreen('form');
  }, [mobile, screen]);

  React.useEffect(() => {
    if (screen === 'list') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (mobile && screen === 'form' && selectedId) setScreen('detail');
      else closeScreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, mobile, selectedId]);

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
      setScreen(mobile ? 'detail' : 'list');
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

  const formWindow = (
    <form className={mobile ? 'mob-edit-form' : 'pc-window-form'} onSubmit={e => void save(e)}>
      {formSections(mobile)}
      <div className="account-form-actions">
        <button type="button" onClick={() => (mobile && selectedId ? setScreen('detail') : closeScreen())}>{t('common.cancel')}</button>
        <button type="submit" className="button-primary" disabled={saving}>{t('common.save')}</button>
      </div>
    </form>
  );

  if (mobile) {
    return (
      <section className="account-mobile">
        <header className="mob-list-header">
          <h2>{t('account.shortTitle')}</h2>
          <button type="button" className="text-link mob-new" onClick={openCreate}>{t('account.new')}</button>
        </header>
        <label className="mob-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input className="mob-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('account.search')} />
        </label>
        <div className="mob-filters">
          {([['managed', 'account.filters.managed', true], ['mine', 'account.filters.mine', true], ['all', 'account.filters.all', false]] as const).map(([id, key, showIcon]) => (
            <button type="button" key={id} className={scope === id ? 'active' : ''} onClick={() => setScope(id)}>
              {showIcon && <ListFilterIcon />}
              <span className={showIcon ? '' : 'mob-filter-plain'}>{t(key)}</span>
            </button>
          ))}
        </div>
        {sandbox && <p className="notice info mob-banner">{t('account.localMode')}</p>}
        {message && <p className="notice info mob-banner">{message}</p>}
        <div className="mob-recent-label">{t('account.recent')}</div>
        <div className="mob-account-list">
          {rows.map(row => (
            <button type="button" key={row.public_id} className="mob-account-row" onClick={() => openDetail(row)}>
              <strong>{row.account_name}</strong>
              <small>{t('account.hospitalAddressShort')} {row.hospital_address || row.address || '-'}</small>
            </button>
          ))}
          {!rows.length && <p className="notice info mob-banner">{t('common.noData')}</p>}
        </div>

        {screen !== 'list' && (
          <div className="mob-layer" role="dialog" aria-modal="true">
            <header className="mob-detail-top">
              <button type="button" className="text-link" onClick={() => (screen === 'form' && selectedId ? setScreen('detail') : closeScreen())}>{t('account.back')}</button>
              <strong>{creating ? t('account.new') : selected?.account_name}</strong>
              {screen === 'detail' && selected ? <button type="button" className="text-link" onClick={() => openEdit(selected)}>{t('account.edit')}</button> : <span />}
            </header>
            {screen === 'detail' && selected && (
              <>
                <div className="mob-actions">
                  <button type="button" disabled><ActionIcon name="plan" />{t('account.actions.plan')}</button>
                  <button type="button" disabled><ActionIcon name="order" />{t('account.actions.order')}</button>
                  {(erpEnabled || sandbox) && (
                    <button type="button" className="is-erp" onClick={() => void requestErp(selected.public_id)} disabled={selected.erp_approved_yn || selected.integration_status === 'REQUESTING'}>
                      <ActionIcon name="erp" />{t('account.actions.erp')}
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(selected)}><ActionIcon name="edit" />{t('account.edit')}</button>
                </div>
                <div className="mob-hero">
                  <div className="mob-hero-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
                  </div>
                  <div>
                    <small>{t('account.shortTitle')}</small>
                    <h3>{selected.account_name}</h3>
                  </div>
                </div>
                <dl className="mob-summary">
                  <div><dt>{t('account.fields.erpCode')}</dt><dd>{selected.erp_customer_code || '-'}</dd></div>
                  <div><dt>{t('account.crmStatus')}</dt><dd><i className={`dot ${statusClass(selected.account_status)}`} />{t(`account.statuses.${selected.account_status}`, { defaultValue: selected.account_status })}</dd></div>
                  <div><dt>{t('account.grade')}</dt><dd>{t(`account.grades.${selected.account_grade || 'GENERAL'}`, { defaultValue: selected.account_grade || '-' })}</dd></div>
                  <div><dt>{t('account.integration')}</dt><dd>{t(`account.integrationStatus.${selected.integration_status}`, { defaultValue: selected.integration_status })}</dd></div>
                  <div><dt>{t('account.owner')}</dt><dd><span className="mob-owner">{selected.owner_name || '-'}</span></dd></div>
                </dl>
                {FORM_SECTIONS.map(section => (
                  <div key={section.id}>
                    <button type="button" className="mob-accordion" onClick={() => setOpenSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>
                      <span>{openSections[section.id] ? 'v' : '>'}</span> {t(section.titleKey)}
                    </button>
                    {openSections[section.id] && (
                      <dl className="mob-summary">
                        {fieldsByCodes(section.codes).map(field => field && (
                          <div key={field.code}>
                            <dt>{field.nameKo}{field.requiredOut ? <em className="mob-req"> *</em> : ''}</dt>
                            <dd>{interfaceDisplay(selected, field)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
                {message && <p className="notice info mob-banner">{message}</p>}
              </>
            )}
            {screen === 'form' && formWindow}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="workspace-page account-desktop">
      <div className="page-header">
        <div>
          <span className="page-kicker">CRM · ACCOUNT</span>
          <h2>{t('account.title')}</h2>
          <small>{t('account.manageSubtitle')}</small>
        </div>
        <div className="page-actions">
          <input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('account.search')} />
          <button type="button" className="button-primary" onClick={openCreate}>{t('account.register')}</button>
        </div>
      </div>
      <div className="pc-filter-row">
        {([['managed', 'account.filters.managed'], ['mine', 'account.filters.mine'], ['all', 'account.filters.all']] as const).map(([id, key]) => (
          <button type="button" key={id} className={`pc-chip${scope === id ? ' active' : ''}`} onClick={() => setScope(id)}>{t(key)}</button>
        ))}
      </div>
      {sandbox && <p className="notice info">{t('account.localMode')}</p>}
      {message && screen === 'list' && <p className="notice info">{message}</p>}
      <div className="data-card pc-table-card">
        <div className="data-card-header"><div><strong>{t('account.title')}</strong><small>{rows.length} · {t('account.selectRow')}</small></div></div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {DESKTOP_TABLE_FIELDS.map(field => <th key={field}>{t(`account.table.${field}`)}</th>)}
                {(erpEnabled || sandbox) && <th>{t('account.erpRegistration')}</th>}
              </tr>
            </thead>
            <tbody>
              {query.isLoading && !sandbox && <tr><td colSpan={12}>{t('common.loading')}</td></tr>}
              {!query.isLoading && !rows.length && <tr><td colSpan={12}>{t('common.noData')}</td></tr>}
              {rows.map(row => (
                <tr key={row.public_id} className={selectedId === row.public_id ? 'is-selected' : ''} onClick={() => openDetail(row)}>
                  <td><strong>{row.account_name}</strong></td>
                  <td>{row.hospital_address || row.address || '-'}</td>
                  <td>{row.business_no || '-'}</td>
                  <td>{row.provider_no || '-'}</td>
                  <td>{accountTypeName(row.account_type) || '-'}</td>
                  <td><span className={`status-pill ${statusClass(row.account_status)}`}>{t(`account.statuses.${row.account_status}`, { defaultValue: row.account_status })}</span></td>
                  <td>{t(`account.grades.${row.account_grade || 'GENERAL'}`, { defaultValue: row.account_grade || '-' })}</td>
                  <td>{row.erp_customer_code || '-'}</td>
                  <td>{t(`account.integrationStatus.${row.integration_status}`, { defaultValue: row.integration_status })}</td>
                  <td>{row.owner_name || '-'}</td>
                  {(erpEnabled || sandbox) && (
                    <td>
                      <button type="button" disabled={row.erp_approved_yn || row.integration_status === 'REQUESTING'} onClick={e => { e.stopPropagation(); void requestErp(row.public_id); }}>
                        {t('account.request')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {screen === 'form' && (
        <div className="pc-window-backdrop" role="presentation" onClick={closeScreen}>
          <div className="pc-window" role="dialog" aria-modal="true" aria-labelledby="account-form-title" onClick={e => e.stopPropagation()}>
            <header className="pc-window-header">
              <div>
                <span className="page-kicker">{t('account.formWindow')}</span>
                <h3 id="account-form-title">{creating ? t('account.register') : selected?.account_name}</h3>
              </div>
              <div className="pc-window-actions">
                {selected && (erpEnabled || sandbox) && (
                  <button type="button" onClick={() => void requestErp(selected.public_id)}>{t('account.actions.erp')}</button>
                )}
                <button type="button" className="icon-button" onClick={closeScreen} aria-label={t('app.close')}>×</button>
              </div>
            </header>
            {message && <p className="notice info">{message}</p>}
            {formWindow}
          </div>
        </div>
      )}
    </section>
  );
}
