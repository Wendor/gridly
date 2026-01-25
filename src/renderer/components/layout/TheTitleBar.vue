<template>
  <div class="title-bar" @dblclick="maximizeWindow">
    <div class="drag-region"></div>
    <div class="title-content">
      <span class="app-name">Gridly</span>
      <span v-if="connectionTitle" class="conn-info"> - {{ connectionTitle }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import i18n from '../../i18n'

const tabStore = useTabStore()
const connStore = useConnectionStore()

const connectionTitle = computed(() => {
  if (tabStore.currentTab?.type === 'query' && tabStore.currentTab.connectionId !== null) {
    const connId = tabStore.currentTab.connectionId
    const conn = connStore.savedConnections.find((c) => c.id === connId)
    if (conn) {
      const status = connStore.isConnected(connId) ? i18n.global.t('status.connectedInTitle') : ''
      return `${conn.name} ${status}`
    }
  }
  return null
})

function maximizeWindow(): void {
  // System handling usually works, but double-click to max is nice to keep if we can,
  // though without IPC it might be inactive. Keeping empty handler or removing entirely.
  // User said "System ones are enough", implying standard traffic lights.
  // Standard traffic lights work on drag regions usually.
}
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

.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  -webkit-app-region: drag;
  z-index: 1;
}

.title-content {
  position: relative;
  z-index: 2; /* Text must be visible but clicks usually should go to drag region...
                 Actually, text is usually part of drag region.
                 If z-index 2, it might block dragging if not app-region: drag.
                 Text should likely be draggable too. */
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
