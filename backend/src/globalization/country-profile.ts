import type { MarketTemplateCode } from '@dio-crm/contracts';

export type CountryProfileStatus = 'ACTIVE' | 'BASELINE_ONLY';

export type CountryProfileDefinition = {
  countryCode: string;
  marketTemplateCode: MarketTemplateCode;
  status: CountryProfileStatus;
  /** Existing approved runtime market profile. Undefined means M2 mapping only. */
  marketProfileCode?: string;
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
  status: 'BASELINE_ONLY'
};

export const MX_COUNTRY_PROFILE: CountryProfileDefinition = {
  countryCode: 'MX',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  status: 'BASELINE_ONLY'
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
