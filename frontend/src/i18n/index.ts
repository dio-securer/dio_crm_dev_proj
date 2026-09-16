import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko-KR/common.json';
import en from './locales/en-US/common.json';
import { leadMockKo } from './locales/ko-KR/lead-mock';
import { leadMockEn } from './locales/en-US/lead-mock';
import { FALLBACK_LOCALE, resolveInitialLocale, saveLocale, type SupportedLocale } from './locale-resolver';

void i18n.use(initReactI18next).init({
  resources: {
    'ko-KR': { translation: { ...ko, ...leadMockKo } },
    'en-US': { translation: { ...en, ...leadMockEn } }
  },
  lng: resolveInitialLocale(),
  fallbackLng: FALLBACK_LOCALE,
  interpolation: { escapeValue: false },
  returnNull: false
});

export async function changeLocale(locale: SupportedLocale) {
  saveLocale(locale);
  await i18n.changeLanguage(locale);
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export { i18n };
