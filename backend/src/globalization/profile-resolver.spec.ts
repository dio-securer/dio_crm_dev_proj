import { getCountryProfile } from './country-profile';
import { getMarketProfile } from './market-profile';
import { getMarketTemplate } from './market-template';
import { resolveCountryTemplate, resolveMarketTemplateCode } from './profile-resolver';

describe('multi-market template foundation', () => {
  it('registers HQ and GLOBAL templates', () => {
    expect(getMarketTemplate('HQ_TEMPLATE')?.screenProfileCode).toBe('HQ_SCREEN_PROFILE');
    expect(getMarketTemplate('GLOBAL_TEMPLATE')?.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
  });

  it('keeps KR on the HQ template and existing market profile', () => {
    const profile = getCountryProfile('KR');
    expect(profile?.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(profile?.marketProfileCode).toBe('KR_SALES');
    expect(profile?.status).toBe('ACTIVE');
    expect(resolveMarketTemplateCode('kr')).toBe('HQ_TEMPLATE');
  });

  it('connects US and MX to GLOBAL runtime market profiles while retaining explicit gaps', () => {
    const expected = { US: 'US_SALES', MX: 'MX_SALES' } as const;
    for (const countryCode of ['US', 'MX'] as const) {
      const country = getCountryProfile(countryCode);
      expect(country?.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
      expect(country?.status).toBe('ACTIVE_WITH_GAPS');
      expect(country?.marketProfileCode).toBe(expected[countryCode]);
      expect(country?.gaps).toContain('ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED');
      expect(resolveCountryTemplate(countryCode)?.template.code).toBe('GLOBAL_TEMPLATE');

      const market = getMarketProfile(expected[countryCode]);
      expect(market?.countryCode).toBe(countryCode);
      expect(market?.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
      expect(market?.fieldProfileCode).toBe('GLOBAL_FIELD_PROFILE');
      expect(market?.featureProfileCode).toBe('GLOBAL_FEATURE_PROFILE');
      expect(market?.workflowProfileCode).toBe('GLOBAL_SALES_APPROVAL_BASELINE');
      expect(market?.integrationProfileCode).toBe('GLOBAL_INTEGRATION_PROFILE');
      expect(market?.requireCompanyOperationalConfig).toBe(true);
    }
  });

  it('does not infer unapproved countries', () => {
    for (const countryCode of ['IN', 'PT', 'TR']) {
      expect(getCountryProfile(countryCode)).toBeUndefined();
      expect(resolveCountryTemplate(countryCode)).toBeUndefined();
    }
  });
});
