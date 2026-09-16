import React from 'react';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPE_CODES, accountTypeName } from '@dio-crm/contracts';
import { AbQuickCreate } from '../../ui/ab-workspace';
import {
  ACCOUNT_COUNTRIES,
  ACCOUNT_OWNER_CODES,
  EMPTY_ACCOUNT_QUICK_CREATE,
  type AccountQuickCreateDraft
} from './account-quick-create';

function readDraft(storageKey: string): AccountQuickCreateDraft {
  try {
    const raw = globalThis.sessionStorage?.getItem(storageKey);
    if (raw) return { ...EMPTY_ACCOUNT_QUICK_CREATE, ...(JSON.parse(raw) as Partial<AccountQuickCreateDraft>) };
  } catch {
    // ignore invalid session draft
  }
  return EMPTY_ACCOUNT_QUICK_CREATE;
}

function writeDraft(storageKey: string, draft: AccountQuickCreateDraft) {
  try {
    globalThis.sessionStorage?.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function clearDraft(storageKey: string) {
  try {
    globalThis.sessionStorage?.removeItem(storageKey);
  } catch {
    // ignore
  }
}

type Props = {
  open: boolean;
  saving: boolean;
  storageKey: string;
  onClose: () => void;
  onSubmit: (draft: AccountQuickCreateDraft) => Promise<void>;
  onDraftSaved?: () => void;
};

export function AccountQuickCreatePanel({ open, saving, storageKey, onClose, onSubmit, onDraftSaved }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState<AccountQuickCreateDraft>(() => readDraft(storageKey));
  const [validation, setValidation] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setDraft(readDraft(storageKey));
    setValidation('');
  }, [open, storageKey]);

  React.useEffect(() => {
    if (open) writeDraft(storageKey, draft);
  }, [draft, open, storageKey]);

  const setField = <K extends keyof AccountQuickCreateDraft>(key: K, value: AccountQuickCreateDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.accountName.trim() || !draft.country || !draft.accountType || !draft.phone.trim() || !draft.ownerCode) {
      setValidation(t('account.quick.required'));
      return;
    }
    setValidation('');
    try {
      await onSubmit(draft);
      clearDraft(storageKey);
      setDraft(EMPTY_ACCOUNT_QUICK_CREATE);
    } catch {
      // parent owns the user-facing error message; keep the draft for retry
    }
  };

  return (
    <AbQuickCreate
      open={open}
      title={t('account.quick.title')}
      help={t('account.quick.help')}
      closeLabel={t('app.close')}
      onClose={onClose}
      className="account-quick-create"
      footer={<div className="account-quick-create-actions">
        <button type="button" className="lead-v2-button ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button type="button" className="lead-v2-button secondary" onClick={() => { writeDraft(storageKey, draft); onDraftSaved?.(); }}>{t('account.actions.saveDraft')}</button>
        <button type="submit" form="account-quick-create-form" className="lead-v2-button primary" disabled={saving}>{saving ? t('common.loading') : t('account.quick.create')}</button>
      </div>}
    >
      <form id="account-quick-create-form" className="lead-v2-form account-quick-create-form" onSubmit={submit}>
        <label><span>{t('account.fields.accountName')} *</span><input value={draft.accountName} onChange={event => setField('accountName', event.target.value)} autoFocus /></label>
        <label><span>{t('account.fields.country')} *</span><select value={draft.country} onChange={event => setField('country', event.target.value as AccountQuickCreateDraft['country'])}><option value="">{t('common.selectNone')}</option>{ACCOUNT_COUNTRIES.map(code => <option key={code} value={code}>{t(`account.countries.${code}`, { defaultValue: code })}</option>)}</select></label>
        <label><span>{t('account.fields.accountType')} *</span><select value={draft.accountType} onChange={event => setField('accountType', event.target.value)}>{Object.keys(ACCOUNT_TYPE_CODES).map(code => <option key={code} value={code}>{accountTypeName(code) || code}</option>)}</select></label>
        <label><span>{t('account.phone')} *</span><input value={draft.phone} onChange={event => setField('phone', event.target.value)} inputMode="tel" /></label>
        <label><span>{t('account.owner')} *</span><select value={draft.ownerCode} onChange={event => setField('ownerCode', event.target.value as AccountQuickCreateDraft['ownerCode'])}><option value="">{t('common.selectNone')}</option>{ACCOUNT_OWNER_CODES.map(code => <option key={code} value={code}>{t(`account.owners.${code}`)}</option>)}</select></label>
        <label className="full"><span>{t('account.fields.address')}</span><input value={draft.address} onChange={event => setField('address', event.target.value)} /></label>
        {validation && <p className="account-quick-create-validation" role="alert">{validation}</p>}
      </form>
    </AbQuickCreate>
  );
}
