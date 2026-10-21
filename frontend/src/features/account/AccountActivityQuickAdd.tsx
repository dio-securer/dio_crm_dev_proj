import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AbQuickCreate } from '../../ui/ab-workspace';
import { addAccountActivity, type AccountActivityType } from './account-relations-mock';

const ACTIVITY_TYPES: AccountActivityType[] = ['CALL', 'EMAIL', 'MEETING', 'VISIT', 'NOTE'];

function localDateTimeValue() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

type Props = {
  open: boolean;
  accountId: string;
  ownerName: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AccountActivityQuickAdd({ open, accountId, ownerName, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [type, setType] = useState<AccountActivityType>('CALL');
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue());
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setType('CALL');
    setOccurredAt(localDateTimeValue());
    setSubject('');
    setNote('');
  }, [open, accountId]);

  const save = () => {
    if (!subject.trim()) return;
    addAccountActivity(accountId, ownerName || '-', {
      type,
      subject,
      note,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined
    });
    onSaved();
    onClose();
  };

  return (
    <AbQuickCreate
      open={open}
      title={t('account.activityQuick.title')}
      help={t('account.activityQuick.help')}
      closeLabel={t('app.close')}
      onClose={onClose}
      footer={<div className="lead-v2-drawer-actions">
        <button type="button" className="lead-v2-button primary" onClick={save} disabled={!subject.trim()}>{t('account.activityQuick.save')}</button>
        <button type="button" className="lead-v2-button ghost" onClick={onClose}>{t('common.cancel')}</button>
      </div>}
    >
      <div className="lead-v2-form">
        <label><span>{t('account.activityQuick.type')}</span><select value={type} onChange={event => setType(event.target.value as AccountActivityType)}>{ACTIVITY_TYPES.map(value => <option key={value} value={value}>{t(`account.activityTypes.${value}`)}</option>)}</select></label>
        <label><span>{t('account.activityQuick.occurredAt')}</span><input type="datetime-local" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} /></label>
        <label><span>{t('account.activityQuick.subject')} *</span><input value={subject} onChange={event => setSubject(event.target.value)} /></label>
        <label><span>{t('account.activityQuick.note')}</span><textarea rows={4} value={note} onChange={event => setNote(event.target.value)} /></label>
      </div>
    </AbQuickCreate>
  );
}
