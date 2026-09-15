import type { GlobalizationContext, MarketFeatureKey } from '@dio-crm/contracts';
import { resolveCountryProfile } from './profile-resolver';

export type MarketProfileDefinition = Omit<GlobalizationContext, 'locale'> & {
  defaultLocale: string;
};

const krFoundation = resolveCountryProfile('KR');
if (!krFoundation) throw new Error('KR_COUNTRY_PROFILE_NOT_CONFIGURED');

const KR_PROFILE: MarketProfileDefinition = {
  countryCode: krFoundation.countryCode,
  currencyCode: 'KRW',
  timezone: 'Asia/Seoul',
  marketProfileCode: krFoundation.marketProfileCode,
  marketTemplateCode: krFoundation.marketTemplateCode,
  screenProfileCode: krFoundation.screenProfileCode,
  fieldProfileCode: krFoundation.fieldProfileCode,
  featureProfileCode: krFoundation.featureProfileCode,
  workflowProfileCode: krFoundation.workflowProfileCode,
  integrationProfileCode: krFoundation.integrationProfileCode,
  mapProfileCode: krFoundation.mapProfileCode,
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
