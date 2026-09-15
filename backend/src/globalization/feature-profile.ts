import type { MarketFeatureKey } from '@dio-crm/contracts';

export type FeatureDecision = boolean | 'UNCONFIRMED';
export type FeatureProfileStatus = 'ACTIVE' | 'BASELINE_ONLY';

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
 * GLOBAL candidate values are limited to what is explicitly supported by the
 * overseas training material. BASELINE_ONLY means it cannot be used as an
 * approved runtime profile until country onboarding confirms all gaps.
 */
export const GLOBAL_FEATURE_PROFILE: FeatureProfileDefinition = {
  code: 'GLOBAL_FEATURE_PROFILE',
  status: 'BASELINE_ONLY',
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
  if (profile.status !== 'ACTIVE') throw new Error('FEATURE_PROFILE_NOT_ACTIVE');

  const entries = Object.entries(profile.features) as Array<[MarketFeatureKey, FeatureDecision]>;
  const unresolved = entries.filter(([, decision]) => decision === 'UNCONFIRMED');
  if (unresolved.length) throw new Error('FEATURE_PROFILE_HAS_UNCONFIRMED_VALUES');

  return Object.fromEntries(entries.map(([key, decision]) => [key, decision === true])) as Record<MarketFeatureKey, boolean>;
}
