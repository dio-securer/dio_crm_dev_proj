import { getMarketProfile, marketFeatureEnabled } from './market-profile';
import { KR_SALES_APPROVAL, getWorkflowProfile } from './workflow-profile';

describe('globalization profiles', () => {
  it('preserves approved KR feature baseline and exposes M1 profile codes', () => {
    const profile = getMarketProfile('KR_SALES');
    expect(profile).toBeDefined();
    expect(profile?.countryCode).toBe('KR');
    expect(profile?.defaultLocale).toBe('ko-KR');
    expect(profile?.currencyCode).toBe('KRW');
    expect(profile?.timezone).toBe('Asia/Seoul');
    expect(profile?.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(profile?.screenProfileCode).toBe('HQ_SCREEN_PROFILE');
    expect(profile?.fieldProfileCode).toBe('HQ_FIELD_PROFILE');
    expect(profile?.featureProfileCode).toBe('HQ_FEATURE_PROFILE');
    expect(profile?.integrationProfileCode).toBe('HQ_INTEGRATION_PROFILE');
    expect(profile && marketFeatureEnabled(profile, 'GPS_CHECKIN')).toBe(true);
    expect(profile && marketFeatureEnabled(profile, 'DIRECT_WORK')).toBe(true);
  });

  it('does not invent an unapproved market profile', () => {
    expect(getMarketProfile('US_SALES')).toBeUndefined();
  });

  it('preserves KR two-step approval workflow', () => {
    const workflow = getWorkflowProfile(KR_SALES_APPROVAL.code);
    expect(workflow?.activityReport.map(x => x.actor)).toEqual(['BRANCH_MANAGER','DIVISION_MANAGER']);
    expect(workflow?.directWork.map(x => x.actor)).toEqual(['BRANCH_MANAGER','DIVISION_MANAGER']);
  });
});
