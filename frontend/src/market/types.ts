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

export type MarketTemplateDefinition = {
  code: MarketTemplateCode;
  screenProfileCode: ScreenProfileCode;
  fieldProfileCode: FieldProfileCode;
  featureProfileCode: FeatureProfileCode;
  integrationProfileCode: IntegrationProfileCode;
};

export type CountryProfileStatus = 'ACTIVE' | 'ACTIVE_WITH_GAPS' | 'BASELINE_ONLY';

export type CountryProfile = {
  countryCode: string;
  marketTemplateCode: MarketTemplateCode;
  status: CountryProfileStatus;
  marketProfileCode?: string;
  gaps?: string[];
};
