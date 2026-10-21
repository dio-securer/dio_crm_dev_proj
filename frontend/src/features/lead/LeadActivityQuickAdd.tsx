import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeadActivityInput, LeadActivityType } from './lead-model';
import '../../styles/lead-detail-enhancements.css';

type QuickType = Extract<LeadActivityType, 'CALL' | 'VISIT' | 'MEETING' | 'NOTE'>;

type Props = {
  preferredType?: QuickType | null;
  onSubmit: (input: LeadActivityInput) => void;
};

const QUICK_TYPES: Array<{ type: QuickType; icon: string }> = [
  { type: 'CALL', icon: '☎' },
  { type: 'VISIT', icon: '⌂' },
  { type: 'MEETING', icon: '◷' },
  { type: 'NOTE', icon: '✎' }
];

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function LeadActivityQuickAdd({ preferredType, onSubmit }: Props) {
  const { t } = useTranslation();
  const [type, setType] = useState<QuickType | null>(preferredType ?? null);
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue());
  const [title, setTitle] = useState(preferredType ? t(`lead.activityType.${preferredType}`) : '');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!preferredType) return;
    setType(preferredType);
    setTitle(t(`lead.activityType.${preferredType}`));
    setOccurredAt(localDateTimeValue());
  }, [preferredType, t]);

  const chooseType = (nextType: QuickType) => {
    setType(nextType);
    setTitle(t(`lead.activityType.${nextType}`));
    setOccurredAt(localDateTimeValue());
  };

  const submit = () => {
    if (!type || !title.trim()) return;
    const parsed = new Date(occurredAt);
    onSubmit({
      type,
      occurredAt: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
      title: title.trim(),
      summary: summary.trim()
    });
    setSummary('');
    setTitle('');
    setType(null);
    setOccurredAt(localDateTimeValue());
  };

  return (
    <div className="lead-activity-quick-add">
      <div className="lead-activity-quick-types" aria-label={t('lead.activity.quickAdd')}>
        {QUICK_TYPES.map(item => (
          <button key={item.type} type="button" className={type === item.type ? 'active' : ''} onClick={() => chooseType(item.type)}>
            <span aria-hidden="true">{item.icon}</span>
            <strong>{t(`lead.activityType.${item.type}`)}</strong>
          </button>
        ))}
      </div>
      {type && <div className="lead-activity-compose">
        <label>
          <span>{t('lead.activity.occurredAt')}</span>
          <input type="datetime-local" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} />
        </label>
        <label>
          <span>{t('lead.activity.title')}</span>
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder={t('lead.activity.titlePlaceholder')} />
        </label>
        <label className="wide">
          <span>{t('lead.activity.summary')}</span>
          <textarea rows={3} value={summary} onChange={event => setSummary(event.target.value)} placeholder={t('lead.activity.summaryPlaceholder')} />
        </label>
        <div className="lead-enhance-actions wide">
          <button type="button" className="lead-v2-button ghost" onClick={() => setType(null)}>{t('lead.actions.cancel')}</button>
          <button type="button" className="lead-v2-button primary" onClick={submit} disabled={!title.trim()}>{t('lead.activity.add')}</button>
        </div>
      </div>}
    </div>
  );
}
