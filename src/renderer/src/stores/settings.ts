import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { themes } from '../lib/themes'

export const useSettingsStore = defineStore('settings', () => {
  const currentThemeId = ref('vscode-dark')

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

  return {
    currentThemeId,
    activeTheme,
    themesList: themes,
    fontSize,
    initTheme,
    setTheme,
    setFontSize
  }
})
