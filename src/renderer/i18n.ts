import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ru from './locales/ru.json'

// Get saved language from localStorage or default to 'en'
const savedLocale = localStorage.getItem('app-locale') || 'en'

const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: savedLocale,
  fallbackLocale: 'en',
  globalInjection: true,
  messages: {
    en,
    ru
  }
})

export default i18n
