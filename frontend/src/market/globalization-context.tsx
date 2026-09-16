import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GlobalizationContext, MeContextResponse, MarketFeatureKey } from '@dio-crm/contracts';
import { apiGet } from '../api';
import { changeLocale } from '../i18n';
import { normalizeLocale } from '../i18n/locale-resolver';
import { isFeatureVisible } from './feature-visibility';
import { KR_MARKET_PROFILE } from './profiles/KR';
import { GLOBAL_EXECUTIVE_DEMO_CONTEXT, isGlobalExecutiveDemoMode } from '../demo/demo-mode';

const fallbackContext: GlobalizationContext = {
  locale: KR_MARKET_PROFILE.defaultLocale,
  countryCode: KR_MARKET_PROFILE.countryCode,
  currencyCode: KR_MARKET_PROFILE.currencyCode,
  timezone: KR_MARKET_PROFILE.timezone,
  marketProfileCode: KR_MARKET_PROFILE.code,
  marketTemplateCode: KR_MARKET_PROFILE.marketTemplateCode,
  screenProfileCode: KR_MARKET_PROFILE.screenProfileCode,
  fieldProfileCode: KR_MARKET_PROFILE.fieldProfileCode,
  featureProfileCode: KR_MARKET_PROFILE.featureProfileCode,
  workflowProfileCode: KR_MARKET_PROFILE.workflowProfileCode,
  integrationProfileCode: KR_MARKET_PROFILE.integrationProfileCode,
  mapProfileCode: KR_MARKET_PROFILE.mapProfileCode,
  features: KR_MARKET_PROFILE.features
};

type ContextValue = {
  globalization: GlobalizationContext;
  serverResolved: boolean;
  featureEnabled: (key: MarketFeatureKey) => boolean;
};

const GlobalizationContextStore = createContext<ContextValue>({
  globalization: fallbackContext,
  serverResolved: false,
  featureEnabled: key => isFeatureVisible(fallbackContext, key)
});

export function GlobalizationProvider({ children }: { children: React.ReactNode }) {
  const demoMode = isGlobalExecutiveDemoMode();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('dio_crm_access_token');
  const query = useQuery({
    queryKey: ['me-context'],
    queryFn: () => apiGet<MeContextResponse>('/api/me/context'),
    enabled: hasToken && !demoMode,
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  const globalization = demoMode ? GLOBAL_EXECUTIVE_DEMO_CONTEXT : query.data?.globalization ?? fallbackContext;

  useEffect(() => {
    const locale = normalizeLocale(globalization.locale);
    if (locale) void changeLocale(locale);
  }, [globalization.locale]);

  const value = useMemo<ContextValue>(() => ({
    globalization,
    serverResolved: demoMode || !!query.data,
    featureEnabled: key => isFeatureVisible(globalization, key)
  }), [demoMode, globalization, query.data]);

  return <GlobalizationContextStore.Provider value={value}>{children}</GlobalizationContextStore.Provider>;
}

export function useGlobalization() {
  return useContext(GlobalizationContextStore);
}
