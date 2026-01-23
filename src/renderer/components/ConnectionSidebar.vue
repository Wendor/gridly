<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h3>НАВИГАТОР</h3>
      <BaseButton
        variant="ghost"
        :icon-only="true"
        title="Новое подключение"
        @click="$emit('open-create-modal')"
      >
        <BaseIcon name="plus" />
      </BaseButton>
    </div>

    <div class="saved-list">
      <div v-for="(conn, index) in connections" :key="index">
        <div
          class="saved-item"
          :class="{ active: activeSidebarId === index }"
          @click="onSelect(index)"
          @contextmenu.prevent="onContextMenu($event, index)"
        >
          <div class="conn-main-row">
            <div class="arrow-wrapper" @click.stop="toggleExpand(index)">
              <BaseIcon
                name="chevronRight"
                class="arrow-icon"
                :class="{ rotated: isExpanded(index) }"
              />
            </div>

            <div class="conn-info">
              <div class="conn-name">
                <div class="status-indicator-wrapper">
                  <span class="icon-wrapper db-icon">
                    <BaseIcon name="database" />
                  </span>
                  <div
                    v-if="connStore.isConnected(index)"
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
                title="Удалить"
                @click.stop="$emit('delete', index)"
              >
                <BaseIcon name="trash" />
              </BaseButton>
            </div>
          </div>
        </div>

        <div v-if="isExpanded(index)" class="databases-tree">
          <div v-if="connStore.databasesError?.[index]" class="error-state">
            Ошибка: {{ connStore.databasesError[index] }}
          </div>
          <div v-else-if="!connStore.databasesCache[index]" class="loading-state">
            Загрузка баз...
          </div>
          <div v-else-if="connStore.databasesCache[index].length === 0" class="empty-state">
            Нет баз
          </div>

          <div
            v-for="dbName in connStore.databasesCache[index]"
            v-else
            :key="dbName"
            class="db-node"
          >
            <div class="db-item" @click.stop="toggleDbExpand(index, dbName)">
              <BaseIcon
                name="chevronRight"
                class="arrow-icon-small"
                :class="{ rotated: isDbExpanded(index, dbName) }"
              />
              <span class="db-icon-small">
                <BaseIcon name="database" />
              </span>
              <span class="db-name-text">{{ dbName }}</span>
            </div>

            <div v-if="isDbExpanded(index, dbName)" class="tables-tree">
              <div v-if="!connStore.tablesCache[`${index}-${dbName}`]" class="loading-state">
                Загрузка...
              </div>
              <div
                v-else-if="connStore.tablesCache[`${index}-${dbName}`].length === 0"
                class="empty-tables"
              >
                Нет таблиц
              </div>
              <div
                v-for="table in connStore.tablesCache[`${index}-${dbName}`]"
                v-else
                :key="table"
                class="table-item"
                @click.stop="$emit('table-click', table, index, dbName)"
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

    <BaseContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      @close="closeCtxMenu"
    >
      <div v-if="connStore.isConnected(ctxMenu.index)" class="ctx-item" @click="handleDisconnect">
        <span class="ctx-icon disconnect-icon">×</span>
        Отключиться
      </div>

      <div class="ctx-item" @click="handleEdit">
        <BaseIcon name="edit" />
        Редактировать
      </div>
      <div class="ctx-item delete" @click="handleDelete">
        <BaseIcon name="trash" />
        Удалить
      </div>
    </BaseContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { DbConnection } from '../../shared/types'
import BaseIcon from './ui/BaseIcon.vue'
import BaseButton from './ui/BaseButton.vue'
import BaseContextMenu from './ui/BaseContextMenu.vue'
import { useConnectionStore } from '../stores/connections'

const props = defineProps<{
  connections: DbConnection[]
  activeSidebarId: number | null
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'delete', index: number): void
  (e: 'edit', index: number): void
  (e: 'open-create-modal'): void
  (e: 'table-click', table: string, index: number, dbName: string): void
}>()

const connStore = useConnectionStore()

const expandedIndices = ref<Set<number>>(new Set())
const expandedDbs = ref<Set<string>>(new Set())

const ctxMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  index: -1
})

function onContextMenu(event: MouseEvent, index: number): void {
  ctxMenu.visible = true
  ctxMenu.x = event.clientX
  ctxMenu.y = event.clientY
  ctxMenu.index = index
}

function closeCtxMenu(): void {
  ctxMenu.visible = false
}

function handleEdit(): void {
  if (ctxMenu.index !== -1) emit('edit', ctxMenu.index)
  closeCtxMenu()
}

function handleDelete(): void {
  if (ctxMenu.index !== -1) {
    if (confirm('Вы уверены, что хотите удалить это подключение?')) {
      emit('delete', ctxMenu.index)
    }
  }
  closeCtxMenu()
}

async function handleDisconnect(): Promise<void> {
  if (ctxMenu.index !== -1) {
    connStore.activeConnectionIds.delete(ctxMenu.index)
  }
  closeCtxMenu()
}

function isExpanded(index: number): boolean {
  return expandedIndices.value.has(index)
}

function toggleExpand(index: number): void {
  if (expandedIndices.value.has(index)) {
    expandedIndices.value.delete(index)
  } else {
    expandedIndices.value.add(index)
    connStore.loadDatabases(index)
  }
}

function isDbExpanded(index: number, dbName: string): boolean {
  return expandedDbs.value.has(`${index}-${dbName}`)
}

function toggleDbExpand(index: number, dbName: string): void {
  const key = `${index}-${dbName}`
  if (expandedDbs.value.has(key)) {
    expandedDbs.value.delete(key)
  } else {
    expandedDbs.value.add(key)
    connStore.loadTables(index, dbName) // Теперь принимает 2 аргумента
  }
}

function onSelect(index: number): void {
  emit('select', index)
  if (!expandedIndices.value.has(index)) {
    toggleExpand(index)
  }
}

const STORAGE_KEY = 'sidebar-expanded-connections'

function saveExpandedState(): void {
  const expandedNames = Array.from(expandedIndices.value)
    .map((idx) => props.connections[idx]?.name)
    .filter(Boolean)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedNames))
}

function restoreExpandedState(): void {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return
  try {
    const names = JSON.parse(saved) as string[]
    if (!Array.isArray(names)) return
    const newSet = new Set<number>()
    names.forEach((name) => {
      const idx = props.connections.findIndex((c) => c.name === name)
      if (idx !== -1) {
        newSet.add(idx)
        connStore.loadDatabases(idx)
      }
    })
    expandedIndices.value = newSet
  } catch (e) {
    console.error('Failed to restore sidebar state', e)
  }
}

watch(
  () => expandedIndices.value,
  () => saveExpandedState(),
  { deep: true }
)

watch(
  () => props.connections,
  (newConns) => {
    if (newConns.length > 0) restoreExpandedState()
  },
  { immediate: true }
)

watch(
  () => props.connections,
  (newConns) => {
    newConns.forEach((_, index) => {
      // Если соединение раскрыто, но кэша нет (он был сброшен при updateConnection),
      // то перезагружаем список баз.
      if (isExpanded(index) && !connStore.databasesCache[index]) {
        connStore.loadDatabases(index)
      }
    })
  },
  { deep: true }
)
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
  color: var(--text-secondary);
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
</style>
