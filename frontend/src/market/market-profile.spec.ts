import { describe, expect, it } from 'vitest';
import { KR_MARKET_PROFILE } from './profiles/KR';

describe('KR market profile', () => {
  it('keeps existing Korean CRM features enabled', () => {
    expect(KR_MARKET_PROFILE.countryCode).toBe('KR');
    expect(KR_MARKET_PROFILE.defaultLocale).toBe('ko-KR');
    expect(KR_MARKET_PROFILE.currencyCode).toBe('KRW');
    expect(KR_MARKET_PROFILE.features.GPS_CHECKIN).toBe(true);
    expect(KR_MARKET_PROFILE.features.DIRECT_WORK).toBe(true);
    expect(KR_MARKET_PROFILE.features.ACTIVITY_APPROVAL).toBe(true);
  });
});
