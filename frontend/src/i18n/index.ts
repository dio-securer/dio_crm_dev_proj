import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko-KR/common.json';
import en from './locales/en-US/common.json';
import koLead from './locales/ko-KR/lead.json';
import enLead from './locales/en-US/lead.json';
import koAccountExt from './locales/ko-KR/account-ext.json';
import enAccountExt from './locales/en-US/account-ext.json';
import koWorkspaceExt from './locales/ko-KR/crm-workspace-ext.json';
import enWorkspaceExt from './locales/en-US/crm-workspace-ext.json';
import localeMeta from './locales/_stubs/locale-meta.json';
import { leadMockKo } from './locales/ko-KR/lead-mock';
import { leadMockEn } from './locales/en-US/lead-mock';
import { mergeTranslations } from './merge-resources';
import { FALLBACK_LOCALE, resolveInitialLocale, saveLocale, type SupportedLocale } from './locale-resolver';

const koTranslation = mergeTranslations(ko, koLead, koAccountExt, koWorkspaceExt, leadMockKo);
const enTranslation = mergeTranslations(en, enLead, enAccountExt, enWorkspaceExt, leadMockEn);

/** Planned locales reuse en-US copy until native translation (step 3 stub). */
const stubTranslation = mergeTranslations(enTranslation, localeMeta);

void i18n.use(initReactI18next).init({
  resources: {
    'ko-KR': { translation: koTranslation },
    'en-US': { translation: enTranslation },
    'es-MX': { translation: stubTranslation },
    'pt-PT': { translation: stubTranslation },
    'tr-TR': { translation: stubTranslation },
    'hi-IN': { translation: stubTranslation }
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
