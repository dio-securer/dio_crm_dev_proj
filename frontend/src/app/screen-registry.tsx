import React from 'react';
import type { ComponentType } from 'react';
import {
  HqLeadPage,
  HqAccountPage,
  HqActivityPage,
  HqActivityReportPage,
  HqDirectWorkPage,
  HqOpportunityPage,
  HqPipelinePage,
  HqContractPage,
  HqOrderPage,
  HqFulfillmentPage,
  HqLedgerPage,
  HqAccount360Page,
  HqAnalyticsPage,
  HqOpsPage
} from '../market/templates/hq/HqScreens';
import {
  GlobalLeadPage,
  GlobalAccountPage,
  GlobalActivityPage,
  GlobalActivityReportPage,
  GlobalOpportunityPage,
  GlobalContractPage,
  GlobalOrderPage
} from '../market/templates/global/GlobalScreens';
import {
  DemoGlobalLeadPage,
  DemoGlobalAccountPage,
  DemoGlobalActivityPage,
  DemoGlobalActivityReportPage,
  DemoGlobalOpportunityPage,
  DemoGlobalContractPage,
  DemoGlobalOrderPage
} from '../demo/GlobalExecutiveDemoScreens';
import { isGlobalExecutiveDemoMode } from '../demo/demo-mode';
import type { ScreenKey } from './screen-profile';

const screenRegistry = new Map<ScreenKey, ComponentType>([
  ['HQ_LEAD', HqLeadPage],
  ['HQ_ACCOUNT', HqAccountPage],
  ['HQ_ACTIVITY', HqActivityPage],
  ['HQ_ACTIVITY_REPORT', HqActivityReportPage],
  ['HQ_DIRECT_WORK', HqDirectWorkPage],
  ['HQ_OPPORTUNITY', HqOpportunityPage],
  ['HQ_PIPELINE', HqPipelinePage],
  ['HQ_CONTRACT', HqContractPage],
  ['HQ_ORDER', HqOrderPage],
  ['HQ_FULFILLMENT', HqFulfillmentPage],
  ['HQ_LEDGER', HqLedgerPage],
  ['HQ_ACCOUNT360', HqAccount360Page],
  ['HQ_ANALYTICS', HqAnalyticsPage],
  ['HQ_OPS', HqOpsPage],

  ['GLOBAL_LEAD', GlobalLeadPage],
  ['GLOBAL_ACCOUNT', GlobalAccountPage],
  ['GLOBAL_ACTIVITY_MAP', GlobalActivityPage],
  ['GLOBAL_ACTIVITY_REPORT', GlobalActivityReportPage],
  ['GLOBAL_OPPORTUNITY', GlobalOpportunityPage],
  ['GLOBAL_CONTRACT', GlobalContractPage],
  ['GLOBAL_ORDER', GlobalOrderPage]
]);

const demoScreenRegistry = new Map<ScreenKey, ComponentType>([
  ['GLOBAL_LEAD', DemoGlobalLeadPage],
  ['GLOBAL_ACCOUNT', DemoGlobalAccountPage],
  ['GLOBAL_ACTIVITY_MAP', DemoGlobalActivityPage],
  ['GLOBAL_ACTIVITY_REPORT', DemoGlobalActivityReportPage],
  ['GLOBAL_OPPORTUNITY', DemoGlobalOpportunityPage],
  ['GLOBAL_CONTRACT', DemoGlobalContractPage],
  ['GLOBAL_ORDER', DemoGlobalOrderPage]
]);

export function ScreenNotRegistered({ screenKey }: { screenKey: ScreenKey }) {
  return <div role="alert" data-screen-key={screenKey}>SCREEN_NOT_REGISTERED</div>;
}

export function getRegisteredScreen(screenKey: ScreenKey): ComponentType | undefined {
  return screenRegistry.get(screenKey);
}

export function renderScreen(screenKey: ScreenKey) {
  const demoScreen = isGlobalExecutiveDemoMode() ? demoScreenRegistry.get(screenKey) : undefined;
  const Screen = demoScreen ?? getRegisteredScreen(screenKey);
  return Screen ? <Screen /> : <ScreenNotRegistered screenKey={screenKey} />;
}
