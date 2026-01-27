<template>
  <div class="query-view">
    <ControlPanel>
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

      <template #right>
        <div class="toolbar-right">
          <BaseButton
            v-if="!currentQueryTab?.loading"
            variant="primary"
            :disabled="currentQueryTab?.connectionId === null"
            @click="tabStore.runQuery()"
          >
            <BaseIcon name="play" /> {{ $t('query.run') }}
          </BaseButton>
          <BaseButton
            v-else
            variant="danger"
            @click="tabStore.cancelQuery()"
          >
            <BaseIcon name="square" /> {{ $t('common.cancel') }}
          </BaseButton>
        </div>
      </template>
    </ControlPanel>

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

      <div v-if="currentQueryTab" class="view-panel-header">
         <ControlPanel>
            <div class="pagination-controls">
              <BaseButton :disabled="!canGoPrev" variant="ghost" icon-only @click="goFirst">
                <BaseIcon name="chevronsLeft" />
              </BaseButton>
              <BaseButton :disabled="!canGoPrev" variant="ghost" icon-only @click="tabStore.prevPage">
                <BaseIcon name="chevronLeft" />
              </BaseButton>

              <div class="pagination-info">
                <span class="pagination-range">{{ paginationRangeText }}</span>
                <span v-if="currentQueryTab.pagination.total !== null" class="pagination-total">{{
                  paginationTotalText
                }}</span>
              </div>

              <BaseButton :disabled="!canGoNext" variant="ghost" icon-only @click="tabStore.nextPage">
                <BaseIcon name="chevronRight" />
              </BaseButton>
              <BaseButton :disabled="!canGoLast" variant="ghost" icon-only @click="goLast">
                <BaseIcon name="chevronsRight" />
              </BaseButton>
            </div>

            <div class="toolbar-divider"></div>

            <BaseSelect
                      v-if="currentQueryTab"
                      :model-value="currentQueryTab.pagination.limit"
                      :options="limitOptions"
                      :label="$t('pagination.limit')"
                      inline-label
                      variant="ghost"
                      class="limit-select-icon"
                      @update:model-value="onLimitChange"
                    />

                    <div class="toolbar-divider"></div>

                    <BaseButton
                      :title="$t('query.refresh')"
                      variant="ghost"
                      icon-only
                      @click="tabStore.runQuery()"
                    >
                      <BaseIcon name="refresh" />
                    </BaseButton>

                    <BaseSelect
                      :model-value="autoRefreshInterval"
                      :options="autoRefreshOptions"
                      icon="clock"
                      class="auto-refresh-select"
                      highlight-active
                      @update:model-value="onAutoRefreshChange"
                    />

                    <div class="toolbar-divider"></div>

                    <BaseButton
                        variant="ghost"
                        icon-only

                        :disabled="!currentQueryTab?.rows?.length"
                        @click="exportCsv"
                    >
                      <BaseIcon name="download" />
                    </BaseButton>
                    <div class="toolbar-divider"></div>

                    <BaseButton
                      variant="ghost"
                      icon-only
                      :title="$t('query.revertChanges')"
                      class="revert-btn"
                      :disabled="!hasChanges"
                      @click="tabStore.revertChanges"
                    >
                      <BaseIcon name="undo" />
                    </BaseButton>

                    <BaseButton
                      variant="ghost"
                      icon-only
                      :title="$t('query.commitChanges')"
                      class="action-btn"
                      :class="{ 'primary-icon': hasChanges }"
                      :disabled="!hasChanges"
                      @click="tabStore.commitChanges"
                    >
                      <BaseIcon name="save" />
                    </BaseButton>

                    <div v-if="hasChanges" class="toolbar-divider"></div>
                    <div v-if="hasChanges" class="changes-info">
                      <span class="changes-count">{{ changesCountText }}</span>
                    </div>

            <template #right>
                <div class="toolbar-right-actions">


                    <div class="spacer"></div>
                      <BaseButton
                        variant="ghost"
                        icon-only
                        :title="detailPaneOpen ? 'Close Detail' : 'Open Detail'"
                        :class="{ active: detailPaneOpen }"
                        @click="toggleDetailPane"
                      >
                        <BaseIcon name="panelBottom" />
                      </BaseButton>
                </div>
            </template>
         </ControlPanel>
      </div>

      <div class="table-area">

      <BaseTable
        v-if="currentQueryTab"
        :key="currentQueryTab.id"
        :columns="tableColumns"
        :data="currentQueryTab.rows"
        :row-offset="currentQueryTab.pagination.offset"
        :editable="canEdit"
        :changed-cells="changedCellsSet"
        :primary-keys="currentQueryTab?.primaryKeys || []"
        :loading="!!currentQueryTab?.loading"
        style="width: 100%; height: 100%"
        @sort-change="onSortChange"
        @cell-context-menu="onCellContextMenu"
        @cell-change="onCellChange"
        @cell-focus="onCellFocus"
      >
        <template #empty>
          <div class="no-data">{{ $t('query.noData') }}</div>
        </template>
      </BaseTable>

      </div> <!-- End table-area -->

      <div v-if="detailPaneOpen" class="resizer-horizontal-bottom" @mousedown="startDetailResize"></div>

      <div
        v-if="detailPaneOpen"
        class="detail-pane"
        :style="{ height: detailPaneHeight + 'px', minHeight: '50px' }"
      >
        <ControlPanel :title="$t('query.detail.title')">
          <template #right>
             <div class="detail-actions">
                  <BaseButton
                     v-if="activeCell"
                     variant="ghost"
                     size="sm"
                     icon-only
                     class="action-btn"
                     :title="$t('query.detail.format')"
                     @click="formatDetailContent"
                  >
                     <BaseIcon name="sparkles" />
                  </BaseButton>

                  <div class="toolbar-divider"></div>

                  <BaseButton
                    variant="ghost"
                    size="sm"
                    icon-only
                    class="action-btn"
                    :title="$t('query.detail.cancel')"
                    :disabled="!isDetailDirty"
                    @click="cancelDetailChanges"
                  >
                    <BaseIcon name="undo" />
                  </BaseButton>

                  <BaseButton
                    variant="ghost"
                    size="sm"
                    icon-only
                    class="action-btn"
                    :class="{ 'primary-icon': isDetailDirty && canEdit }"
                    :title="$t('query.detail.save')"
                    :disabled="!isDetailDirty || !canEdit"
                    @click="applyDetailChanges"
                  >
                    <BaseIcon name="check" />
                  </BaseButton>
             </div>
          </template>
        </ControlPanel>
        <div class="detail-editor">
          <ValueEditor
            v-if="activeCell"
            v-model="editorContent"
            :language="editorContent.trim().startsWith('{') ? 'json' : 'text'"
            :read-only="!canEdit"
          />
          <div v-else class="no-selection">{{ $t('query.detail.noSelection') }}</div>
        </div>
      </div>

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
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue';
import { format } from 'sql-formatter';
import { isWrappedValue } from '@/types';

import { useTabStore, QueryTab } from '../../stores/tabs';
import { useConnectionStore } from '../../stores/connections';
import SqlEditor from '../SqlEditor.vue';
import ValueEditor from '../ui/ValueEditor.vue';
import BaseIcon from '../ui/BaseIcon.vue';
import BaseButton from '../ui/BaseButton.vue';
import BaseSelect from '../ui/BaseSelect.vue';
import BaseContextMenu from '../ui/BaseContextMenu.vue';
import BaseTable from '../ui/BaseTable.vue';
import ControlPanel from '../ui/ControlPanel.vue';
import i18n from '../../i18n';

const tabStore = useTabStore();
const connStore = useConnectionStore();

// Helper to get typed current tab
const currentQueryTab = computed<QueryTab | null>(() => {
  return tabStore.currentTab?.type === 'query' ? tabStore.currentTab : null;
});


const editorHeight = ref(300);
const isResizing = ref(false);
const isDetailResizing = ref(false);
const detailPaneOpen = ref(false);
const detailPaneHeight = ref(200);
const activeCell = ref<{
  rowIndex: number
  colKey: string
  value: unknown
  row: Record<string, unknown>
} | null>(null);
const editorContent = ref('');
const originalEditorContent = ref('');

const isDetailDirty = computed(() => {
  return editorContent.value !== originalEditorContent.value;
});

// Sync detail editor content when active cell changes
watch(
  () => activeCell.value,
  (newVal) => {
    if (!newVal) {
      editorContent.value = '';
      return;
    }

    // Performance: Only update if pane is open
    if (!detailPaneOpen.value) return;

    const val = newVal.value;
    if (isWrappedValue(val)) {
      editorContent.value = typeof val.raw === 'string' ? val.raw : JSON.stringify(val.raw, null, 2);
    } else if (typeof val === 'object' && val !== null) {
      editorContent.value = JSON.stringify(val, null, 2);
    } else {
      editorContent.value = String(val ?? '');
    }
    originalEditorContent.value = editorContent.value;
  },
);

// Synch editor content when pane opens
watch(detailPaneOpen, (isOpen) => {
  if (isOpen && activeCell.value) {
    // Trigger update logic manually
    const val = activeCell.value.value;
    if (isWrappedValue(val)) {
      editorContent.value = typeof val.raw === 'string' ? val.raw : JSON.stringify(val.raw, null, 2);
    } else if (typeof val === 'object' && val !== null) {
      editorContent.value = JSON.stringify(val, null, 2);
    } else {
      editorContent.value = String(val ?? '');
    }
    originalEditorContent.value = editorContent.value;
  }
});

// Fix for Stale Data: Watch for changes in the underlying value of the active cell
// (e.g. when Revert happens, activeCell object identity might stay same but value changes)
watch(
  () => activeCell.value?.value,
  (newVal) => {
    if (!activeCell.value) return;
    // Performance: Only update if pane is open
    if (!detailPaneOpen.value) return;

    const val = newVal;
    let newContent = '';
    if (isWrappedValue(val)) {
      newContent = typeof val.raw === 'string' ? val.raw : JSON.stringify(val.raw, null, 2);
    } else if (typeof val === 'object' && val !== null) {
      newContent = JSON.stringify(val, null, 2);
    } else {
      newContent = String(val ?? '');
    }

    // Only update if different to avoid cursor jumps / loops
    if (newContent !== editorContent.value) {
       editorContent.value = newContent;
       originalEditorContent.value = newContent;
    }
  },
);

function onCellFocus(payload: unknown) {
  activeCell.value = payload as {
    rowIndex: number
    colKey: string
    value: unknown
    row: Record<string, unknown>
  };
}

function toggleDetailPane() {
  detailPaneOpen.value = !detailPaneOpen.value;
}

async function applyDetailChanges() {
  if (!activeCell.value) return;
  // We assume the user edits the string representation.
  // Ideally we should try to parse JSON if the original was JSON/Object.
  let newValue: unknown = editorContent.value;

  const originalVal = activeCell.value.value;
  const isOriginalJson =
    (typeof originalVal === 'object' && originalVal !== null) ||
    (isWrappedValue(originalVal) && typeof originalVal.raw !== 'string');

  if (isOriginalJson) {
    try {
      newValue = JSON.parse(editorContent.value);
    } catch {
      // If invalid JSON, maybe we warn or just save as string?
      // For now let's save as string but user might be disappointed if they broke JSON structure.
      // But maybe they intended to make it a string.
    }
  }

  tabStore.updateCellValue(activeCell.value.rowIndex, activeCell.value.colKey, newValue);
  // Update original content to matches what we just saved (approx)
  // But strictly, we should wait for re-sync.
  // For now, let's assume success and update original to avoid dirty state flickering if sync is delayed
  originalEditorContent.value = editorContent.value;
}

function cancelDetailChanges() {
  editorContent.value = originalEditorContent.value;
}

function formatDetailContent() {
  try {
    const json = JSON.parse(editorContent.value);
    editorContent.value = JSON.stringify(json, null, 2);
  } catch {
    // Not valid JSON, ignore
  }
}

// Layout Resizing specific to Detail Pane (Vertical Resizer moving Up/Down)
// Note: We use "resizer-horizontal-bottom" which is a horizontal line that changes height
const startDetailY = ref(0);
const startDetailHeight = ref(0);

function startDetailResize(e: MouseEvent): void {
  isDetailResizing.value = true;
  startDetailY.value = e.clientY;
  startDetailHeight.value = detailPaneHeight.value;
  document.addEventListener('mousemove', doDetailResize);
  document.addEventListener('mouseup', stopDetailResize);
  e.preventDefault();
}

function stopDetailResize(): void {
  isDetailResizing.value = false;
  document.removeEventListener('mousemove', doDetailResize);
  document.removeEventListener('mouseup', stopDetailResize);
}

function doDetailResize(e: MouseEvent): void {
  if (!isDetailResizing.value) return;
  // Dragging UP increases height
  // Delta = StartY - CurrentY
  const delta = startDetailY.value - e.clientY;
  const newHeight = startDetailHeight.value + delta;

  // Constrain
  const maxH = window.innerHeight - 300; // Keep some space for table
  if (newHeight > 50 && newHeight < maxH) detailPaneHeight.value = newHeight;
}

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  value: null as unknown,
  rowData: null as unknown,
});

function onCellContextMenu(payload: {
  event: MouseEvent
  value: unknown
  data: Record<string, unknown>
}): void {
  contextMenu.value = payload.value;
  contextMenu.rowData = payload.data;
  const event = payload.event;
  if (event) {
    contextMenu.x = event.clientX;
    contextMenu.y = event.clientY;
    contextMenu.visible = true;
  }
}

function closeContextMenu(): void {
  contextMenu.visible = false;
}

async function copyValue(): Promise<void> {
  const raw = contextMenu.value;
  let val = '';
  if (raw === null) {
    val = '(NULL)';
  } else if (isWrappedValue(raw)) {
    val = typeof raw.raw === 'string' ? raw.raw : JSON.stringify(raw.raw);
  } else {
    val = String(raw);
  }
  await navigator.clipboard.writeText(val);
  closeContextMenu();
}

async function copyRow(): Promise<void> {
  if (!contextMenu.rowData) return;
  // Un-wrap values for JSON copy
  const cleanRow = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(contextMenu.rowData as Record<string, unknown>)) {
    if (isWrappedValue(v)) {
      cleanRow[k] = v.raw;
    } else {
      cleanRow[k] = v;
    }
  }
  const json = JSON.stringify(cleanRow, null, 2);
  await navigator.clipboard.writeText(json);
  closeContextMenu();
}

async function formatCurrentSql(): Promise<void> {
  if (!currentQueryTab.value) return;

  const connId = currentQueryTab.value.connectionId;
  const conn = connStore.savedConnections.find((c) => c.id === connId);

  const dialect = conn?.type === 'postgres' ? 'postgresql' : 'mysql';

  currentQueryTab.value.sql = format(currentQueryTab.value.sql, {
    language: dialect,
    keywordCase: 'upper',
  });
}

function exportCsv(): void {
  if (!currentQueryTab.value?.rows.length) return;
  const header = Object.keys(currentQueryTab.value.rows[0]).join(',');
  const csv = currentQueryTab.value.rows
    .map((r) =>
      Object.values(r)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  const blob = new Blob([header + '\n' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `export_${Date.now()}.csv`;
  link.click();
}

// Pagination & Toolbar Logic
const canGoPrev = computed(() => {
  if (!currentQueryTab.value) return false;
  return currentQueryTab.value.pagination.offset > 0;
});

const canGoNext = computed(() => {
  if (!currentQueryTab.value) return false;
  // If total is known
  if (currentQueryTab.value.pagination.total !== null) {
    return (
      currentQueryTab.value.pagination.offset + currentQueryTab.value.pagination.limit <
      currentQueryTab.value.pagination.total
    );
  }
  // If total unknown, check if we have full page of rows
  // If we have fewer rows than limit, we are at end
  return currentQueryTab.value.rows.length === currentQueryTab.value.pagination.limit;
});

const canGoLast = computed(() => {
  if (!currentQueryTab.value || currentQueryTab.value.pagination.total === null) return false;
  return canGoNext.value;
});

const paginationRangeText = computed(() => {
  if (!currentQueryTab.value) return '';
  const { offset } = currentQueryTab.value.pagination;
  const count = currentQueryTab.value.rows.length;
  const start = count > 0 ? offset + 1 : 0;
  const end = offset + count;
  return `${start} - ${end}`;
});

const paginationTotalText = computed(() => {
  if (!currentQueryTab.value) return '';
  const { total } = currentQueryTab.value.pagination;
  const count = currentQueryTab.value.rows.length;
  const offset = currentQueryTab.value.pagination.offset;
  const end = offset + count;

  if (total !== null) {
    return `${i18n.global.t('common.of')} ${total}`;
  }
  return `${i18n.global.t('common.of')} ${end}+`;
});

// Auto Refresh (Timer logic is below)

function goFirst(): void {
  if (currentQueryTab.value) {
    currentQueryTab.value.pagination.offset = 0;
    tabStore.runQuery();
  }
}

function goLast(): void {
  if (currentQueryTab.value && currentQueryTab.value.pagination.total !== null) {
    const { total, limit } = currentQueryTab.value.pagination;
    const newOffset = Math.max(0, Math.floor((total - 1) / limit) * limit);
    currentQueryTab.value.pagination.offset = newOffset;
    tabStore.runQuery();
  }
}

const hasChanges = computed(() => {
  if (!currentQueryTab.value || currentQueryTab.value.type !== 'query') return false;
  if (!currentQueryTab.value.pendingChanges) return false;
  return currentQueryTab.value.pendingChanges.size > 0;
});

const changesCount = computed(() => {
  if (!currentQueryTab.value || currentQueryTab.value.type !== 'query') return 0;
  if (!currentQueryTab.value.pendingChanges) return 0;
  return currentQueryTab.value.pendingChanges.size;
});

const changedCellsSet = computed((): Set<string> => {
  if (!currentQueryTab.value || currentQueryTab.value.type !== 'query') return new Set();
  if (!currentQueryTab.value.pendingChanges) return new Set();
  const result = new Set<string>();
  for (const [rowKey, changes] of currentQueryTab.value.pendingChanges) {
    for (const colName of Object.keys(changes)) {
      const row = currentQueryTab.value.rows.find(
        (r) =>
          currentQueryTab.value!.primaryKeys.map((pk) => String(r[pk] ?? '')).join('|') === rowKey,
      );
      if (row) {
        const rowIndex = currentQueryTab.value.rows.indexOf(row);
        result.add(`${rowIndex}:${colName}`);
      }
    }
  }
  return result;
});

const changesCountText = computed(() => {
  const count = changesCount.value;
  return i18n.global.t('query.changesCount', count);
});

const canEdit = computed(() => {
  if (!currentQueryTab.value || currentQueryTab.value.type !== 'query') return false;
  if (!currentQueryTab.value.primaryKeys) return false;
  return currentQueryTab.value.primaryKeys.length > 0;
});

function onCellChange(payload: { rowIndex: number; column: string; value: unknown }): void {
  tabStore.updateCellValue(payload.rowIndex, payload.column, payload.value);
}

// Auto Refresh
const autoRefreshInterval = ref(0); // 0 = disabled
const autoRefreshTimer = ref<number | null>(null);

const autoRefreshOptions = [
  { label: 'Auto: Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
];

const limitOptions = [
  { label: '100', value: 100 },
  { label: '300', value: 300 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
];

function onLimitChange(val: string | number): void {
  if (currentQueryTab.value && val !== 0) {
    currentQueryTab.value.pagination.limit = Number(val);
    tabStore.runQuery();
  }
}

function onAutoRefreshChange(val: string | number): void {
  const ms = Number(val);
  autoRefreshInterval.value = ms;

  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value);
    autoRefreshTimer.value = null;
  }

  if (ms > 0) {
    autoRefreshTimer.value = window.setInterval(() => {
      if (currentQueryTab.value && !connStore.loading && !currentQueryTab.value.loading) {
        tabStore.runQuery();
      }
    }, ms);
  }
}

// Clear timer on unmount or tab change
// (Moved to combined onUnmounted above)

watch(
  () => currentQueryTab.value?.id,
  () => {
    // Reset auto refresh on tab switch/close? Or keep it per tab?
    // User request didn't specify. Usually per-view.
    // If I keep it simple, it's global for the view component.
    // If I switch tabs, the view component stays mounted (it's in App.vue usually or View).
    // Let's reset it to be safe.
    autoRefreshInterval.value = 0;
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value);
      autoRefreshTimer.value = null;
    }

    // Fix for stale data in Value Editor (Detail Pane)
    activeCell.value = null;
    editorContent.value = '';
    originalEditorContent.value = '';
  },
);

const connectionOptions = computed(() => {
  const opts = connStore.savedConnections.map((conn) => ({
    label: conn.name,
    value: conn.id,
  }));
  return [{ label: i18n.global.t('connections.select'), value: '' }, ...opts];
});

async function onTabConnectionChange(val: string | number): Promise<void> {
  if (currentQueryTab.value) {
    if (val === '') {
      currentQueryTab.value.connectionId = null;
    } else {
      currentQueryTab.value.connectionId = String(val);
    }

    if (currentQueryTab.value.connectionId !== null) {
      await connStore.ensureConnection(currentQueryTab.value.connectionId);
    }
  }
}

function onSortChange(sort: { colId: string | null; sort: 'asc' | 'desc' | null }): void {
  if (!sort.colId || !sort.sort) return;
  if (!currentQueryTab.value) return;
  const match = currentQueryTab.value.sql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i);
  if (match) {
    let newSql = `SELECT * FROM ${match[1]}`;
    newSql += ` ORDER BY "${sort.colId}" ${sort.sort.toUpperCase()}`;

    currentQueryTab.value.sql = newSql;
    tabStore.runQuery();
  }
}

// Resizing logic for editor
const startY = ref(0);
const startHeight = ref(0);
function startResize(e: MouseEvent): void {
  isResizing.value = true;
  startY.value = e.clientY;
  startHeight.value = editorHeight.value;
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}
function stopResize(): void {
  window.dbApi.getState().then((state) => {
    window.dbApi.updateState({
      ui: {
        ...state.ui,
        editorHeight: editorHeight.value,
      },
    });
  });
  isResizing.value = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
}
function doResize(e: MouseEvent): void {
  if (!isResizing.value) return;
  const newHeight = startHeight.value + (e.clientY - startY.value);
  if (newHeight > 100 && newHeight < window.innerHeight - 200) editorHeight.value = newHeight;
}

const tableColumns = computed(() => {
  if (!currentQueryTab.value?.colDefs) return [];
  return currentQueryTab.value.colDefs.map((def) => ({
    prop: def.field,
    label: def.headerName || def.field,
    sortable: true,
    width: 150, // Default width, resizing will handle updates
  }));
});

onMounted(async () => {
  const state = await window.dbApi.getState();
  editorHeight.value = state.ui.editorHeight;

  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  if (autoRefreshTimer.value) clearInterval(autoRefreshTimer.value);
  window.removeEventListener('keydown', handleKeydown);
});

function handleKeydown(e: KeyboardEvent): void {
  // Only handle if this view is active (currentQueryTab is populated)
  if (!currentQueryTab.value) return;

  // Save: Ctrl+S or Cmd+S
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (hasChanges.value) {
      tabStore.commitChanges();
    }
    return;
  }

  // Refresh: F5
  // Note: Electron/Browser might block F5 or reload page unless prevented
  if (e.key === 'F5') {
    e.preventDefault();
    tabStore.runQuery();
    return;
  }
}
</script>

<style scoped>


.query-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.conn-select-wrapper {
  min-width: 200px;
}
.toolbar-right,
.toolbar-right-actions,
.detail-actions {
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
.table-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-width: 0;
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



.view-panel-header {
  flex-shrink: 0;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
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

.limit-select-icon {
  width: auto;
  margin-left: 0;
}

.pagination-range {
  font-variant-numeric: tabular-nums;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-primary);
}

.pagination-total {
  margin-left: -2px;
  color: var(--text-primary);
}

.results-toolbar .base-btn {
  color: var(--text-primary);
}

.spacer {
  flex: 1;
}


.resizer-vertical {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  border-left: 1px solid var(--border-color);
  flex-shrink: 0;
  z-index: 20;
  position: relative;
}
.resizer-vertical:hover {
  background: var(--accent-primary);
  opacity: 0.5;
}

.resizer-horizontal-bottom {
  height: 0;
  background: transparent;
  cursor: row-resize;
  z-index: 20;
  flex-shrink: 0;
  position: relative;
  border-top: 1px solid var(--border-color);
}
.resizer-horizontal-bottom::before {
  content: '';
  position: absolute;
  top: -3px;
  bottom: -3px;
  left: 0;
  right: 0;
  z-index: 20;
}
.resizer-horizontal-bottom::after {
  content: '';
  position: absolute;
  top: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-primary);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}
.resizer-horizontal-bottom:hover::after,
.resizer-horizontal-bottom:active::after {
  opacity: 1;
  height: 4px;
  top: -2px;
}

.detail-pane {
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  overflow: hidden;
  flex-shrink: 0;
}

.action-btn {
  color: var(--text-primary) !important;
}
.action-btn.primary-icon {
  color: var(--accent-primary) !important;
}
.action-btn:hover {
  background-color: var(--list-hover-bg);
}

.detail-editor {
  flex: 1;
  overflow: hidden;
  position: relative;
}
.no-selection {
  padding: 20px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 13px;
}

:deep(.base-btn.active) {
  color: var(--accent-primary);
  background-color: var(--bg-input);
}
</style>
