import type { MarketFeatureKey } from '@dio-crm/contracts';
import type { ShellNavItem } from '../ui/AppShell';
import type { ScreenSlot } from './screen-profile';

export type AppRouteConfig = ShellNavItem & {
  path: string;
  slot: ScreenSlot;
  feature?: MarketFeatureKey;
};

export const APP_ROUTES: AppRouteConfig[] = [
  { path: '/', to: '/', slot: 'lead', labelKey: 'nav.lead', icon: 'lead', end: true, mobilePrimary: true },
  { path: '/accounts', to: '/accounts', slot: 'account', labelKey: 'nav.account', icon: 'account', mobilePrimary: true },
  { path: '/contacts', to: '/contacts', slot: 'contact', labelKey: 'nav.contact', icon: 'account' },
  { path: '/activities', to: '/activities', slot: 'activity', labelKey: 'nav.activity', icon: 'activity', mobilePrimary: true },
  { path: '/activity-reports', to: '/activity-reports', slot: 'activityReport', labelKey: 'nav.activityReport', icon: 'report', feature: 'ACTIVITY_APPROVAL' },
  { path: '/direct-work', to: '/direct-work', slot: 'directWork', labelKey: 'nav.directWork', icon: 'direct', feature: 'DIRECT_WORK' },
  { path: '/opportunities', to: '/opportunities', slot: 'opportunity', labelKey: 'nav.opportunity', icon: 'opportunity' },
  { path: '/pipeline', to: '/pipeline', slot: 'pipeline', labelKey: 'nav.pipeline', icon: 'pipeline' },
  { path: '/contracts', to: '/contracts', slot: 'contract', labelKey: 'nav.contract', icon: 'contract' },
  { path: '/orders', to: '/orders', slot: 'order', labelKey: 'nav.order', icon: 'order' },
  { path: '/fulfillment', to: '/fulfillment', slot: 'fulfillment', labelKey: 'nav.fulfillment', icon: 'fulfillment' },
  { path: '/ledger-statements', to: '/ledger-statements', slot: 'ledger', labelKey: 'nav.ledger', icon: 'ledger' },
  { path: '/account360', to: '/account360', slot: 'account360', labelKey: 'nav.account360', icon: 'account360' },
  { path: '/analytics', to: '/analytics', slot: 'analytics', labelKey: 'nav.analytics', icon: 'analytics', mobilePrimary: true },
  { path: '/ops', to: '/ops', slot: 'ops', labelKey: 'nav.ops', icon: 'ops' }
];

export function filterAppRoutes(
  screenSlots: Partial<Record<ScreenSlot, unknown>>,
  featureEnabled: (key: MarketFeatureKey) => boolean
): AppRouteConfig[] {
  return APP_ROUTES.filter(route => {
    if (route.feature && !featureEnabled(route.feature)) return false;
    return Boolean(screenSlots[route.slot]);
  });
}
