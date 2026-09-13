import type { GlobalizationContext, MarketFeatureKey } from '@dio-crm/contracts';

export type MarketProfileDefinition = Omit<GlobalizationContext, 'locale'> & {
  defaultLocale: string;
};

const KR_PROFILE: MarketProfileDefinition = {
  countryCode: 'KR',
  currencyCode: 'KRW',
  timezone: 'Asia/Seoul',
  marketProfileCode: 'KR_SALES',
  workflowProfileCode: 'KR_SALES_APPROVAL',
  mapProfileCode: 'KR_DEFAULT',
  defaultLocale: 'ko-KR',
  features: {
    HIRA_IMPORT: true,
    DIRECT_WORK: true,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: true
  }
};

const registry = new Map<string, MarketProfileDefinition>([[KR_PROFILE.marketProfileCode, KR_PROFILE]]);

export function getMarketProfile(code: string): MarketProfileDefinition | undefined {
  return registry.get(code);
}

export function marketFeatureEnabled(profile: MarketProfileDefinition, feature: MarketFeatureKey) {
  return profile.features[feature] === true;
}
