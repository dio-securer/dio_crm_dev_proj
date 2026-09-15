import { getCountryProfile } from './country-profile';
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

  it('maps US and MX to GLOBAL without inventing runtime market profiles', () => {
    for (const countryCode of ['US', 'MX']) {
      const profile = getCountryProfile(countryCode);
      expect(profile?.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
      expect(profile?.status).toBe('BASELINE_ONLY');
      expect(profile?.marketProfileCode).toBeUndefined();
      expect(resolveCountryTemplate(countryCode)?.template.code).toBe('GLOBAL_TEMPLATE');
    }
  });

  it('does not infer unapproved countries', () => {
    for (const countryCode of ['IN', 'PT', 'TR']) {
      expect(getCountryProfile(countryCode)).toBeUndefined();
      expect(resolveCountryTemplate(countryCode)).toBeUndefined();
    }
  });
});
