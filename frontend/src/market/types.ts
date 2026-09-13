export type MarketFeatureKey =
  | 'HIRA_IMPORT'
  | 'DIRECT_WORK'
  | 'GPS_CHECKIN'
  | 'ACTIVITY_APPROVAL'
  | 'ERP_ACCOUNT_APPROVAL'
  | 'MONTHLY_STATEMENT';

export type MarketProfile = {
  code: string;
  countryCode: string;
  defaultLocale: string;
  currencyCode: string;
  timezone: string;
  workflowProfileCode: string;
  mapProfileCode: string;
  features: Record<MarketFeatureKey, boolean>;
};
