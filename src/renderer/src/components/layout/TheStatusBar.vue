<template>
  <div class="status-bar-global">
    <div class="sb-section left">
      <div class="sb-item status-text">
        <span v-if="connStore.loading" class="loading-label">Executing...</span>
        <span v-else>{{ tabStore.currentTab?.type === 'settings' ? 'Settings' : 'Ready' }}</span>
      </div>
    </div>

    <div class="sb-section center">
      <div v-if="tabStore.currentTab?.type === 'query'" class="pagination-controls">
        <BaseButton
          variant="ghost"
          :icon-only="true"
          :disabled="tabStore.currentTab.pagination.offset === 0 || connStore.loading"
          title="Previous Page"
          class="pg-btn-override"
          @click="tabStore.prevPage"
        >
          <BaseIcon name="chevronLeft" />
        </BaseButton>

        <span class="pg-text">
          {{ startRow }} - {{ endRow }}
          <span v-if="tabStore.currentTab.pagination.total !== null" class="total-count">
            of {{ tabStore.currentTab.pagination.total }}
          </span>
        </span>

        <BaseButton
          variant="ghost"
          :icon-only="true"
          :disabled="isNextDisabled || connStore.loading"
          title="Next Page"
          class="pg-btn-override"
          @click="tabStore.nextPage"
        >
          <BaseIcon name="chevronRight" />
        </BaseButton>
      </div>
    </div>

    <div class="sb-section right">
      <div class="sb-item meta-info" :style="{ opacity: connStore.loading ? 0.5 : 1 }">
        <span v-if="tabStore.currentTab?.meta"> ⏱ {{ tabStore.currentTab.meta.duration }} ms </span>
      </div>

      <div class="sb-item connection-status" :class="{ active: isTabConnected }">
        {{ isTabConnected ? `${currentConnectionName}` : 'Disconnected' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import BaseButton from '../ui/BaseButton.vue'
import BaseIcon from '../ui/BaseIcon.vue'

const tabStore = useTabStore()
const connStore = useConnectionStore()

const isTabConnected = computed(() => {
  return tabStore.currentTab?.type === 'query' && tabStore.currentTab.connectionId !== null
})

const currentConnectionName = computed(() => {
  if (!isTabConnected.value) return ''
  const conn = connStore.savedConnections[tabStore.currentTab!.connectionId!]
  return conn ? conn.name : 'Unknown'
})

// Вычисляемые свойства для пагинации
const startRow = computed(() => (tabStore.currentTab?.pagination.offset || 0) + 1)
const endRow = computed(() => {
  if (!tabStore.currentTab) return 0
  return (tabStore.currentTab.pagination.offset || 0) + tabStore.currentTab.rows.length
})

const isNextDisabled = computed(() => {
  if (!tabStore.currentTab) return true
  // Если загрузили меньше лимита, значит это конец
  if (tabStore.currentTab.rows.length < tabStore.currentTab.pagination.limit) return true
  // Если знаем тотал, проверяем по нему
  if (tabStore.currentTab.pagination.total !== null) {
    return endRow.value >= tabStore.currentTab.pagination.total
  }
  return false
})
</script>

<style scoped>
/* ПЕРЕХОД НА CSS GRID */
.status-bar-global {
  height: var(--status-bar-height);
  background: var(--bg-status-bar);
  color: var(--fg-status-bar);
  font-size: 12px;
  user-select: none;

  /* GRID LAYOUT: 3 колонки. Центр (auto) занимает ровно сколько надо, края (1fr) делят остаток */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 10px;
}

.status-bar-global.loading {
  background: #005f9e;
}

/* Секции для выравнивания */
.sb-section {
  display: flex;
  align-items: center;
}

.sb-section.left {
  justify-content: flex-start;
}
.sb-section.center {
  justify-content: center;
}
.sb-section.right {
  justify-content: flex-end;
  gap: 15px; /* Отступ между таймером и статусом */
}

.sb-item {
  display: flex;
  align-items: center;
  white-space: nowrap; /* Чтобы текст не переносился и не менял высоту */
}

.connection-status {
  display: flex;
  align-items: center;
  font-weight: 500;
}
.connection-status::before {
  content: '';
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  margin-right: 6px;
}
.connection-status.active::before {
  background: #89d185; /* Зеленая точка */
}

/* Пагинация */
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Override ghost button color for status bar dark theme if needed */
.pg-btn-override {
  color: white !important;
  opacity: 0.8;
  padding: 0 !important;
  width: 20px;
  height: 20px;
  min-height: 0 !important; /* Force override constraints */
  min-width: 0 !important; /* Force override constraints */
}
.pg-btn-override:hover:not(:disabled) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1) !important;
}

.pg-text {
  font-variant-numeric: tabular-nums; /* Фиксированная ширина цифр */
  text-align: center;
  /* Минимальная ширина, чтобы не дергалось при смене 9 -> 10 */
  min-width: 100px;
  display: inline-block;
}

.total-count {
  opacity: 0.8;
  margin-left: 2px;
}

.loading-label {
  font-style: italic;
  opacity: 0.8;
}
</style>
