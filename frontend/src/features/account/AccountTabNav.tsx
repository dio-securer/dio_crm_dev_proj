import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../ui/UiIcon';
import { ACCOUNT_EDIT_REQUEST_EVENT } from './AccountDetailHeader';

export type AccountTabId = 'summary' | 'contacts' | 'opportunities' | 'activity' | 'trade' | 'manage' | 'address' | 'erp' | 'related';
type MobileAccountGroup = 'summary' | 'sales' | 'activity' | 'erp' | 'more';

type Props = {
  activeTab: AccountTabId;
  onChange: (tab: AccountTabId) => void;
};

const DESKTOP_TABS: AccountTabId[] = ['summary', 'contacts', 'opportunities', 'activity', 'trade', 'manage', 'address', 'erp', 'related'];
const SALES_TABS: AccountTabId[] = ['contacts', 'opportunities', 'trade'];
const MORE_TABS: AccountTabId[] = ['manage', 'address', 'related'];

const GROUP_ICONS: Record<MobileAccountGroup, UiIconName> = {
  summary: 'layout',
  sales: 'briefcase',
  activity: 'activity',
  erp: 'link',
  more: 'more'
};

function activeGroup(tab: AccountTabId): MobileAccountGroup {
  if (SALES_TABS.includes(tab)) return 'sales';
  if (MORE_TABS.includes(tab)) return 'more';
  if (tab === 'activity') return 'activity';
  if (tab === 'erp') return 'erp';
  return 'summary';
}

export function AccountTabNav({ activeTab, onChange }: Props) {
  const { t } = useTranslation();
  const group = activeGroup(activeTab);

  React.useEffect(() => {
    const openEdit = () => onChange('manage');
    window.addEventListener(ACCOUNT_EDIT_REQUEST_EVENT, openEdit);
    return () => window.removeEventListener(ACCOUNT_EDIT_REQUEST_EVENT, openEdit);
  }, [onChange]);

  const groups: Array<{ id: MobileAccountGroup; label: string; defaultTab: AccountTabId }> = [
    { id: 'summary', label: t('account.tabs.summary'), defaultTab: 'summary' },
    { id: 'sales', label: t('account.mobileTabs.sales'), defaultTab: SALES_TABS.includes(activeTab) ? activeTab : 'contacts' },
    { id: 'activity', label: t('account.tabs.activity'), defaultTab: 'activity' },
    { id: 'erp', label: t('account.tabs.erp'), defaultTab: 'erp' },
    { id: 'more', label: t('nav.more'), defaultTab: MORE_TABS.includes(activeTab) ? activeTab : 'manage' }
  ];
  const childTabs = group === 'sales' ? SALES_TABS : group === 'more' ? MORE_TABS : [];

  return <>
    <nav className="lead-v2-tabs account-tabs-desktop" aria-label={t('account.detailTitle')}>
      {DESKTOP_TABS.map(item => <button type="button" key={item} className={activeTab === item ? 'active' : ''} onClick={() => onChange(item)}>{t(`account.tabs.${item}`)}</button>)}
    </nav>
    <div className="account-mobile-tab-shell">
      <nav className="account-mobile-primary-tabs" aria-label={t('account.detailTitle')}>
        {groups.map(item => <button type="button" key={item.id} className={group === item.id ? 'active' : ''} onClick={() => onChange(item.defaultTab)}>
          <UiIcon name={GROUP_ICONS[item.id]} size="18" />
          <span>{item.label}</span>
        </button>)}
      </nav>
      {childTabs.length > 0 && <nav className="account-mobile-secondary-tabs" aria-label={group === 'sales' ? t('account.mobileTabs.sales') : t('nav.more')}>
        {childTabs.map(item => <button type="button" key={item} className={activeTab === item ? 'active' : ''} onClick={() => onChange(item)}>{t(`account.tabs.${item}`)}</button>)}
      </nav>}
    </div>
  </>;
}
