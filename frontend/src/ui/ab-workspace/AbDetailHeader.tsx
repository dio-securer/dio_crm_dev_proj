import React from 'react';
import { UiIcon } from '../UiIcon';
import '../../styles/ab-workspace-extras.css';

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

function normalizeEyebrow(value: React.ReactNode) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuid.test(text)) return `#${text.slice(0, 8).toUpperCase()}`;
  return value;
}

export function AbDetailHeader({ eyebrow, title, subtitle, badges, meta, actions }: Props) {
  const reference = normalizeEyebrow(eyebrow);
  return (
    <header className="ab-detail-header">
      <div className="ab-detail-header-top">
        <div className="ab-detail-identity">
          <span className="ab-detail-entity-icon" aria-hidden="true"><UiIcon name="building" size="var(--icon-lg)" /></span>
          <div className="ab-detail-header-main">
            {reference && <div className="ab-detail-eyebrow">{reference}</div>}
            <div className="ab-detail-title-line"><h3>{title}</h3>{badges}</div>
            {subtitle && <div className="ab-detail-subtitle">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="ab-detail-actions">{actions}</div>}
      </div>
      {meta && <div className="ab-detail-header-meta">{meta}</div>}
    </header>
  );
}
