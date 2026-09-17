import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountSummary } from '@dio-crm/contracts';
import { accountTypeName } from '@dio-crm/contracts';
import { AbDetailHeader, AbEntityBadges, AbHeroInsights, AbQuickActions, countryFlag } from '../../ui/ab-workspace';
import { accountCountry, accountLastActivity } from './account-list-model';
import { getAccountRelationSummary } from './account-relations-mock';

export const ACCOUNT_EDIT_REQUEST_EVENT = 'dio-crm:account-edit-request';

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

type Props = {
  account: AccountSummary;
  onEdit: () => void;
  onAddActivity: () => void;
  onErpRequest?: () => void;
  erpRequestDisabled?: boolean;
};

export function AccountDetailHeader({ account, onEdit, onAddActivity, onErpRequest, erpRequestDisabled = false }: Props) {
  const { t, i18n } = useTranslation();
  const country = accountCountry(account);
  const typeName = accountTypeName(account.account_type) || account.account_type || '-';
  const lastActivity = accountLastActivity(account);
  const email = account.tax_email || '';
  const relations = getAccountRelationSummary(account.public_id);

  const beginEdit = () => {
    onEdit();
    window.dispatchEvent(new CustomEvent(ACCOUNT_EDIT_REQUEST_EVENT));
  };

  return (
    <AbDetailHeader
      entityIcon="building"
      eyebrow={account.erp_customer_code || account.public_id}
      title={account.account_name}
      subtitle={<><strong>{typeName}</strong> · <span className="ab-list-country"><i>{countryFlag(country)}</i>{country}</span></>}
      badges={<AbEntityBadges badges={[
        { label: t(`account.grades.${account.account_grade || 'GENERAL'}`, { defaultValue: account.account_grade || '-' }), tone: 'info' },
        { label: t(`account.statuses.${account.account_status}`, { defaultValue: account.account_status }), tone: account.account_status === 'ACTIVE' ? 'success' : 'neutral' },
        { label: account.erp_approved_yn ? t('account.badges.erpLinked') : t('account.badges.erpPending'), tone: account.erp_approved_yn ? 'success' : 'warning' }
      ]} />}
      insights={<AbHeroInsights items={[
        { id: 'contacts', label: t('account.related.contacts'), value: relations.contactCount, icon: 'users' },
        { id: 'opportunities', label: t('account.related.opportunities'), value: relations.opportunityCount, icon: 'briefcase', tone: relations.opportunityCount > 0 ? 'primary' : 'default' },
        { id: 'activities', label: t('account.related.activities'), value: relations.activityCount, icon: 'activity', meta: formatDateTime(relations.latestActivityAt, i18n.language), tone: relations.activityCount > 0 ? 'success' : 'default' }
      ]} />}
      meta={<div className="ab-detail-meta-list">
        <div className="ab-detail-meta-item"><span>{t('account.owner')}</span><strong>{account.owner_name ?? '-'}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('account.fields.lastActivity')}</span><strong>{formatDateTime(lastActivity, i18n.language)}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('account.phone')}</span><strong>{account.phone ?? '-'}</strong></div>
        <div className="ab-detail-meta-item"><span>{t('account.integration')}</span><strong>{t(`account.integrationStatus.${account.integration_status}`, { defaultValue: account.integration_status })}</strong></div>
      </div>}
      actions={<AbQuickActions
        ariaLabel={t('account.quickActionsLabel')}
        actions={[
          { id: 'call', label: t('account.actions.call'), icon: '☎', href: account.phone ? `tel:${account.phone}` : undefined, disabled: !account.phone },
          { id: 'email', label: t('account.actions.email'), icon: '✉', href: email ? `mailto:${email}` : undefined, disabled: !email },
          { id: 'activity', label: t('account.actions.addActivity'), icon: '＋', onClick: onAddActivity, tone: 'primary' },
          { id: 'edit', label: t('account.actions.edit'), icon: '✎', onClick: beginEdit },
          ...(onErpRequest ? [{ id: 'erp', label: t('account.actions.erpRequest'), icon: '⇄', onClick: onErpRequest, disabled: erpRequestDisabled }] : [])
        ]}
      />}
    />
  );
}
