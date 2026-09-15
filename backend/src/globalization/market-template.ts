import type {
  FeatureProfileCode,
  FieldProfileCode,
  IntegrationProfileCode,
  MarketTemplateCode,
  ScreenProfileCode
} from '@dio-crm/contracts';

export type MarketTemplateDefinition = {
  code: MarketTemplateCode;
  screenProfileCode: ScreenProfileCode;
  fieldProfileCode: FieldProfileCode;
  featureProfileCode: FeatureProfileCode;
  integrationProfileCode: IntegrationProfileCode;
};

export const HQ_TEMPLATE: MarketTemplateDefinition = {
  code: 'HQ_TEMPLATE',
  screenProfileCode: 'HQ_SCREEN_PROFILE',
  fieldProfileCode: 'HQ_FIELD_PROFILE',
  featureProfileCode: 'HQ_FEATURE_PROFILE',
  integrationProfileCode: 'HQ_INTEGRATION_PROFILE'
};

export const GLOBAL_TEMPLATE: MarketTemplateDefinition = {
  code: 'GLOBAL_TEMPLATE',
  screenProfileCode: 'GLOBAL_SCREEN_PROFILE',
  fieldProfileCode: 'GLOBAL_FIELD_PROFILE',
  featureProfileCode: 'GLOBAL_FEATURE_PROFILE',
  integrationProfileCode: 'GLOBAL_INTEGRATION_PROFILE'
};

const registry = new Map<MarketTemplateCode, MarketTemplateDefinition>([
  [HQ_TEMPLATE.code, HQ_TEMPLATE],
  [GLOBAL_TEMPLATE.code, GLOBAL_TEMPLATE]
]);

export function getMarketTemplate(code: MarketTemplateCode): MarketTemplateDefinition | undefined {
  return registry.get(code);
}

export function listMarketTemplates(): MarketTemplateDefinition[] {
  return [...registry.values()];
}
