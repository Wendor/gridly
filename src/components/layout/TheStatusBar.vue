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
          ⏱ {{ Number(tabStore.currentTab.meta.duration).toFixed(2) }} ms
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

const connectedTab = computed(() => {
  const t = tabStore.currentTab
  // Both 'query' and 'dashboard' tabs have a connectionId
  if (t && (t.type === 'query' || t.type === 'dashboard')) {
    return t
  }
  return null
})

const isTabConnected = computed(() => {
  return connectedTab.value?.connectionId !== null && connectedTab.value?.connectionId !== undefined
})

const currentConnectionName = computed(() => {
  if (!isTabConnected.value || !connectedTab.value) return ''
  const connId = connectedTab.value.connectionId
  // Dashboard tab might have connectionId as string directly, check type definition if needed.
  // In types.ts: DashboardTab { connectionId: string }, QueryTab { connectionId: string | null }
  if (!connId) return ''

  const conn = connStore.savedConnections.find((c) => c.id === connId)
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
