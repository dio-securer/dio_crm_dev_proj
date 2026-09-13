import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GlobalizationContext, MeContextResponse, MarketFeatureKey } from '@dio-crm/contracts';
import { apiGet } from '../api';
import { changeLocale } from '../i18n';
import { normalizeLocale } from '../i18n/locale-resolver';
import { KR_MARKET_PROFILE } from './profiles/KR';

const fallbackContext: GlobalizationContext = {
  locale: KR_MARKET_PROFILE.defaultLocale,
  countryCode: KR_MARKET_PROFILE.countryCode,
  currencyCode: KR_MARKET_PROFILE.currencyCode,
  timezone: KR_MARKET_PROFILE.timezone,
  marketProfileCode: KR_MARKET_PROFILE.code,
  workflowProfileCode: KR_MARKET_PROFILE.workflowProfileCode,
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
  featureEnabled: key => fallbackContext.features[key] === true
});

export function GlobalizationProvider({ children }: { children: React.ReactNode }) {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('dio_crm_access_token');
  const query = useQuery({
    queryKey: ['me-context'],
    queryFn: () => apiGet<MeContextResponse>('/api/me/context'),
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  const globalization = query.data?.globalization ?? fallbackContext;

  useEffect(() => {
    const locale = normalizeLocale(globalization.locale);
    if (locale) void changeLocale(locale);
  }, [globalization.locale]);

  const value = useMemo<ContextValue>(() => ({
    globalization,
    serverResolved: !!query.data,
    featureEnabled: key => globalization.features[key] === true
  }), [globalization, query.data]);

  return <GlobalizationContextStore.Provider value={value}>{children}</GlobalizationContextStore.Provider>;
}

export function useGlobalization() {
  return useContext(GlobalizationContextStore);
}
