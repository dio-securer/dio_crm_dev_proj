import type { GlobalizationContext } from '@dio-crm/contracts';

export type MarketProfileDefinition = Omit<GlobalizationContext, 'locale' | 'features'> & {
  defaultLocale: string;
};

const KR_PROFILE: MarketProfileDefinition = {
  countryCode: 'KR',
  currencyCode: 'KRW',
  timezone: 'Asia/Seoul',
  marketProfileCode: 'KR_SALES',
  marketTemplateCode: 'HQ_TEMPLATE',
  screenProfileCode: 'HQ_SCREEN_PROFILE',
  fieldProfileCode: 'HQ_FIELD_PROFILE',
  featureProfileCode: 'HQ_FEATURE_PROFILE',
  workflowProfileCode: 'KR_SALES_APPROVAL',
  integrationProfileCode: 'HQ_INTEGRATION_PROFILE',
  mapProfileCode: 'KR_DEFAULT',
  defaultLocale: 'ko-KR'
};

const registry = new Map<string, MarketProfileDefinition>([[KR_PROFILE.marketProfileCode, KR_PROFILE]]);

export function getMarketProfile(code: string): MarketProfileDefinition | undefined {
  return registry.get(code);
}
