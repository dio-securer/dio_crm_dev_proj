import React from 'react';
import '../../styles/ab-workspace-extras.css';

export type AbQuickAction = {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
  title?: string;
};

type Props = {
  actions: AbQuickAction[];
  ariaLabel?: string;
};

export function AbQuickActions({ actions, ariaLabel }: Props) {
  return (
    <div className="ab-quick-actions" aria-label={ariaLabel}>
      {actions.map(action => {
        const className = `ab-quick-action tone-${action.tone ?? 'default'}${action.disabled ? ' disabled' : ''}`;
        const content = <>{action.icon && <span aria-hidden="true">{action.icon}</span>}<strong>{action.label}</strong></>;
        if (action.href && !action.disabled) {
          return <a key={action.id} className={className} href={action.href} title={action.title}>{content}</a>;
        }
        return (
          <button
            key={action.id}
            type="button"
            className={className}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
