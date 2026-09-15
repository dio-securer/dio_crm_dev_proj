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
export function HqOpportunityPage() { return <OpportunitiesPage />; }
export function HqPipelinePage() { return <PipelinePage />; }
export function HqContractPage() { return <ContractsPage />; }
export function HqOrderPage() { return <OrdersPage />; }
export function HqFulfillmentPage() { return <FulfillmentPage />; }
export function HqLedgerPage() { return <LedgerStatementsPage />; }
export function HqAccount360Page() { return <Account360Page />; }
export function HqAnalyticsPage() { return <AnalyticsDashboardPage />; }
export function HqOpsPage() { return <OpsStatusPage />; }
