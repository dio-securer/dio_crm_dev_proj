import React from 'react';
import '../../styles/ab-workspace-extras.css';

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

export function AbDetailHeader({ eyebrow, title, subtitle, badges, meta, actions }: Props) {
  return (
    <header className="ab-detail-header">
      <div className="ab-detail-header-main">
        {eyebrow && <div className="ab-detail-eyebrow">{eyebrow}</div>}
        <div className="ab-detail-title-line"><h3>{title}</h3>{badges}</div>
        {subtitle && <div className="ab-detail-subtitle">{subtitle}</div>}
        {meta && <div className="ab-detail-meta">{meta}</div>}
      </div>
      {actions && <div className="ab-detail-actions">{actions}</div>}
    </header>
  );
}
