import React from 'react';

export type InfoItem = { label: string; value: React.ReactNode };

export function AbInfoGrid({ items, columns = 2 }: { items: InfoItem[]; columns?: 2 | 3 }) {
  return (
    <dl className={`ab-info-grid cols-${columns}`}>
      {items.map(item => (
        <div key={item.label} className="ab-info-item">
          <dt>{item.label}</dt>
          <dd>{item.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}
