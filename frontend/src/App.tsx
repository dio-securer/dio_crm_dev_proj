import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
import { useGlobalization } from './market/globalization-context';
import { AppShell, type ShellNavItem } from './ui/AppShell';

const navigation: Array<ShellNavItem & { feature?: MarketFeatureKey }> = [
  { to: '/', labelKey: 'nav.lead', icon: 'lead', end: true, mobilePrimary: true },
  { to: '/accounts', labelKey: 'nav.account', icon: 'account' },
  { to: '/activities', labelKey: 'nav.activity', icon: 'activity', mobilePrimary: true },
  { to: '/activity-reports', labelKey: 'nav.activityReport', icon: 'report', feature: 'ACTIVITY_APPROVAL' },
  { to: '/direct-work', labelKey: 'nav.directWork', icon: 'direct', feature: 'DIRECT_WORK' },
  { to: '/opportunities', labelKey: 'nav.opportunity', icon: 'opportunity', mobilePrimary: true },
  { to: '/pipeline', labelKey: 'nav.pipeline', icon: 'pipeline' },
  { to: '/contracts', labelKey: 'nav.contract', icon: 'contract' },
  { to: '/orders', labelKey: 'nav.order', icon: 'order', mobilePrimary: true },
  { to: '/fulfillment', labelKey: 'nav.fulfillment', icon: 'fulfillment' },
  { to: '/ledger-statements', labelKey: 'nav.ledger', icon: 'ledger' },
  { to: '/account360', labelKey: 'nav.account360', icon: 'account360' },
  { to: '/analytics', labelKey: 'nav.analytics', icon: 'analytics', mobilePrimary: true },
  { to: '/ops', labelKey: 'nav.ops', icon: 'ops' }
];

export default function App() {
  const { featureEnabled } = useGlobalization();
  const links = navigation.filter(item => !item.feature || featureEnabled(item.feature));

  return (
    <AppShell links={links}>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
