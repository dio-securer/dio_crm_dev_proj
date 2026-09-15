import type { MapProfileCode, MarketTemplateCode, WorkflowProfileCode } from '@dio-crm/contracts';

export type CountryProfileStatus = 'ACTIVE' | 'CONFIG_BASELINE';

export type CountryProfileDefinition = {
  countryCode: string;
  marketProfileCode: string;
  marketTemplateCode: MarketTemplateCode;
  workflowProfileCode?: WorkflowProfileCode;
  mapProfileCode?: MapProfileCode;
  status: CountryProfileStatus;
};

export const KR_COUNTRY_PROFILE: CountryProfileDefinition = {
  countryCode: 'KR',
  marketProfileCode: 'KR_SALES',
  marketTemplateCode: 'HQ_TEMPLATE',
  workflowProfileCode: 'KR_SALES_APPROVAL',
  mapProfileCode: 'KR_DEFAULT',
  status: 'ACTIVE'
};

export const US_COUNTRY_PROFILE: CountryProfileDefinition = {
  countryCode: 'US',
  marketProfileCode: 'US_SALES',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  status: 'CONFIG_BASELINE'
};

export const MX_COUNTRY_PROFILE: CountryProfileDefinition = {
  countryCode: 'MX',
  marketProfileCode: 'MX_SALES',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  status: 'CONFIG_BASELINE'
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
  return [...registry.values()];
}
