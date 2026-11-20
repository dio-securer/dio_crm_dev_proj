export const SUPPORTED_LOCALES = ['ko-KR', 'en-US'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ko-KR';
export const FALLBACK_LOCALE: SupportedLocale = 'ko-KR';
const STORAGE_KEY = 'dio_crm_locale';

export function normalizeLocale(value?: string | null): SupportedLocale | undefined {
  if (!value) return undefined;
  const exact = SUPPORTED_LOCALES.find(x => x.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  const language = value.split('-')[0]?.toLowerCase();
  return SUPPORTED_LOCALES.find(x => x.split('-')[0].toLowerCase() === language);
}

export function resolveInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const preview = window as Window & { __DIO_VISUAL_PREVIEW__?: boolean; __DIO_VISUAL_PREVIEW_BOOT__?: { locale?: string } };
  if (preview.__DIO_VISUAL_PREVIEW__) return normalizeLocale(preview.__DIO_VISUAL_PREVIEW_BOOT__?.locale) ?? DEFAULT_LOCALE;
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* An opaque preview origin has no storage. */ }
  return normalizeLocale(stored)
    ?? normalizeLocale(navigator.language)
    ?? DEFAULT_LOCALE;
}

export function saveLocale(locale: SupportedLocale) {
  if (typeof window === 'undefined' || (window as Window & { __DIO_VISUAL_PREVIEW__?: boolean }).__DIO_VISUAL_PREVIEW__) return;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* Locale remains in memory. */ }
}
