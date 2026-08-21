import { createI18n } from 'vue-i18n'
import en from './locales/en'
import es from './locales/es'

export type AppLocale = 'es' | 'en'
export const SUPPORTED_LOCALES: AppLocale[] = ['es', 'en']
const LOCALE_STORAGE_KEY = 'locale'

function detectLocale(): AppLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored === 'es' || stored === 'en') return stored

  const browserLocale = navigator.language.slice(0, 2)
  return browserLocale === 'en' ? 'en' : 'es'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'es',
  messages: { es, en },
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

export function getLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale
}
