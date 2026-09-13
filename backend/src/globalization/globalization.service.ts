import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { GlobalizationContext, MarketFeatureKey, MeContextResponse } from '@dio-crm/contracts';
import { DatabaseService } from '../database/database.service';
import type { JwtPayload } from '../security/security';
import { getMarketProfile, marketFeatureEnabled } from './market-profile';

type ContextRow = {
  country_code: string;
  default_locale: string;
  default_currency: string;
  default_timezone: string;
  market_profile_code: string;
  workflow_profile_code?: string | null;
  map_profile_code?: string | null;
  preferred_locale?: string | null;
  timezone_override?: string | null;
};

@Injectable()
export class GlobalizationService {
  constructor(private readonly db: DatabaseService) {}

  async resolveForUser(user: JwtPayload): Promise<MeContextResponse> {
    const result = await this.db.query<ContextRow>(`
      SELECT c.country_code, c.default_locale, c.default_currency, c.default_timezone,
             c.market_profile_code, c.workflow_profile_code, c.map_profile_code,
             u.preferred_locale, u.timezone_override
      FROM dbo.crm_user u
      JOIN dbo.crm_company c ON c.company_id = u.company_id
      WHERE u.user_id=@userId AND u.company_id=@companyId
        AND u.is_active=1 AND u.deleted_yn=0 AND c.is_active=1`,
      { userId: user.sub, companyId: user.companyId });
    const row = result.recordset[0];
    if (!row) throw new ForbiddenException('USER_COMPANY_CONTEXT_NOT_FOUND');

    const profile = getMarketProfile(row.market_profile_code);
    if (!profile) throw new InternalServerErrorException('INVALID_MARKET_PROFILE');

    const globalization: GlobalizationContext = {
      locale: row.preferred_locale || row.default_locale || profile.defaultLocale,
      countryCode: row.country_code || profile.countryCode,
      currencyCode: row.default_currency || profile.currencyCode,
      timezone: row.timezone_override || row.default_timezone || profile.timezone,
      marketProfileCode: row.market_profile_code,
      workflowProfileCode: row.workflow_profile_code || profile.workflowProfileCode,
      mapProfileCode: row.map_profile_code || profile.mapProfileCode,
      features: profile.features
    };
    return {
      user: { userId: user.sub, publicId: user.publicId, name: user.name, companyId: user.companyId },
      globalization
    };
  }

  async assertFeature(user: JwtPayload, feature: MarketFeatureKey) {
    const context = await this.resolveForUser(user);
    const profile = getMarketProfile(context.globalization.marketProfileCode);
    if (!profile || !marketFeatureEnabled(profile, feature)) {
      throw new ForbiddenException('FEATURE_NOT_AVAILABLE_FOR_MARKET');
    }
  }
}
