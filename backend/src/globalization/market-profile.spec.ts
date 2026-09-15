import { GLOBAL_FEATURE_PROFILE, HQ_FEATURE_PROFILE, featureDecision, runtimeFeatureMap } from './feature-profile';
import { getMarketProfile } from './market-profile';
import { GLOBAL_SALES_APPROVAL_BASELINE, KR_SALES_APPROVAL, getWorkflowProfile } from './workflow-profile';

describe('globalization profiles', () => {
  it('preserves approved KR profile codes and resolves features from HQ feature profile', () => {
    const profile = getMarketProfile('KR_SALES');
    expect(profile).toBeDefined();
    expect(profile?.countryCode).toBe('KR');
    expect(profile?.defaultLocale).toBe('ko-KR');
    expect(profile?.currencyCode).toBe('KRW');
    expect(profile?.timezone).toBe('Asia/Seoul');
    expect(profile?.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(profile?.screenProfileCode).toBe('HQ_SCREEN_PROFILE');
    expect(profile?.fieldProfileCode).toBe('HQ_FIELD_PROFILE');
    expect(profile?.featureProfileCode).toBe(HQ_FEATURE_PROFILE.code);
    expect(profile?.integrationProfileCode).toBe('HQ_INTEGRATION_PROFILE');

    const features = runtimeFeatureMap(HQ_FEATURE_PROFILE.code);
    expect(features.GPS_CHECKIN).toBe(true);
    expect(features.DIRECT_WORK).toBe(true);
  });

  it('does not invent an unapproved market profile', () => {
    expect(getMarketProfile('US_SALES')).toBeUndefined();
  });

  it('keeps GLOBAL feature decisions as baseline-only where evidence is incomplete', () => {
    expect(GLOBAL_FEATURE_PROFILE.status).toBe('BASELINE_ONLY');
    expect(featureDecision(GLOBAL_FEATURE_PROFILE, 'DIRECT_WORK')).toBe(false);
    expect(featureDecision(GLOBAL_FEATURE_PROFILE, 'GPS_CHECKIN')).toBe(true);
    expect(featureDecision(GLOBAL_FEATURE_PROFILE, 'MONTHLY_STATEMENT')).toBe('UNCONFIRMED');
    expect(() => runtimeFeatureMap(GLOBAL_FEATURE_PROFILE.code)).toThrow('FEATURE_PROFILE_NOT_ACTIVE');
  });

  it('preserves KR two-step approval workflow', () => {
    const workflow = getWorkflowProfile(KR_SALES_APPROVAL.code);
    expect(workflow?.status).toBe('ACTIVE');
    expect(workflow?.activityReport.map(x => x.actor)).toEqual(['BRANCH_MANAGER', 'DIVISION_MANAGER']);
    expect(workflow?.directWork.map(x => x.actor)).toEqual(['BRANCH_MANAGER', 'DIVISION_MANAGER']);
  });

  it('records GLOBAL approval requirement without inventing approver roles', () => {
    const workflow = getWorkflowProfile(GLOBAL_SALES_APPROVAL_BASELINE.code);
    expect(workflow?.status).toBe('BASELINE_ONLY');
    expect(workflow?.activityReportApprovalRequired).toBe(true);
    expect(workflow?.activityReport).toEqual([]);
    expect(workflow?.directWorkEnabled).toBe(false);
    expect(workflow?.gaps).toContain('ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED');
  });
});
