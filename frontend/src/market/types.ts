import type {
  FeatureProfileCode,
  FieldProfileCode,
  IntegrationProfileCode,
  MapProfileCode,
  MarketFeatureKey,
  MarketTemplateCode,
  ScreenProfileCode,
  WorkflowProfileCode
} from '@dio-crm/contracts';

export type { MarketFeatureKey } from '@dio-crm/contracts';

export type MarketProfile = {
  code: string;
  countryCode: string;
  defaultLocale: string;
  currencyCode: string;
  timezone: string;
  marketTemplateCode?: MarketTemplateCode;
  screenProfileCode?: ScreenProfileCode;
  fieldProfileCode?: FieldProfileCode;
  featureProfileCode?: FeatureProfileCode;
  workflowProfileCode: WorkflowProfileCode;
  integrationProfileCode?: IntegrationProfileCode;
  mapProfileCode: MapProfileCode;
  features: Record<MarketFeatureKey, boolean>;
};
