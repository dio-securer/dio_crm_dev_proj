import type { CountryProfile, MarketProfile } from '../types';

export const US_COUNTRY_PROFILE: CountryProfile = {
  countryCode: 'US',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  status: 'ACTIVE_WITH_GAPS',
  marketProfileCode: 'US_SALES',
  gaps: [
    'LOCALE_CURRENCY_TIMEZONE_REQUIRE_COMPANY_CONFIG',
    'MAP_PROFILE_REQUIRE_COMPANY_CONFIG',
    'ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED',
    'ERP_PROVIDER_ENDPOINT_UNCONFIRMED',
    'HIRA_IMPORT_UNCONFIRMED',
    'MONTHLY_STATEMENT_UNCONFIRMED'
  ]
};

/** Unauthenticated demo context for GLOBAL_TEMPLATE / US_SALES. */
export const US_MARKET_PROFILE: MarketProfile = {
  code: 'US_SALES',
  countryCode: 'US',
  defaultLocale: 'en-US',
  currencyCode: 'USD',
  timezone: 'America/New_York',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  screenProfileCode: 'GLOBAL_SCREEN_PROFILE',
  fieldProfileCode: 'GLOBAL_FIELD_PROFILE',
  featureProfileCode: 'GLOBAL_FEATURE_PROFILE',
  workflowProfileCode: 'GLOBAL_SALES_APPROVAL_BASELINE',
  integrationProfileCode: 'GLOBAL_INTEGRATION_PROFILE',
  mapProfileCode: 'GLOBAL_DEFAULT',
  features: {
    HIRA_IMPORT: false,
    DIRECT_WORK: false,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: false
  }
};

