<template>
  <div class="query-view" @click="closeContextMenu">
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

        <button class="icon-btn" title="Format SQL" @click="formatCurrentSql">
          <BaseIcon name="sparkles" /> Format
        </button>
      </div>

      <div class="toolbar-right">
        <button
          class="icon-btn"
          title="Export to CSV"
          :disabled="!tabStore.currentTab?.rows?.length"
          @click="exportCsv"
        >
          <BaseIcon name="download" /> Export CSV
        </button>

        <button
          class="run-btn"
          :disabled="connStore.loading || tabStore.currentTab!.connectionId === null"
          @click="tabStore.runQuery"
        >
          <BaseIcon name="play" /> Run (Ctrl+Enter)
        </button>
      </div>
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
        :enable-cell-text-selection="true"
        :ensure-dom-order="true"
        @sort-changed="onGridSortChanged"
        @cell-context-menu="onCellContextMenu"
      />

      <div
        v-if="contextMenu.visible"
        class="ctx-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <div class="ctx-item" @click="copyValue">Copy Value</div>
        <div class="ctx-item" @click="copyRow">Copy Row (JSON)</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { SortChangedEvent, GridApi, ColumnState, CellContextMenuEvent } from 'ag-grid-community'

import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import { useSettingsStore } from '../../stores/settings'
import SqlEditor from '../SqlEditor.vue'
import BaseIcon from '../ui/BaseIcon.vue'

const tabStore = useTabStore()
const connStore = useConnectionStore()
const settingsStore = useSettingsStore()

const editorHeight = ref(300)
const isResizing = ref(false)
const defaultColDef = { sortable: true, filter: false, resizable: true }

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  value: null as unknown,
  rowData: null as unknown
})

// FIX: Добавлен возвращаемый тип void
function onCellContextMenu(params: CellContextMenuEvent): void {
  contextMenu.value = params.value
  contextMenu.rowData = params.data

  const event = params.event as MouseEvent
  if (event) {
    contextMenu.x = event.clientX
    contextMenu.y = event.clientY
    contextMenu.visible = true
  }
}

// FIX: Добавлен возвращаемый тип void
function closeContextMenu(): void {
  contextMenu.visible = false
}

// FIX: Добавлен возвращаемый тип Promise<void>
async function copyValue(): Promise<void> {
  const val = contextMenu.value === null ? '(NULL)' : String(contextMenu.value)
  try {
    await navigator.clipboard.writeText(val)
  } catch (err) {
    console.error('Failed to copy', err)
  }
  closeContextMenu()
}

// FIX: Добавлен возвращаемый тип Promise<void>
async function copyRow(): Promise<void> {
  if (!contextMenu.rowData) return
  try {
    // Добавляем replacer (второй аргумент), чтобы обработать бинарники
    const json = JSON.stringify(
      contextMenu.rowData,
      (_key, value) => {
        // Проверяем, похоже ли значение на бинарный буфер (объект с ключами "0", "1", "2"...)
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.keys(value).every((k) => !isNaN(Number(k)))
        ) {
          // Превращаем объект {"0": 155, "1": 255...} в массив чисел
          const bytes = Object.values(value) as number[]

          // ВАРИАНТ 1: Если хотите вернуть красивую HEX строку (например "9be1...")
          // Это идеально для checksum, hash и id
          return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')

          // ВАРИАНТ 2: Если хотите просто массив чисел [155, 255, ...]
          // return bytes
        }

        // Если это стандартный Node Buffer { type: 'Buffer', data: [...] }
        if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
          return value.data.map((b: number) => b.toString(16).padStart(2, '0')).join('')
        }

        return value
      },
      2
    )

    await navigator.clipboard.writeText(json)
  } catch (err) {
    console.error('Failed to copy row', err)
  }
  closeContextMenu()
}

import { format } from 'sql-formatter'

async function formatCurrentSql(): Promise<void> {
  if (!tabStore.currentTab) return
  try {
    const formatted = format(tabStore.currentTab.sql, {
      language:
        connStore.savedConnections[tabStore.currentTab.connectionId || 0]?.type === 'postgres'
          ? 'postgresql'
          : 'mysql',
      keywordCase: 'upper'
    })
    tabStore.currentTab.sql = formatted
  } catch (e) {
    console.error('Format error', e)
  }
}

function exportCsv(): void {
  if (!tabStore.currentTab || !tabStore.currentTab.rows.length) return

  const rows = tabStore.currentTab.rows
  if (rows.length === 0) return

  const header = Object.keys(rows[0]).join(',')
  const csvContent = rows
    .map((row) => {
      return Object.values(row)
        .map((val) => {
          if (val === null) return ''
          const str = String(val).replace(/"/g, '""') // Escape quotes
          return `"${str}"`
        })
        .join(',')
    })
    .join('\n')

  const blob = new Blob([header + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `export_${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function onTabConnectionChange(): Promise<void> {
  if (tabStore.currentTab?.type === 'query' && tabStore.currentTab.connectionId !== null) {
    try {
      await connStore.ensureConnection(tabStore.currentTab!.connectionId)
    } catch (e) {
      console.error(e)
    }
  }
}

function onGridSortChanged(event: SortChangedEvent): void {
  const api = event.api as GridApi
  const allState: ColumnState[] = api.getColumnState()

  const sortModel = allState
    .filter((col) => col.sort != null)
    .map((col) => ({
      colId: col.colId,
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
        const sortPart = sortModel.map((s) => `"${s.colId}" ${s.sort!.toUpperCase()}`).join(', ')
        newSql += ` ORDER BY ${sortPart}`
      }

      if (tabStore.currentTab.sql !== newSql) {
        tabStore.currentTab.pagination.offset = 0
        tabStore.currentTab.sql = newSql
        tabStore.runQuery()
      }
    }
  }
}

const startY = ref(0)
const startHeight = ref(0)

function startResize(e: MouseEvent): void {
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = editorHeight.value
  
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'row-resize'
  
  // Prevent text selection during drag
  e.preventDefault()
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
  
  const delta = e.clientY - startY.value
  const newHeight = startHeight.value + delta
  
  // Constraints
  if (newHeight > 50 && newHeight < window.innerHeight - 150) {
    editorHeight.value = newHeight
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
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.conn-select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  height: 28px; /* Фиксированная высота */
  padding: 0 8px;
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
  height: 28px; /* Фиксированная высота */
  padding: 0 16px;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.run-btn:disabled {
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: not-allowed;
}
.run-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  height: 28px; /* Фиксированная высота */
  padding: 0 12px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
}
.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.icon {
  font-family: inherit;
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

.ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  /* FIX: Исправлены пробелы в rgba */
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 150px;
}
.ctx-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}
.ctx-item:hover {
  background: var(--list-hover-bg);
  color: var(--text-white);
}
</style>
