import type { ScreenProfileCode } from '@dio-crm/contracts';

export type ScreenSlot =
  | 'lead'
  | 'account'
  | 'activity'
  | 'activityReport'
  | 'directWork'
  | 'opportunity'
  | 'pipeline'
  | 'contract'
  | 'order'
  | 'fulfillment'
  | 'ledger'
  | 'account360'
  | 'analytics'
  | 'ops';

export type ScreenKey =
  | 'HQ_LEAD'
  | 'HQ_ACCOUNT'
  | 'HQ_ACTIVITY'
  | 'HQ_ACTIVITY_REPORT'
  | 'HQ_DIRECT_WORK'
  | 'HQ_OPPORTUNITY'
  | 'HQ_PIPELINE'
  | 'HQ_CONTRACT'
  | 'HQ_ORDER'
  | 'HQ_FULFILLMENT'
  | 'HQ_LEDGER'
  | 'HQ_ACCOUNT360'
  | 'HQ_ANALYTICS'
  | 'HQ_OPS'
  | 'GLOBAL_LEAD'
  | 'GLOBAL_ACCOUNT'
  | 'GLOBAL_ACTIVITY_MAP'
  | 'GLOBAL_ACTIVITY_REPORT'
  | 'GLOBAL_OPPORTUNITY'
  | 'GLOBAL_PIPELINE'
  | 'GLOBAL_CONTRACT'
  | 'GLOBAL_ORDER'
  | 'GLOBAL_FULFILLMENT'
  | 'GLOBAL_LEDGER'
  | 'GLOBAL_ACCOUNT360'
  | 'GLOBAL_ANALYTICS'
  | 'GLOBAL_OPS';

export type ScreenProfileDefinition = {
  code: ScreenProfileCode;
  screens: Partial<Record<ScreenSlot, ScreenKey>>;
};

export const HQ_SCREEN_PROFILE: ScreenProfileDefinition = {
  code: 'HQ_SCREEN_PROFILE',
  screens: {
    lead: 'HQ_LEAD',
    account: 'HQ_ACCOUNT',
    activity: 'HQ_ACTIVITY',
    activityReport: 'HQ_ACTIVITY_REPORT',
    directWork: 'HQ_DIRECT_WORK',
    opportunity: 'HQ_OPPORTUNITY',
    pipeline: 'HQ_PIPELINE',
    contract: 'HQ_CONTRACT',
    order: 'HQ_ORDER',
    fulfillment: 'HQ_FULFILLMENT',
    ledger: 'HQ_LEDGER',
    account360: 'HQ_ACCOUNT360',
    analytics: 'HQ_ANALYTICS',
    ops: 'HQ_OPS'
  }
};

/**
 * M7 GLOBAL baseline is intentionally limited to screens directly supported by
 * the overseas sales/activity training material. Additional routes stay hidden
 * until a later country requirement proves they belong in the GLOBAL template.
 */
export const GLOBAL_SCREEN_PROFILE: ScreenProfileDefinition = {
  code: 'GLOBAL_SCREEN_PROFILE',
  screens: {
    lead: 'GLOBAL_LEAD',
    account: 'GLOBAL_ACCOUNT',
    activity: 'GLOBAL_ACTIVITY_MAP',
    activityReport: 'GLOBAL_ACTIVITY_REPORT',
    opportunity: 'GLOBAL_OPPORTUNITY',
    contract: 'GLOBAL_CONTRACT',
    order: 'GLOBAL_ORDER'
  }
};

const SCREEN_PROFILES = new Map<ScreenProfileCode, ScreenProfileDefinition>([
  [HQ_SCREEN_PROFILE.code, HQ_SCREEN_PROFILE],
  [GLOBAL_SCREEN_PROFILE.code, GLOBAL_SCREEN_PROFILE]
]);

export function getScreenProfile(code: ScreenProfileCode | undefined): ScreenProfileDefinition | undefined {
  return code ? SCREEN_PROFILES.get(code) : undefined;
}

export function resolveScreenKey(profileCode: ScreenProfileCode, slot: ScreenSlot): ScreenKey | undefined {
  return getScreenProfile(profileCode)?.screens[slot];
}
