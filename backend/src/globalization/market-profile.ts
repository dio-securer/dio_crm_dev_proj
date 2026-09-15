import type {
  FeatureProfileCode,
  FieldProfileCode,
  IntegrationProfileCode,
  MapProfileCode,
  MarketTemplateCode,
  ScreenProfileCode,
  WorkflowProfileCode
} from '@dio-crm/contracts';

export type MarketProfileDefinition = {
  countryCode: string;
  marketProfileCode: string;
  marketTemplateCode: MarketTemplateCode;
  screenProfileCode: ScreenProfileCode;
  fieldProfileCode: FieldProfileCode;
  featureProfileCode: FeatureProfileCode;
  workflowProfileCode: WorkflowProfileCode;
  integrationProfileCode: IntegrationProfileCode;
  mapProfileCode?: MapProfileCode;
  /** Optional fallback values. GLOBAL country profiles intentionally require crm_company configuration instead. */
  defaultLocale?: string;
  currencyCode?: string;
  timezone?: string;
  requireCompanyOperationalConfig?: boolean;
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

/**
 * M8 activates the US/MX Country Profile -> GLOBAL Template selection without
 * inventing locale/currency/timezone/provider defaults that are not present in
 * the training material. Those operational values must come from crm_company.
 */
const US_PROFILE: MarketProfileDefinition = {
  countryCode: 'US',
  marketProfileCode: 'US_SALES',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  screenProfileCode: 'GLOBAL_SCREEN_PROFILE',
  fieldProfileCode: 'GLOBAL_FIELD_PROFILE',
  featureProfileCode: 'GLOBAL_FEATURE_PROFILE',
  workflowProfileCode: 'GLOBAL_SALES_APPROVAL_BASELINE',
  integrationProfileCode: 'GLOBAL_INTEGRATION_PROFILE',
  requireCompanyOperationalConfig: true
};

const MX_PROFILE: MarketProfileDefinition = {
  countryCode: 'MX',
  marketProfileCode: 'MX_SALES',
  marketTemplateCode: 'GLOBAL_TEMPLATE',
  screenProfileCode: 'GLOBAL_SCREEN_PROFILE',
  fieldProfileCode: 'GLOBAL_FIELD_PROFILE',
  featureProfileCode: 'GLOBAL_FEATURE_PROFILE',
  workflowProfileCode: 'GLOBAL_SALES_APPROVAL_BASELINE',
  integrationProfileCode: 'GLOBAL_INTEGRATION_PROFILE',
  requireCompanyOperationalConfig: true
};

const registry = new Map<string, MarketProfileDefinition>([
  [KR_PROFILE.marketProfileCode, KR_PROFILE],
  [US_PROFILE.marketProfileCode, US_PROFILE],
  [MX_PROFILE.marketProfileCode, MX_PROFILE]
]);

export function getMarketProfile(code: string): MarketProfileDefinition | undefined {
  return registry.get(code);
}
