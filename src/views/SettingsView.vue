<template>
  <div class="settings-view">
    <div class="container">
      <h1>{{ $t('settings.title') }}</h1>

      <div class="section">
        <h2>{{ $t('settings.general') }}</h2>
        <div class="setting-item">
          <label>{{ $t('settings.language') }}</label>
          <div style="width: 200px">
            <BaseSelect
              :model-value="settings.language"
              :options="[
                { label: 'English', value: 'en' },
                { label: 'Русский', value: 'ru' }
              ]"
              @update:model-value="(val) => settings.setLanguage(String(val))"
            />
          </div>
        </div>
      </div>

      <div class="section">
        <h2>{{ $t('settings.theme') }}</h2>
        <div class="themes-grid">
          <div
            v-for="theme in settings.themesList"
            :key="theme.id"
            class="theme-card"
            :class="{ active: settings.currentThemeId === theme.id }"
            @click="settings.setTheme(theme.id)"
          >
            <div class="preview" :style="{ backgroundColor: theme.colors['--bg-app'] }">
              <div
                class="sidebar-preview"
                :style="{ backgroundColor: theme.colors['--bg-sidebar'] }"
              ></div>
              <div
                class="accent-preview"
                :style="{ backgroundColor: theme.colors['--accent-primary'] }"
              ></div>
            </div>
            <div class="name">{{ theme.name }}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>{{ $t('settings.editor') }}</h2>
        <div class="setting-item">
          <label>{{ $t('settings.fontSize') }}</label>
          <div class="font-controls">
            <BaseButton
              variant="secondary"
              class="square-btn"
              @click="settings.setFontSize(settings.fontSize - 1)"
            >
              -
            </BaseButton>
            <span class="value">{{ settings.fontSize }}px</span>
            <BaseButton
              variant="secondary"
              class="square-btn"
              @click="settings.setFontSize(settings.fontSize + 1)"
            >
              +
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';
import BaseButton from '../components/ui/BaseButton.vue';
import BaseSelect from '../components/ui/BaseSelect.vue';

const settings = useSettingsStore();
</script>

<style scoped>
.settings-view {
  flex: 1;
  background: var(--bg-app);
  color: var(--text-primary);
  overflow-y: auto;
  padding: 40px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-weight: normal;
  margin-bottom: 30px;
}
h2 {
  font-size: 18px;
  margin-bottom: 15px;
  font-weight: 500;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
}
.desc {
  color: var(--text-secondary);
  font-size: 13px;
}

.section {
  margin-bottom: 40px;
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.theme-card {
  cursor: pointer;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  transition:
    transform 0.1s,
    border-color 0.1s;
}

.theme-card:hover {
  border-color: var(--text-secondary);
}
.theme-card.active {
  border-color: var(--focus-border);
  outline: 2px solid var(--focus-border);
}

.preview {
  height: 100px;
  position: relative;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-preview {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 25%;
}
.accent-preview {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 30px;
  height: 10px;
  border-radius: 2px;
}

.name {
  padding: 10px;
  font-size: 13px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.setting-item {
  width: 50%;
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 15px;
  justify-content: space-between;
}
.font-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.value {
  min-width: 40px;
  text-align: center;
  font-family: var(--font-mono);
}

.square-btn {
  padding: 0;
  width: 32px;
  height: 32px;
  justify-content: center;
}
</style>
