import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MarketFeatureKey } from '@dio-crm/contracts';
import { LeadsPage } from './LeadsPage';
import { AccountsPage } from './AccountsPage';
import { ActivitiesPage } from './ActivitiesPage';
import { ActivityReportsPage } from './ActivityReportsPage';
import { DirectWorkPage } from './DirectWorkPage';
import { OpportunitiesPage } from './OpportunitiesPage';
import { PipelinePage } from './PipelinePage';
import { ContractsPage } from './ContractsPage';
import { OrdersPage } from './OrdersPage';
import { FulfillmentPage } from './FulfillmentPage';
import { LedgerStatementsPage } from './LedgerStatementsPage';
import { Account360Page } from './Account360Page';
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';
import { OpsStatusPage } from './OpsStatusPage';
import { changeLocale } from './i18n';
import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n/locale-resolver';
import { useGlobalization } from './market/globalization-context';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '10px 14px', textDecoration: 'none', borderRadius: 8,
  background: isActive ? '#14365d' : '#eef2f6', color: isActive ? '#fff' : '#172033'
});

type NavItem = readonly [to:string, key:string, end:boolean, feature?:MarketFeatureKey];

export default function App() {
  const { t, i18n } = useTranslation();
  const { globalization, featureEnabled } = useGlobalization();
  const links: NavItem[] = [
    ['/', 'nav.lead', true], ['/accounts', 'nav.account', false], ['/activities', 'nav.activity', false],
    ['/activity-reports', 'nav.activityReport', false, 'ACTIVITY_APPROVAL'], ['/direct-work', 'nav.directWork', false, 'DIRECT_WORK'],
    ['/opportunities', 'nav.opportunity', false], ['/pipeline', 'nav.pipeline', false], ['/contracts', 'nav.contract', false],
    ['/orders', 'nav.order', false], ['/fulfillment', 'nav.fulfillment', false], ['/ledger-statements', 'nav.ledger', false],
    ['/account360', 'nav.account360', false], ['/analytics', 'nav.analytics', false], ['/ops', 'nav.ops', false]
  ];

  return (
    <main style={{ fontFamily: 'Malgun Gothic, Segoe UI, sans-serif', maxWidth: 1240, margin: '28px auto', padding: 20 }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16, alignItems:'start', flexWrap:'wrap' }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>{t('app.name')}</h1>
            <p style={{ marginTop: 0, color: '#667085' }}>{t('app.phase')} · {globalization.countryCode} · {globalization.currencyCode} · {globalization.timezone}</p>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>{t('app.language')}
            <select value={i18n.language} onChange={e => void changeLocale(e.target.value as SupportedLocale)}>
              {SUPPORTED_LOCALES.map(locale => <option key={locale} value={locale}>{t(`locale.${locale}`)}</option>)}
            </select>
          </label>
        </div>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {links.filter(([, , , feature]) => !feature || featureEnabled(feature)).map(([to, key, end]) =>
            <NavLink key={to} to={to} end={end} style={linkStyle}>{t(key)}</NavLink>)}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LeadsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        {featureEnabled('ACTIVITY_APPROVAL') && <Route path="/activity-reports" element={<ActivityReportsPage />} />}
        {featureEnabled('DIRECT_WORK') && <Route path="/direct-work" element={<DirectWorkPage />} />}
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/fulfillment" element={<FulfillmentPage />} />
        <Route path="/ledger-statements" element={<LedgerStatementsPage />} />
        <Route path="/account360" element={<Account360Page />} />
        <Route path="/analytics" element={<AnalyticsDashboardPage />} />
        <Route path="/ops" element={<OpsStatusPage />} />
      </Routes>
      <footer style={{ marginTop: 28, color: '#667085', fontSize: 12 }}>{t('footer.globalization')}</footer>
    </main>
  );
}
