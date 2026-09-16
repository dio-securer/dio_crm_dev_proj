import React from 'react';
import '../../styles/ab-workspace-extras.css';

export type AbDetailTab = {
  id: string;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
};

type Props = {
  tabs: AbDetailTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
};

export function AbDetailTabs({ tabs, activeId, onChange, ariaLabel }: Props) {
  return (
    <div className="ab-detail-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => (
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
          <span>{tab.label}</span>
          {typeof tab.count === 'number' && <em>{tab.count}</em>}
        </button>
      ))}
    </div>
  );
}
