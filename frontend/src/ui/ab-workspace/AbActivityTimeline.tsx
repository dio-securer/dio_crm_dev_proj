import React from 'react';
import '../../styles/ab-workspace-extras.css';

export type AbActivityItem = {
  id: string;
  typeLabel: React.ReactNode;
  timeLabel: React.ReactNode;
  title: React.ReactNode;
  summary?: React.ReactNode;
  owner?: React.ReactNode;
  icon?: React.ReactNode;
};

type Props = {
  items: AbActivityItem[];
  empty?: React.ReactNode;
};

export function AbActivityTimeline({ items, empty }: Props) {
  if (!items.length) return <>{empty}</>;
  return (
    <div className="ab-activity-timeline">
      {items.map(item => (
        <div className="ab-activity-item" key={item.id}>
          <span className="ab-activity-node" aria-hidden="true">{item.icon ?? '•'}</span>
          <div className="ab-activity-content">
            <div className="ab-activity-meta"><span>{item.timeLabel}</span><em>{item.typeLabel}</em></div>
            <strong>{item.title}</strong>
            {item.summary && <small>{item.summary}</small>}
            {item.owner && <span className="ab-activity-owner">{item.owner}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
