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
        <TheSidebar @open-create-modal="openCreateModal" @edit="openEditModal" />
      </div>

      <div class="resizer-vertical" @mousedown="startSidebarResize"></div>

      <div class="main-container">
        <TheEditorArea />
      </div>

      <ConnectionModal
        :is-open="isModalOpen"
        :initial-data="editingConnection"
        @close="isModalOpen = false"
        @save="handleModalSave"
      />
    </div>

    <TheStatusBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'

import { useConnectionStore } from './stores/connections'
import { useTabStore } from './stores/tabs'
import { useSettingsStore } from './stores/settings'
import type { DbConnection } from '../shared/types'

import TheTitleBar from './components/layout/TheTitleBar.vue'
import TheActivityBar from './components/layout/TheActivityBar.vue'
import TheSidebar from './components/layout/TheSidebar.vue'
import TheEditorArea from './components/layout/TheEditorArea.vue'
import TheStatusBar from './components/layout/TheStatusBar.vue'
import ConnectionModal from './components/ConnectionModal.vue'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

ModuleRegistry.registerModules([AllCommunityModule])

const connStore = useConnectionStore()
const tabStore = useTabStore()
const settingsStore = useSettingsStore()

const isModalOpen = ref(false)
const sidebarWidth = ref(250)
const isResizingSidebar = ref(false)

// Состояние редактирования
const editingConnection = ref<DbConnection | null>(null)
const editingIndex = ref<number | null>(null)

onMounted(() => {
  connStore.loadFromStorage()
  settingsStore.initTheme()

  const savedWidth = localStorage.getItem('sidebar-width')
  if (savedWidth) sidebarWidth.value = parseInt(savedWidth)
})

// --- Modal Logic ---

function openCreateModal(): void {
  editingIndex.value = null
  editingConnection.value = null
  isModalOpen.value = true
}

function openEditModal(index: number): void {
  const conn = connStore.savedConnections[index]
  if (conn) {
    editingIndex.value = index
    // Клонируем объект, чтобы не менять стор напрямую до сохранения
    editingConnection.value = JSON.parse(JSON.stringify(conn))
    isModalOpen.value = true
  }
}

function handleModalSave(conn: DbConnection): void {
  if (editingIndex.value !== null) {
    // Обновляем существующее
    connStore.updateConnection(editingIndex.value, conn)
  } else {
    // Создаем новое
    connStore.addConnection(conn)
  }
  isModalOpen.value = false
}

// --- Sidebar Resizing ---
function startSidebarResize(): void {
  isResizingSidebar.value = true
}

function stopSidebarResize(): void {
  if (isResizingSidebar.value) {
    localStorage.setItem('sidebar-width', String(sidebarWidth.value))
  }
  isResizingSidebar.value = false
}

function doSidebarResize(e: MouseEvent): void {
  if (!isResizingSidebar.value) return
  const w = e.clientX - 48
  if (w > 150 && w < 800) {
    sidebarWidth.value = w
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
  width: 4px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
  border-right: 1px solid var(--border-color);
  transition: background 0.2s;
}
.resizer-vertical:hover,
.resizer-vertical:active {
  background: var(--focus-border);
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
</style>
