import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeadConversionOptions } from './lead-conversion-mock';
import type { LeadConversionResult } from './lead-model';
import '../../styles/lead-detail-enhancements.css';

export type LeadConversionAccountOption = { id: string; name: string };

type Props = {
  entityKey: string;
  canConvert: boolean;
  converted: boolean;
  result?: LeadConversionResult | null;
  accounts: LeadConversionAccountOption[];
  defaultOpportunityName: string;
  blockedMessage?: React.ReactNode;
  onConvert: (options: LeadConversionOptions) => void | Promise<void>;
  onExclude?: () => void | Promise<void>;
  excludeDisabled?: boolean;
};

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

export function LeadConversionPanel({
  entityKey,
  canConvert,
  converted,
  result,
  accounts,
  defaultOpportunityName,
  blockedMessage,
  onConvert,
  onExclude,
  excludeDisabled
}: Props) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'NEW' | 'EXISTING'>('NEW');
  const [existingAccountId, setExistingAccountId] = useState('');
  const [createContact, setCreateContact] = useState(true);
  const [createOpportunity, setCreateOpportunity] = useState(true);
  const [opportunityName, setOpportunityName] = useState(defaultOpportunityName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMode('NEW');
    setExistingAccountId('');
    setCreateContact(true);
    setCreateOpportunity(true);
    setOpportunityName(defaultOpportunityName);
    setError('');
    setSaving(false);
  }, [entityKey, defaultOpportunityName]);

  const submit = async () => {
    if (mode === 'EXISTING' && !existingAccountId) {
      setError(t('lead.conversion.selectAccountRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConvert({
        accountMode: mode,
        existingAccountId: mode === 'EXISTING' ? existingAccountId : undefined,
        createContact,
        createOpportunity,
        opportunityName: createOpportunity ? opportunityName.trim() : undefined
      });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : String(cause);
      const key = code === 'LEAD_ALREADY_CONVERTED'
        ? 'lead.conversion.alreadyConverted'
        : code === 'ACCOUNT_REQUIRED'
          ? 'lead.conversion.selectAccountRequired'
          : code === 'ACCOUNT_NOT_FOUND'
            ? 'lead.conversion.accountNotFound'
            : '';
      setError(key ? t(key) : code);
    } finally {
      setSaving(false);
    }
  };

  if (converted) {
    return (
      <div className="lead-conversion-result">
        <div className="lead-conversion-result-head"><span>✓</span><div><strong>{t('lead.conversion.completed')}</strong><small>{result ? formatDate(result.convertedAt, i18n.language) : t('lead.conversion.completedNoDetail')}</small></div></div>
        {result && <div className="lead-conversion-result-grid">
          <div><span>{t('lead.conversion.linkedAccount')}</span><strong>{result.accountName}</strong><small>{result.accountId}</small></div>
          <div><span>{t('lead.conversion.createdContact')}</span><strong>{result.contactId ? t('lead.conversion.yes') : t('lead.conversion.no')}</strong><small>{result.contactId ?? '-'}</small></div>
          <div><span>{t('lead.conversion.createdOpportunity')}</span><strong>{result.opportunityId ? t('lead.conversion.yes') : t('lead.conversion.no')}</strong><small>{result.opportunityId ?? '-'}</small></div>
        </div>}
      </div>
    );
  }

  return (
    <div className="lead-conversion-panel">
      {!canConvert && <div className="lead-conversion-blocked">{blockedMessage ?? t('lead.conversion.notReady')}</div>}
      {canConvert && <>
        <div className="lead-conversion-mode" role="group" aria-label={t('lead.conversion.accountMode')}>
          <button type="button" className={mode === 'NEW' ? 'active' : ''} onClick={() => setMode('NEW')}>{t('lead.conversion.createNewAccount')}</button>
          <button type="button" className={mode === 'EXISTING' ? 'active' : ''} onClick={() => setMode('EXISTING')}>{t('lead.conversion.linkExistingAccount')}</button>
        </div>

        {mode === 'EXISTING' && <label className="lead-conversion-field"><span>{t('lead.conversion.existingAccount')} *</span><select value={existingAccountId} onChange={event => setExistingAccountId(event.target.value)}><option value="">{t('common.selectNone')}</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}

        <div className="lead-conversion-options">
          <label><input type="checkbox" checked={createContact} onChange={event => setCreateContact(event.target.checked)} /><span>{t('lead.conversion.createContact')}</span></label>
          <label><input type="checkbox" checked={createOpportunity} onChange={event => setCreateOpportunity(event.target.checked)} /><span>{t('lead.conversion.createOpportunity')}</span></label>
        </div>

        {createOpportunity && <label className="lead-conversion-field"><span>{t('lead.conversion.opportunityName')}</span><input value={opportunityName} onChange={event => setOpportunityName(event.target.value)} /></label>}

        {error && <div className="lead-conversion-error" role="alert">{error}</div>}
        <div className="lead-conversion-actions">
          {onExclude && <button type="button" className="lead-v2-button ghost" disabled={excludeDisabled || saving} onClick={() => void onExclude()}>{t('lead.actions.exclude')}</button>}
          <button type="button" className="lead-v2-button primary" disabled={saving} onClick={() => void submit()}>{saving ? t('common.loading') : t('lead.conversion.execute')}</button>
        </div>
      </>}
    </div>
  );
}
