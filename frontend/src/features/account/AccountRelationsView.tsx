import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AbActivityTimeline, AbKpiRow, AbRelatedList, AbSectionAccordion } from '../../ui/ab-workspace';
import {
  addAccountContact,
  getAccountRelationSummary,
  type AccountMockActivity,
  type AccountMockContact,
  type AccountMockOpportunity
} from './account-relations-mock';
import '../../styles/account-relations.css';

type NavigateTarget = 'contacts' | 'opportunities' | 'activity' | 'related';

type BaseProps = {
  accountId: string;
  tick?: number;
};

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function activityIcon(type: AccountMockActivity['type']) {
  if (type === 'CALL') return '☎';
  if (type === 'EMAIL') return '✉';
  if (type === 'MEETING') return '◷';
  if (type === 'VISIT') return '⌂';
  return '•';
}

export function AccountRelationKpis({ accountId, tick = 0, onNavigate }: BaseProps & { onNavigate: (target: NavigateTarget) => void }) {
  const { t } = useTranslation();
  const summary = useMemo(() => getAccountRelationSummary(accountId), [accountId, tick]);
  return <AbKpiRow items={[
    { label: t('account.related.contacts'), value: summary.contactCount, linkLabel: t('account.actions.viewRelated'), onLink: () => onNavigate('contacts') },
    { label: t('account.related.opportunities'), value: summary.opportunityCount, linkLabel: t('account.actions.viewRelated'), onLink: () => onNavigate('opportunities') },
    { label: t('account.related.activities'), value: summary.activityCount, linkLabel: t('account.actions.viewRelated'), onLink: () => onNavigate('activity') }
  ]} />;
}

export function AccountContactsPanel({ accountId, tick = 0, onChanged }: BaseProps & { onChanged: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ name: '', role: '', phone: '', email: '' });
  const contacts = useMemo(() => getAccountRelationSummary(accountId).contacts, [accountId, tick]);

  const add = () => {
    if (!draft.name.trim()) return;
    addAccountContact(accountId, draft);
    setDraft({ name: '', role: '', phone: '', email: '' });
    onChanged();
  };

  return <AbSectionAccordion id="contacts" title={t('account.tabs.contacts')} hint={`${contacts.length}`} open onToggle={() => undefined}>
    <div className="lead-v2-form">
      <label><span>{t('contact.fields.name')} *</span><input value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
      <label><span>{t('contact.fields.role')}</span><input value={draft.role} onChange={event => setDraft(previous => ({ ...previous, role: event.target.value }))} /></label>
      <label><span>{t('contact.fields.phone')}</span><input value={draft.phone} onChange={event => setDraft(previous => ({ ...previous, phone: event.target.value }))} /></label>
      <label><span>{t('contact.fields.email')}</span><input value={draft.email} onChange={event => setDraft(previous => ({ ...previous, email: event.target.value }))} /></label>
      <button type="button" className="lead-v2-button secondary" onClick={add} disabled={!draft.name.trim()}>{t('contact.actions.add')}</button>
    </div>
    <div className="account-relation-contact-list">
      {contacts.map((contact: AccountMockContact) => <div className="account-relation-contact" key={contact.id}>
        <span className="account-relation-avatar">{contact.name.slice(0, 1)}</span>
        <div><strong>{contact.name}</strong><small>{contact.role || '-'}</small><em>{contact.phone || contact.email || '-'}</em></div>
        <i>{t(`account.relationSource.${contact.source}`)}</i>
      </div>)}
      {!contacts.length && <p className="lead-v2-empty-inline">{t('contact.empty')}</p>}
    </div>
  </AbSectionAccordion>;
}

export function AccountOpportunitiesPanel({ accountId, tick = 0 }: BaseProps) {
  const { t, i18n } = useTranslation();
  const opportunities = useMemo(() => getAccountRelationSummary(accountId).opportunities, [accountId, tick]);
  return <AbSectionAccordion id="opportunities" title={t('account.tabs.opportunities')} hint={`${opportunities.length}`} open onToggle={() => undefined}>
    <AbRelatedList
      items={opportunities.map((item: AccountMockOpportunity) => ({
        id: item.id,
        title: item.name,
        subtitle: item.ownerName,
        status: t(`account.opportunityStage.${item.stage}`, { defaultValue: item.stage }),
        meta: item.expectedAmount != null ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(item.expectedAmount) : formatDateTime(item.createdAt, i18n.language)
      }))}
      empty={<p className="lead-v2-empty-inline">{t('account.empty.opportunities')}</p>}
    />
  </AbSectionAccordion>;
}

export function AccountActivitiesPanel({ accountId, tick = 0, onAddActivity }: BaseProps & { onAddActivity: () => void }) {
  const { t, i18n } = useTranslation();
  const activities = useMemo(() => getAccountRelationSummary(accountId).activities, [accountId, tick]);
  return <AbSectionAccordion id="activities" title={t('account.tabs.activity')} hint={`${activities.length}`} open onToggle={() => undefined}>
    <div className="account-relation-section-actions"><button type="button" className="lead-v2-button secondary" onClick={onAddActivity}>+ {t('account.actions.addActivity')}</button></div>
    <AbActivityTimeline
      items={activities.map((item: AccountMockActivity) => ({
        id: item.id,
        typeLabel: t(`account.activityTypes.${item.type}`),
        timeLabel: formatDateTime(item.occurredAt, i18n.language),
        title: item.subject,
        summary: item.note || undefined,
        owner: item.ownerName,
        icon: activityIcon(item.type)
      }))}
      empty={<p className="lead-v2-empty-inline">{t('account.empty.activities')}</p>}
    />
  </AbSectionAccordion>;
}

export function AccountRelatedPanel({ accountId, tick = 0, onAddActivity }: BaseProps & { onAddActivity: () => void }) {
  return <div className="ab-overview-grid">
    <AccountOpportunitiesPanel accountId={accountId} tick={tick} />
    <AccountActivitiesPanel accountId={accountId} tick={tick} onAddActivity={onAddActivity} />
  </div>;
}
