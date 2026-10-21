import { describe, expect, it } from 'vitest';
import { APP_ROUTES } from './route-config';
import { GLOBAL_SCREEN_PROFILE, HQ_SCREEN_PROFILE } from './screen-profile';

const hqSlots = [
  'lead',
  'account',
  'contact',
  'activity',
  'activityReport',
  'directWork',
  'opportunity',
  'pipeline',
  'contract',
  'order',
  'fulfillment',
  'ledger',
  'account360',
  'analytics',
  'ops'
] as const;

const globalPaths = [
  '/',
  '/accounts',
  '/contacts',
  '/activities',
  '/activity-reports',
  '/opportunities',
  '/contracts',
  '/orders'
];

describe('M10 multi-market route regression', () => {
  it('keeps every HQ route slot mapped to an HQ screen', () => {
    expect(Object.keys(HQ_SCREEN_PROFILE.screens)).toEqual(hqSlots);
    for (const slot of hqSlots) {
      expect(HQ_SCREEN_PROFILE.screens[slot]).toMatch(/^HQ_/);
    }
  });

  it('keeps the approved GLOBAL A+B navigation scope limited to eight routes', () => {
    const visible = APP_ROUTES
      .filter(route => Boolean(GLOBAL_SCREEN_PROFILE.screens[route.slot]))
      .map(route => route.path);

    expect(visible).toEqual(globalPaths);
    expect(GLOBAL_SCREEN_PROFILE.screens.directWork).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.pipeline).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.fulfillment).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.ledger).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.account360).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.analytics).toBeUndefined();
    expect(GLOBAL_SCREEN_PROFILE.screens.ops).toBeUndefined();
  });

  it('keeps route paths and screen slots unique', () => {
    const paths = APP_ROUTES.map(route => route.path);
    const slots = APP_ROUTES.map(route => route.slot);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('keeps GLOBAL mobile primary operational routes within the five-item bottom navigation capacity', () => {
    const mobilePrimary = APP_ROUTES.filter(
      route => route.mobilePrimary && Boolean(GLOBAL_SCREEN_PROFILE.screens[route.slot])
    );
    expect(mobilePrimary.map(route => route.path)).toEqual([
      '/',
      '/accounts',
      '/activities'
    ]);
    expect(mobilePrimary.length).toBeLessThanOrEqual(5);
  });
});
