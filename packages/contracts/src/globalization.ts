export type MarketFeatureKey =
  | 'HIRA_IMPORT'
  | 'DIRECT_WORK'
  | 'GPS_CHECKIN'
  | 'ACTIVITY_APPROVAL'
  | 'ERP_ACCOUNT_APPROVAL'
  | 'MONTHLY_STATEMENT';

export type GlobalizationContext = {
  locale: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  marketProfileCode: string;
  workflowProfileCode?: string;
  mapProfileCode?: string;
  features: Record<MarketFeatureKey, boolean>;
};

export type MeContextResponse = {
  user: {
    userId: number;
    publicId: string;
    name: string;
    companyId: number;
  };
  globalization: GlobalizationContext;
};
