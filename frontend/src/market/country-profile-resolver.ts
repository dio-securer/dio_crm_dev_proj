import { KR_COUNTRY_PROFILE } from './profiles/KR';
import { MX_COUNTRY_PROFILE } from './profiles/MX';
import { US_COUNTRY_PROFILE } from './profiles/US';
import { getMarketTemplate } from './template-registry';
import type { CountryProfile, MarketTemplateDefinition } from './types';

const countryRegistry = new Map<string, CountryProfile>([
  [KR_COUNTRY_PROFILE.countryCode, KR_COUNTRY_PROFILE],
  [US_COUNTRY_PROFILE.countryCode, US_COUNTRY_PROFILE],
  [MX_COUNTRY_PROFILE.countryCode, MX_COUNTRY_PROFILE]
]);

export function getCountryProfile(countryCode: string): CountryProfile | undefined {
  return countryRegistry.get(countryCode.toUpperCase());
}

export function resolveCountryTemplate(countryCode: string): { country: CountryProfile; template: MarketTemplateDefinition } | undefined {
  const country = getCountryProfile(countryCode);
  if (!country) return undefined;
  const template = getMarketTemplate(country.marketTemplateCode);
  return template ? { country, template } : undefined;
}
