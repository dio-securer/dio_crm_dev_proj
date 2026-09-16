import { describe, expect, it } from 'vitest';
import { KR_MARKET_PROFILE } from './profiles/KR';
import { US_MARKET_PROFILE } from './profiles/US';

describe('KR market profile', () => {
  it('keeps existing Korean CRM features enabled', () => {
    expect(KR_MARKET_PROFILE.countryCode).toBe('KR');
    expect(KR_MARKET_PROFILE.defaultLocale).toBe('ko-KR');
    expect(KR_MARKET_PROFILE.currencyCode).toBe('KRW');
    expect(KR_MARKET_PROFILE.features.GPS_CHECKIN).toBe(true);
    expect(KR_MARKET_PROFILE.features.DIRECT_WORK).toBe(true);
    expect(KR_MARKET_PROFILE.features.ACTIVITY_APPROVAL).toBe(true);
  });

  it('exposes the M1 HQ profile-code baseline without changing the KR market code', () => {
    expect(KR_MARKET_PROFILE.code).toBe('KR_SALES');
    expect(KR_MARKET_PROFILE.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(KR_MARKET_PROFILE.screenProfileCode).toBe('HQ_SCREEN_PROFILE');
    expect(KR_MARKET_PROFILE.fieldProfileCode).toBe('HQ_FIELD_PROFILE');
    expect(KR_MARKET_PROFILE.featureProfileCode).toBe('HQ_FEATURE_PROFILE');
    expect(KR_MARKET_PROFILE.workflowProfileCode).toBe('KR_SALES_APPROVAL');
    expect(KR_MARKET_PROFILE.integrationProfileCode).toBe('HQ_INTEGRATION_PROFILE');
    expect(KR_MARKET_PROFILE.mapProfileCode).toBe('KR_DEFAULT');
  });

  it('keeps US demo market on the GLOBAL screen/feature baseline', () => {
    expect(US_MARKET_PROFILE.code).toBe('US_SALES');
    expect(US_MARKET_PROFILE.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
    expect(US_MARKET_PROFILE.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
    expect(US_MARKET_PROFILE.featureProfileCode).toBe('GLOBAL_FEATURE_PROFILE');
    expect(US_MARKET_PROFILE.features.DIRECT_WORK).toBe(false);
    expect(US_MARKET_PROFILE.features.GPS_CHECKIN).toBe(true);
  });
});
