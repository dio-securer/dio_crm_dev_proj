import type { MarketTemplateCode } from '@dio-crm/contracts';
import { getCountryProfile, type CountryProfileDefinition } from './country-profile';
import { getMarketTemplate, type MarketTemplateDefinition } from './market-template';

export type ResolvedCountryTemplate = {
  country: CountryProfileDefinition;
  template: MarketTemplateDefinition;
};

export function resolveCountryTemplate(countryCode: string): ResolvedCountryTemplate | undefined {
  const country = getCountryProfile(countryCode);
  if (!country) return undefined;
  const template = getMarketTemplate(country.marketTemplateCode);
  if (!template) return undefined;
  return { country, template };
}

export function resolveMarketTemplateCode(countryCode: string): MarketTemplateCode | undefined {
  return resolveCountryTemplate(countryCode)?.template.code;
}
