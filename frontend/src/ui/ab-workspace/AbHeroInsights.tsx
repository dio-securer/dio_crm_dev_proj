import React from 'react';
import { UiIcon, type UiIconName } from '../UiIcon';

export type AbHeroInsight = {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
  meta?: React.ReactNode;
  icon?: UiIconName;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
};

type Props = {
  items: AbHeroInsight[];
};

export function AbHeroInsights({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="ab-hero-insights" role="list">
      {items.map(item => (
        <div key={item.id} className={`ab-hero-insight tone-${item.tone ?? 'default'}`} role="listitem">
          {item.icon && <span className="ab-hero-insight-icon" aria-hidden="true"><UiIcon name={item.icon} size="18" /></span>}
          <div className="ab-hero-insight-copy">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.meta && <small>{item.meta}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}
