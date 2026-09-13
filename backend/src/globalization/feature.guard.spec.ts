import { MarketFeatureGuard, RequireMarketFeature, MARKET_FEATURE_KEY } from './feature.guard';

describe('MarketFeatureGuard', () => {
  it('blocks requests without an authenticated user when a market feature is required', async () => {
    const globalization = { assertFeature: jest.fn() } as any;
    const guard = new MarketFeatureGuard(globalization);
    const handler = () => undefined;
    Reflect.defineMetadata(MARKET_FEATURE_KEY, 'DIRECT_WORK', handler);
    const context = {
      getHandler: () => handler,
      getClass: () => class Test {},
      switchToHttp: () => ({ getRequest: () => ({}) })
    } as any;
    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(globalization.assertFeature).not.toHaveBeenCalled();
  });

  it('enforces the server-side market feature for authenticated requests', async () => {
    const globalization = { assertFeature: jest.fn().mockResolvedValue(undefined) } as any;
    const guard = new MarketFeatureGuard(globalization);
    const handler = () => undefined;
    Reflect.defineMetadata(MARKET_FEATURE_KEY, 'GPS_CHECKIN', handler);
    const authUser = { sub:1, companyId:1 };
    const context = {
      getHandler: () => handler,
      getClass: () => class Test {},
      switchToHttp: () => ({ getRequest: () => ({ authUser }) })
    } as any;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(globalization.assertFeature).toHaveBeenCalledWith(authUser, 'GPS_CHECKIN');
  });

  it('does not enforce when no market feature metadata exists', async () => {
    const globalization = { assertFeature: jest.fn() } as any;
    const guard = new MarketFeatureGuard(globalization);
    const context = { getHandler:()=>()=>undefined, getClass:()=>class Test {} } as any;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
