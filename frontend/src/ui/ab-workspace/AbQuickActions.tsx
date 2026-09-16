import React from 'react';
import { UiIcon, type UiIconName } from '../UiIcon';
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

const actionIconMap: Record<string, UiIconName> = {
  call: 'phone',
  phone: 'phone',
  email: 'mail',
  mail: 'mail',
  meeting: 'calendar',
  activity: 'activity',
  addActivity: 'plus',
  edit: 'pencil',
  erp: 'link',
  stage: 'target',
  opportunity: 'briefcase',
  more: 'more'
};

function renderIcon(action: AbQuickAction) {
  const mapped = actionIconMap[action.id];
  if (mapped) return <UiIcon name={mapped} size="var(--icon-md)" />;
  if (action.icon && typeof action.icon !== 'string') return action.icon;
  return action.icon ?? null;
}

export function AbQuickActions({ actions, ariaLabel }: Props) {
  return (
    <div className="ab-quick-actions" aria-label={ariaLabel}>
      {actions.map(action => {
        const className = `ab-quick-action tone-${action.tone ?? 'default'}${action.disabled ? ' disabled' : ''}`;
        const icon = renderIcon(action);
        const content = <>{icon && <span className="ab-quick-action-icon" aria-hidden="true">{icon}</span>}<strong>{action.label}</strong></>;
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
