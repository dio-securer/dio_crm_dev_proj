import { describe, expect, it } from 'vitest';
import { getCountryProfile, resolveCountryTemplate } from './country-profile-resolver';
import { getMarketTemplate } from './template-registry';

describe('country profile foundation', () => {
  it('resolves KR to HQ and preserves approved runtime market profile', () => {
    const country = getCountryProfile('KR');
    expect(country?.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(country?.marketProfileCode).toBe('KR_SALES');
    expect(resolveCountryTemplate('KR')?.template.code).toBe('HQ_TEMPLATE');
  });

  it('resolves US and MX to the GLOBAL baseline only', () => {
    for (const code of ['US', 'MX']) {
      const country = getCountryProfile(code);
      expect(country?.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
      expect(country?.status).toBe('BASELINE_ONLY');
      expect(country?.marketProfileCode).toBeUndefined();
      expect(resolveCountryTemplate(code)?.template.code).toBe('GLOBAL_TEMPLATE');
    }
  });

  it('registers both template families', () => {
    expect(getMarketTemplate('HQ_TEMPLATE')?.fieldProfileCode).toBe('HQ_FIELD_PROFILE');
    expect(getMarketTemplate('GLOBAL_TEMPLATE')?.fieldProfileCode).toBe('GLOBAL_FIELD_PROFILE');
  });

  it('does not map countries that have not been analysed yet', () => {
    for (const code of ['IN', 'PT', 'TR']) expect(getCountryProfile(code)).toBeUndefined();
  });
});
