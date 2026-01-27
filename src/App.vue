<template>
  <div class="app-wrapper">
    <TheTitleBar />
    <div
      class="workbench"
      :class="{ 'is-resizing': isResizingSidebar }"
      @mouseup="stopSidebarResize"
      @mousemove="doSidebarResize"
    >
      <TheActivityBar @open-settings="tabStore.openSettingsTab()" />

      <div class="sidebar-container" :style="{ width: sidebarWidth + 'px' }">
        <TheSidebar />
      </div>

      <div class="resizer-vertical" @mousedown="startSidebarResize"></div>

      <div class="main-container">
        <TheEditorArea />
      </div>
    </div>

    <TheStatusBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useConnectionStore } from './stores/connections';
import { useTabStore } from './stores/tabs';
import { useSettingsStore } from './stores/settings';
import type { DbConnection, DbConnectionMeta } from './types';

import TheTitleBar from './components/layout/TheTitleBar.vue';
import TheActivityBar from './components/layout/TheActivityBar.vue';
import TheSidebar from './components/layout/TheSidebar.vue';
import TheEditorArea from './components/layout/TheEditorArea.vue';
import TheStatusBar from './components/layout/TheStatusBar.vue';
const connStore = useConnectionStore();
const tabStore = useTabStore();
const settingsStore = useSettingsStore();

const sidebarWidth = ref(250);
const isResizingSidebar = ref(false);

const handleGlobalKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Tab') {
    const activeEl = document.activeElement;
    if (!activeEl) return;

    const isTable = activeEl.closest('.base-table-container');
    const isModal = activeEl.closest('.base-modal-overlay');
    const isEditor = activeEl.closest('.sql-editor') || activeEl.closest('.cm-content');

    if (!isTable && !isModal && !isEditor) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
};

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown, true);

  await settingsStore.initSettings();
  await connStore.loadFromStorage();
  await tabStore.loadFromStorage();

  const state = await window.dbApi.getState();
  sidebarWidth.value = state.ui.sidebarWidth;
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
});

// --- Sidebar Resizing ---
function startSidebarResize(): void {
  isResizingSidebar.value = true;
}

function stopSidebarResize(): void {
  if (isResizingSidebar.value) {
    const state = window.dbApi.getState();
    state.then((s) => {
      window.dbApi.updateState({
        ui: {
          ...s.ui,
          sidebarWidth: sidebarWidth.value,
        },
      });
    });
  }
  isResizingSidebar.value = false;
}

function doSidebarResize(e: MouseEvent): void {
  if (!isResizingSidebar.value) return;
  const w = e.clientX - 48;
  if (w > 150 && w < 800) {
    sidebarWidth.value = w;
  }
}
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-app);
  font-family: var(--font-main);
  color: var(--text-primary);
  overflow: hidden;
}

.workbench {
  display: flex;
  flex: 1; /* Occupy remaining space */
  width: 100vw;
  overflow: hidden;
}

.is-resizing * {
  pointer-events: none !important;
  user-select: none !important;
}
.is-resizing {
  cursor: col-resize;
}

.sidebar-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.resizer-vertical {
  width: 0;
  cursor: col-resize;
  background: transparent;
  z-index: 100;
  position: relative;
  /* Visual line is the border-right of element to the left */
}

/* Hit area */
.resizer-vertical::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  right: -3px;
  z-index: 20;
}

/* Visual line on hover */
.resizer-vertical::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -1px; /* Center over the potential border position */
  width: 2px;
  background: var(--accent-primary);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.resizer-vertical:hover::after,
.resizer-vertical:active::after {
  opacity: 1;
  width: 4px;
  left: -2px; /* Center the 4px line */
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
</style>
