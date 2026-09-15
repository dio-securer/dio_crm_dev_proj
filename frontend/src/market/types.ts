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

export type MarketTemplate = {
  code: MarketTemplateCode;
  screenProfileCode: ScreenProfileCode;
  fieldProfileCode: FieldProfileCode;
  featureProfileCode: FeatureProfileCode;
  integrationProfileCode: IntegrationProfileCode;
};

export type CountryProfileStatus = 'ACTIVE' | 'CONFIG_BASELINE';

export type CountryProfile = {
  countryCode: string;
  marketProfileCode: string;
  marketTemplateCode: MarketTemplateCode;
  workflowProfileCode?: WorkflowProfileCode;
  mapProfileCode?: MapProfileCode;
  status: CountryProfileStatus;
};

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
