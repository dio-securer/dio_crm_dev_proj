import type { ScreenKey } from '../../../app/screen-profile';

export const HQ_SCREEN_KEYS = [
  'HQ_LEAD',
  'HQ_ACCOUNT',
  'HQ_ACTIVITY',
  'HQ_ACTIVITY_REPORT',
  'HQ_DIRECT_WORK',
  'HQ_OPPORTUNITY',
  'HQ_PIPELINE',
  'HQ_CONTRACT',
  'HQ_ORDER',
  'HQ_FULFILLMENT',
  'HQ_LEDGER',
  'HQ_ACCOUNT360',
  'HQ_ANALYTICS',
  'HQ_OPS'
] as const satisfies readonly ScreenKey[];
