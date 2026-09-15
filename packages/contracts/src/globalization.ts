export const MARKET_FEATURE_KEYS = [
  'HIRA_IMPORT',
  'DIRECT_WORK',
  'GPS_CHECKIN',
  'ACTIVITY_APPROVAL',
  'ERP_ACCOUNT_APPROVAL',
  'MONTHLY_STATEMENT'
] as const;

export type MarketFeatureKey = typeof MARKET_FEATURE_KEYS[number];

export type MarketTemplateCode = string;
export type ScreenProfileCode = string;
export type FieldProfileCode = string;
export type FeatureProfileCode = string;
export type IntegrationProfileCode = string;
export type WorkflowProfileCode = string;
export type MapProfileCode = string;

export type GlobalizationProfileCodes = {
  /** Higher-level UI/process template. Added by RM-MKT-001 and optional for backward compatibility. */
  marketTemplateCode?: MarketTemplateCode;
  /** Selects the screen set/registry mapping for the current market. */
  screenProfileCode?: ScreenProfileCode;
  /** Selects field/section visibility and ordering rules. */
  fieldProfileCode?: FieldProfileCode;
  /** Selects the market feature baseline before country overrides. */
  featureProfileCode?: FeatureProfileCode;
  /** Selects ERP/map/external integration adapter configuration. */
  integrationProfileCode?: IntegrationProfileCode;
  /** Existing approval/workflow profile. */
  workflowProfileCode?: WorkflowProfileCode;
  /** Existing map-provider profile. */
  mapProfileCode?: MapProfileCode;
};

export type GlobalizationContext = GlobalizationProfileCodes & {
  locale: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  marketProfileCode: string;
  features: Record<MarketFeatureKey, boolean>;
};

export type MeContextResponse = {
  user: {
    userId: number;
    publicId: string;
    name: string;
    companyId: number;
  };
  globalization: GlobalizationContext;
};

const OPTIONAL_PROFILE_FIELDS = [
  'marketTemplateCode',
  'screenProfileCode',
  'fieldProfileCode',
  'featureProfileCode',
  'integrationProfileCode',
  'workflowProfileCode',
  'mapProfileCode'
] as const;

/**
 * Minimal runtime contract guard for /api/me/context.
 * New RM-MKT-001 profile codes are optional so an older compatible payload remains valid.
 */
export function isGlobalizationContext(value: unknown): value is GlobalizationContext {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;

  for (const key of ['locale', 'countryCode', 'currencyCode', 'timezone', 'marketProfileCode'] as const) {
    if (typeof row[key] !== 'string' || !row[key]) return false;
  }

  for (const key of OPTIONAL_PROFILE_FIELDS) {
    const field = row[key];
    if (field !== undefined && (typeof field !== 'string' || !field)) return false;
  }

  if (!row.features || typeof row.features !== 'object') return false;
  const features = row.features as Record<string, unknown>;
  return MARKET_FEATURE_KEYS.every(key => typeof features[key] === 'boolean');
}
