import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import type { MarketFeatureKey } from '@dio-crm/contracts';
import type { AuthenticatedRequest } from '../security/security';
import { GlobalizationService } from './globalization.service';

export const MARKET_FEATURE_KEY = 'marketFeature';
export const RequireMarketFeature = (feature: MarketFeatureKey) => SetMetadata(MARKET_FEATURE_KEY, feature);

@Injectable()
export class MarketFeatureGuard implements CanActivate {
  constructor(private readonly globalization: GlobalizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = Reflect.getMetadata(MARKET_FEATURE_KEY, context.getHandler())
      ?? Reflect.getMetadata(MARKET_FEATURE_KEY, context.getClass());
    if (!feature) return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.authUser) return false;
    await this.globalization.assertFeature(req.authUser, feature as MarketFeatureKey);
    return true;
  }
}
