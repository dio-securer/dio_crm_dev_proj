import React from 'react';
import { LeadsPage } from '../../../LeadsPage';
import { AccountsPage } from '../../../AccountsPage';
import { ContactsPage } from '../../../ContactsPage';
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
 * HQ wrappers keep the screen-profile boundary explicit while sharing the
 * confirmed A+B operational workspaces across markets where applicable.
 */
export function HqLeadPage() { return <LeadsPage />; }
export function HqAccountPage() { return <AccountsPage />; }
export function HqContactPage() { return <ContactsPage />; }
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
