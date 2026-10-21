import React from 'react';
import '../../styles/ab-workspace-extras.css';

export type AbRelatedItem = {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  meta?: React.ReactNode;
};

type Props = {
  items: AbRelatedItem[];
  onSelect?: (item: AbRelatedItem) => void;
  empty?: React.ReactNode;
};

export function AbRelatedList({ items, onSelect, empty }: Props) {
  if (!items.length) return <>{empty}</>;
  return (
    <div className="ab-related-list">
      {items.map(item => (
        <button type="button" key={item.id} className="ab-related-row" onClick={() => onSelect?.(item)}>
          <span className="ab-related-main"><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span>
          {item.status && <span className="ab-related-status">{item.status}</span>}
          {item.meta && <span className="ab-related-meta">{item.meta}</span>}
        </button>
      ))}
    </div>
  );
}
