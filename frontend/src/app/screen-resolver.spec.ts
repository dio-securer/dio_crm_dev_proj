import { describe, expect, it } from 'vitest';
import type { GlobalizationContext } from '@dio-crm/contracts';
import { resolveScreenForSlot, resolveScreenProfileCode, ScreenResolutionError } from './screen-resolver';

const baseContext: GlobalizationContext = {
  locale: 'ko-KR',
  countryCode: 'KR',
  currencyCode: 'KRW',
  timezone: 'Asia/Seoul',
  marketProfileCode: 'KR_SALES',
  screenProfileCode: 'HQ_SCREEN_PROFILE',
  features: {
    HIRA_IMPORT: true,
    DIRECT_WORK: true,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: true
  }
};

describe('M3 screen resolver', () => {
  it('resolves KR account to HQ_ACCOUNT', () => {
    const profile = resolveScreenProfileCode(baseContext);
    expect(resolveScreenForSlot(profile, 'account')).toBe('HQ_ACCOUNT');
  });

  it('resolves GLOBAL account to GLOBAL_ACCOUNT for US/MX template use', () => {
    expect(resolveScreenForSlot('GLOBAL_SCREEN_PROFILE', 'account')).toBe('GLOBAL_ACCOUNT');
  });

  it('resolves GLOBAL activity route to the map entry screen key', () => {
    expect(resolveScreenForSlot('GLOBAL_SCREEN_PROFILE', 'activity')).toBe('GLOBAL_ACTIVITY_MAP');
  });

  it('keeps legacy KR payload compatibility when screenProfileCode is absent', () => {
    const legacy = { ...baseContext, screenProfileCode: undefined };
    expect(resolveScreenProfileCode(legacy)).toBe('HQ_SCREEN_PROFILE');
  });

  it('rejects an unknown screen profile instead of silently using HQ', () => {
    const invalid = { ...baseContext, countryCode: 'US', marketProfileCode: 'US_SALES', screenProfileCode: 'UNKNOWN_SCREEN' };
    expect(() => resolveScreenProfileCode(invalid)).toThrow(ScreenResolutionError);
  });

  it('does not expose direct work in GLOBAL screen profile', () => {
    expect(() => resolveScreenForSlot('GLOBAL_SCREEN_PROFILE', 'directWork')).toThrow(ScreenResolutionError);
  });
});
