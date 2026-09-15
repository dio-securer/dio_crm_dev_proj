import { describe, expect, it } from 'vitest';
import { HQ_SCREEN_PROFILE } from '../../../app/screen-profile';
import { HQ_SCREEN_KEYS } from './hq-screen-manifest';

const profileKeys = Object.values(HQ_SCREEN_PROFILE.screens).filter(Boolean);

describe('M6 HQ template protection', () => {
  it('keeps every HQ screen profile entry owned by the HQ template wrapper layer', () => {
    expect([...profileKeys].sort()).toEqual([...HQ_SCREEN_KEYS].sort());
  });

  it('keeps the approved HQ screen count stable', () => {
    expect(HQ_SCREEN_KEYS).toHaveLength(14);
  });

  it('does not mix GLOBAL screen keys into the HQ wrapper manifest', () => {
    expect(HQ_SCREEN_KEYS.some(key => key.startsWith('GLOBAL_'))).toBe(false);
  });
});
