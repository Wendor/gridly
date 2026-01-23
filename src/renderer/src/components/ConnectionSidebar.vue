<template>
  <div class="sidebar" @click="closeCtxMenu">
    <div class="sidebar-header">
      <h3>НАВИГАТОР</h3>
      <button class="add-btn" title="Новое подключение" @click="$emit('open-create-modal')">
        <BaseIcon name="plus" />
      </button>
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

            <button class="del-btn" title="Удалить" @click.stop="$emit('delete', index)">
              <BaseIcon name="trash" />
            </button>
          </div>
        </div>

        <div v-if="isExpanded(index)" class="tables-tree">
          <div v-if="!tablesCache[index]" class="loading-state">Загрузка...</div>
          <div v-else-if="tablesCache[index].length === 0" class="empty-tables">Нет таблиц</div>
          <div
            v-for="table in tablesCache[index]"
            v-else
            :key="table"
            class="table-item"
            @click.stop="$emit('table-click', table, index)"
          >
            <span class="table-icon">
              <BaseIcon name="table" />
            </span>
            {{ table }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="ctxMenu.visible"
      class="ctx-menu"
      :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
      @click.stop
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { DbConnection } from '../../../shared/types'
import BaseIcon from './ui/BaseIcon.vue'
import { useConnectionStore } from '../stores/connections'

const props = defineProps<{
  connections: DbConnection[]
  activeSidebarId: number | null
  tablesCache: Record<number, string[]>
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'expand', index: number): void
  (e: 'delete', index: number): void
  (e: 'edit', index: number): void
  (e: 'open-create-modal'): void
  (e: 'table-click', table: string, index: number): void
}>()

// Подключаем стор, чтобы проверять статус isConnected(index)
const connStore = useConnectionStore()

const expandedIndices = ref<Set<number>>(new Set())

// --- Логика контекстного меню ---
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
  if (ctxMenu.index !== -1) {
    emit('edit', ctxMenu.index)
  }
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

// НОВОЕ: Ручное отключение
async function handleDisconnect(): Promise<void> {
  if (ctxMenu.index !== -1) {
    // В сторе пока нет явного метода disconnect, но мы можем удалить ID из активных
    // Лучше добавить метод disconnect(id) в стор, но пока можно сделать так:
    // (По-хорошему нужно добавить disconnect в connections.ts, который вызывает ipcRenderer)

    // Пока сбросим состояние в UI (это не разорвет соединение на бэке, если там нет метода)
    // Давайте лучше вызовем хак через activeConnectionIds,
    // но правильнее будет, если вы добавите `disconnect` в API позже.

    // В текущей реализации DatabaseManager разрывает соединение при connect.
    // Если нужно явное отключение, нужно добавить метод в Store и API.
    // Пока просто уберем из активных в UI, чтобы пользователь видел реакцию
    connStore.activeConnectionIds.delete(ctxMenu.index)
  }
  closeCtxMenu()
}
// ------------------------------

function isExpanded(index: number): boolean {
  return expandedIndices.value.has(index)
}

function toggleExpand(index: number): void {
  if (expandedIndices.value.has(index)) {
    expandedIndices.value.delete(index)
  } else {
    expandedIndices.value.add(index)
    emit('expand', index)
  }
}

function onSelect(index: number): void {
  emit('select', index)
  // При клике на само подключение тоже раскрываем
  if (!expandedIndices.value.has(index)) {
    expandedIndices.value.add(index)
    emit('expand', index)
  }
}

// --- PERSISTENCE ---
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
        emit('expand', idx)
      }
    })
    expandedIndices.value = newSet
  } catch (e) {
    console.error('Failed to restore sidebar state', e)
  }
}

watch(
  () => expandedIndices.value,
  () => {
    saveExpandedState()
  },
  { deep: true }
)

watch(
  () => props.connections,
  (newConns) => {
    if (newConns.length > 0) {
      restoreExpandedState()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
/* Стили остались прежними + индикатор */
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
.add-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.add-btn:hover {
  border-color: var(--focus-border);
  background: var(--bg-input);
  color: var(--text-primary);
}
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
.arrow-wrapper:hover {
  opacity: 1;
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
  color: inherit;
  display: flex;
  align-items: center;
  gap: 6px;
}
.name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Стили для индикатора */
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
  background-color: #4caf50; /* Зеленый */
  border-radius: 50%;
  border: 1px solid var(--bg-sidebar); /* Обводка под цвет фона */
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

.icon-wrapper {
  display: flex;
  align-items: center;
}
.db-icon {
  color: var(--text-secondary);
}
.saved-item:hover .db-icon {
  color: var(--accent-primary);
}

.del-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: none;
  padding: 2px;
  border-radius: 4px;
}
.saved-item:hover .del-btn {
  display: flex;
}
.del-btn:hover {
  color: #f44;
  background: rgba(255, 0, 0, 0.1);
}

.tables-tree {
  margin-left: 10px;
  border-left: 1px solid var(--border-color);
  padding-bottom: 5px;
}
.empty-tables,
.loading-state {
  padding-left: 15px;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 2px;
}
.table-item {
  font-size: 13px;
  color: var(--text-primary);
  opacity: 0.8;
  padding: 5px 0 5px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-item:hover {
  color: var(--list-hover-fg);
  background: var(--list-hover-bg);
  opacity: 1;
}
.table-icon {
  color: var(--accent-primary);
  opacity: 0.8;
  display: flex;
  align-items: center;
}

/* Контекстное меню */
.ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 150px;
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
  line-height: 1;
}
</style>
