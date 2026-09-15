import type { MarketTemplateCode } from '@dio-crm/contracts';

export type CountryProfileStatus = 'ACTIVE' | 'ACTIVE_WITH_GAPS' | 'BASELINE_ONLY';

export type CountryProfileDefinition = {
  countryCode: string;
  marketTemplateCode: MarketTemplateCode;
  status: CountryProfileStatus;
  marketProfileCode?: string;
  gaps?: string[];
};

export const KR_COUNTRY_PROFILE: CountryProfileDefinition = {
  countryCode: 'KR',
  marketTemplateCode: 'HQ_TEMPLATE',
  status: 'ACTIVE',
  marketProfileCode: 'KR_SALES'
};

export const US_COUNTRY_PROFILE: CountryProfileDefinition = {
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

export const MX_COUNTRY_PROFILE: CountryProfileDefinition = {
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

const registry = new Map<string, CountryProfileDefinition>([
  [KR_COUNTRY_PROFILE.countryCode, KR_COUNTRY_PROFILE],
  [US_COUNTRY_PROFILE.countryCode, US_COUNTRY_PROFILE],
  [MX_COUNTRY_PROFILE.countryCode, MX_COUNTRY_PROFILE]
]);

export function getCountryProfile(countryCode: string): CountryProfileDefinition | undefined {
  return registry.get(countryCode.toUpperCase());
}

export function listCountryProfiles(): CountryProfileDefinition[] {
  return Array.from(registry.values());
}
