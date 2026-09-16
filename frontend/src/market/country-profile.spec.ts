import { describe, expect, it } from 'vitest';
import { getScreenProfile } from '../app/screen-profile';
import { getCountryProfile, resolveCountryTemplate } from './country-profile-resolver';
import { getMarketTemplate } from './template-registry';

describe('country profile foundation', () => {
  it('resolves KR to HQ and preserves approved runtime market profile', () => {
    const country = getCountryProfile('KR');
    expect(country?.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(country?.marketProfileCode).toBe('KR_SALES');
    expect(resolveCountryTemplate('KR')?.template.code).toBe('HQ_TEMPLATE');
  });

  it('connects US and MX to GLOBAL runtime profiles with explicit unresolved gaps', () => {
    const expected = { US: 'US_SALES', MX: 'MX_SALES' } as const;
    for (const code of ['US', 'MX'] as const) {
      const country = getCountryProfile(code);
      const resolved = resolveCountryTemplate(code);
      expect(country?.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
      expect(country?.status).toBe('ACTIVE_WITH_GAPS');
      expect(country?.marketProfileCode).toBe(expected[code]);
      expect(country?.gaps).toContain('LOCALE_CURRENCY_TIMEZONE_REQUIRE_COMPANY_CONFIG');
      expect(country?.gaps).toContain('ACTIVITY_REPORT_APPROVER_ORG_UNCONFIRMED');
      expect(resolved?.template.code).toBe('GLOBAL_TEMPLATE');
      expect(resolved?.template.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
      expect(resolved?.template.fieldProfileCode).toBe('GLOBAL_FIELD_PROFILE');
      expect(resolved?.template.featureProfileCode).toBe('GLOBAL_FEATURE_PROFILE');
      expect(resolved?.template.integrationProfileCode).toBe('GLOBAL_INTEGRATION_PROFILE');
    }
  });

  it('exposes the approved A+B GLOBAL navigation screen slots for US/MX', () => {
    const screen = getScreenProfile('GLOBAL_SCREEN_PROFILE');
    expect(screen?.screens).toEqual({
      lead: 'GLOBAL_LEAD',
      account: 'GLOBAL_ACCOUNT',
      contact: 'GLOBAL_CONTACT',
      activity: 'GLOBAL_ACTIVITY_MAP',
      activityReport: 'GLOBAL_ACTIVITY_REPORT',
      opportunity: 'GLOBAL_OPPORTUNITY',
      contract: 'GLOBAL_CONTRACT',
      order: 'GLOBAL_ORDER'
    });
    expect(screen?.screens.directWork).toBeUndefined();
    expect(screen?.screens.ledger).toBeUndefined();
  });

  it('registers both template families', () => {
    expect(getMarketTemplate('HQ_TEMPLATE')?.fieldProfileCode).toBe('HQ_FIELD_PROFILE');
    expect(getMarketTemplate('GLOBAL_TEMPLATE')?.fieldProfileCode).toBe('GLOBAL_FIELD_PROFILE');
  });

  it('does not map countries that have not been analysed yet', () => {
    for (const code of ['IN', 'PT', 'TR']) expect(getCountryProfile(code)).toBeUndefined();
  });
});
