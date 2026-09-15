import type { GlobalizationContext } from '@dio-crm/contracts';

const STORAGE_KEY = 'dio_crm_demo_mode';
const MODE = 'global-executive';

export function isGlobalExecutiveDemoMode(): boolean {
  if (typeof window === 'undefined') return false;

  const queryMode = new URLSearchParams(window.location.search).get('demo');
  if (queryMode === 'off') {
    window.localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  if (queryMode === 'global' || queryMode === MODE) {
    window.localStorage.setItem(STORAGE_KEY, MODE);
    return true;
  }
  return window.localStorage.getItem(STORAGE_KEY) === MODE;
}

export const GLOBAL_EXECUTIVE_DEMO_CONTEXT: GlobalizationContext = {
  locale: 'en-US',
  countryCode: 'US',
  currencyCode: 'USD',
  timezone: 'America/New_York',
  marketProfileCode: 'US_SALES',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  screenProfileCode: 'GLOBAL_SCREEN_PROFILE',
  fieldProfileCode: 'GLOBAL_FIELD_PROFILE',
  featureProfileCode: 'GLOBAL_FEATURE_PROFILE',
  workflowProfileCode: 'GLOBAL_SALES_APPROVAL_BASELINE',
  integrationProfileCode: 'GLOBAL_INTEGRATION_PROFILE',
  mapProfileCode: 'DEMO_MAP_PROFILE',
  features: {
    HIRA_IMPORT: false,
    DIRECT_WORK: false,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: false
  }
};

export const EXECUTIVE_DEMO_LABEL = 'DIO Global CRM Standard v1.0 · Executive Prototype';
