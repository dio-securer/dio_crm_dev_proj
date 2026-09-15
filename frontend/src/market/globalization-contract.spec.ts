import { describe, expect, it } from 'vitest';
import { isGlobalizationContext } from '@dio-crm/contracts';

const features = {
  HIRA_IMPORT: true,
  DIRECT_WORK: true,
  GPS_CHECKIN: true,
  ACTIVITY_APPROVAL: true,
  ERP_ACCOUNT_APPROVAL: true,
  MONTHLY_STATEMENT: true
};

describe('GlobalizationContext contract', () => {
  it('accepts the extended M1 context payload', () => {
    expect(isGlobalizationContext({
      locale: 'ko-KR',
      countryCode: 'KR',
      currencyCode: 'KRW',
      timezone: 'Asia/Seoul',
      marketProfileCode: 'KR_SALES',
      marketTemplateCode: 'HQ_TEMPLATE',
      screenProfileCode: 'HQ_SCREEN_PROFILE',
      fieldProfileCode: 'HQ_FIELD_PROFILE',
      featureProfileCode: 'HQ_FEATURE_PROFILE',
      workflowProfileCode: 'KR_SALES_APPROVAL',
      integrationProfileCode: 'HQ_INTEGRATION_PROFILE',
      mapProfileCode: 'KR_DEFAULT',
      features
    })).toBe(true);
  });

  it('keeps an older compatible payload valid while M1 fields are optional', () => {
    expect(isGlobalizationContext({
      locale: 'ko-KR',
      countryCode: 'KR',
      currencyCode: 'KRW',
      timezone: 'Asia/Seoul',
      marketProfileCode: 'KR_SALES',
      workflowProfileCode: 'KR_SALES_APPROVAL',
      mapProfileCode: 'KR_DEFAULT',
      features
    })).toBe(true);
  });

  it('rejects malformed feature/profile values', () => {
    expect(isGlobalizationContext({
      locale: 'ko-KR',
      countryCode: 'KR',
      currencyCode: 'KRW',
      timezone: 'Asia/Seoul',
      marketProfileCode: 'KR_SALES',
      marketTemplateCode: 100,
      features
    })).toBe(false);

    expect(isGlobalizationContext({
      locale: 'ko-KR',
      countryCode: 'KR',
      currencyCode: 'KRW',
      timezone: 'Asia/Seoul',
      marketProfileCode: 'KR_SALES',
      features: { ...features, GPS_CHECKIN: 'yes' }
    })).toBe(false);
  });
});
