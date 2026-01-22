<template>
  <div class="sidebar" @click="closeCtxMenu">
    <div class="sidebar-header">
      <h3>НАВИГАТОР</h3>
      <button class="add-btn" title="Новое подключение" @click="$emit('open-create-modal')">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
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
              <svg
                class="arrow-icon"
                :class="{ rotated: isExpanded(index) }"
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>

            <div class="conn-info">
              <div class="conn-name">
                <span class="icon-wrapper db-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                  </svg>
                </span>
                <span class="name-text">{{ conn.name }}</span>
              </div>
            </div>

            <button class="del-btn" title="Удалить" @click.stop="$emit('delete', index)">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path
                  d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                ></path>
              </svg>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="3" y1="15" x2="21" y2="15"></line>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
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
      <div class="ctx-item" @click="handleEdit">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Редактировать
      </div>
      <div class="ctx-item delete" @click="handleDelete">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path
            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
          ></path>
        </svg>
        Удалить
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { DbConnection } from '../../../shared/types'

defineProps<{
  connections: DbConnection[]
  activeSidebarId: number | null
  tablesCache: Record<number, string[]>
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'expand', index: number): void
  (e: 'delete', index: number): void
  (e: 'edit', index: number): void // <-- НОВОЕ СОБЫТИЕ
  (e: 'open-create-modal'): void
  (e: 'table-click', table: string, index: number): void
}>()

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
  if (!expandedIndices.value.has(index)) {
    expandedIndices.value.add(index)
    emit('expand', index)
  }
}
</script>

<style scoped>
/* Стили остались прежними + добавлены стили для меню */
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
  position: relative; /* Для позиционирования чего-либо внутри, если понадобится */
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
  background: var(--focus-border);
  color: var(--text-white);
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
  color: var(--text-white);
  background: var(--list-hover-bg);
  opacity: 1;
}
.table-icon {
  color: var(--accent-primary);
  opacity: 0.8;
  display: flex;
  align-items: center;
}

/* --- Контекстное меню --- */
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
  color: var(--text-white);
}

.ctx-item.delete:hover {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}
</style>
