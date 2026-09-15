import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { GlobalizationService } from './globalization.service';

describe('GlobalizationService', () => {
  const base = {
    country_code:'KR', default_locale:'ko-KR', default_currency:'KRW', default_timezone:'Asia/Seoul',
    market_profile_code:'KR_SALES', workflow_profile_code:'KR_SALES_APPROVAL', map_profile_code:'KR_DEFAULT',
    preferred_locale:null, timezone_override:null
  };

  function createService(row: any) {
    const db = { query: jest.fn().mockResolvedValue({ recordset: row ? [row] : [] }) } as any;
    return { service:new GlobalizationService(db), db };
  }

  it('uses user locale/timezone overrides without accepting a client country switch', async () => {
    const { service, db } = createService({ ...base, preferred_locale:'en-US', timezone_override:'America/New_York' });
    const context = await service.resolveCompany(1, 10);
    expect(context.locale).toBe('en-US');
    expect(context.countryCode).toBe('KR');
    expect(context.timezone).toBe('America/New_York');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('c.company_id=@companyId'), expect.objectContaining({ companyId:1, userId:10 }));
  });

  it('resolves the approved KR profile codes and HQ feature profile', async () => {
    const { service } = createService(base);
    const context = await service.resolveCompany(1, 10);
    expect(context.marketTemplateCode).toBe('HQ_TEMPLATE');
    expect(context.screenProfileCode).toBe('HQ_SCREEN_PROFILE');
    expect(context.fieldProfileCode).toBe('HQ_FIELD_PROFILE');
    expect(context.featureProfileCode).toBe('HQ_FEATURE_PROFILE');
    expect(context.workflowProfileCode).toBe('KR_SALES_APPROVAL');
    expect(context.integrationProfileCode).toBe('HQ_INTEGRATION_PROFILE');
    expect(context.mapProfileCode).toBe('KR_DEFAULT');
    expect(context.features.GPS_CHECKIN).toBe(true);
    expect(context.features.DIRECT_WORK).toBe(true);
  });

  it('allows backend feature guard checks for an enabled HQ feature', async () => {
    const { service } = createService(base);
    await expect(service.assertFeature({ companyId:1, sub:10 } as any, 'GPS_CHECKIN')).resolves.toBeUndefined();
  });

  it('falls back to the approved KR profile default locale', async () => {
    const { service } = createService({ ...base, default_locale:'', preferred_locale:null });
    const context = await service.resolveCompany(1, 10);
    expect(context.locale).toBe('ko-KR');
  });

  it.each([
    ['US', 'US_SALES'],
    ['MX', 'MX_SALES']
  ])('resolves %s login context to the GLOBAL template using company-configured operational values', async (countryCode, marketProfileCode) => {
    const row = {
      country_code: countryCode,
      default_locale: `${countryCode.toLowerCase()}-configured-locale`,
      default_currency: `${countryCode}_CFG`,
      default_timezone: `${countryCode}/Configured_Timezone`,
      market_profile_code: marketProfileCode,
      workflow_profile_code: null,
      map_profile_code: `${countryCode}_CONFIGURED_MAP`,
      preferred_locale: null,
      timezone_override: null
    };
    const { service } = createService(row);
    const context = await service.resolveCompany(2, 20);

    expect(context.countryCode).toBe(countryCode);
    expect(context.locale).toBe(row.default_locale);
    expect(context.currencyCode).toBe(row.default_currency);
    expect(context.timezone).toBe(row.default_timezone);
    expect(context.marketProfileCode).toBe(marketProfileCode);
    expect(context.marketTemplateCode).toBe('GLOBAL_TEMPLATE');
    expect(context.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
    expect(context.fieldProfileCode).toBe('GLOBAL_FIELD_PROFILE');
    expect(context.featureProfileCode).toBe('GLOBAL_FEATURE_PROFILE');
    expect(context.workflowProfileCode).toBe('GLOBAL_SALES_APPROVAL_BASELINE');
    expect(context.integrationProfileCode).toBe('GLOBAL_INTEGRATION_PROFILE');
    expect(context.mapProfileCode).toBe(row.map_profile_code);
    expect(context.features.GPS_CHECKIN).toBe(true);
    expect(context.features.ACTIVITY_APPROVAL).toBe(true);
    expect(context.features.ERP_ACCOUNT_APPROVAL).toBe(true);
    expect(context.features.DIRECT_WORK).toBe(false);
    expect(context.features.HIRA_IMPORT).toBe(false);
    expect(context.features.MONTHLY_STATEMENT).toBe(false);
  });

  it('allows a confirmed GLOBAL feature and denies an unresolved GLOBAL feature', async () => {
    const globalRow = {
      country_code:'US', default_locale:'configured-locale', default_currency:'CFG', default_timezone:'Configured/Timezone',
      market_profile_code:'US_SALES', workflow_profile_code:null, map_profile_code:'CONFIGURED_MAP',
      preferred_locale:null, timezone_override:null
    };
    const { service } = createService(globalRow);
    await expect(service.assertFeature({ companyId:2, sub:20 } as any, 'GPS_CHECKIN')).resolves.toBeUndefined();
    await expect(service.assertFeature({ companyId:2, sub:20 } as any, 'HIRA_IMPORT')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires GLOBAL operational locale/currency/timezone/map values from company configuration', async () => {
    const { service } = createService({
      country_code:'US', default_locale:'', default_currency:'', default_timezone:'',
      market_profile_code:'US_SALES', workflow_profile_code:null, map_profile_code:null,
      preferred_locale:null, timezone_override:null
    });
    await expect(service.resolveCompany(2,20)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects country and market-profile mismatches', async () => {
    const { service } = createService({ ...base, country_code:'US', market_profile_code:'MX_SALES' });
    await expect(service.resolveCompany(2,20)).rejects.toThrow('MARKET_PROFILE_COUNTRY_MISMATCH');
  });

  it('rejects an unknown market profile', async () => {
    const { service } = createService({ ...base, market_profile_code:'UNAPPROVED_MARKET' });
    await expect(service.resolveCompany(1,10)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects a missing company context', async () => {
    const { service } = createService(null);
    await expect(service.resolveCompany(999,10)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
