<template>
  <div class="query-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <BaseSelect
          :model-value="currentQueryTab?.connectionId ?? ''"
          :options="connectionOptions"
          class="conn-select-wrapper"
          variant="outline"
          @update:model-value="onTabConnectionChange"
        />

        <BaseButton :title="$t('query.format')" @click="formatCurrentSql">
          <BaseIcon name="sparkles" /> {{ $t('query.format') }}
        </BaseButton>
      </div>

      <div class="toolbar-right">
        <!-- REMOVED EXPORT BUTTON FROM TOP -->

        <BaseButton
          variant="primary"
          :disabled="connStore.loading || currentQueryTab?.connectionId === null"
          @click="tabStore.runQuery"
        >
          <BaseIcon name="play" /> {{ $t('query.run') }}
        </BaseButton>
      </div>
    </div>

    <div class="editor-wrapper" :style="{ height: editorHeight + 'px' }">
      <SqlEditor v-if="currentQueryTab" v-model="currentQueryTab.sql" @run="tabStore.runQuery" />
    </div>

    <div class="resizer-horizontal" @mousedown="startResize"></div>

    <div class="grid-wrapper">
      <div v-if="connStore.error" class="error-msg">
        <div class="error-content">
          <h3>{{ $t('common.error') }}</h3>
          <p>{{ connStore.error }}</p>
          <button @click="connStore.error = null">{{ $t('common.close') }}</button>
        </div>
      </div>

      <div v-if="currentQueryTab" class="results-toolbar">
        <div class="pagination-controls">
          <BaseButton :disabled="!canGoPrev" variant="ghost" icon-only @click="goFirst">
            <BaseIcon name="chevronsLeft" />
          </BaseButton>
          <BaseButton :disabled="!canGoPrev" variant="ghost" icon-only @click="tabStore.prevPage">
            <BaseIcon name="chevronLeft" />
          </BaseButton>

          <span class="pagination-text">{{ paginationText }}</span>

          <BaseButton :disabled="!canGoNext" variant="ghost" icon-only @click="tabStore.nextPage">
            <BaseIcon name="chevronRight" />
          </BaseButton>
          <BaseButton :disabled="!canGoLast" variant="ghost" icon-only @click="goLast">
            <BaseIcon name="chevronsRight" />
          </BaseButton>
        </div>

        <div class="toolbar-divider"></div>

        <BaseButton
          :title="$t('query.refresh')"
          variant="ghost"
          icon-only
          @click="tabStore.runQuery"
        >
          <BaseIcon name="refresh" :class="{ spin: connStore.loading }" />
        </BaseButton>

        <BaseSelect
          :model-value="autoRefreshInterval"
          :options="autoRefreshOptions"
          icon="clock"
          class="auto-refresh-select"
          highlight-active
          @update:model-value="onAutoRefreshChange"
        />

        <div class="spacer"></div>

        <BaseButton
          variant="ghost"
          :title="$t('query.exportCsv')"
          :disabled="!currentQueryTab?.rows?.length"
          @click="exportCsv"
        >
          <BaseIcon name="download" /> {{ $t('query.exportCsv') }}
        </BaseButton>
      </div>

      <BaseTable
        v-if="currentQueryTab"
        :columns="tableColumns"
        :data="currentQueryTab.rows"
        :row-offset="currentQueryTab.pagination.offset"
        style="width: 100%; height: 100%"
        @sort-change="onSortChange"
        @cell-context-menu="onCellContextMenu"
      />

      <BaseContextMenu
        :visible="contextMenu.visible"
        :x="contextMenu.x"
        :y="contextMenu.y"
        @close="closeContextMenu"
      >
        <div class="ctx-item" @click="copyValue">{{ $t('query.copyValue') }}</div>
        <div class="ctx-item" @click="copyRow">{{ $t('query.copyRow') }}</div>
      </BaseContextMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue'
import { format } from 'sql-formatter'
import { isWrappedValue } from '../../../shared/types'

import { useTabStore, QueryTab } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import SqlEditor from '../SqlEditor.vue'
import BaseIcon from '../ui/BaseIcon.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import BaseContextMenu from '../ui/BaseContextMenu.vue'
import BaseTable from '../ui/BaseTable.vue'
import i18n from '../../i18n'

const tabStore = useTabStore()
const connStore = useConnectionStore()

// Helper to get typed current tab
const currentQueryTab = computed<QueryTab | null>(() => {
  return tabStore.currentTab?.type === 'query' ? tabStore.currentTab : null
})

const editorHeight = ref(300)
const isResizing = ref(false)

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  value: null as unknown,
  rowData: null as unknown
})

function onCellContextMenu(payload: {
  event: MouseEvent
  value: unknown
  data: Record<string, unknown>
}): void {
  contextMenu.value = payload.value
  contextMenu.rowData = payload.data
  const event = payload.event
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
  if (!currentQueryTab.value) return
  const dialect =
    connStore.savedConnections[currentQueryTab.value.connectionId || 0]?.type === 'postgres'
      ? 'postgresql'
      : 'mysql'
  currentQueryTab.value.sql = format(currentQueryTab.value.sql, {
    language: dialect,
    keywordCase: 'upper'
  })
}

function exportCsv(): void {
  if (!currentQueryTab.value?.rows.length) return
  const header = Object.keys(currentQueryTab.value.rows[0]).join(',')
  const csv = currentQueryTab.value.rows
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

// Pagination & Toolbar Logic
const canGoPrev = computed(() => {
  if (!currentQueryTab.value) return false
  return currentQueryTab.value.pagination.offset > 0
})

const canGoNext = computed(() => {
  if (!currentQueryTab.value) return false
  // If total is known
  if (currentQueryTab.value.pagination.total !== null) {
    return (
      currentQueryTab.value.pagination.offset + currentQueryTab.value.pagination.limit <
      currentQueryTab.value.pagination.total
    )
  }
  // If total unknown, check if we have full page of rows
  // If we have fewer rows than limit, we are at end
  return currentQueryTab.value.rows.length === currentQueryTab.value.pagination.limit
})

const canGoLast = computed(() => {
  if (!currentQueryTab.value || currentQueryTab.value.pagination.total === null) return false
  return canGoNext.value
})

const paginationText = computed(() => {
  if (!currentQueryTab.value) return ''
  const { offset, total } = currentQueryTab.value.pagination
  const count = currentQueryTab.value.rows.length
  const start = count > 0 ? offset + 1 : 0
  const end = offset + count

  if (total !== null) {
    return `${start} - ${end} of ${total}`
  }
  return `${start} - ${end} of ${end}+`
})

function goFirst(): void {
  if (currentQueryTab.value) {
    currentQueryTab.value.pagination.offset = 0
    tabStore.runQuery()
  }
}

function goLast(): void {
  if (currentQueryTab.value && currentQueryTab.value.pagination.total !== null) {
    const { total, limit } = currentQueryTab.value.pagination
    const newOffset = Math.max(0, Math.floor((total - 1) / limit) * limit)
    currentQueryTab.value.pagination.offset = newOffset
    tabStore.runQuery()
  }
}

// Auto Refresh
const autoRefreshInterval = ref(0) // 0 = disabled
const autoRefreshTimer = ref<number | null>(null)

const autoRefreshOptions = [
  { label: 'Auto: Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 }
]

function onAutoRefreshChange(val: string | number): void {
  const ms = Number(val)
  autoRefreshInterval.value = ms

  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }

  if (ms > 0) {
    autoRefreshTimer.value = window.setInterval(() => {
      if (currentQueryTab.value && !connStore.loading) {
        tabStore.runQuery()
      }
    }, ms)
  }
}

// Clear timer on unmount or tab change
onUnmounted(() => {
  if (autoRefreshTimer.value) clearInterval(autoRefreshTimer.value)
})

watch(
  () => currentQueryTab.value?.id,
  () => {
    // Reset auto refresh on tab switch/close? Or keep it per tab?
    // User request didn't specify. Usually per-view.
    // If I keep it simple, it's global for the view component.
    // If I switch tabs, the view component stays mounted (it's in App.vue usually or View).
    // Let's reset it to be safe.
    autoRefreshInterval.value = 0
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value)
      autoRefreshTimer.value = null
    }
  }
)

const connectionOptions = computed(() => {
  const opts = connStore.savedConnections.map((conn, idx) => ({
    label: conn.name,
    value: idx
  }))
  return [{ label: i18n.global.t('connections.select'), value: '' }, ...opts]
})

async function onTabConnectionChange(val: string | number): Promise<void> {
  if (currentQueryTab.value) {
    if (val === '') {
      currentQueryTab.value.connectionId = null
    } else {
      currentQueryTab.value.connectionId = Number(val)
    }

    if (currentQueryTab.value.connectionId !== null) {
      await connStore.ensureConnection(currentQueryTab.value.connectionId)
    }
  }
}

function onSortChange(sort: { colId: string | null; sort: 'asc' | 'desc' | null }): void {
  if (!sort.colId || !sort.sort) return
  if (!currentQueryTab.value) return
  const match = currentQueryTab.value.sql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i)
  if (match) {
    let newSql = `SELECT * FROM ${match[1]}`
    newSql += ` ORDER BY "${sort.colId}" ${sort.sort.toUpperCase()}`

    currentQueryTab.value.sql = newSql
    tabStore.runQuery()
  }
}

// Resizing logic for editor
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

const tableColumns = computed(() => {
  if (!currentQueryTab.value?.colDefs) return []
  return currentQueryTab.value.colDefs.map((def) => ({
    prop: def.field,
    label: def.headerName || def.field,
    sortable: true,
    width: 150 // Default width, resizing will handle updates
  }))
})

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
  height: 0;
  background: transparent;
  cursor: row-resize;
  z-index: 20;
  flex-shrink: 0;
  position: relative;
  /* Visual line is the border-bottom of the element above, or we add one here if needed */
}

/* Hit area */
.resizer-horizontal::before {
  content: '';
  position: absolute;
  top: -3px;
  bottom: -3px;
  left: 0;
  right: 0;
  z-index: 20;
}
/* Visual line on hover */
.resizer-horizontal::after {
  content: '';
  position: absolute;
  top: -1px; /* Align with the border of the element above */
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-primary);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.resizer-horizontal:hover::after,
.resizer-horizontal:active::after {
  opacity: 1;
  height: 4px;
  top: -2px;
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

.results-toolbar {
  display: flex;
  align-items: center;
  height: 36px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-app); /* Match grid background */
  padding: 0 8px;
  gap: 8px;
  flex-shrink: 0;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-text {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 100px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
}

.auto-refresh-select {
  width: auto;
}

.results-toolbar .base-btn {
  color: var(--text-primary);
}

.spacer {
  flex: 1;
}
</style>
