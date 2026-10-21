import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../UiIcon';
import '../../styles/ab-workspace-extras.css';

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  insights?: React.ReactNode;
  actions?: React.ReactNode;
  entityIcon?: UiIconName;
};

function normalizeEyebrow(value: React.ReactNode) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuid.test(text)) return `#${text.slice(0, 8).toUpperCase()}`;
  return value;
}

function replaceEmptyMetaValues(node: React.ReactNode, emptyLabel: string): React.ReactNode {
  if (node === '-') return <span className="ab-detail-empty-value"><UiIcon name="inbox" size="13" />{emptyLabel}</span>;
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return node;
  if (node.props.children === undefined) return node;
  return React.cloneElement(
    node,
    undefined,
    React.Children.map(node.props.children, child => replaceEmptyMetaValues(child, emptyLabel))
  );
}

export function AbDetailHeader({ eyebrow, title, subtitle, badges, meta, insights, actions, entityIcon = 'target' }: Props) {
  const { t } = useTranslation();
  const reference = normalizeEyebrow(eyebrow);
  const normalizedMeta = meta ? replaceEmptyMetaValues(meta, t('common.noData')) : null;

  return (
    <header className={`ab-detail-header entity-${entityIcon}`}>
      <div className="ab-detail-header-top">
        <div className="ab-detail-identity">
          <span className={`ab-detail-entity-icon entity-${entityIcon}`} aria-hidden="true"><UiIcon name={entityIcon} size="var(--icon-lg)" /></span>
          <div className="ab-detail-header-main">
            {reference && <div className="ab-detail-eyebrow">{reference}</div>}
            <div className="ab-detail-title-line"><h3>{title}</h3>{badges}</div>
            {subtitle && <div className="ab-detail-subtitle">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="ab-detail-actions">{actions}</div>}
      </div>
      {insights && <div className="ab-detail-header-insights">{insights}</div>}
      {normalizedMeta && <div className="ab-detail-header-meta">{normalizedMeta}</div>}
    </header>
  );
}
