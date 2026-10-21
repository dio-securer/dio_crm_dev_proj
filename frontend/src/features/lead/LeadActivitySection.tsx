import React from 'react';
import { useTranslation } from 'react-i18next';
import { AbActivityTimeline } from '../../ui/ab-workspace';
import { LeadActivityQuickAdd } from './LeadActivityQuickAdd';
import type { LeadActivity, LeadActivityInput, LeadActivityType } from './lead-model';

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function activityIcon(type: LeadActivityType) {
  if (type === 'CALL') return '☎';
  if (type === 'EMAIL') return '✉';
  if (type === 'MEETING') return '●';
  if (type === 'VISIT') return '⌂';
  return '◆';
}

type Props = {
  activities: LeadActivity[];
  onSubmit: (input: LeadActivityInput) => void;
  preferredType?: Extract<LeadActivityType, 'CALL' | 'VISIT' | 'MEETING' | 'NOTE'> | null;
  limit?: number;
  quickAdd?: boolean;
};

export function LeadActivitySection({ activities, onSubmit, preferredType, limit, quickAdd = true }: Props) {
  const { t, i18n } = useTranslation();
  const visible = limit ? activities.slice(0, limit) : activities;
  const items = visible.map(activity => ({
    id: activity.id,
    typeLabel: t(`lead.activityType.${activity.type}`),
    timeLabel: formatDate(activity.occurredAt, i18n.language),
    title: activity.title,
    summary: activity.summary,
    owner: activity.ownerName,
    icon: activityIcon(activity.type)
  }));

  return (
    <>
      {quickAdd && <LeadActivityQuickAdd preferredType={preferredType} onSubmit={onSubmit} />}
      {quickAdd && <div className="lead-activity-separator" />}
      <AbActivityTimeline items={items} empty={<p className="lead-v2-empty-inline">{t('lead.empty.activity')}</p>} />
    </>
  );
}
