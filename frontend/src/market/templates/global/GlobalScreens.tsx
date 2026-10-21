import React from 'react';
import { ContactsPage } from '../../../ContactsPage';
import { OpportunitiesPage } from '../../../OpportunitiesPage';
import { ContractsPage } from '../../../ContractsPage';
import { OrdersPage } from '../../../OrdersPage';
import { GlobalLeadPage } from './GlobalLeadPage';
import { GlobalAccountPage } from './GlobalAccountPage';
import { GlobalActivityPage } from './GlobalActivityPage';
import { GlobalActivityReportPage } from './GlobalActivityReportPage';

export function GlobalContactPage() {
  return <ContactsPage />;
}

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
