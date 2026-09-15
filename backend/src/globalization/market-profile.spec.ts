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

  it('registers US and MX runtime market profiles without hardcoded operational defaults', () => {
    for (const [code, country] of [['US_SALES', 'US'], ['MX_SALES', 'MX']] as const) {
      const profile = getMarketProfile(code);
      expect(profile?.countryCode).toBe(country);
      expect(profile?.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
      expect(profile?.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
      expect(profile?.fieldProfileCode).toBe('GLOBAL_FIELD_PROFILE');
      expect(profile?.featureProfileCode).toBe('GLOBAL_FEATURE_PROFILE');
      expect(profile?.workflowProfileCode).toBe('GLOBAL_SALES_APPROVAL_BASELINE');
      expect(profile?.integrationProfileCode).toBe('GLOBAL_INTEGRATION_PROFILE');
      expect(profile?.defaultLocale).toBeUndefined();
      expect(profile?.currencyCode).toBeUndefined();
      expect(profile?.timezone).toBeUndefined();
      expect(profile?.mapProfileCode).toBeUndefined();
      expect(profile?.requireCompanyOperationalConfig).toBe(true);
    }
  });

  it('uses GLOBAL feature evidence in confirmed-only mode and fails closed for unresolved features', () => {
    expect(GLOBAL_FEATURE_PROFILE.status).toBe('ACTIVE_CONFIRMED_ONLY');
    expect(featureDecision(GLOBAL_FEATURE_PROFILE, 'DIRECT_WORK')).toBe(false);
    expect(featureDecision(GLOBAL_FEATURE_PROFILE, 'GPS_CHECKIN')).toBe(true);
    expect(featureDecision(GLOBAL_FEATURE_PROFILE, 'MONTHLY_STATEMENT')).toBe('UNCONFIRMED');

    const features = runtimeFeatureMap(GLOBAL_FEATURE_PROFILE.code);
    expect(features.GPS_CHECKIN).toBe(true);
    expect(features.ACTIVITY_APPROVAL).toBe(true);
    expect(features.ERP_ACCOUNT_APPROVAL).toBe(true);
    expect(features.DIRECT_WORK).toBe(false);
    expect(features.HIRA_IMPORT).toBe(false);
    expect(features.MONTHLY_STATEMENT).toBe(false);
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
