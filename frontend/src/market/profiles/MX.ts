import type { CountryProfile } from '../types';

export const MX_COUNTRY_PROFILE: CountryProfile = {
  countryCode: 'MX',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  status: 'ACTIVE_WITH_GAPS',
  marketProfileCode: 'MX_SALES',
  gaps: [
    'LOCALE_CURRENCY_TIMEZONE_REQUIRE_COMPANY_CONFIG',
    'MAP_PROFILE_REQUIRE_COMPANY_CONFIG',
    'ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED',
    'ERP_PROVIDER_ENDPOINT_UNCONFIRMED',
    'HIRA_IMPORT_UNCONFIRMED',
    'MONTHLY_STATEMENT_UNCONFIRMED'
  ]
};
