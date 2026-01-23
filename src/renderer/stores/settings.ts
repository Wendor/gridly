import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { themes } from '../lib/themes'

export const useSettingsStore = defineStore('settings', () => {
  const currentThemeId = ref('atom-one-dark')

  const activeTheme = computed(() => themes.find((t) => t.id === currentThemeId.value) || themes[0])

  function applyTheme(): void {
    const theme = activeTheme.value
    const root = document.documentElement

    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    root.setAttribute('data-theme', theme.type)
  }

  const fontSize = ref(14)

  function setFontSize(size: number): void {
    fontSize.value = size
    localStorage.setItem('editor-font-size', String(size))
  }

  function initTheme(): void {
    const saved = localStorage.getItem('app-theme')
    if (saved && themes.find((t) => t.id === saved)) {
      currentThemeId.value = saved
    }
    const savedFont = localStorage.getItem('editor-font-size')
    if (savedFont) fontSize.value = parseInt(savedFont)

    applyTheme()
  }

  function setTheme(id: string): void {
    if (!themes.find((t) => t.id === id)) return
    currentThemeId.value = id
    localStorage.setItem('app-theme', id)
    applyTheme()
  }

  const language = ref('en')

  function setLanguage(lang: string): void {
    language.value = lang
    localStorage.setItem('app-locale', lang)
    // Update global i18n locale
    // We need to import i18n or use it via window/global context if circular deps are an issue.
    // However, importing it directly is usually fine.
    // For now, let's rely on the component or main init to sync, OR import here.
    // Dynamic import to avoid potential circular dependency issues with main
    import('../i18n').then((module) => {
      module.default.global.locale.value = lang
    })
  }

  function initSettings(): void {
    initTheme()
    const savedLang = localStorage.getItem('app-locale')
    if (savedLang) {
      setLanguage(savedLang)
    }
  }

  return {
    currentThemeId,
    activeTheme,
    themesList: themes,
    fontSize,
    initTheme,
    initSettings,
    language,
    setLanguage,
    setTheme,
    setFontSize
  }
})
