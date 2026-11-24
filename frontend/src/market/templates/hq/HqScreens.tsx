import React from 'react';
import { LeadsPage } from '../../../LeadsPage';
import { AccountsPage } from '../../../AccountsPage';
import { ActivitiesPage } from '../../../ActivitiesPage';
import { ActivityReportsPage } from '../../../ActivityReportsPage';
import { DirectWorkPage } from '../../../DirectWorkPage';
import { OpportunitiesPage } from '../../../OpportunitiesPage';
import { PipelinePage } from '../../../PipelinePage';
import { ContractsPage } from '../../../ContractsPage';
import { OrdersPage } from '../../../OrdersPage';
import { FulfillmentPage } from '../../../FulfillmentPage';
import { LedgerStatementsPage } from '../../../LedgerStatementsPage';
import { Account360Page } from '../../../Account360Page';
import { AnalyticsDashboardPage } from '../../../AnalyticsDashboardPage';
import { OpsStatusPage } from '../../../OpsStatusPage';
import { useHqMock } from '../../../hq-mock/HqMockProvider';
import { HqOpportunitiesPage, HqPipelineView, HqContractsPage } from '../../../hq-mock/HqSalesPages';
import { HqOrdersPage, HqFulfillmentView, HqLedgerView, HqAnalyticsView } from '../../../hq-mock/HqH06Pages';
import { HqMockOpsPage } from '../../../hq-mock/HqH07Pages';

/**
 * M6 protects the existing Korea/HQ UI behind explicit HQ template wrappers.
 * These wrappers intentionally add no behavior. The legacy pages remain the
 * regression baseline while M7 introduces separate GLOBAL implementations.
 */
export function HqLeadPage() { return <LeadsPage />; }
export function HqAccountPage() { return <AccountsPage />; }
export function HqActivityPage() { return <ActivitiesPage />; }
export function HqActivityReportPage() { return <ActivityReportsPage />; }
export function HqDirectWorkPage() { return <DirectWorkPage />; }
export function HqOpportunityPage() { const hq = useHqMock(); return hq.enabled ? <HqOpportunitiesPage /> : <OpportunitiesPage />; }
export function HqPipelinePage() { const hq = useHqMock(); return hq.enabled ? <HqPipelineView /> : <PipelinePage />; }
export function HqContractPage() { const hq = useHqMock(); return hq.enabled ? <HqContractsPage /> : <ContractsPage />; }
export function HqOrderPage() { const hq = useHqMock(); return hq.enabled ? <HqOrdersPage /> : <OrdersPage />; }
export function HqFulfillmentPage() { const hq = useHqMock(); return hq.enabled ? <HqFulfillmentView /> : <FulfillmentPage />; }
export function HqLedgerPage() { const hq = useHqMock(); return hq.enabled ? <HqLedgerView /> : <LedgerStatementsPage />; }
export function HqAccount360Page() { return <Account360Page />; }
export function HqAnalyticsPage() { const hq = useHqMock(); return hq.enabled ? <HqAnalyticsView /> : <AnalyticsDashboardPage />; }
export function HqOpsPage() { const hq = useHqMock(); return hq.enabled ? <HqMockOpsPage /> : <OpsStatusPage />; }
