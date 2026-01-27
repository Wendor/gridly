<template>
  <div
    ref="containerRef"
    class="base-table-container"
    tabindex="0"
    @keydown="onKeyDown"
    @wheel.passive="onWheel"
    @copy.prevent="onCopy"
    @paste.prevent="onPaste"
  >
    <!-- 1. Top Left: Corner -->
    <div
      class="corner-pane"
      :style="{ width: rowNumWidth + 'px', height: headerHeight + 'px' }"
    >
      #
    </div>

    <!-- 2. Top Right: Headers -->
    <div
      class="header-pane"
      :style="{
        left: rowNumWidth + 'px',
        height: headerHeight + 'px',
        right: '15px' /* Space for vertical scrollbar */
      }"
    >
      <div
        class="header-content"
        :style="{
          transform: `translate3d(${-scrollLeft}px, 0, 0)`,
          width: totalWidth + 'px'
        }"
      >
        <div :style="{ width: spacerWidth + 'px', flexShrink: 0 }"></div>
        <div
          v-for="(col, index) in visibleColumns"
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
            @mousedown.stop.prevent="startResize($event, visibleColumnsState.start + index)"
            @click.stop
          ></div>
        </div>
      </div>
    </div>

    <!-- 3. Bottom Left: Row Numbers -->
    <div
      class="row-header-pane"
      :style="{
        top: headerHeight + 'px',
        width: rowNumWidth + 'px',
        bottom: '15px' /* Space for horizontal scrollbar */
      }"
    >
      <!-- Optimized: No virtual spacer needed in DOM, just transform -->
      <div
        class="rows-container"
        :style="{ transform: `translate3d(0, ${offsetY - scrollTop}px, 0)` }"
      >
        <div
          v-for="(row, rowIndex) in visibleRows"
          :key="rowOffset + startRowIndex + rowIndex"
          class="row-num-cell"
          :style="{ height: rowHeight + 'px' }"
        >
          {{ rowOffset + startRowIndex + rowIndex + 1 }}
        </div>
      </div>
    </div>

    <!-- 4. Bottom Right: Data -->
    <div
      class="data-pane"
      :style="{
        top: headerHeight + 'px',
        left: rowNumWidth + 'px',
        right: '15px',
        bottom: '15px'
      }"
      @mousedown="onContainerMouseDown"
      @dblclick="onContainerDblClick"
      @contextmenu="onContainerContextMenu"
    >
      <div
        class="rows-container"
        :style="{ transform: `translate3d(${-scrollLeft}px, ${offsetY - scrollTop}px, 0)` }"
      >
        <div
          v-for="(row, rowIndex) in visibleRows"
          :key="rowOffset + startRowIndex + rowIndex"
          class="table-row"
          :style="{ height: rowHeight + 'px', width: totalWidth + 'px' }"
        >
          <div :style="{ width: spacerWidth + 'px', flexShrink: 0 }"></div>
          <div
            v-for="col in visibleColumns"
            :key="col.prop"
            class="table-cell"
            :class="{
              selected: isCellSelected(startRowIndex + rowIndex, col.prop),
              focused: isCellFocused(startRowIndex + rowIndex, col.prop),
              changed: isCellChanged(startRowIndex + rowIndex, col.prop)
            }"
            :style="{ width: col.width + 'px', minWidth: col.width + 'px' }"
            :data-row-index="startRowIndex + rowIndex"
            :data-col-key="col.prop"
          >
            <!-- Display Value -->
            <span
              :class="{ 'special-value': isSpecialValue(row[col.prop]) }"
              :style="{ opacity: isEditing(startRowIndex + rowIndex, col.prop) ? 0 : 1 }"
            >
              {{ formatTableValue(row[col.prop]) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading-overlay">
        <BaseIcon name="loader" spin style="font-size: 24px" />
      </div>

      <div v-if="data.length === 0 && !loading" class="empty-state">
        <slot name="empty">No Data</slot>
      </div>
    </div>

    <!-- 5. Dummy Scrollers -->
    <div
      ref="vScrollerRef"
      class="vertical-scroller"
      tabindex="-1"
      :style="{ top: headerHeight + 'px', bottom: '15px' }"
      @scroll="onVirtualScrollY"
    >
      <div :style="{ height: totalHeight + 'px' }"></div>
    </div>

    <div
      ref="hScrollerRef"
      class="horizontal-scroller"
      tabindex="-1"
      :style="{ left: rowNumWidth + 'px', right: '15px' }"
      @scroll="onVirtualScrollX"
    >
      <div :style="{ width: totalWidth + 'px', height: '1px' }"></div>
    </div>

    <!-- Context Menu -->
    <BaseContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @close="closeContextMenu"
    >
      <div class="ctx-item" @click="copyValue">Copy Value</div>
      <div class="ctx-item" @click="copyRow">Copy Row JSON</div>
    </BaseContextMenu>

    <!-- Singleton Input -->
    <input
      v-if="editingCell"
      ref="editInputRef"
      v-model="editValue"
      class="cell-input singleton-input"
      :style="{
        top: singletonInputState.top + 'px',
        left: singletonInputState.left + 'px',
        width: singletonInputState.width + 'px',
        height: singletonInputState.height + 'px'
      }"
      @blur="finishEdit"
      @keydown.enter.stop="onInputEnter"
      @keydown.esc.stop="cancelEdit"
      @keydown.tab.prevent.stop="onInputTab"
      @click.stop
      @mousedown.stop
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, shallowRef, reactive } from 'vue';
import { formatTableValue } from '@/utils/tableFormatter';
import { isWrappedValue } from '@/types';
import BaseIcon from '../ui/BaseIcon.vue';
import BaseContextMenu from '../ui/BaseContextMenu.vue';

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
    editable?: boolean
    changedCells?: Set<string>
    primaryKeys?: string[]
    loading?: boolean
  }>(),
  {
    rowHeight: 28,
    rowOffset: 0,
    editable: false,
    changedCells: () => new Set(),
    primaryKeys: () => [],
    loading: false,
  },
);

const emit = defineEmits<{
  (e: 'sort-change', payload: SortState): void
  (
    e: 'cell-context-menu',
    payload: { event: MouseEvent; value: unknown; data: Record<string, unknown> }
  ): void
  (e: 'column-resize', payload: Record<string, number>): void
  (e: 'cell-change', payload: { rowIndex: number; column: string; value: unknown }): void
  (
    e: 'cell-focus',
    payload: { rowIndex: number; colKey: string; value: unknown; row: Record<string, unknown> } | null
  ): void
}>();

// Refs
const containerRef = ref<HTMLElement | null>(null);
const vScrollerRef = ref<HTMLElement | null>(null);
const hScrollerRef = ref<HTMLElement | null>(null);
// Singleton Input Ref
const editInputRef = ref<HTMLInputElement | null>(null);
const headerHeight = 28;

const containerHeight = ref(0);
const containerWidth = ref(0);
const scrollTop = ref(0);
const scrollLeft = ref(0);
const sortState = ref<SortState>({ colId: null, sort: null });

const focusedCell = ref<CellPosition | null>(null);
const selectedCells = shallowRef<Set<string>>(new Set());
const lastSelectedCell = ref<CellPosition | null>(null);

// Values
const editingCell = ref<{ rowIndex: number; colKey: string } | null>(null);
const editValue = ref<string>('');
const columnWidths = ref<Record<string, number>>({});

const singletonInputState = reactive({
  visible: false,
  top: 0,
  left: 0,
  width: 0,
  height: 0,
});

// Watchers
watch(focusedCell, (newVal) => {
  if (newVal) {
    const row = props.data[newVal.rowIndex];
    const value = row ? row[newVal.colKey] : undefined;
    emit('cell-focus', {
      rowIndex: newVal.rowIndex,
      colKey: newVal.colKey,
      value,
      row: row || {},
    });
  } else {
    emit('cell-focus', null);
  }
});

watch(
  () => props.columns,
  (newCols) => {
    newCols.forEach((col) => {
      if (!columnWidths.value[col.prop]) {
        columnWidths.value[col.prop] = col.width || 150;
      }
    });
  },
  { immediate: true },
);

// Computed Layout
const rowNumWidth = computed(() => {
  const maxNum = props.rowOffset + props.data.length;
  const digits = Math.max(3, String(maxNum).length);
  return digits * 10 + 16;
});

const normalizedColumns = computed(() => {
  return props.columns.map((col) => ({
    ...col,
    width: columnWidths.value[col.prop] || col.width || 150,
  }));
});

const columnOffsets = computed(() => {
  const offsets: Record<string, number> = {};
  let current = 0;
  for (const col of normalizedColumns.value) {
    offsets[col.prop] = current;
    current += col.width;
  }
  return offsets;
});

const totalWidth = computed(() => {
  return normalizedColumns.value.reduce((acc, col) => acc + col.width, 0);
});

const totalHeight = computed(() => props.data.length * props.rowHeight);
const buffer = 20;
// Use containerHeight ref for Viewport calculations
const visibleCount = computed(() => Math.ceil((containerHeight.value || 500) / props.rowHeight) + buffer * 2);

const startRowIndex = computed(() => {
  const start = Math.floor(scrollTop.value / props.rowHeight) - buffer;
  return Math.max(0, start);
});

const offsetY = computed(() => startRowIndex.value * props.rowHeight);

// Virtual Columns
const bufferCol = 5;
const visibleColumnsState = computed(() => {
  const currentScroll = scrollLeft.value;
  const width = containerWidth.value;
  const cols = normalizedColumns.value;

  if (width === 0) return { start: 0, end: cols.length, padLeft: 0 };

  let start = 0;
  let end = cols.length;
  let padLeft = 0;

  // Find start
  let currentWidth = 0;
  for (let i = 0; i < cols.length; i++) {
    const w = cols[i].width;
    if (currentWidth + w > currentScroll) {
      start = Math.max(0, i - bufferCol);
      break;
    }
    currentWidth += w;
  }

  // Calc PAD
  for (let i = 0; i < start; i++) {
    padLeft += cols[i].width;
  }

  // Find end
  let visibleW = 0;
  for (let i = start; i < cols.length; i++) {
    visibleW += cols[i].width;
    // approx check
    if (visibleW > width + (bufferCol * 300)) {
      end = i + 1 + bufferCol;
      break;
    }
  }

  end = Math.min(cols.length, end);

  return { start, end, padLeft };
});

const visibleColumns = computed(() => {
  const { start, end } = visibleColumnsState.value;
  return normalizedColumns.value.slice(start, end);
});

const spacerWidth = computed(() => visibleColumnsState.value.padLeft);

const visibleRows = computed(() => {
  const start = startRowIndex.value;
  const end = Math.min(props.data.length, start + visibleCount.value);
  return props.data.slice(start, end);
});

// SCROLL HANDLING
function onVirtualScrollY(e: Event) {
  const target = e.target as HTMLElement;
  scrollTop.value = target.scrollTop;
}

function onVirtualScrollX(e: Event) {
  const target = e.target as HTMLElement;
  scrollLeft.value = target.scrollLeft;
}

function onWheel(e: WheelEvent) {
  if (editingCell.value) finishEdit(); // Close edit on scroll

  if (vScrollerRef.value) {
    vScrollerRef.value.scrollTop += e.deltaY;
  }
  if (hScrollerRef.value) {
    hScrollerRef.value.scrollLeft += e.deltaX;
  }
}

// Helpers
function getCellKey(rowIndex: number, colKey: string): string {
  return `${rowIndex}:${colKey}`;
}

function isCellSelected(rowIndex: number, colKey: string): boolean {
  return selectedCells.value.has(getCellKey(rowIndex, colKey));
}

function isCellFocused(rowIndex: number, colKey: string): boolean {
  return focusedCell.value?.rowIndex === rowIndex && focusedCell.value?.colKey === colKey;
}

function selectCell(rowIndex: number, colKey: string, multi: boolean, range: boolean): void {
  const key = getCellKey(rowIndex, colKey);
  const newSet = new Set(selectedCells.value);

  if (range && lastSelectedCell.value) {
    const r1 = Math.min(lastSelectedCell.value.rowIndex, rowIndex);
    const r2 = Math.max(lastSelectedCell.value.rowIndex, rowIndex);
    const c1Idx = normalizedColumns.value.findIndex(c => c.prop === lastSelectedCell.value!.colKey);
    const c2Idx = normalizedColumns.value.findIndex(c => c.prop === colKey);
    const minC = Math.min(c1Idx, c2Idx);
    const maxC = Math.max(c1Idx, c2Idx);

    newSet.clear();
    for (let r = r1; r <= r2; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cKey = normalizedColumns.value[c].prop;
        newSet.add(getCellKey(r, cKey));
      }
    }
  } else if (multi) {
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    lastSelectedCell.value = { rowIndex, colKey };
  } else {
    if (newSet.size === 1 && newSet.has(key)) {
      focusedCell.value = { rowIndex, colKey };
      return;
    }
    newSet.clear();
    newSet.add(key);
    lastSelectedCell.value = { rowIndex, colKey };
  }

  selectedCells.value = newSet;
  focusedCell.value = { rowIndex, colKey };
}

function handleCellClick(rowIndex: number, colProp: string, event: MouseEvent): void {
  if (!isEditing(rowIndex, colProp)) {
    event.preventDefault();
    // Focus container to capture key events
    containerRef.value?.focus({ preventScroll: true });
  }
  selectCell(rowIndex, colProp, event.metaKey || event.ctrlKey, event.shiftKey);
}

function getTargetCell(e: Event): { rowIndex: number; colKey: string } | null {
  const target = e.target as HTMLElement;
  const cell = target.closest('.table-cell') as HTMLElement;
  if (!cell) return null;
  const rowIndexStr = cell.dataset.rowIndex;
  const colKey = cell.dataset.colKey;
  if (!rowIndexStr || !colKey) return null;
  return { rowIndex: parseInt(rowIndexStr, 10), colKey };
}

function onContainerMouseDown(e: MouseEvent): void {
  const target = getTargetCell(e);
  if (!target) return;
  handleCellClick(target.rowIndex, target.colKey, e);
}

function onContainerDblClick(e: MouseEvent): void {
  const target = getTargetCell(e);
  if (!target) return;
  handleCellDblClickInternal(target.rowIndex, target.colKey);
}



function onContainerContextMenu(e: MouseEvent): void {
  const target = getTargetCell(e);
  if (!target) return;
  e.preventDefault();
  const { rowIndex, colKey } = target;
  const row = props.data[rowIndex];
  if (!row) return;
  onCellContextMenu(e, row, row[colKey], rowIndex, colKey);
}

// Keyboard
function onKeyDown(e: KeyboardEvent): void {
  if (editingCell.value) return;
  if (!focusedCell.value) return;

  const { rowIndex, colKey } = focusedCell.value;
  const colIndex = normalizedColumns.value.findIndex((c) => c.prop === colKey);

  let nextRow = rowIndex;
  let nextColIndex = colIndex;

  switch (e.key) {
    case 'ArrowUp': nextRow = Math.max(0, rowIndex - 1); break;
    case 'ArrowDown': nextRow = Math.min(props.data.length - 1, rowIndex + 1); break;
    case 'ArrowLeft': nextColIndex = Math.max(0, colIndex - 1); break;
    case 'ArrowRight': nextColIndex = Math.min(normalizedColumns.value.length - 1, colIndex + 1); break;
    case 'Tab':
      e.preventDefault();
      if (e.shiftKey) {
        nextColIndex--;
        if (nextColIndex < 0) { nextColIndex = normalizedColumns.value.length - 1; nextRow--; }
      } else {
        nextColIndex++;
        if (nextColIndex >= normalizedColumns.value.length) { nextColIndex = 0; nextRow++; }
      }
      nextRow = Math.max(0, Math.min(props.data.length - 1, nextRow));
      break;
    case 'Enter':
      e.preventDefault();
      if (props.editable) startEdit(rowIndex, colKey, false);
      return;
    default:
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && props.editable) {
        e.preventDefault();
        startEdit(rowIndex, colKey, true, e.key);
      }
      return;
  }

  // Guard bounds
  if (nextColIndex < 0) nextColIndex = 0;
  if (nextColIndex >= normalizedColumns.value.length) nextColIndex = normalizedColumns.value.length - 1;

  const nextColKey = normalizedColumns.value[nextColIndex].prop;
  if (nextRow !== rowIndex || nextColIndex !== colIndex) {
    e.preventDefault();
    focusedCell.value = { rowIndex: nextRow, colKey: nextColKey };
    if (e.shiftKey && e.key !== 'Tab') selectCell(nextRow, nextColKey, false, true);
    else selectCell(nextRow, nextColKey, false, false);
    scrollToCell(nextRow, nextColIndex);
  }
}

function scrollToCell(rowIndex: number, colIndex: number): void {
  if (!vScrollerRef.value || !hScrollerRef.value) return;

  const rowTop = rowIndex * props.rowHeight;
  const rowBottom = rowTop + props.rowHeight;

  if (rowTop < scrollTop.value) {
    vScrollerRef.value.scrollTop = rowTop;
  } else if (rowBottom > scrollTop.value + containerHeight.value) {
    vScrollerRef.value.scrollTop = rowBottom - containerHeight.value;
  }

  let colLeft = 0;
  for(let i=0; i<colIndex; i++) colLeft += normalizedColumns.value[i].width;
  const colRight = colLeft + normalizedColumns.value[colIndex].width;

  if (colLeft < scrollLeft.value) {
    hScrollerRef.value.scrollLeft = colLeft;
  } else if (colRight > scrollLeft.value + containerWidth.value) {
    hScrollerRef.value.scrollLeft = colRight - containerWidth.value;
  }
}

function onHeaderClick(col: TableColumn): void {
  if (!col.sortable) return;
  if (sortState.value.colId !== col.prop) sortState.value = { colId: col.prop, sort: 'asc' };
  else if (sortState.value.sort === 'asc') sortState.value = { colId: col.prop, sort: 'desc' };
  else sortState.value = { colId: null, sort: null };
  emit('sort-change', sortState.value);
}

// Resizing
const isResizing = ref(false);
const resizeState = ref<{ startX: number; startWidth: number; colIndex: number } | null>(null);

function startResize(e: MouseEvent, index: number): void {
  isResizing.value = true;
  const col = normalizedColumns.value[index];
  resizeState.value = { startX: e.clientX, startWidth: col.width, colIndex: index };
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(e: MouseEvent): void {
  if (!resizeState.value) return;
  const delta = e.clientX - resizeState.value.startX;
  const newWidth = Math.max(50, resizeState.value.startWidth + delta);
  const colProp = normalizedColumns.value[resizeState.value.colIndex].prop;
  columnWidths.value[colProp] = newWidth;
}

function onResizeEnd(): void {
  isResizing.value = false;
  resizeState.value = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  emit('column-resize', columnWidths.value);
}

// Context Menu
const contextMenu = reactive({ visible: false, x: 0, y: 0, value: null as unknown, rowData: null as unknown });

function onCellContextMenu(event: MouseEvent, row: Record<string, unknown>, value: unknown, rowIndex: number, colKey: string): void {
  if (!isCellSelected(rowIndex, colKey)) selectCell(rowIndex, colKey, false, false);
  contextMenu.value = value;
  contextMenu.rowData = row;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.visible = true;
}

function closeContextMenu(): void { contextMenu.visible = false; }

async function copyValue(): Promise<void> {
  const raw = contextMenu.value;
  let val = '';
  if (raw === null) val = '(NULL)';
  else if (isWrappedValue(raw)) val = typeof raw.raw === 'string' ? raw.raw : JSON.stringify(raw.raw);
  else val = String(raw);
  await navigator.clipboard.writeText(val);
  closeContextMenu();
}

async function copyRow(): Promise<void> {
   if (!contextMenu.rowData) return;
   const cleanRow = {} as Record<string, unknown>;
   for (const [k, v] of Object.entries(contextMenu.rowData as Record<string, unknown>)) {
     if (isWrappedValue(v)) cleanRow[k] = v.raw;
     else cleanRow[k] = v;
   }
   const json = JSON.stringify(cleanRow, null, 2);
   await navigator.clipboard.writeText(json);
   closeContextMenu();
}

// Helpers
function isSpecialValue(val: unknown): boolean { return val === null || val === undefined || isWrappedValue(val); }
function isCellChanged(rowIndex: number, colKey: string): boolean { return props.changedCells.has(getCellKey(rowIndex, colKey)); }
function isEditing(rowIndex: number, colKey: string): boolean {
  return editingCell.value !== null && editingCell.value.rowIndex === rowIndex && editingCell.value.colKey === colKey;
}
function isPrimaryKeyColumn(colKey: string): boolean { return props.primaryKeys.includes(colKey); }

function startEdit(rowIndex: number, colKey: string, clearContent: boolean = false, initialKey: string = ''): void {
  editingCell.value = { rowIndex, colKey };
  const row = props.data[rowIndex];
  if (clearContent) editValue.value = initialKey;
  else editValue.value = formatTableValue(row[colKey]);

  // Update Singleton Position
  const col = normalizedColumns.value.find(c => c.prop === colKey);
  const colW = col?.width || 150;
  const colL = columnOffsets.value[colKey] || 0;

  // Calculate relative to the viewport (accounting for scroll)
  // We want to pin it to the cell's physical location
  // If we want it to scroll WITH the content, we need to update it on Scroll.
  // But for now let's just calc initial.

  // Actually, simpler: close edit on scroll?
  // Let's rely on updateSingletonPosition which we'll call on scroll or keep static and close on scroll.

  // Adjust dimensions to match cell content box (excluding borders)
  // Table row has border-bottom: 1px, Table cell has border-right: 1px
  // Selection shadow is inset, so it sits inside the borders.
  // We must shrink the input to match.
  singletonInputState.width = colW - 1;
  singletonInputState.height = props.rowHeight - 1;

  // Top: Header(28) + RowOffset - ScrollTop
  singletonInputState.top = headerHeight + (rowIndex * props.rowHeight) - scrollTop.value;
  // Left: RowNum(Width) + ColOffset - ScrollLeft
  singletonInputState.left = rowNumWidth.value + colL - scrollLeft.value;
  singletonInputState.visible = true;

  nextTick(() => {
    if (editInputRef.value) {
      editInputRef.value.focus();
      if (!clearContent) editInputRef.value.select();
    }
  });
}

function handleCellDblClickInternal(rowIndex: number, colKey: string): void {
  if (!props.editable) return;
  startEdit(rowIndex, colKey, false);
}

function finishEdit(): void {
  if (!editingCell.value) return;
  const { rowIndex, colKey } = editingCell.value;
  const valueToEmit = editValue.value;
  editingCell.value = null;
  editValue.value = '';

  // Return focus to container
  containerRef.value?.focus({ preventScroll: true });

  setTimeout(() => emit('cell-change', { rowIndex, column: colKey, value: valueToEmit }), 0);
}

function onInputEnter(): void { finishEdit(); }
function onInputTab(_e: KeyboardEvent): void { /* same logic as keydown tab, simplified */ finishEdit(); }
function cancelEdit(): void { editingCell.value = null; editValue.value = ''; containerRef.value?.focus({ preventScroll: true }); }

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  if (containerRef.value) {
    // Observer on the Data Pane area specifically?
    // Actually we need the metrics of the data pane to size the dummy scrollbars page size?
    // Let's observe the container. div.data-pane is simpler to just observe containerRef and subtract headers
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // We have fixed headers/rowNums.
        containerWidth.value = entry.contentRect.width - rowNumWidth.value - 15; // - scrollbar
        containerHeight.value = entry.contentRect.height - headerHeight - 15; // - scrollbar
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => { if (resizeObserver) resizeObserver.disconnect(); });

async function onPaste(): Promise<void> {
  if (!props.editable || !focusedCell.value) return;
  const { rowIndex, colKey } = focusedCell.value;
  if (isPrimaryKeyColumn(colKey)) return;
  try {
    const text = await navigator.clipboard.readText();
    if (text) emit('cell-change', { rowIndex, column: colKey, value: text });
  } catch (e) {
    console.error('Failed to read clipboard', e);
  }
}

function onCopy(): void {
    if (selectedCells.value.size === 0) return;
    const cells: { r: number; cIdx: number; val: unknown }[] = [];
    for(const key of selectedCells.value) {
        const [r, cKey] = key.split(':');
        const rowIndex = parseInt(r);
        const cIdx = normalizedColumns.value.findIndex(c => c.prop === cKey);
        if(rowIndex >= 0 && cIdx >= 0 && props.data[rowIndex]) {
            const rowData = props.data[rowIndex];
            cells.push({r: rowIndex, cIdx, val: rowData[cKey]});
        }
    }
    cells.sort((a, b) => { if(a.r !== b.r) return a.r - b.r; return a.cIdx - b.cIdx; });
    const rowsMap = new Map<number, typeof cells>();
    for(const c of cells){ if(!rowsMap.has(c.r)) rowsMap.set(c.r, []); rowsMap.get(c.r)!.push(c); }
    const lines: string[] = [];
    for(const [, rowCells] of rowsMap) lines.push(rowCells.map(rc => formatTableValue(rc.val)).join('\t'));
    navigator.clipboard.writeText(lines.join('\n'));
}
</script>

<style scoped>
.base-table-container {
  width: 100%;
  height: 100%;
  position: relative; /* Anchor/Canvas */
  background: var(--bg-app);
  overflow: hidden;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  border: none;
  outline: none;
}

/* Panes positioned absolutely */
.corner-pane {
  position: absolute;
  top: 0;
  left: 0;
  background: var(--bg-panel-header);
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-weight: 600;
  user-select: none;
  z-index: 30;
  box-sizing: border-box;
}

.header-pane {
  position: absolute;
  top: 0;
  /* left/right set by style */
  background: var(--bg-panel-header);
  border-bottom: 1px solid var(--border-color);
  overflow: hidden; /* No native scroll */
  z-index: 20;
  box-sizing: border-box;
}

.row-header-pane {
  position: absolute;
  left: 0;
  /* top/bottom set by style */
  background: var(--bg-panel-header);
  /* border-right: 1px solid var(--border-color); replaced by shadow for better cell overlap */
  box-shadow: inset -1px 0 0 0 var(--border-color);
  overflow: hidden; /* No native scroll */
  z-index: 20;
  box-sizing: border-box;
}

.data-pane {
  position: absolute;
  /* top/left/right/bottom set by style */
  overflow: hidden; /* No native scroll */
  z-index: 10;
  box-sizing: border-box;
}

.rows-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  /* Transform will move this */
  will-change: transform;
}

.header-content {
  display: flex;
  height: 100%;
  will-change: transform;
}

/* Dummy Scrollers */
.vertical-scroller {
  position: absolute;
  right: 0;
  width: 15px;
  /* top/bottom set by style */
  overflow-y: scroll;
  overflow-x: hidden;
  z-index: 40;
}

.horizontal-scroller {
  position: absolute;
  bottom: 0;
  height: 15px;
  /* left/right set by style */
  overflow-x: scroll;
  overflow-y: hidden;
  z-index: 40;
}

/* Content Styles */
.header-cell {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
  box-sizing: border-box;
}
.header-cell.sortable { cursor: pointer; }
.header-cell.sortable:hover { background: var(--list-hover-bg); }

.row-num-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
  color: var(--text-secondary);
  font-size: 11px;
}

.table-row {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.table-cell {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-right: 1px solid var(--border-color);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  box-sizing: border-box;
  color: var(--text-primary);
  cursor: default;
}
.table-cell.selected {
  background: color-mix(in srgb, var(--accent-primary), transparent 80%);
  box-shadow: inset 0 0 0 1px var(--accent-primary);

}
.table-cell.changed {
  background: color-mix(in srgb, var(--warning), transparent 85%);
  box-shadow: inset 0 0 0 1px var(--warning);
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
.resize-handle:hover { background: var(--accent-primary); }
.sort-indicator { margin-left: 4px; }

.cell-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-app);
  color: var(--text-primary);
  font-family: inherit;
  font-size: inherit;
  margin: 0;
  padding: 0 9px; /* +1px to compensate for missing border */
  outline: none;
  z-index: 100; /* Ensure on top */
  box-sizing: border-box;
  box-shadow: inset 0 0 0 1px var(--accent-primary);
}

.special-value { color: var(--text-secondary); font-style: italic; }
.ctx-item { padding: 8px 12px; cursor: pointer; color: var(--text-primary); }
.ctx-item:hover { background: var(--list-hover-bg); }

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}
</style>
