import React from 'react';

type Props = {
  title: string;
  description?: string;
  tone?: 'empty' | 'loading' | 'error';
  action?: React.ReactNode;
};

export function AbEmptyState({ title, description, tone = 'empty', action }: Props) {
  return (
    <div className={`ab-empty-state tone-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="ab-empty-icon" aria-hidden="true">{tone === 'loading' ? '…' : tone === 'error' ? '!' : '○'}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="ab-empty-action">{action}</div>}
    </div>
  );
}
