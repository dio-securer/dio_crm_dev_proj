import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GlobalizationContext, MeContextResponse, MarketFeatureKey } from '@dio-crm/contracts';
import { apiGet } from '../api';
import { changeLocale, i18n } from '../i18n';
import { normalizeLocale } from '../i18n/locale-resolver';
import { isFeatureVisible } from './feature-visibility';
import {
  contextFromProfile,
  profileForTemplate,
  readDemoTemplate,
  writeDemoTemplate,
  type DemoTemplate
} from './demo-template';

type ContextValue = {
  globalization: GlobalizationContext;
  serverResolved: boolean;
  featureEnabled: (key: MarketFeatureKey) => boolean;
  demoTemplate: DemoTemplate;
  setDemoTemplate: (template: DemoTemplate) => void;
};

const initialTemplate = readDemoTemplate();
const initialContext = contextFromProfile(profileForTemplate(initialTemplate));

const GlobalizationContextStore = createContext<ContextValue>({
  globalization: initialContext,
  serverResolved: false,
  featureEnabled: key => isFeatureVisible(initialContext, key),
  demoTemplate: initialTemplate,
  setDemoTemplate: () => undefined
});

export function GlobalizationProvider({ children }: { children: React.ReactNode }) {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('dio_crm_access_token');
  const [demoTemplate, setDemoTemplateState] = useState<DemoTemplate>(initialTemplate);
  const query = useQuery({
    queryKey: ['me-context'],
    queryFn: () => apiGet<MeContextResponse>('/api/me/context'),
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  const demoContext = useMemo(
    () => contextFromProfile(profileForTemplate(demoTemplate), normalizeLocale(i18n.language) || undefined),
    [demoTemplate]
  );
  const globalization = query.data?.globalization ?? demoContext;

  useEffect(() => {
    const locale = normalizeLocale(globalization.locale);
    if (locale) void changeLocale(locale);
  }, [globalization.locale]);

  const setDemoTemplate = (template: DemoTemplate) => {
    writeDemoTemplate(template);
    setDemoTemplateState(template);
  };

  const value = useMemo<ContextValue>(() => ({
    globalization,
    serverResolved: !!query.data,
    featureEnabled: key => isFeatureVisible(globalization, key),
    demoTemplate,
    setDemoTemplate
  }), [globalization, query.data, demoTemplate]);

  return <GlobalizationContextStore.Provider value={value}>{children}</GlobalizationContextStore.Provider>;
}

export function useGlobalization() {
  return useContext(GlobalizationContextStore);
}
