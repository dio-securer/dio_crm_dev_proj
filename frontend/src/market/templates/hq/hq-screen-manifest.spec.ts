import { describe, expect, it } from 'vitest';
import { HQ_SCREEN_PROFILE } from '../../../app/screen-profile';
import { HQ_SCREEN_KEYS } from './hq-screen-manifest';

const profileKeys = Object.values(HQ_SCREEN_PROFILE.screens).filter(Boolean);

describe('A+B HQ template protection', () => {
  it('keeps every HQ screen profile entry owned by the HQ template wrapper layer', () => {
    expect([...profileKeys].sort()).toEqual([...HQ_SCREEN_KEYS].sort());
  });

  it('keeps the approved HQ screen count stable including Contact', () => {
    expect(HQ_SCREEN_KEYS).toHaveLength(15);
  });

  it('does not mix GLOBAL screen keys into the HQ wrapper manifest', () => {
    expect(HQ_SCREEN_KEYS.some(key => key.startsWith('GLOBAL_'))).toBe(false);
  });
});
