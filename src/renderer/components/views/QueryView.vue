<template>
  <div class="query-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <BaseSelect
          :model-value="tabStore.currentTab?.connectionId ?? ''"
          :options="connectionOptions"
          class="conn-select-wrapper"
          variant="outline"
          @update:model-value="onTabConnectionChange"
        />

        <BaseButton title="Format SQL" @click="formatCurrentSql">
          <BaseIcon name="sparkles" /> Format
        </BaseButton>
      </div>

      <div class="toolbar-right">
        <BaseButton
          title="Export to CSV"
          :disabled="!tabStore.currentTab?.rows?.length"
          @click="exportCsv"
        >
          <BaseIcon name="download" /> Export CSV
        </BaseButton>

        <BaseButton
          variant="primary"
          :disabled="connStore.loading || tabStore.currentTab?.connectionId === null"
          @click="tabStore.runQuery"
        >
          <BaseIcon name="play" /> Run
        </BaseButton>
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

      <BaseContextMenu
        :visible="contextMenu.visible"
        :x="contextMenu.x"
        :y="contextMenu.y"
        @close="closeContextMenu"
      >
        <div class="ctx-item" @click="copyValue">Copy Value</div>
        <div class="ctx-item" @click="copyRow">Copy Row (JSON)</div>
      </BaseContextMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { SortChangedEvent, GridApi, CellContextMenuEvent } from 'ag-grid-community'
import { format } from 'sql-formatter'
import { isWrappedValue } from '../../../shared/types'

import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import { useSettingsStore } from '../../stores/settings'
import SqlEditor from '../SqlEditor.vue'
import BaseIcon from '../ui/BaseIcon.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import BaseContextMenu from '../ui/BaseContextMenu.vue'

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

function closeContextMenu(): void {
  contextMenu.visible = false
}

async function copyValue(): Promise<void> {
  const raw = contextMenu.value
  let val = ''
  if (raw === null) {
    val = '(NULL)'
  } else if (isWrappedValue(raw)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    val = typeof raw.raw === 'string' ? raw.raw : JSON.stringify(raw.raw)
  } else {
    val = String(raw)
  }
  await navigator.clipboard.writeText(val)
  closeContextMenu()
}

async function copyRow(): Promise<void> {
  if (!contextMenu.rowData) return
  // Un-wrap values for JSON copy
  const cleanRow = {} as Record<string, unknown>
  for (const [k, v] of Object.entries(contextMenu.rowData as Record<string, unknown>)) {
    if (isWrappedValue(v)) {
      cleanRow[k] = v.raw
    } else {
      cleanRow[k] = v
    }
  }
  const json = JSON.stringify(cleanRow, null, 2)
  await navigator.clipboard.writeText(json)
  closeContextMenu()
}

async function formatCurrentSql(): Promise<void> {
  if (!tabStore.currentTab) return
  const dialect =
    connStore.savedConnections[tabStore.currentTab.connectionId || 0]?.type === 'postgres'
      ? 'postgresql'
      : 'mysql'
  tabStore.currentTab.sql = format(tabStore.currentTab.sql, {
    language: dialect,
    keywordCase: 'upper'
  })
}

function exportCsv(): void {
  if (!tabStore.currentTab?.rows.length) return
  const header = Object.keys(tabStore.currentTab.rows[0]).join(',')
  const csv = tabStore.currentTab.rows
    .map((r) =>
      Object.values(r)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')
  const blob = new Blob([header + '\n' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `export_${Date.now()}.csv`
  link.click()
}

const connectionOptions = computed(() => {
  const opts = connStore.savedConnections.map((conn, idx) => ({
    label: conn.name,
    value: idx
  }))
  return [{ label: 'Select Connection', value: '' }, ...opts]
})

async function onTabConnectionChange(val: string): Promise<void> {
  if (tabStore.currentTab) {
    tabStore.currentTab.connectionId = val === '' ? null : Number(val)
    if (tabStore.currentTab.connectionId !== null) {
      await connStore.ensureConnection(tabStore.currentTab.connectionId)
    }
  }
}

function onGridSortChanged(event: SortChangedEvent): void {
  const api = event.api as GridApi
  const sortModel = api
    .getColumnState()
    .filter((c) => c.sort != null)
    .map((c) => ({ colId: c.colId, sort: c.sort }))
  if (!tabStore.currentTab) return
  const match = tabStore.currentTab.sql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i)
  if (match) {
    let newSql = `SELECT * FROM ${match[1]}`
    if (sortModel.length > 0)
      newSql += ` ORDER BY ${sortModel.map((s) => `"${s.colId}" ${s.sort!.toUpperCase()}`).join(', ')}`
    tabStore.currentTab.sql = newSql
    tabStore.runQuery()
  }
}

// Resizing logic
const startY = ref(0)
const startHeight = ref(0)
function startResize(e: MouseEvent): void {
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = editorHeight.value
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}
function stopResize(): void {
  localStorage.setItem('editor-height', String(editorHeight.value))
  isResizing.value = false
  document.removeEventListener('mousemove', doResize)
  document.removeEventListener('mouseup', stopResize)
}
function doResize(e: MouseEvent): void {
  if (!isResizing.value) return
  const newHeight = startHeight.value + (e.clientY - startY.value)
  if (newHeight > 100 && newHeight < window.innerHeight - 200) editorHeight.value = newHeight
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
.editor-wrapper {
  overflow: hidden;
  background: var(--bg-app);
  flex-shrink: 0;
  min-height: 100px; /* Гарантируем видимость */
}
.resizer-horizontal {
  height: 4px;
  background: transparent;
  cursor: row-resize;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
.grid-wrapper {
  flex: 1; /* Занимает все оставшееся пространство */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

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
.conn-select-wrapper {
  min-width: 200px;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
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


.ctx-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}
.ctx-item:hover {
  background: var(--list-hover-bg);
  color: var(--list-hover-fg);
}
</style>
