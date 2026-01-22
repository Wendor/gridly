<template>
  <div class="sidebar-wrapper">
    <ConnectionSidebar
      :connections="connStore.savedConnections"
      :active-sidebar-id="connStore.activeId"
      :tables-cache="connStore.tablesCache"
      @select="(id) => (connStore.activeId = id)"
      @expand="(id) => connStore.loadTables(id)"
      @delete="connStore.deleteConnection"
      @open-create-modal="$emit('open-create-modal')"
      @table-click="handleTableClick"
    />
  </div>
</template>

<script setup lang="ts">
import { useConnectionStore } from '../../stores/connections'
import { useTabStore } from '../../stores/tabs'
import ConnectionSidebar from '../ConnectionSidebar.vue'

defineEmits<{
  (e: 'open-create-modal'): void
}>()

const connStore = useConnectionStore()
const tabStore = useTabStore()

function handleTableClick(tableName: string, connIndex: number): void {
  // Теперь просто вызываем умный метод стора
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
