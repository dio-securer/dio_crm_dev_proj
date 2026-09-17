import React from 'react';

export type KpiItem = { label: string; value: string | number; linkLabel?: string; onLink?: () => void };

export function AbKpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="ab-kpi-row">
      {items.map(item => (
        <article className="ab-kpi-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.linkLabel && (
            <button type="button" className="ab-kpi-link" onClick={item.onLink}>{item.linkLabel}</button>
          )}
        </article>
      ))}
    </div>
  );
}
