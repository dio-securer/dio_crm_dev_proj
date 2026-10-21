import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEAD_SOURCES, type LeadSource } from './lead-model';
import { AbQuickCreate } from '../../ui/ab-workspace';
import '../../styles/lead-detail-enhancements.css';

export type LeadQuickCreateValue = {
  hospitalName: string;
  country: string;
  phone: string;
  contactName: string;
  ownerValue: string;
  address: string;
  source: LeadSource;
};

type OwnerOption = { value: string; label: string };

type Props = {
  open: boolean;
  defaultCountry: string;
  ownerOptions: OwnerOption[];
  closeLabel: string;
  onClose: () => void;
  onSubmit: (value: LeadQuickCreateValue, draft: boolean) => boolean | Promise<boolean>;
};

function initialValue(defaultCountry: string): LeadQuickCreateValue {
  return {
    hospitalName: '',
    country: defaultCountry,
    phone: '',
    contactName: '',
    ownerValue: '',
    address: '',
    source: 'WEB'
  };
}

export function LeadQuickCreatePanel({ open, defaultCountry, ownerOptions, closeLabel, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState<LeadQuickCreateValue>(() => initialValue(defaultCountry));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue(initialValue(defaultCountry));
      setError('');
      setSaving(false);
      return;
    }
    setValue(prev => ({
      ...prev,
      country: prev.country || defaultCountry,
      ownerValue: prev.ownerValue || ownerOptions[0]?.value || ''
    }));
  }, [open, defaultCountry, ownerOptions]);

  const setField = <K extends keyof LeadQuickCreateValue>(key: K, fieldValue: LeadQuickCreateValue[K]) => {
    setValue(prev => ({ ...prev, [key]: fieldValue }));
  };

  const submit = async (draft: boolean) => {
    if (!value.hospitalName.trim() || !value.country.trim() || !value.phone.trim() || !value.contactName.trim() || !value.ownerValue.trim()) {
      setError(t('lead.quick.required'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const ok = await onSubmit({
        ...value,
        hospitalName: value.hospitalName.trim(),
        country: value.country.trim(),
        phone: value.phone.trim(),
        contactName: value.contactName.trim(),
        ownerValue: value.ownerValue.trim(),
        address: value.address.trim()
      }, draft);
      if (ok) {
        setValue(initialValue(defaultCountry));
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AbQuickCreate
      open={open}
      title={t('lead.quick.title')}
      help={t('lead.quick.help')}
      closeLabel={closeLabel}
      onClose={onClose}
      className="lead-quick-create"
      footer={<div className="lead-quick-create-footer-actions">
        <button type="button" className="lead-v2-button ghost" onClick={onClose} disabled={saving}>{t('lead.actions.cancel')}</button>
        <button type="button" className="lead-v2-button secondary" onClick={() => void submit(true)} disabled={saving}>{t('lead.actions.saveDraft')}</button>
        <button type="button" className="lead-v2-button primary" onClick={() => void submit(false)} disabled={saving}>{saving ? t('common.loading') : t('lead.actions.save')}</button>
      </div>}
    >
      <div className="lead-v2-form lead-quick-create-form">
        <label><span>{t('lead.fields.hospitalName')} *</span><input autoFocus value={value.hospitalName} onChange={event => setField('hospitalName', event.target.value)} /></label>
        <label><span>{t('lead.fields.country')} *</span><input value={value.country} onChange={event => setField('country', event.target.value)} /></label>
        <label><span>{t('lead.fields.phone')} *</span><input value={value.phone} inputMode="tel" onChange={event => setField('phone', event.target.value)} /></label>
        <label><span>{t('lead.fields.contactName')} *</span><input value={value.contactName} onChange={event => setField('contactName', event.target.value)} /></label>
        <label>
          <span>{t('lead.fields.owner')} *</span>
          {ownerOptions.length ? <select value={value.ownerValue} onChange={event => setField('ownerValue', event.target.value)}>
            {ownerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input value={value.ownerValue} onChange={event => setField('ownerValue', event.target.value)} />}
        </label>
        <label><span>{t('lead.fields.address')}</span><input value={value.address} onChange={event => setField('address', event.target.value)} /></label>
        <label><span>{t('lead.fields.source')}</span><select value={value.source} onChange={event => setField('source', event.target.value as LeadSource)}>{LEAD_SOURCES.map(source => <option key={source} value={source}>{t(`lead.source.${source}`)}</option>)}</select></label>
      </div>
      {error && <div className="lead-quick-create-error" role="alert">{error}</div>}
      <div className="lead-quick-create-hint">{t('lead.quick.afterSave')}</div>
    </AbQuickCreate>
  );
}
