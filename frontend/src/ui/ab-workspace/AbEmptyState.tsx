import React from 'react';
import { UiIcon } from '../UiIcon';

type Props = {
  title: string;
  description?: string;
  tone?: 'empty' | 'loading' | 'error';
  action?: React.ReactNode;
};

export function AbEmptyState({ title, description, tone = 'empty', action }: Props) {
  const iconName = tone === 'loading' ? 'loader' : tone === 'error' ? 'alert-circle' : 'inbox';
  return (
    <div className={`ab-empty-state tone-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="ab-empty-icon" aria-hidden="true"><UiIcon name={iconName} size="var(--icon-lg)" /></span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="ab-empty-action">{action}</div>}
    </div>
  );
}
