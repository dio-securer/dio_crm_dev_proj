import { describe, expect, it } from 'vitest';
import { GLOBAL_SCREEN_PROFILE } from '../app/screen-profile';
import { APP_ROUTES, filterAppRoutes } from '../app/route-config';
import { contextFromProfile, profileForTemplate } from './demo-template';
import { US_MARKET_PROFILE } from './profiles/US';

describe('demo GLOBAL template', () => {
  it('maps GLOBAL demo to US_SALES / GLOBAL_SCREEN_PROFILE', () => {
    const profile = profileForTemplate('GLOBAL');
    expect(profile).toBe(US_MARKET_PROFILE);
    expect(profile.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
    expect(profile.features.DIRECT_WORK).toBe(false);
    expect(profile.features.HIRA_IMPORT).toBe(false);
  });

  it('builds a globalization context that resolves GLOBAL screens', () => {
    const context = contextFromProfile(US_MARKET_PROFILE, 'ko-KR');
    expect(context.locale).toBe('ko-KR');
    expect(context.countryCode).toBe('US');
    expect(context.screenProfileCode).toBe('GLOBAL_SCREEN_PROFILE');
  });

  it('limits unauthenticated GLOBAL navigation to the eight approved A+B routes', () => {
    const context = contextFromProfile(US_MARKET_PROFILE);
    const visible = filterAppRoutes(GLOBAL_SCREEN_PROFILE.screens, key => context.features[key] === true);
    expect(visible.map(route => route.path)).toEqual([
      '/',
      '/accounts',
      '/contacts',
      '/activities',
      '/activity-reports',
      '/opportunities',
      '/contracts',
      '/orders'
    ]);
    expect(visible.some(route => route.slot === 'directWork')).toBe(false);
    expect(APP_ROUTES.some(route => route.slot === 'directWork')).toBe(true);
  });
});
