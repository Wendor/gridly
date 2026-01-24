<template>
  <div class="status-bar-global">
    <div class="sb-section left">
      <div class="sb-item status-text">
        <span v-if="connStore.loading" class="loading-label">{{ $t('status.executing') }}</span>
        <span v-else>{{
          tabStore.currentTab?.type === 'settings' ? $t('common.settings') : $t('common.ready')
        }}</span>
      </div>
    </div>

    <div class="sb-section center">
      <!-- Pagination removed (moved to results toolbar) -->
    </div>

    <div class="sb-section right">
      <div class="sb-item meta-info" :style="{ opacity: connStore.loading ? 0.5 : 1 }">
        <span v-if="tabStore.currentTab?.type === 'query' && tabStore.currentTab.meta">
          ⏱ {{ tabStore.currentTab.meta.duration }} ms
        </span>
      </div>

      <div class="sb-item connection-status" :class="{ active: isTabConnected }">
        {{ isTabConnected ? `${currentConnectionName}` : $t('status.disconnected') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'

const tabStore = useTabStore()
const connStore = useConnectionStore()

const currentQueryTab = computed(() => {
  return tabStore.currentTab?.type === 'query' ? tabStore.currentTab : null
})

const isTabConnected = computed(() => {
  return (
    currentQueryTab.value?.connectionId !== null &&
    currentQueryTab.value?.connectionId !== undefined
  )
})

const currentConnectionName = computed(() => {
  if (!isTabConnected.value || !currentQueryTab.value) return ''
  const conn = connStore.savedConnections[currentQueryTab.value.connectionId!]
  return conn ? conn.name : 'Unknown'
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

.loading-label {
  font-style: italic;
  opacity: 0.8;
}
</style>
