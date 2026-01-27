<template>
  <div class="editor-area">
    <div class="tabs-header-wrapper">
      <div ref="scrollContainer" class="tabs-scroll-area">
        <div
          v-for="(tab, index) in tabStore.tabs"
          :key="tab.id"
          class="tab"
          :class="{
            active: tabStore.activeTabId === tab.id,
            dragging: draggedTabId === tab.id,
            'drop-left': dragOverIndex === index && draggedIndex !== null && draggedIndex > index,
            'drop-right': dragOverIndex === index && draggedIndex !== null && draggedIndex < index
          }"
          draggable="true"
          @click="switchToTab(tab.id)"
          @dragstart="onDragStart($event, index, tab.id)"
          @dragover.prevent="onDragOver($event)"
          @dragenter.prevent="onDragEnter($event, index)"
          @drop.prevent="onDrop($event, index)"
          @dragend="onDragEnd"
          @mousedown.middle="tabStore.closeTab(tab.id)"
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
              v-else-if="tab.type === 'dashboard'"
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
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
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
      </div>

      <div class="tabs-actions">
        <div class="action-btn" :title="$t('common.tabList')" @click="toggleTabList">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="action-btn" :title="$t('common.newTab')" @click="tabStore.addTab(null)">+</div>

        <div v-if="isTabListOpen" ref="tabListDropdown" class="tab-list-dropdown">
          <div
            v-for="tab in tabStore.tabs"
            :key="tab.id"
            class="dropdown-item"
            :class="{ active: tabStore.activeTabId === tab.id }"
            @click="selectTabFromList(tab.id)"
          >
            {{ tab.name }}
          </div>
          <div v-if="tabStore.tabs.length === 0" class="dropdown-empty">
            {{ $t('common.noTabs') }}
          </div>
        </div>
      </div>
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useTabStore } from '../../stores/tabs';
import { useConnectionStore } from '../../stores/connections';
import SettingsView from '../views/SettingsView.vue';
import QueryView from '../views/QueryView.vue';
import DocumentView from '../views/DocumentView.vue';
import DashboardView from '../views/DashboardView.vue';

const tabStore = useTabStore();
const connStore = useConnectionStore();
const scrollContainer = ref<HTMLElement | null>(null);
const tabListDropdown = ref<HTMLElement | null>(null);

const isTabListOpen = ref(false);
const draggedTabId = ref<number | null>(null);

function toggleTabList(): void {
  isTabListOpen.value = !isTabListOpen.value;
}

function selectTabFromList(id: number): void {
  switchToTab(id);
  isTabListOpen.value = false;
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent): void {
  if (
    isTabListOpen.value &&
    tabListDropdown.value &&
    !tabListDropdown.value.contains(event.target as Node) &&
    !(event.target as HTMLElement).closest('.action-btn')
  ) {
    isTabListOpen.value = false;
  }
}

async function switchToTab(id: number): Promise<void> {
  tabStore.activeTabId = id;
  const tab = tabStore.currentTab;
  if (tab && (tab.type === 'query' || tab.type === 'dashboard') && tab.connectionId !== null) {
    try {
      await connStore.ensureConnection(tab.connectionId);
    } catch (e) {
      console.error(e);
    }
  }
  // Scroll to tab
  setTimeout(() => {
    if (!scrollContainer.value) return;
    const activeEl = scrollContainer.value.querySelector('.tab.active') as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, 50);
}

const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// --- Drag & Drop ---
function onDragStart(e: DragEvent, index: number, tabId: number): void {
  console.log('Drag Start:', index, tabId);
  draggedIndex.value = index;
  draggedTabId.value = tabId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    // Use custom MIME type to prevent dropping as text in editor
    e.dataTransfer.setData('application/x-gridly-tab', index.toString());
  }
}

function onDragOver(e: DragEvent): void {
  e.preventDefault(); // Explicitly prevent default
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function onDragEnter(e: DragEvent, index: number): void {
  e.preventDefault();
  if (index !== draggedIndex.value) {
    dragOverIndex.value = index;
  }
}

function onDrop(e: DragEvent, dropIndex: number): void {
  // Prevent default logic if necessary, though we don't rely on dataTransfer
  e.preventDefault();
  console.log('Drop:', dropIndex, 'Dragged:', draggedIndex.value);

  if (draggedIndex.value === null) {
    console.error('Dragged index is null on drop!');
    return;
  }

  if (draggedIndex.value !== dropIndex) {
    console.log('Reordering...');
    tabStore.reorderTabs(draggedIndex.value, dropIndex);
  }

  resetDrag();
}

function onDragEnd(): void {
  resetDrag();
}

function resetDrag(): void {
  draggedTabId.value = null;
  draggedIndex.value = null;
  dragOverIndex.value = null;
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  const tab = tabStore.currentTab;
  if (tab && (tab.type === 'query' || tab.type === 'dashboard') && tab.connectionId !== null) {
    connStore.ensureConnection(tab.connectionId).catch(console.error);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
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
.tabs-header-wrapper {
  height: var(--header-height);
  background: var(--bg-panel-header);
  display: flex;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  box-sizing: border-box;
  position: relative;
  z-index: 2000; /* Extremely high to ensure dropdown beats dashboard */
  -webkit-app-region: no-drag; /* Ensure it's not captured by window drag */
}

/* ... existing code ... */
.tabs-scroll-area {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  /* Hide scrollbar but allow scroll */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}
.tabs-scroll-area::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  color: var(--text-secondary);
  background: var(--bg-panel-header); /* Solid background for hit testing */
  min-width: 120px;
  max-width: 220px;
  font-size: 13px;
  user-select: none;
  flex-shrink: 0; /* Don't squash tabs */
  -webkit-user-drag: element;
  position: relative;
}
/* .tab:active removed as requested */
.tab:hover {
  background: var(--bg-app);
}
.tab * {
  pointer-events: none;
}
.tab-close {
  pointer-events: auto;
}
.tab.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
  border-top: 2px solid var(--accent-primary);
}
.tab.dragging {
  opacity: 1;
  background: var(--bg-app);
}
.tab.drop-left::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: var(--accent-primary);
  z-index: 10;
}
.tab.drop-right::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 2px;
  background: var(--accent-primary);
  z-index: 10;
}

.tab-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
  opacity: 0.8;
}
.tab.active .tab-icon {
  opacity: 1;
  color: var(--accent-primary);
}

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

.tabs-actions {
  display: flex;
  align-items: center;
  background: var(--bg-panel-header);
  box-shadow: -5px 0 5px -5px rgba(0, 0, 0, 0.1);
  z-index: 2;
  position: relative;
}

.action-btn {
  width: 35px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: var(--text-secondary);
}
.action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-app);
}

.tab-list-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 250px;
  max-width: 300px;
  background: var(--bg-input); /* Match BaseSelect */
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  z-index: 9999;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 4px; /* Match BaseSelect */
}
.dropdown-item {
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px; /* Match BaseSelect */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
  border-bottom: none; /* Remove old border */
}

.dropdown-item:hover {
  background: var(--list-hover-bg);
  color: var(--list-hover-fg);
}
.dropdown-item.active {
  background: var(--list-active-bg);
  color: var(--list-active-fg);
}
.dropdown-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-secondary);
  font-style: italic;
  font-size: 12px;
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
