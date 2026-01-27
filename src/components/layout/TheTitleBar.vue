<template>
  <div class="title-bar" data-tauri-drag-region>
    <div class="title-content" data-tauri-drag-region>
      <span class="app-name" data-tauri-drag-region>Gridly</span>
      <span v-if="connectionTitle" class="conn-info" data-tauri-drag-region> - {{ connectionTitle }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTabStore } from '../../stores/tabs';
import { useConnectionStore } from '../../stores/connections';
import i18n from '../../i18n';

const tabStore = useTabStore();
const connStore = useConnectionStore();

const connectionTitle = computed(() => {
  if (tabStore.currentTab?.type === 'query' && tabStore.currentTab.connectionId !== null) {
    const connId = tabStore.currentTab.connectionId;
    const conn = connStore.savedConnections.find((c) => c.id === connId);
    if (conn) {
      const status = connStore.isConnected(connId) ? i18n.global.t('status.connectedInTitle') : '';
      return `${conn.name} ${status}`;
    }
  }
  return null;
});
</script>

<style scoped>
.title-bar {
  height: 30px;
  background: var(--bg-panel-header);
  display: flex;
  align-items: center;
  justify-content: center; /* Center the title */
  flex-shrink: 0;
  user-select: none;
  width: 100%;
  position: relative;
}

.title-content {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-name {
  color: var(--text-primary);
  font-weight: 600;
}

.conn-info {
  opacity: 0.8;
}
</style>
