<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h3>{{ $t('sidebar.navigator') }}</h3>
      <BaseButton
        variant="ghost"
        :icon-only="true"
        :title="$t('connections.new')"
        @click="$emit('open-create-modal')"
      >
        <BaseIcon name="plus" />
      </BaseButton>
    </div>

    <div ref="listContainer" class="saved-list" @scroll="onScroll">
      <div v-for="conn in connections" :key="conn.id">
        <div
          class="saved-item"
          :class="{ active: activeSidebarId === conn.id }"
          @click="onSelect(conn.id)"
          @contextmenu.prevent="onContextMenu($event, conn.id)"
        >
          <div class="conn-main-row">
            <div class="arrow-wrapper" @click.stop="toggleExpand(conn.id)">
              <BaseIcon
                name="chevronRight"
                class="arrow-icon"
                :class="{ rotated: isExpanded(conn.id) }"
              />
            </div>

            <div class="conn-info">
              <div class="conn-name">
                <div class="status-indicator-wrapper">
                  <span class="icon-wrapper db-icon">
                    <BaseIcon name="database" />
                  </span>
                  <div
                    v-if="connStore.isConnected(conn.id)"
                    class="status-dot"
                    title="Connected"
                  ></div>
                </div>
                <span class="name-text">{{ conn.name }}</span>
              </div>
            </div>

            <div class="actions">
              <BaseButton
                variant="ghost"
                :icon-only="true"
                class="del-btn-wrap"
                :title="$t('common.delete')"
                @click.stop="$emit('delete', conn.id)"
              >
                <BaseIcon name="trash" />
              </BaseButton>
            </div>
          </div>
        </div>

        <div v-if="isExpanded(conn.id)" class="databases-tree">
          <div v-if="connStore.databasesError?.[conn.id]" class="error-state">
            {{ $t('common.error') }}: {{ connStore.databasesError[conn.id] }}
          </div>
          <div v-else-if="!connStore.databasesCache[conn.id]" class="loading-state">
            {{ $t('sidebar.loadingDbs') }}
          </div>
          <div v-else-if="connStore.databasesCache[conn.id].length === 0" class="empty-state">
            {{ $t('sidebar.noDbs') }}
          </div>

          <div
            v-for="dbName in connStore.databasesCache[conn.id]"
            v-else
            :key="dbName"
            class="db-node"
          >
            <div class="db-item" @click.stop="toggleDbExpand(conn.id, dbName)">
              <BaseIcon
                name="chevronRight"
                class="arrow-icon-small"
                :class="{ rotated: isDbExpanded(conn.id, dbName) }"
              />
              <span class="db-icon-small">
                <BaseIcon name="database" />
              </span>
              <span class="db-name-text">{{ dbName }}</span>
            </div>

            <div v-if="isDbExpanded(conn.id, dbName)" class="tables-tree">
              <div v-if="!connStore.tablesCache[`${conn.id}-${dbName}`]" class="loading-state">
                {{ $t('sidebar.loadingTables') }}
              </div>
              <div
                v-else-if="connStore.tablesCache[`${conn.id}-${dbName}`].length === 0"
                class="empty-tables"
              >
                {{ $t('sidebar.noTables') }}
              </div>
              <div
                v-for="table in connStore.tablesCache[`${conn.id}-${dbName}`]"
                v-else
                :key="table"
                class="table-item"
                @click.stop="$emit('table-click', table, conn.id, dbName)"
              >
                <span class="table-icon">
                  <BaseIcon name="table" />
                </span>
                <span class="table-name-text">{{ table }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BaseContextMenu :visible="ctxMenu.visible" :x="ctxMenu.x" :y="ctxMenu.y" @close="closeCtxMenu">
      <div
        v-if="ctxMenu.id && !connStore.isConnected(ctxMenu.id)"
        class="ctx-item"
        @click="handleConnect"
      >
        <span class="ctx-icon connect-icon">
          <BaseIcon name="play" />
        </span>
        {{ $t('sidebar.connect') }}
      </div>

      <div
        v-if="ctxMenu.id && connStore.isConnected(ctxMenu.id)"
        class="ctx-item"
        @click="handleRefresh"
      >
        <span class="ctx-icon refresh-icon">
          <BaseIcon name="refresh" />
        </span>
        {{ $t('sidebar.refresh') }}
      </div>

      <div
        v-if="ctxMenu.id && connStore.isConnected(ctxMenu.id)"
        class="ctx-item"
        @click="handleDisconnect"
      >
        <span class="ctx-icon disconnect-icon">×</span>
        {{ $t('sidebar.disconnect') }}
      </div>

      <div
        v-if="ctxMenu.id && connStore.isConnected(ctxMenu.id)"
        class="ctx-item"
        @click="handleOpenDashboard"
      >
        <BaseIcon name="chart" />
        {{ $t('sidebar.overview') }}
      </div>
      <div class="ctx-item" @click="handleEdit">
        <BaseIcon name="edit" />
        {{ $t('sidebar.edit') }}
      </div>
      <div class="ctx-item delete" @click="handleDelete">
        <BaseIcon name="trash" />
        {{ $t('sidebar.delete') }}
      </div>
    </BaseContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, nextTick } from 'vue';
import type { DbConnection } from '../types';
import BaseIcon from './ui/BaseIcon.vue';
import BaseButton from './ui/BaseButton.vue';
import BaseContextMenu from './ui/BaseContextMenu.vue';
import { useConnectionStore } from '../stores/connections';
import { useTabStore } from '../stores/tabs';
import i18n from '../i18n';

const props = defineProps<{
  connections: DbConnection[]
  activeSidebarId: string | null
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
  (e: 'edit', id: string): void
  (e: 'open-create-modal'): void
  (e: 'table-click', table: string, id: string, dbName: string): void
}>();

const connStore = useConnectionStore();
const tabStore = useTabStore();

const expandedIds = ref<Set<string>>(new Set());
const expandedDbs = ref<Set<string>>(new Set());
const listContainer = ref<HTMLElement | null>(null);
const scrollPosition = ref(0);

const ctxMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  id: null as string | null,
});

function onContextMenu(event: MouseEvent, id: string): void {
  ctxMenu.visible = true;
  ctxMenu.x = event.clientX;
  ctxMenu.y = event.clientY;
  ctxMenu.id = id;
}

function closeCtxMenu(): void {
  ctxMenu.visible = false;
}

function handleEdit(): void {
  if (ctxMenu.id) emit('edit', ctxMenu.id);
  closeCtxMenu();
}

function handleOpenDashboard(): void {
  if (ctxMenu.id) {
    tabStore.openDashboardTab(ctxMenu.id);
  }
  closeCtxMenu();
}

function handleDelete(): void {
  if (ctxMenu.id) {
    if (confirm(i18n.global.t('sidebar.confirmDelete'))) {
      emit('delete', ctxMenu.id);
    }
  }
  closeCtxMenu();
}

async function handleDisconnect(): Promise<void> {
  if (ctxMenu.id) {
    await connStore.disconnect(ctxMenu.id);
  }
  closeCtxMenu();
}

async function handleConnect(): Promise<void> {
  if (ctxMenu.id) {
    await connStore.ensureConnection(ctxMenu.id);
    connStore.loadDatabases(ctxMenu.id);
    if (!expandedIds.value.has(ctxMenu.id)) {
      expandedIds.value.add(ctxMenu.id);
    }
  }
  closeCtxMenu();
}

async function handleRefresh(): Promise<void> {
  if (ctxMenu.id) {
    await connStore.loadDatabases(ctxMenu.id, true);
  }
  closeCtxMenu();
}

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id);
}

function toggleExpand(id: string): void {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
    connStore.loadDatabases(id);
  }
}

function isDbExpanded(id: string, dbName: string): boolean {
  return expandedDbs.value.has(`${id}-${dbName}`);
}

function toggleDbExpand(id: string, dbName: string): void {
  const key = `${id}-${dbName}`;
  if (expandedDbs.value.has(key)) {
    expandedDbs.value.delete(key);
  } else {
    expandedDbs.value.add(key);
    connStore.loadTables(id, dbName);
  }
}

function onSelect(id: string): void {
  emit('select', id);
  if (!expandedIds.value.has(id)) {
    toggleExpand(id);
  }
}

// Debounce helper
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const saveStateDebounced = debounce(async () => {
  const connIds = Array.from(expandedIds.value);
  const dbKeys = Array.from(expandedDbs.value);
  
  try {
    const state = await window.dbApi.getState();
    await window.dbApi.updateState({
      ui: {
        ...state.ui,
        expandedConnections: connIds,
        expandedDatabases: dbKeys,
        sidebarScrollPosition: Math.round(scrollPosition.value),
      },
    });
  } catch (e) {
    console.error('Failed to save sidebar state', e);
  }
}, 500);

function onScroll(e: Event) {
  const target = e.target as HTMLElement;
  scrollPosition.value = target.scrollTop;
  saveStateDebounced();
}

async function restoreExpandedState(): Promise<void> {
  try {
    const state = await window.dbApi.getState();
    
    // Restore Connections
    if (state.ui.expandedConnections?.length) {
      expandedIds.value = new Set(state.ui.expandedConnections);
      // Trigger load
      state.ui.expandedConnections.forEach((id) => {
        connStore.loadDatabases(id);
      });
    }

    // Restore Databases
    if (state.ui.expandedDatabases?.length) {
      expandedDbs.value = new Set(state.ui.expandedDatabases);
      // Trigger load tables for expanded DBs
      state.ui.expandedDatabases.forEach((key) => {
        // key is `connId-dbName`
        const parts = key.split('-');
        if (parts.length >= 2) {
            // Reconstruct connId (which might contain dashes) and dbName
            // Assumption: key format `connId-dbName` is simple. 
            // If connID is uuid, it has dashes. 
            // Better strategy: split by FIRST dash? No, UUID has dashes.
            // Split by LAST dash? DB name might have dashes. 
            // Wait, logic in toggleDbExpand: `${id}-${dbName}`
            // This is ambiguous if ID has dashes and DB name has dashes.
            // UUIDs are standard. DB names are user defined.
            // We should iterate over connection IDs to match prefix?
            // Or change separator to something less common?
            // For now, let's try to find matching connection ID.
            
            for (const conn of props.connections) {
                if (key.startsWith(conn.id + '-')) {
                    const dbName = key.slice(conn.id.length + 1);
                    connStore.loadTables(conn.id, dbName);
                    break;
                }
            }
        }
      });
    }

    // Restore Scroll
    if (typeof state.ui.sidebarScrollPosition === 'number') {
      scrollPosition.value = state.ui.sidebarScrollPosition;
      nextTick(() => {
        if (listContainer.value) {
          listContainer.value.scrollTop = scrollPosition.value;
        }
      });
    }
  } catch (e) {
    console.error('Failed to restore expanded state', e);
  }
}

watch(
  () => [expandedIds.value, expandedDbs.value],
  () => saveStateDebounced(),
  { deep: true },
);

watch(
  () => props.connections,
  (newConns) => {
    if (newConns.length > 0) {
        // We restore state only once on init, really, but connections load async?
        // restoreExpandedState checks props.connections inside it? No.
        // But the loop inside restoreExpandedState needs props.connections to parse keys.
        // So we should call it when connections are available.
        restoreExpandedState();
    }
  },
  { immediate: true, deep: true },
);

// We also need to reload tables if connections change/reconnect?
// Already handled by existing watcher at bottom of file?
// No, that watcher only handled `expandedIds`.
// Let's add expandedDbs handling to it.
watch(
  () => props.connections,
  (newConns) => {
    newConns.forEach((conn) => {
      // Load databases if connection expanded
      if (conn.id && isExpanded(conn.id) && !connStore.databasesCache[conn.id]) {
        connStore.loadDatabases(conn.id);
      }
      // Load tables if any DB in this connection is expanded
      // We need to iterate all expandedDbs and check if they belong to this conn
      expandedDbs.value.forEach(key => {
          if (key.startsWith(conn.id + '-')) {
              const dbName = key.slice(conn.id.length + 1);
              if (!connStore.tablesCache[key]) {
                  connStore.loadTables(conn.id, dbName);
              }
          }
      });
    });
  },
  { deep: true },
);

onMounted(() => {
    // Initial restore if connections already exist
    if (props.connections.length > 0) {
        restoreExpandedState();
    }
});
</script>

<style scoped>
/* Стили из предыдущего ответа остаются актуальными */
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  height: 35px;
  box-sizing: border-box;
}
.sidebar-header h3 {
  margin: 0;
  font-size: 11px;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}
/* .add-btn removed */
.saved-list {
  flex: 1;
  overflow-y: auto;
  padding-top: 5px;
}
.saved-item {
  cursor: pointer;
  border-left: 3px solid transparent;
  user-select: none;
  color: var(--text-primary);
  opacity: 0.9;
}
.saved-item:hover {
  background: var(--list-hover-bg);
  opacity: 1;
}
.saved-item.active {
  background: var(--list-active-bg);
  border-left-color: var(--focus-border);
}
.conn-main-row {
  display: flex;
  align-items: center;
  position: relative;
  height: 30px;
  padding-right: 30px;
}
.arrow-wrapper {
  width: 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.7;
}
.arrow-icon {
  transition: transform 0.15s;
  color: var(--text-secondary);
}
.arrow-icon.rotated {
  transform: rotate(90deg);
}
.conn-info {
  flex: 1;
  overflow: hidden;
}
.conn-name {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-indicator-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.status-dot {
  position: absolute;
  bottom: 0;
  right: -2px;
  width: 6px;
  height: 6px;
  background-color: #4caf50;
  border-radius: 50%;
  border: 1px solid var(--bg-sidebar);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}
.icon-wrapper {
  display: flex;
  align-items: center;
}
.db-icon {
  color: var(--text-secondary);
}

.actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
}

.saved-item:hover .actions {
  display: flex;
}

.del-btn-wrap {
  padding: 4px;
}

.databases-tree {
  margin-left: 10px;
  border-left: 1px solid var(--border-color);
}
.db-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  opacity: 0.85;
}
.db-item:hover {
  background: var(--list-hover-bg);
  opacity: 1;
}
.db-name-text {
  margin-left: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-icon-small {
  display: flex;
  align-items: center;
  width: 14px;
  color: var(--text-secondary);
  transform: scale(0.8);
}
.arrow-icon-small {
  font-size: 10px;
  transition: transform 0.1s;
  color: var(--text-secondary);
  margin-right: 4px;
}
.arrow-icon-small.rotated {
  transform: rotate(90deg);
}
.tables-tree {
  margin-left: 15px;
  border-left: 1px dotted var(--border-color);
  padding-bottom: 5px;
}
.table-item {
  font-size: 12px;
  color: var(--text-primary);
  opacity: 0.8;
  padding: 4px 0 4px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.table-item:hover {
  background: var(--list-hover-bg);
  opacity: 1;
}
.table-icon {
  color: var(--accent-primary);
  opacity: 0.7;
  transform: scale(0.85);
  display: flex;
}
.loading-state,
.empty-state,
.empty-tables {
  padding-left: 20px;
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
  margin: 2px 0;
}

.error-state {
  padding-left: 20px;
  font-size: 11px;
  color: #ff6b6b;
  margin: 2px 0;
}

.ctx-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}
.ctx-item:hover {
  background: var(--list-hover-bg);
  color: var(--list-hover-fg);
}
.ctx-item.delete:hover {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}
.ctx-icon {
  width: 14px;
  text-align: center;
  font-weight: bold;
}
.disconnect-icon {
  color: #ffaa00;
  font-size: 16px;
}
.connect-icon {
  color: #4caf50;
  display: flex;
}
.refresh-icon {
  color: var(--text-secondary);
  display: flex;
}
</style>
