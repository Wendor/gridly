<template>
  <div class="status-bar-global" :class="{ loading: connStore.loading }">
    <div class="sb-item">
      {{ tabStore.currentTab?.type === 'settings' ? 'Settings' : 'Ready' }}
    </div>

    <div v-if="connStore.loading" class="sb-item">Running... ⏳</div>

    <div class="spacer"></div>

    <div v-if="tabStore.currentTab?.meta && !connStore.loading" class="sb-item">
      ⏱ {{ tabStore.currentTab.meta.duration }} ms | {{ tabStore.currentTab.rows.length }} rows
    </div>

    <div class="sb-item connection-status" :class="{ active: isTabConnected }">
      {{ isTabConnected ? `Connected: ${currentConnectionName}` : 'Disconnected' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'

const tabStore = useTabStore()
const connStore = useConnectionStore()

const isTabConnected = computed<boolean>(() => {
  return !!(
    tabStore.currentTab &&
    tabStore.currentTab.type === 'query' &&
    tabStore.currentTab.connectionId !== null &&
    connStore.connectedId === tabStore.currentTab.connectionId &&
    connStore.isConnected
  )
})

const currentConnectionName = computed<string>(() => {
  if (
    !tabStore.currentTab ||
    tabStore.currentTab.type !== 'query' ||
    tabStore.currentTab.connectionId === null
  )
    return ''
  return connStore.savedConnections[tabStore.currentTab.connectionId]?.name || 'Unknown'
})
</script>

<style scoped>
.status-bar-global {
  height: var(--status-bar-height);
  background: var(--accent-primary);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  /* Убрали fixed позиционирование, теперь это часть flex-контейнера в App.vue */
  width: 100%;
  box-sizing: border-box;
  transition: background 0.3s;
}
.status-bar-global.loading {
  background: #005f9e; /* Чуть светлее или другой оттенок при загрузке */
}

.sb-item {
  margin-right: 15px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.spacer {
  flex: 1;
}
.connection-status {
  background: rgba(0, 0, 0, 0.2);
  padding: 0 8px;
  height: 100%;
  font-size: 11px;
  display: flex;
  align-items: center;
}
.connection-status.active {
  background: rgba(0, 0, 0, 0.4);
  font-weight: bold;
}
</style>
