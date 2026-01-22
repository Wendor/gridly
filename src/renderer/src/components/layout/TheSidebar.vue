<template>
  <div class="sidebar-wrapper">
    <ConnectionSidebar
      v-if="uiStore.activeSidebar === 'connections'"
      :connections="connStore.savedConnections"
      :active-sidebar-id="connStore.activeId"
      :tables-cache="connStore.tablesCache"
      @select="(id) => (connStore.activeId = id)"
      @expand="(id) => connStore.loadTables(id)"
      @delete="connStore.deleteConnection"
      @open-create-modal="$emit('open-create-modal')"
      @table-click="handleTableClick"
    />

    <HistorySidebar v-else-if="uiStore.activeSidebar === 'history'" />

    <div
      v-else-if="uiStore.activeSidebar === 'settings'"
      style="padding: 20px; color: var(--text-secondary)"
    >
      Settings Panel
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConnectionStore } from '../../stores/connections'
import { useTabStore } from '../../stores/tabs'
// Импорт стора UI для переключения
import { useUIStore } from '../../stores/ui'

import ConnectionSidebar from '../ConnectionSidebar.vue'
import HistorySidebar from '../HistorySidebar.vue'

defineEmits<{
  (e: 'open-create-modal'): void
}>()

const connStore = useConnectionStore()
const tabStore = useTabStore()
const uiStore = useUIStore()

function handleTableClick(tableName: string, connIndex: number): void {
  tabStore.openTableTab(connIndex, tableName)
}
</script>

<style scoped>
.sidebar-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-sidebar);
}
</style>
