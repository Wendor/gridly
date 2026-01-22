<template>
  <div class="query-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <select
          v-model="tabStore.currentTab!.connectionId"
          class="conn-select"
          @change="onTabConnectionChange"
        >
          <option :value="null" disabled>Select Connection</option>
          <option v-for="(conn, idx) in connStore.savedConnections" :key="idx" :value="idx">
            {{ conn.name }}
          </option>
        </select>
      </div>

      <button
        class="run-btn"
        :disabled="connStore.loading || tabStore.currentTab!.connectionId === null"
        @click="tabStore.runQuery"
      >
        ▶ Run (Ctrl+Enter)
      </button>
    </div>

    <div class="editor-wrapper" :style="{ height: editorHeight + 'px' }">
      <SqlEditor
        v-if="tabStore.currentTab"
        v-model="tabStore.currentTab.sql"
        @run="tabStore.runQuery"
      />
    </div>

    <div class="resizer-horizontal" @mousedown="startResize"></div>

    <div class="grid-wrapper">
      <div v-if="connStore.error" class="error-msg">
        <div class="error-content">
          <h3>Error</h3>
          <p>{{ connStore.error }}</p>
          <button @click="connStore.error = null">Close</button>
        </div>
      </div>

      <ag-grid-vue
        v-if="tabStore.currentTab"
        :theme="'legacy'"
        :class="
          settingsStore.activeTheme.type === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'
        "
        style="width: 100%; height: 100%"
        :column-defs="tabStore.currentTab.colDefs"
        :row-data="tabStore.currentTab.rows"
        :default-col-def="defaultColDef"
        @sort-changed="onGridSortChanged"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
// 1. ИМПОРТИРУЕМ ВСЕ НУЖНЫЕ ТИПЫ
import { SortChangedEvent, GridApi, ColumnState } from 'ag-grid-community'

import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import { useSettingsStore } from '../../stores/settings'
import SqlEditor from '../SqlEditor.vue'

const tabStore = useTabStore()
const connStore = useConnectionStore()
const settingsStore = useSettingsStore()

const editorHeight = ref(300)
const isResizing = ref(false)
const defaultColDef = { sortable: true, filter: false, resizable: true }

async function onTabConnectionChange(): Promise<void> {
  if (tabStore.currentTab?.type === 'query' && tabStore.currentTab.connectionId !== null) {
    try {
      await connStore.ensureConnection(tabStore.currentTab!.connectionId)
    } catch (e) {
      console.error(e)
    }
  }
}

// --- ИСПРАВЛЕННАЯ ЛОГИКА СОРТИРОВКИ (БЕЗ ANY) ---
function onGridSortChanged(event: SortChangedEvent): void {
  // 2. Приводим api к типу GridApi (без as any)
  const api = event.api as GridApi

  // 3. Получаем состояние колонок, типизированное как ColumnState[]
  const allState: ColumnState[] = api.getColumnState()

  // 4. Теперь TypeScript знает, что `col` — это ColumnState, и не требует any
  const sortModel = allState
    .filter((col) => col.sort != null)
    .map((col) => ({
      colId: col.colId,
      // col.sort может быть undefined, поэтому используем optional chaining или утверждение
      sort: col.sort
    }))

  if (!tabStore.currentTab) return

  const currentSql = tabStore.currentTab.sql.trim()

  if (/^SELECT\s+\*\s+FROM/i.test(currentSql)) {
    const match = currentSql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i)

    if (match) {
      const tableName = match[1]
      let newSql = `SELECT * FROM ${tableName}`

      if (sortModel.length > 0) {
        // Добавляем кавычки для Postgres
        const sortPart = sortModel.map((s) => `"${s.colId}" ${s.sort!.toUpperCase()}`).join(', ')
        newSql += ` ORDER BY ${sortPart}`
      }

      newSql += ' LIMIT 100;'

      if (tabStore.currentTab.sql !== newSql) {
        tabStore.currentTab.sql = newSql
        tabStore.runQuery()
      }
    }
  }
}

function startResize(): void {
  isResizing.value = true
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'row-resize'
}

function stopResize(): void {
  if (isResizing.value) {
    localStorage.setItem('editor-height', String(editorHeight.value))
  }
  isResizing.value = false
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
}

function doResize(e: MouseEvent): void {
  if (!isResizing.value) return
  const h = e.clientY - 40 - 35
  if (h > 50 && h < window.innerHeight - 150) {
    editorHeight.value = h
  }
}

onMounted(() => {
  const saved = localStorage.getItem('editor-height')
  if (saved) editorHeight.value = parseInt(saved)
})
</script>

<style scoped>
.query-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.toolbar {
  height: 40px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background: var(--bg-app);
  flex-shrink: 0;
}
.conn-select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 4px 8px;
  border-radius: 2px;
  font-size: 13px;
  min-width: 200px;
  outline: none;
}
.conn-select:focus {
  border-color: var(--focus-border);
}
.run-btn {
  background: var(--accent-primary);
  color: var(--text-white);
  border: none;
  padding: 6px 16px;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
}
.run-btn:disabled {
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: not-allowed;
}
.run-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.editor-wrapper {
  overflow: hidden;
  background: var(--bg-app);
  flex-shrink: 0;
}
.resizer-horizontal {
  height: 4px;
  background: transparent;
  cursor: row-resize;
  border-top: 1px solid var(--border-color);
  z-index: 10;
  flex-shrink: 0;
  transition: background 0.2s;
}
.resizer-horizontal:hover,
.resizer-horizontal:active {
  background: var(--focus-border);
}
.grid-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-height: 0;
}
.error-msg {
  position: absolute;
  inset: 0;
  background: rgba(50, 0, 0, 0.9);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff9999;
}
.error-content {
  background: #330000;
  padding: 20px;
  border: 1px solid #ff5555;
  border-radius: 4px;
  max-width: 80%;
}
.error-content button {
  margin-top: 10px;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
