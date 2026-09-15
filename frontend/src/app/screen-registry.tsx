import React from 'react';
import type { ComponentType } from 'react';
import { LeadsPage } from '../LeadsPage';
import { AccountsPage } from '../AccountsPage';
import { ActivitiesPage } from '../ActivitiesPage';
import { ActivityReportsPage } from '../ActivityReportsPage';
import { DirectWorkPage } from '../DirectWorkPage';
import { OpportunitiesPage } from '../OpportunitiesPage';
import { PipelinePage } from '../PipelinePage';
import { ContractsPage } from '../ContractsPage';
import { OrdersPage } from '../OrdersPage';
import { FulfillmentPage } from '../FulfillmentPage';
import { LedgerStatementsPage } from '../LedgerStatementsPage';
import { Account360Page } from '../Account360Page';
import { AnalyticsDashboardPage } from '../AnalyticsDashboardPage';
import { OpsStatusPage } from '../OpsStatusPage';
import type { ScreenKey } from './screen-profile';

const screenRegistry = new Map<ScreenKey, ComponentType>([
  ['HQ_LEAD', LeadsPage],
  ['HQ_ACCOUNT', AccountsPage],
  ['HQ_ACTIVITY', ActivitiesPage],
  ['HQ_ACTIVITY_REPORT', ActivityReportsPage],
  ['HQ_DIRECT_WORK', DirectWorkPage],
  ['HQ_OPPORTUNITY', OpportunitiesPage],
  ['HQ_PIPELINE', PipelinePage],
  ['HQ_CONTRACT', ContractsPage],
  ['HQ_ORDER', OrdersPage],
  ['HQ_FULFILLMENT', FulfillmentPage],
  ['HQ_LEDGER', LedgerStatementsPage],
  ['HQ_ACCOUNT360', Account360Page],
  ['HQ_ANALYTICS', AnalyticsDashboardPage],
  ['HQ_OPS', OpsStatusPage]
]);

export function ScreenNotRegistered({ screenKey }: { screenKey: ScreenKey }) {
  return <div role="alert" data-screen-key={screenKey}>SCREEN_NOT_REGISTERED</div>;
}

export function getRegisteredScreen(screenKey: ScreenKey): ComponentType | undefined {
  return screenRegistry.get(screenKey);
}

export function renderScreen(screenKey: ScreenKey) {
  const Screen = getRegisteredScreen(screenKey);
  return Screen ? <Screen /> : <ScreenNotRegistered screenKey={screenKey} />;
}
