import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { GlobalizationContext, MarketFeatureKey, MeContextResponse } from '@dio-crm/contracts';
import { DatabaseService } from '../database/database.service';
import type { JwtPayload } from '../security/security';
import { featureDecision, getFeatureProfile, runtimeFeatureMap } from './feature-profile';
import { getMarketProfile } from './market-profile';

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

  async resolveCompany(companyId: number, userId?: number): Promise<GlobalizationContext> {
    const result = await this.db.query<ContextRow>(`
      SELECT TOP 1 c.country_code, c.default_locale, c.default_currency, c.default_timezone,
             c.market_profile_code, c.workflow_profile_code, c.map_profile_code,
             u.preferred_locale, u.timezone_override
      FROM dbo.crm_company c
      LEFT JOIN dbo.crm_user u ON u.company_id=c.company_id AND u.user_id=@userId AND u.is_active=1 AND u.deleted_yn=0
      WHERE c.company_id=@companyId AND c.is_active=1`,
      { userId: userId ?? null, companyId });
    const row = result.recordset[0];
    if (!row) throw new ForbiddenException('COMPANY_CONTEXT_NOT_FOUND');

    const profile = getMarketProfile(row.market_profile_code);
    if (!profile) throw new InternalServerErrorException('INVALID_MARKET_PROFILE');
    if (!profile.featureProfileCode) throw new InternalServerErrorException('INVALID_FEATURE_PROFILE');

    let features: Record<MarketFeatureKey, boolean>;
    try {
      features = runtimeFeatureMap(profile.featureProfileCode);
    } catch {
      throw new InternalServerErrorException('INVALID_FEATURE_PROFILE');
    }

    return {
      locale: row.preferred_locale || row.default_locale || profile.defaultLocale,
      countryCode: row.country_code || profile.countryCode,
      currencyCode: row.default_currency || profile.currencyCode,
      timezone: row.timezone_override || row.default_timezone || profile.timezone,
      marketProfileCode: row.market_profile_code,
      marketTemplateCode: profile.marketTemplateCode,
      screenProfileCode: profile.screenProfileCode,
      fieldProfileCode: profile.fieldProfileCode,
      featureProfileCode: profile.featureProfileCode,
      workflowProfileCode: row.workflow_profile_code || profile.workflowProfileCode,
      integrationProfileCode: profile.integrationProfileCode,
      mapProfileCode: row.map_profile_code || profile.mapProfileCode,
      features
    };
  }

  async resolveForUser(user: JwtPayload): Promise<MeContextResponse> {
    const globalization = await this.resolveCompany(user.companyId, user.sub);
    return {
      user: { userId: user.sub, publicId: user.publicId, name: user.name, companyId: user.companyId },
      globalization
    };
  }

  async assertFeature(user: JwtPayload, feature: MarketFeatureKey) {
    const context = await this.resolveCompany(user.companyId, user.sub);
    const code = context.featureProfileCode;
    const profile = code ? getFeatureProfile(code) : undefined;
    if (!profile || profile.status !== 'ACTIVE' || featureDecision(profile, feature) !== true) {
      throw new ForbiddenException('FEATURE_NOT_AVAILABLE_FOR_MARKET');
    }
  }
}
