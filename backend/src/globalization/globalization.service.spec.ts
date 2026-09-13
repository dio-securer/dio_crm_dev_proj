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

  it('falls back to the approved KR profile default locale', async () => {
    const { service } = createService({ ...base, default_locale:'', preferred_locale:null });
    const context = await service.resolveCompany(1, 10);
    expect(context.locale).toBe('ko-KR');
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
