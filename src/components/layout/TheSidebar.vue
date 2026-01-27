<template>
  <div class="sidebar-wrapper">
    <ConnectionSidebar
      v-if="uiStore.activeSidebar === 'connections'"
      :connections="connStore.savedConnections"
      :active-sidebar-id="connStore.activeId"
      :tables-cache="connStore.tablesCache"
      @select="(id) => connStore.ensureConnection(id)"
      @expand="(id) => connStore.loadTables(id)"
      @delete="connStore.deleteConnection"
      @edit="(id) => tabStore.openConnectionTab(id)"
      @open-create-modal="() => tabStore.openConnectionTab()"
      @table-click="handleTableClick"
    />

    <HistorySidebar v-else-if="uiStore.activeSidebar === 'history'" />

    <div
      v-else-if="uiStore.activeSidebar === 'settings'"
      style="padding: 20px; color: var(--text-secondary)"
    >
      {{ $t('common.settingsPanel') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConnectionStore } from '../../stores/connections';
import { useTabStore } from '../../stores/tabs';
import { useUIStore } from '../../stores/ui';

import ConnectionSidebar from '../ConnectionSidebar.vue';
import HistorySidebar from '../HistorySidebar.vue';

// REMOVED emits
// defineEmits<{
//   (e: 'open-create-modal'): void
//   (e: 'edit', id: string): void
// }>();

const connStore = useConnectionStore();
const tabStore = useTabStore();
const uiStore = useUIStore();

function handleTableClick(tableName: string, connId: string, dbName: string): void {
  tabStore.openTableTab(connId, tableName, dbName);
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
