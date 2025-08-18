import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import he from './locales/he.json'

const stored = typeof window !== 'undefined' ? window.localStorage.getItem('lng') : null
const fallbackLng = 'en'
const initialLng = stored || fallbackLng

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    lng: initialLng,
    fallbackLng,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  })

export function setLanguage(lng: 'en' | 'he') {
  i18n.changeLanguage(lng)
  try { window.localStorage.setItem('lng', lng) } catch {}
}

export default i18n


