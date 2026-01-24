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
        :available-databases="modalAvailableDatabases"
        @close="isModalOpen = false"
        @save="handleModalSave"
      />
    </div>

    <TheStatusBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
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

const connStore = useConnectionStore()
const tabStore = useTabStore()
const settingsStore = useSettingsStore()

const isModalOpen = ref(false)
const sidebarWidth = ref(250)
const isResizingSidebar = ref(false)

// Состояние редактирования
const editingConnection = ref<DbConnection | null>(null)
const editingIndex = ref<number | null>(null)
const modalAvailableDatabases = ref<string[]>([])

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    const activeEl = document.activeElement
    if (!activeEl) return

    // Allow tab if we are inside a table container
    const isTable = activeEl.closest('.base-table-container')
    // Allow tab if we are inside a modal (e.g. connection form)
    const isModal = activeEl.closest('.base-modal-overlay')
    // Allow tab if we are inside the SQL editor
    const isEditor = activeEl.closest('.sql-editor') || activeEl.closest('.cm-content')

    if (!isTable && !isModal && !isEditor) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown, true) // capture phase toensure we catch it first

  settingsStore.initSettings()

  const savedWidth = localStorage.getItem('sidebar-width')
  if (savedWidth) sidebarWidth.value = parseInt(savedWidth)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown, true)
})

// --- Modal Logic ---

function openCreateModal(): void {
  editingIndex.value = null
  editingConnection.value = null
  modalAvailableDatabases.value = []
  isModalOpen.value = true
}

async function openEditModal(index: number): Promise<void> {
  const conn = connStore.savedConnections[index]
  if (conn) {
    editingIndex.value = index
    modalAvailableDatabases.value = []

    // Клонируем объект, чтобы не менять стор напрямую до сохранения
    editingConnection.value = JSON.parse(JSON.stringify(conn))

    // Если подключение активно, загружаем список ВСЕХ баз (без excludeList)
    if (connStore.isConnected(index)) {
      try {
        const dbs = await window.dbApi.getDatabases(index, '')
        modalAvailableDatabases.value = dbs.sort()
      } catch (e) {
        console.error('Failed to load databases for modal:', e)
      }
    }

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
  width: 0;
  cursor: col-resize;
  background: transparent;
  z-index: 20;
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
