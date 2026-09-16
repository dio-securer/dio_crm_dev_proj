import React from 'react';
import { UiIcon, type UiIconName } from '../UiIcon';
import '../../styles/ab-workspace-extras.css';

export type AbDetailTab = {
  id: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
  icon?: UiIconName;
};

type Props = {
  tabs: AbDetailTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
};

const tabIconMap: Record<string, UiIconName> = {
  overview: 'layout',
  summary: 'layout',
  activity: 'activity',
  keyman: 'users',
  contacts: 'users',
  opportunities: 'briefcase',
  system: 'database',
  conversion: 'shuffle',
  erp: 'link',
  related: 'link',
  trade: 'briefcase',
  manage: 'target',
  address: 'map-pin'
};

export function AbDetailTabs({ tabs, activeId, onChange, ariaLabel }: Props) {
  return (
    <div className="ab-detail-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => {
        const icon = tab.icon ?? tabIconMap[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`ab-tab-panel-${tab.id}`}
            className={activeId === tab.id ? 'active' : ''}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
          >
            {icon && <UiIcon name={icon} size="var(--icon-sm)" className="ab-detail-tab-icon" />}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && <em>{tab.count}</em>}
          </button>
        );
      })}
    </div>
  );
}
