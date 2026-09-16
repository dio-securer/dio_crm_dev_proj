import React from 'react';
import { useTranslation } from 'react-i18next';
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
  conversion: 'shuffle',
  more: 'more'
};

function renderIcon(action: AbQuickAction) {
  const mapped = actionIconMap[action.id];
  if (mapped) return <UiIcon name={mapped} size="var(--icon-md)" />;
  if (action.icon && typeof action.icon !== 'string') return action.icon;
  return action.icon ?? null;
}

function pickMobilePrimary(actions: AbQuickAction[]) {
  const preferredIds = ['call', 'activity'];
  const selected: AbQuickAction[] = [];
  for (const id of preferredIds) {
    const action = actions.find(item => item.id === id);
    if (action && !selected.some(item => item.id === action.id)) selected.push(action);
  }
  for (const action of actions) {
    if (selected.length >= 2) break;
    if (action.id === 'more' || selected.some(item => item.id === action.id)) continue;
    selected.push(action);
  }
  return selected.slice(0, 2);
}

export function AbQuickActions({ actions, ariaLabel }: Props) {
  const { t } = useTranslation();
  const [mobileMoreOpen, setMobileMoreOpen] = React.useState(false);
  const collapsible = actions.length > 3;
  const mobilePrimary = collapsible ? pickMobilePrimary(actions) : actions;
  const mobilePrimaryIds = new Set(mobilePrimary.map(action => action.id));
  const mobileOverflow = actions.filter(action => !mobilePrimaryIds.has(action.id));

  React.useEffect(() => {
    setMobileMoreOpen(false);
  }, [actions]);

  const actionContent = (action: AbQuickAction) => {
    const icon = renderIcon(action);
    return <>{icon && <span className="ab-quick-action-icon" aria-hidden="true">{icon}</span>}<strong>{action.label}</strong></>;
  };

  const renderStandardAction = (action: AbQuickAction) => {
    const className = `ab-quick-action tone-${action.tone ?? 'default'}${action.disabled ? ' disabled' : ''}`;
    const content = actionContent(action);
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
  };

  const renderOverflowAction = (action: AbQuickAction) => {
    const className = `ab-quick-action-menu-item tone-${action.tone ?? 'default'}${action.disabled ? ' disabled' : ''}`;
    const content = actionContent(action);
    if (action.href && !action.disabled) {
      return <a key={action.id} className={className} href={action.href} title={action.title} onClick={() => setMobileMoreOpen(false)}>{content}</a>;
    }
    return (
      <button
        key={action.id}
        type="button"
        className={className}
        disabled={action.disabled}
        title={action.title}
        onClick={() => {
          setMobileMoreOpen(false);
          action.onClick?.();
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div className={`ab-quick-actions${collapsible ? ' has-mobile-overflow' : ''}`} aria-label={ariaLabel}>
      <div className="ab-quick-actions-desktop-set">
        {actions.map(renderStandardAction)}
      </div>
      {collapsible && (
        <div className="ab-quick-actions-mobile-set">
          {mobilePrimary.map(renderStandardAction)}
          <button
            type="button"
            className={`ab-quick-action ab-quick-action-more${mobileMoreOpen ? ' active' : ''}`}
            aria-expanded={mobileMoreOpen}
            onClick={() => setMobileMoreOpen(open => !open)}
          >
            <span className="ab-quick-action-icon" aria-hidden="true"><UiIcon name="more" size="var(--icon-md)" /></span>
            <strong>{t('nav.more')}</strong>
          </button>
          {mobileMoreOpen && (
            <div className="ab-quick-action-menu" role="menu">
              {mobileOverflow.map(renderOverflowAction)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
