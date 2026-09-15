import type {
  FeatureProfileCode,
  FieldProfileCode,
  IntegrationProfileCode,
  MapProfileCode,
  MarketTemplateCode,
  ScreenProfileCode,
  WorkflowProfileCode
} from '@dio-crm/contracts';
import { getCountryProfile, type CountryProfileDefinition } from './country-profile';
import { getMarketTemplate, type MarketTemplateDefinition } from './market-template';

export type ResolvedCountryProfile = {
  countryCode: string;
  marketProfileCode: string;
  marketTemplateCode: MarketTemplateCode;
  screenProfileCode: ScreenProfileCode;
  fieldProfileCode: FieldProfileCode;
  featureProfileCode: FeatureProfileCode;
  integrationProfileCode: IntegrationProfileCode;
  workflowProfileCode?: WorkflowProfileCode;
  mapProfileCode?: MapProfileCode;
  status: CountryProfileDefinition['status'];
};

export function resolveCountryProfile(countryCode: string): ResolvedCountryProfile | undefined {
  const country = getCountryProfile(countryCode);
  if (!country) return undefined;
  const template = getMarketTemplate(country.marketTemplateCode);
  if (!template) return undefined;
  return combine(country, template);
}

export function resolveCountryProfileByMarketProfileCode(marketProfileCode: string): ResolvedCountryProfile | undefined {
  for (const countryCode of ['KR', 'US', 'MX']) {
    const resolved = resolveCountryProfile(countryCode);
    if (resolved?.marketProfileCode === marketProfileCode) return resolved;
  }
  return undefined;
}

function combine(country: CountryProfileDefinition, template: MarketTemplateDefinition): ResolvedCountryProfile {
  return {
    countryCode: country.countryCode,
    marketProfileCode: country.marketProfileCode,
    marketTemplateCode: template.code,
    screenProfileCode: template.screenProfileCode,
    fieldProfileCode: template.fieldProfileCode,
    featureProfileCode: template.featureProfileCode,
    integrationProfileCode: template.integrationProfileCode,
    workflowProfileCode: country.workflowProfileCode,
    mapProfileCode: country.mapProfileCode,
    status: country.status
  };
}
