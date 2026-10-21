import type { GlobalizationContext } from '@dio-crm/contracts';
import type { MarketProfile } from './types';
import { KR_MARKET_PROFILE } from './profiles/KR';
import { US_MARKET_PROFILE } from './profiles/US';

export type DemoTemplate = 'HQ' | 'GLOBAL';

export const DEMO_TEMPLATE_STORAGE_KEY = 'dio_crm:demo:template';

export function profileForTemplate(template: DemoTemplate): MarketProfile {
  return template === 'GLOBAL' ? US_MARKET_PROFILE : KR_MARKET_PROFILE;
}

export function contextFromProfile(profile: MarketProfile, locale?: string): GlobalizationContext {
  return {
    locale: locale || profile.defaultLocale,
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    timezone: profile.timezone,
    marketProfileCode: profile.code,
    marketTemplateCode: profile.marketTemplateCode,
    screenProfileCode: profile.screenProfileCode,
    fieldProfileCode: profile.fieldProfileCode,
    featureProfileCode: profile.featureProfileCode,
    workflowProfileCode: profile.workflowProfileCode,
    integrationProfileCode: profile.integrationProfileCode,
    mapProfileCode: profile.mapProfileCode,
    features: profile.features
  };
}

export function readDemoTemplate(): DemoTemplate {
  if (typeof window === 'undefined') return 'GLOBAL';
  const query = new URLSearchParams(window.location.search).get('template');
  if (query === 'HQ' || query === 'GLOBAL') {
    window.localStorage.setItem(DEMO_TEMPLATE_STORAGE_KEY, query);
    return query;
  }
  const stored = window.localStorage.getItem(DEMO_TEMPLATE_STORAGE_KEY);
  if (stored === 'HQ' || stored === 'GLOBAL') return stored;
  return 'GLOBAL';
}

export function writeDemoTemplate(template: DemoTemplate) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_TEMPLATE_STORAGE_KEY, template);
}
