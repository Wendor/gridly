<template>
  <div class="editor-area">
    <div class="tabs-container">
      <div
        v-for="tab in tabStore.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tabStore.activeTabId === tab.id }"
        @click="switchToTab(tab.id)"
      >
        <span class="tab-icon">
          <svg
            v-if="tab.type === 'settings'"
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
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 5 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            ></path>
          </svg>
          <svg
            v-else
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </span>

        <span class="tab-title">{{ tab.name }}</span>
        <span class="tab-close" @click.stop="tabStore.closeTab(tab.id)">×</span>
      </div>
      <div class="add-tab" :title="$t('common.newTab')" @click="tabStore.addTab(null)">+</div>
    </div>

    <div v-if="tabStore.currentTab" class="main-view-container">
      <SettingsView v-if="tabStore.currentTab.type === 'settings'" />
      <DocumentView v-else-if="tabStore.currentTab.type === 'document'" />
      <DashboardView v-else-if="tabStore.currentTab.type === 'dashboard'" />
      <QueryView v-else-if="tabStore.currentTab.type === 'query'" />
    </div>

    <div v-else class="empty-state">
      <div class="logo-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      </div>
      <p>{{ $t('common.noTabs') }}</p>
      <button class="btn-primary" @click="tabStore.addTab(null)">
        {{ $t('common.openNewQuery') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTabStore } from '../../stores/tabs'
import { useConnectionStore } from '../../stores/connections'
import SettingsView from '../views/SettingsView.vue'
import QueryView from '../views/QueryView.vue'
import DocumentView from '../views/DocumentView.vue'
import DashboardView from '../views/DashboardView.vue'

const tabStore = useTabStore()
const connStore = useConnectionStore()

async function switchToTab(id: number): Promise<void> {
  tabStore.activeTabId = id
  const tab = tabStore.currentTab
  if (tab && (tab.type === 'query' || tab.type === 'dashboard') && tab.connectionId !== null) {
    try {
      await connStore.ensureConnection(tab.connectionId)
    } catch (e) {
      console.error(e)
    }
  }
}

// Restore connection for active tab on mount
import { onMounted } from 'vue'

onMounted(() => {
  const tab = tabStore.currentTab
  if (tab && (tab.type === 'query' || tab.type === 'dashboard') && tab.connectionId !== null) {
    connStore.ensureConnection(tab.connectionId).catch(console.error)
  }
})
</script>

<style scoped>
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-app);
  height: 100%;
}
.tabs-container {
  height: var(--header-height);
  background: var(--bg-panel-header);
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  box-sizing: border-box;
}
.tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  min-width: 120px;
  max-width: 220px;
  font-size: 13px;
  user-select: none;
}
.tab:hover {
  background: var(--bg-app);
}
.tab.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
  border-top: 2px solid var(--accent-primary);
}

/* Выравнивание иконки */
.tab-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
  opacity: 0.8;
}
.tab.active .tab-icon {
  opacity: 1;
  color: var(--accent-primary);
} /* Цветная иконка в активном табе */

.tab-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-close {
  margin-left: 8px;
  font-size: 16px;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tab-close:hover {
  background: #444;
  color: white;
}
.add-tab {
  width: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: var(--text-secondary);
}
.add-tab:hover {
  color: var(--text-white);
  background: var(--bg-app);
}
.main-view-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  opacity: 0.5;
}

.logo-icon {
  margin-bottom: 20px;
  color: var(--border-color);
}

.btn-primary {
  margin-top: 20px;
  padding: 10px 20px;
  background: var(--accent-primary);
  color: white;
  border: none;
  cursor: pointer;
  border-radius: 4px;
}
</style>
