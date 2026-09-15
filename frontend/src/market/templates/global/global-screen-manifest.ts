import type { ScreenKey } from '../../../app/screen-profile';

export const GLOBAL_SCREEN_MANIFEST: readonly ScreenKey[] = [
  'GLOBAL_LEAD',
  'GLOBAL_ACCOUNT',
  'GLOBAL_ACTIVITY_MAP',
  'GLOBAL_ACTIVITY_REPORT',
  'GLOBAL_OPPORTUNITY',
  'GLOBAL_CONTRACT',
  'GLOBAL_ORDER'
] as const;
