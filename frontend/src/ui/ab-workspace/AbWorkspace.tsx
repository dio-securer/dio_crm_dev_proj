import React from 'react';
import '../../styles/ab-workspace-controls.css';

type Props = {
  list: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
};

export function AbWorkspace({ list, detail, className = '' }: Props) {
  return (
    <div className={`lead-v2-workspace ab-split-workspace${className ? ` ${className}` : ''}`}>
      <aside className="lead-v2-list-pane ab-split-list">{list}</aside>
      <article className="lead-v2-detail-pane ab-split-detail">{detail}</article>
    </div>
  );
}
