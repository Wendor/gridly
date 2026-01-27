import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { themes } from '../lib/themes';

export const useSettingsStore = defineStore('settings', () => {
  const currentThemeId = ref('atom-one-dark');
  const fontSize = ref(14);
  const language = ref('en');

  const activeTheme = computed(() => themes.find((t) => t.id === currentThemeId.value) || themes[0]);

  function applyTheme(): void {
    const theme = activeTheme.value;
    const root = document.documentElement;

    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.setAttribute('data-theme', theme.type);
  }

  async function saveSettings(): Promise<void> {
    try {
      await window.dbApi.saveSettings({
        theme: currentThemeId.value,
        locale: language.value,
        fontSize: fontSize.value,
      });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  function setFontSize(size: number): void {
    fontSize.value = size;
    saveSettings();
  }

  function initTheme(): void {
    applyTheme();
  }

  function setTheme(id: string): void {
    if (!themes.find((t) => t.id === id)) return;
    currentThemeId.value = id;
    applyTheme();
    saveSettings();
  }

  function setLanguage(lang: string): void {
    language.value = lang;
    import('../i18n').then((module) => {
      module.default.global.locale.value = lang as 'en' | 'ru';
    });
    saveSettings();
  }

  async function initSettings(): Promise<void> {
    try {
      const settings = await window.dbApi.getSettings();

      if (settings.theme && themes.find((t) => t.id === settings.theme)) {
        currentThemeId.value = settings.theme;
      }

      if (settings.fontSize) {
        fontSize.value = settings.fontSize;
      }

      if (settings.locale) {
        language.value = settings.locale;
        setLanguage(settings.locale); // activates i18n
      }

      applyTheme();
    } catch (e) {
      console.error('Failed to load settings:', e);
      // Fallback or defaults are already set
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
    setFontSize,
  };
});
