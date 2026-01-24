<template>
  <div class="base-table-container" tabindex="0" @keydown="onKeyDown">
    <div ref="scrollerRef" class="table-wrapper" @scroll="onScroll">
      <div class="table-content" :style="{ minWidth: totalWidth + rowNumWidth + 'px' }">
        <div class="header-row" :style="{ height: headerHeight + 'px' }">
          <div
            class="header-cell corner-cell"
            :style="{ width: rowNumWidth + 'px', minWidth: rowNumWidth + 'px' }"
          >
            #
          </div>
          <div
            v-for="(col, index) in normalizedColumns"
            :key="col.prop"
            class="header-cell"
            :class="{ sortable: col.sortable }"
            :style="{ width: col.width + 'px', minWidth: col.width + 'px' }"
            @click="onHeaderClick(col)"
          >
            <span class="header-text">{{ col.label }}</span>
            <span v-if="sortState.colId === col.prop" class="sort-indicator">
              {{ sortState.sort === 'asc' ? '↑' : '↓' }}
            </span>
            <div
              class="resize-handle"
              @mousedown.stop.prevent="startResize($event, index)"
              @click.stop
            ></div>
          </div>
        </div>

        <div class="virtual-spacer" :style="{ height: totalHeight + 'px' }">
          <div class="rows-container" :style="{ transform: `translateY(${offsetY}px)` }">
            <div
              v-for="(row, rowIndex) in visibleRows"
              :key="startRowIndex + rowIndex"
              class="table-row"
              :style="{ height: rowHeight + 'px' }"
            >
              <div
                class="row-num-cell"
                :style="{ width: rowNumWidth + 'px', minWidth: rowNumWidth + 'px' }"
              >
                {{ rowOffset + startRowIndex + rowIndex + 1 }}
              </div>
              <div
                v-for="col in normalizedColumns"
                :key="col.prop"
                class="table-cell"
                :class="{
                  selected: isCellSelected(startRowIndex + rowIndex, col.prop),
                  focused: isCellFocused(startRowIndex + rowIndex, col.prop)
                }"
                :style="{ width: col.width + 'px', minWidth: col.width + 'px' }"
                @click="handleCellClick(startRowIndex + rowIndex, col.prop, $event)"
                @contextmenu.prevent="
                  onCellContextMenu($event, row, row[col.prop], startRowIndex + rowIndex, col.prop)
                "
              >
                {{ formatValue(row[col.prop]) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

export interface TableColumn {
  prop: string
  label: string
  width?: number
  sortable?: boolean
}

interface SortState {
  colId: string | null
  sort: 'asc' | 'desc' | null
}

interface CellPosition {
  rowIndex: number
  colKey: string
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]

    data: Record<string, unknown>[]
    rowHeight?: number
    rowOffset?: number
  }>(),
  {
    rowHeight: 28,
    rowOffset: 0
  }
)

const emit = defineEmits<{
  (e: 'sort-change', payload: SortState): void
  (
    e: 'cell-context-menu',
    payload: { event: MouseEvent; value: unknown; data: Record<string, unknown> }
  ): void
  (e: 'column-resize', payload: Record<string, number>): void
}>()

const scrollerRef = ref<HTMLElement | null>(null)
const headerHeight = 28

const containerHeight = ref(0)
const scrollTop = ref(0)
const sortState = ref<SortState>({ colId: null, sort: null })

const focusedCell = ref<CellPosition | null>(null)
const selectedCells = ref<Set<string>>(new Set())
const lastSelectedCell = ref<CellPosition | null>(null)

const columnWidths = ref<Record<string, number>>({})

const rowNumWidth = computed(() => {
  const maxNum = props.rowOffset + props.data.length
  const digits = Math.max(3, String(maxNum).length)
  return digits * 10 + 16
})

const normalizedColumns = computed(() => {
  return props.columns.map((col) => ({
    ...col,
    width: columnWidths.value[col.prop] || col.width || 150
  }))
})

const totalWidth = computed(() => {
  return normalizedColumns.value.reduce((acc, col) => acc + col.width, 0)
})

watch(
  () => props.columns,
  (newCols) => {
    newCols.forEach((col) => {
      if (!columnWidths.value[col.prop]) {
        columnWidths.value[col.prop] = col.width || 150
      }
    })
  },
  { immediate: true }
)

const totalHeight = computed(() => props.data.length * props.rowHeight)
const buffer = 5
const visibleCount = computed(() => Math.ceil(containerHeight.value / props.rowHeight) + buffer * 2)

const startRowIndex = computed(() => {
  const start = Math.floor(scrollTop.value / props.rowHeight) - buffer
  return Math.max(0, start)
})

const offsetY = computed(() => startRowIndex.value * props.rowHeight)

const visibleRows = computed(() => {
  const start = startRowIndex.value
  const end = Math.min(props.data.length, start + visibleCount.value)
  return props.data.slice(start, end)
})

function onScroll(e: Event): void {
  const target = e.target as HTMLElement
  scrollTop.value = Math.max(0, target.scrollTop)
}

function getCellKey(rowIndex: number, colKey: string): string {
  return `${rowIndex}:${colKey}`
}

function isCellSelected(rowIndex: number, colKey: string): boolean {
  return selectedCells.value.has(getCellKey(rowIndex, colKey))
}

function isCellFocused(rowIndex: number, colKey: string): boolean {
  return focusedCell.value?.rowIndex === rowIndex && focusedCell.value?.colKey === colKey
}

function selectCell(rowIndex: number, colKey: string, multi: boolean, range: boolean): void {
  const key = getCellKey(rowIndex, colKey)

  if (range && lastSelectedCell.value) {
    const r1 = Math.min(lastSelectedCell.value.rowIndex, rowIndex)
    const r2 = Math.max(lastSelectedCell.value.rowIndex, rowIndex)
    const c1Idx = normalizedColumns.value.findIndex(
      (c) => c.prop === lastSelectedCell.value!.colKey
    )
    const c2Idx = normalizedColumns.value.findIndex((c) => c.prop === colKey)
    const minC = Math.min(c1Idx, c2Idx)
    const maxC = Math.max(c1Idx, c2Idx)

    selectedCells.value.clear()
    for (let r = r1; r <= r2; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cKey = normalizedColumns.value[c].prop
        selectedCells.value.add(getCellKey(r, cKey))
      }
    }
  } else if (multi) {
    if (selectedCells.value.has(key)) {
      selectedCells.value.delete(key)
    } else {
      selectedCells.value.add(key)
    }
    lastSelectedCell.value = { rowIndex, colKey }
  } else {
    selectedCells.value.clear()
    selectedCells.value.add(key)
    lastSelectedCell.value = { rowIndex, colKey }
  }

  focusedCell.value = { rowIndex, colKey }
}

function handleCellClick(rowIndex: number, colProp: string, event: MouseEvent): void {
  selectCell(rowIndex, colProp, event.metaKey || event.ctrlKey, event.shiftKey)
}

function onKeyDown(e: KeyboardEvent): void {
  if (!focusedCell.value) return

  const { rowIndex, colKey } = focusedCell.value
  const colIndex = normalizedColumns.value.findIndex((c) => c.prop === colKey)

  let nextRow = rowIndex
  let nextColIndex = colIndex

  switch (e.key) {
    case 'ArrowUp':
      nextRow = Math.max(0, rowIndex - 1)
      break
    case 'ArrowDown':
      nextRow = Math.min(props.data.length - 1, rowIndex + 1)
      break
    case 'ArrowLeft':
      nextColIndex = Math.max(0, colIndex - 1)
      break
    case 'ArrowRight':
      nextColIndex = Math.min(normalizedColumns.value.length - 1, colIndex + 1)
      break
    default:
      return
  }

  const nextColKey = normalizedColumns.value[nextColIndex].prop

  if (nextRow !== rowIndex || nextColIndex !== colIndex) {
    e.preventDefault()
    focusedCell.value = { rowIndex: nextRow, colKey: nextColKey }
    if (e.shiftKey) {
      selectCell(nextRow, nextColKey, false, true)
    } else {
      selectCell(nextRow, nextColKey, false, false)
    }
    scrollToCell(nextRow, nextColIndex)
  }
}

function scrollToCell(rowIndex: number, colIndex: number): void {
  if (!scrollerRef.value) return

  const scroller = scrollerRef.value

  const scrollbarHeight = scroller.offsetHeight - scroller.clientHeight
  const scrollbarWidth = scroller.offsetWidth - scroller.clientWidth

  const realRowTop = headerHeight + rowIndex * props.rowHeight
  const realRowBottom = realRowTop + props.rowHeight

  const visibleTop = scroller.scrollTop + headerHeight
  const visibleBottom = scroller.scrollTop + scroller.clientHeight - scrollbarHeight

  if (realRowTop < visibleTop) {
    scroller.scrollTop = realRowTop - headerHeight
  } else if (realRowBottom > visibleBottom) {
    scroller.scrollTop = realRowBottom - scroller.clientHeight + scrollbarHeight
  }

  let colLeft = 0
  for (let i = 0; i < colIndex; i++) {
    colLeft += normalizedColumns.value[i].width
  }
  const colWidth = normalizedColumns.value[colIndex].width
  const realColLeft = rowNumWidth.value + colLeft
  const realColRight = realColLeft + colWidth

  const visibleLeft = scroller.scrollLeft + rowNumWidth.value
  const visibleRight = scroller.scrollLeft + scroller.clientWidth - scrollbarWidth

  if (realColLeft < visibleLeft) {
    scroller.scrollLeft = colLeft
  } else if (realColRight > visibleRight) {
    scroller.scrollLeft = realColRight - scroller.clientWidth + scrollbarWidth
  }
}

function onHeaderClick(col: TableColumn): void {
  if (!col.sortable) return

  if (sortState.value.colId !== col.prop) {
    sortState.value = { colId: col.prop, sort: 'asc' }
  } else if (sortState.value.sort === 'asc') {
    sortState.value = { colId: col.prop, sort: 'desc' }
  } else {
    sortState.value = { colId: null, sort: null }
  }
  emit('sort-change', sortState.value)
}

const isResizing = ref(false)
const resizeState = ref<{ startX: number; startWidth: number; colIndex: number } | null>(null)

function startResize(e: MouseEvent, index: number): void {
  isResizing.value = true
  const col = normalizedColumns.value[index]
  resizeState.value = {
    startX: e.clientX,
    startWidth: col.width,
    colIndex: index
  }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent): void {
  if (!resizeState.value) return
  const delta = e.clientX - resizeState.value.startX
  const newWidth = Math.max(50, resizeState.value.startWidth + delta)
  const colProp = normalizedColumns.value[resizeState.value.colIndex].prop
  columnWidths.value[colProp] = newWidth
}

function onResizeEnd(): void {
  isResizing.value = false
  resizeState.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  emit('column-resize', columnWidths.value)
}

function onCellContextMenu(
  event: MouseEvent,
  row: Record<string, unknown>,
  value: unknown,
  rowIndex: number,
  colKey: string
): void {
  if (!isCellSelected(rowIndex, colKey)) {
    selectCell(rowIndex, colKey, false, false)
  }
  emit('cell-context-menu', { event, value, data: row })
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '(NULL)'
  if (typeof val === 'object') {
    if (val && (val as Record<string, unknown>).__isWrapped) {
      return (val as Record<string, unknown>).display as string
    }
    return JSON.stringify(val)
  }
  return String(val)
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (scrollerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(scrollerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<style scoped>
.base-table-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  border: none;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  outline: none;
  overflow: hidden;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
}

.table-content {
  display: flex;
  flex-direction: column;
}

.header-row {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--bg-panel-header);
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.header-cell {
  padding: 0 8px;
  display: flex;
  align-items: center;
  position: relative;
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-weight: 600;
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}

.header-cell.corner-cell {
  position: sticky;
  left: 0;
  z-index: 40;
  background: var(--bg-panel-header);
  justify-content: center;
}

.header-cell.sortable {
  cursor: pointer;
}

.header-cell.sortable:hover {
  background: var(--list-hover-bg);
  color: var(--text-primary);
}

.header-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sort-indicator {
  margin-left: 4px;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 10;
}

.resize-handle:hover {
  background: var(--accent-primary);
}

.virtual-spacer {
  position: relative;
}

.rows-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.table-row {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.row-num-cell {
  position: sticky;
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-size: 11px;
  border-right: 1px solid var(--border-color);
  box-sizing: border-box;
  flex-shrink: 0;
}

.table-cell {
  padding: 0 8px;
  display: flex;
  align-items: center;
  border-right: 1px solid var(--border-color);
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-sizing: border-box;
  flex-shrink: 0;
}

.table-cell.selected {
  box-shadow: inset 0 0 0 1px var(--accent-primary);
}

.table-cell.focused {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
  z-index: 2;
}
</style>
