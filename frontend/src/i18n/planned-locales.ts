/** Locales with resource stubs; UI may expose later. Fallback chain: locale → en-US → ko-KR */
export const PLANNED_LOCALES = ['es-MX', 'pt-PT', 'tr-TR', 'hi-IN'] as const;
export type PlannedLocale = (typeof PLANNED_LOCALES)[number];

export const LOCALE_LABEL_KEYS: Record<string, string> = {
  'ko-KR': 'locale.ko-KR',
  'en-US': 'locale.en-US',
  'es-MX': 'locale.es-MX',
  'pt-PT': 'locale.pt-PT',
  'tr-TR': 'locale.tr-TR',
  'hi-IN': 'locale.hi-IN'
};
