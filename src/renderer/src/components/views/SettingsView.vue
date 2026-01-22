<template>
  <div class="settings-view">
    <div class="container">
      <h1>Preferences</h1>

      <div class="section">
        <h2>Color Theme</h2>
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
        <h2>Editor (Coming Soon)</h2>
        <p class="desc">Font size, word wrap, etc.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings'
const settings = useSettingsStore()
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
</style>
