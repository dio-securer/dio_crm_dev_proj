import { describe, expect, it } from 'vitest';
import { GLOBAL_SCREEN_PROFILE } from '../../../app/screen-profile';
import { GLOBAL_SCREEN_MANIFEST } from './global-screen-manifest';

const expected = [
  'GLOBAL_LEAD',
  'GLOBAL_ACCOUNT',
  'GLOBAL_ACTIVITY_MAP',
  'GLOBAL_ACTIVITY_REPORT',
  'GLOBAL_OPPORTUNITY',
  'GLOBAL_CONTRACT',
  'GLOBAL_ORDER'
];

describe('M7 GLOBAL screen baseline', () => {
  it('contains only the overseas sales/activity screens supported by the source material', () => {
    expect(GLOBAL_SCREEN_MANIFEST).toEqual(expected);
    expect(Object.values(GLOBAL_SCREEN_PROFILE.screens)).toEqual(expected);
  });

  it('does not expose Direct Work / Direct Leave route in GLOBAL', () => {
    expect(GLOBAL_SCREEN_PROFILE.screens.directWork).toBeUndefined();
  });

  it('keeps not-yet-proven screens out of the GLOBAL navigation baseline', () => {
    expect(GLOBAL_SCREEN_PROFILE.screens.pipeline).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.fulfillment).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.ledger).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.account360).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.analytics).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.ops).toBeUndefined();
  });

  it('does not mix HQ keys into the GLOBAL manifest', () => {
    expect(GLOBAL_SCREEN_MANIFEST.some(key => key.startsWith('HQ_'))).toBe(false);
  });
});
