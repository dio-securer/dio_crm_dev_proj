import React from 'react';
import { OpportunitiesPage } from '../../../OpportunitiesPage';
import { ContractsPage } from '../../../ContractsPage';
import { OrdersPage } from '../../../OrdersPage';
import { GlobalLeadPage } from './GlobalLeadPage';
import { GlobalAccountPage } from './GlobalAccountPage';
import { GlobalActivityPage } from './GlobalActivityPage';
import { GlobalActivityReportPage } from './GlobalActivityReportPage';

export function GlobalOpportunityPage() {
  return <OpportunitiesPage />;
}

export function GlobalContractPage() {
  return <ContractsPage />;
}

export function GlobalOrderPage() {
  return <OrdersPage />;
}

export {
  GlobalLeadPage,
  GlobalAccountPage,
  GlobalActivityPage,
  GlobalActivityReportPage
};
