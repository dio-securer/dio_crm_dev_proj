import type { MarketFeatureKey } from '@dio-crm/contracts';

export type FeatureDecision = boolean | 'UNCONFIRMED';
export type FeatureProfileStatus = 'ACTIVE' | 'ACTIVE_CONFIRMED_ONLY' | 'BASELINE_ONLY';

export type FeatureProfileDefinition = {
  code: string;
  status: FeatureProfileStatus;
  features: Record<MarketFeatureKey, FeatureDecision>;
};

export const HQ_FEATURE_PROFILE: FeatureProfileDefinition = {
  code: 'HQ_FEATURE_PROFILE',
  status: 'ACTIVE',
  features: {
    HIRA_IMPORT: true,
    DIRECT_WORK: true,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: true
  }
};

/**
 * M8 enables the documented GLOBAL feature subset for US/MX.
 * UNCONFIRMED does not become a business-rule false; runtime simply fails closed
 * and does not expose/authorize the feature until a later country requirement approves it.
 */
export const GLOBAL_FEATURE_PROFILE: FeatureProfileDefinition = {
  code: 'GLOBAL_FEATURE_PROFILE',
  status: 'ACTIVE_CONFIRMED_ONLY',
  features: {
    HIRA_IMPORT: 'UNCONFIRMED',
    DIRECT_WORK: false,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: 'UNCONFIRMED'
  }
};

const registry = new Map<string, FeatureProfileDefinition>([
  [HQ_FEATURE_PROFILE.code, HQ_FEATURE_PROFILE],
  [GLOBAL_FEATURE_PROFILE.code, GLOBAL_FEATURE_PROFILE]
]);

export function getFeatureProfile(code: string): FeatureProfileDefinition | undefined {
  return registry.get(code);
}

export function featureDecision(profile: FeatureProfileDefinition, feature: MarketFeatureKey): FeatureDecision {
  return profile.features[feature];
}

export function runtimeFeatureMap(code: string): Record<MarketFeatureKey, boolean> {
  const profile = getFeatureProfile(code);
  if (!profile) throw new Error('FEATURE_PROFILE_NOT_REGISTERED');
  if (profile.status === 'BASELINE_ONLY') throw new Error('FEATURE_PROFILE_NOT_ACTIVE');

  const entries = Object.entries(profile.features) as Array<[MarketFeatureKey, FeatureDecision]>;
  const unresolved = entries.filter(([, decision]) => decision === 'UNCONFIRMED');
  if (profile.status === 'ACTIVE' && unresolved.length) {
    throw new Error('FEATURE_PROFILE_HAS_UNCONFIRMED_VALUES');
  }

  return Object.fromEntries(entries.map(([key, decision]) => [key, decision === true])) as Record<MarketFeatureKey, boolean>;
}

export function featureProfileAllowsRuntime(profile: FeatureProfileDefinition): boolean {
  return profile.status === 'ACTIVE' || profile.status === 'ACTIVE_CONFIRMED_ONLY';
}
