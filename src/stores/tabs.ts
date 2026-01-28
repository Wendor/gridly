import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useConnectionStore } from './connections';

import i18n from '../i18n';

export interface BaseTab {
  id: number
  name: string
}

export interface QueryTab extends BaseTab {
  type: 'query'
  connectionId: string | null
  database: string | null
  sql: string
  currentQueryId?: string
  rows: Record<string, unknown>[]
  colDefs: { field: string; headerName?: string }[]
  meta: { duration: number } | null
  pagination: {
    limit: number
    offset: number
    total: number | null
  }
  tableName: string | null
  primaryKeys: string[]
  pendingChanges: Map<string, Record<string, unknown>>
  originalRows: Map<string, Record<string, unknown>>
  loading?: boolean
  error?: string | null
}

export interface SettingsTab extends BaseTab {
  type: 'settings'
}

export interface DocumentTab extends BaseTab {
  type: 'document'
  content: string
}

export interface DashboardTab extends BaseTab {
  type: 'dashboard'
  connectionId: string
}

export interface ConnectionTab extends BaseTab {
  type: 'connection'
  connectionId?: string // undefined = new connection
}

export type Tab = QueryTab | SettingsTab | DocumentTab | DashboardTab | ConnectionTab

export const useTabStore = defineStore('tabs', () => {
  const connectionStore = useConnectionStore();

  const tabs = ref<Tab[]>([]);
  const activeTabId = ref(1);
  const nextTabId = ref(1);



  const currentTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value));

  function addTab(initialConnId: string | null = null): void {
    const id = nextTabId.value++;
    let connId = initialConnId;

    if (connId === null) {
      if (currentTab.value?.type === 'query') {
        connId = currentTab.value.connectionId;
      } else {
        connId = connectionStore.savedConnections.length
          ? connectionStore.savedConnections[0].id
          : null;
      }
    }

    tabs.value.push({
      id,
      type: 'query',
      name: `${i18n.global.t('common.query')} ${id}`,
      connectionId: connId,
      database: null,
      sql: '',
      rows: [],
      colDefs: [],
      meta: null,
      pagination: { limit: 100, offset: 0, total: null },
      tableName: null,
      primaryKeys: [],
      pendingChanges: new Map(),
      originalRows: new Map(),
      loading: false,
      error: null,
    });
    activeTabId.value = id;
  }

  async function openTableTab(
    connectionId: string,
    tableName: string,
    database?: string,
  ): Promise<void> {
    const existingTab = tabs.value.find(
      (t): t is QueryTab =>
        t.type === 'query' && t.connectionId === connectionId && t.name === tableName,
    );

    if (existingTab) {
      activeTabId.value = existingTab.id;
      return;
    }

    const id = nextTabId.value++;

    tabs.value.push({
      id,
      type: 'query',
      name: tableName,
      connectionId,
      database: database || null,
      sql: `SELECT * FROM ${tableName}`,
      rows: [],
      colDefs: [],
      meta: null,
      pagination: { limit: 100, offset: 0, total: null },
      tableName: tableName,
      primaryKeys: [],
      pendingChanges: new Map(),
      originalRows: new Map(),
      loading: false,
      error: null,
    });

    activeTabId.value = id;
    activeTabId.value = id;
    // Query execution is now responsibility of caller
  }

  function openSettingsTab(): void {
    const existing = tabs.value.find((t) => t.type === 'settings');
    if (existing) {
      activeTabId.value = existing.id;
      return;
    }

    const id = nextTabId.value++;
    tabs.value.push({
      id,
      type: 'settings',
      name: i18n.global.t('common.settings'),
    });
    activeTabId.value = id;
  }

  function openDocumentTab(title: string, content: string): void {
    const existing = tabs.value.find((t) => t.type === 'document' && t.name === title);
    if (existing) {
      activeTabId.value = existing.id;
      return;
    }

    const id = nextTabId.value++;
    tabs.value.push({
      id,
      type: 'document',
      name: title,
      content,
    });
    activeTabId.value = id;
  }

  function closeTab(id: number): void {
    if (tabs.value.length === 1) return;
    const idx = tabs.value.findIndex((t) => t.id === id);
    tabs.value.splice(idx, 1);
    if (id === activeTabId.value) {
      activeTabId.value = tabs.value[Math.max(0, idx - 1)].id;
    }
  }

  function openDashboardTab(connectionId: string): void {
    const existing = tabs.value.find(
      (t) => t.type === 'dashboard' && t.connectionId === connectionId,
    );
    if (existing) {
      activeTabId.value = existing.id;
      return;
    }

    const id = nextTabId.value++;
    const conn = connectionStore.savedConnections.find((c) => c.id === connectionId);
    tabs.value.push({
      id,
      type: 'dashboard',
      name: `${i18n.global.t('sidebar.overview')} - ${conn?.name || connectionId}`,
      connectionId,
    });
    activeTabId.value = id;
  }

  function openConnectionTab(connectionId?: string): void {
    const existing = tabs.value.find(
      (t) => t.type === 'connection' && t.connectionId === connectionId,
    );
    if (existing) {
      activeTabId.value = existing.id;
      return;
    }

    const id = nextTabId.value++;
    let name = i18n.global.t('connections.new');
    if (connectionId) {
      const conn = connectionStore.savedConnections.find((c) => c.id === connectionId);
      name = conn ? `${i18n.global.t('connections.edit')}: ${conn.name}` : i18n.global.t('connections.edit');
    }

    tabs.value.push({
      id,
      type: 'connection',
      name,
      connectionId,
    });
    activeTabId.value = id;
  }





  // --- PERSISTENCE LOGIC ---
  async function saveToStorage(): Promise<void> {
    const dataToSave = tabs.value.map((t) => {
      if (t.type === 'query') {
        return {
          id: t.id,
          type: t.type,
          name: t.name,
          connectionId: t.connectionId,
          database: t.database,
          sql: t.sql,
          tableName: t.tableName,
        };
      } else if (t.type === 'dashboard') {
        return {
          id: t.id,
          type: t.type,
          name: t.name,
          connectionId: t.connectionId,
        };
      } else if (t.type === 'document') {
        return {
          id: t.id,
          type: t.type,
          name: t.name,
          content: t.content,
        };
      } else if (t.type === 'connection') {
        return {
          id: t.id,
          type: t.type,
          name: t.name,
          connectionId: t.connectionId,
        };
      } else {
        return {
          id: t.id,
          type: t.type,
          name: t.name,
        };
      }
    });

    await window.dbApi.updateState({
      tabs: {
        openTabs: dataToSave,
        activeTabId: activeTabId.value,
        nextTabId: nextTabId.value,
      },
    });
  }

  async function loadFromStorage(): Promise<void> {
    try {
      const state = await window.dbApi.getState();

      if (state.tabs.openTabs.length > 0) {
        tabs.value = state.tabs.openTabs.map((t) => {
          if (t.type === 'query') {
            return {
              ...t,
              rows: [],
              colDefs: [],
              meta: null,
              primaryKeys: [],
              pendingChanges: new Map(),
              originalRows: new Map(),
              pagination: {
                limit: 100,
                offset: 0,
                total: null,
              },
              loading: false,
              error: null,
            } as QueryTab;
          } else {
            return t as Tab;
          }
        });
        activeTabId.value = state.tabs.activeTabId ?? 1;
        nextTabId.value = state.tabs.nextTabId;
      } else {
        openHelpTab();
      }
    } catch (e) {
      console.error('Failed to load tabs', e);
      openHelpTab();
    }
  }

  // Helper function for initial state if no tabs are loaded
  function openHelpTab(): void {
    openDocumentTab(
      i18n.global.t('common.instructions'),
      `# ${i18n.global.t('common.instructions')}\n\n${i18n.global.t('common.instructionsText')}`,
    );
  }

  watch(
    () => tabs.value,
    async () => {
      await saveToStorage();
    },
    { deep: true },
  );

  watch(activeTabId, () => {
    saveToStorage();
  });



  loadFromStorage();
  if (tabs.value.length === 0) {
    if (connectionStore.savedConnections.length === 0) {
      openDocumentTab(
        i18n.global.t('common.instructions'),
        `# ${i18n.global.t('common.instructions')}\n\n${i18n.global.t('common.instructionsText')}`,
      );
    } else {
      addTab();
    }
  }



  function reorderTabs(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= tabs.value.length ||
      toIndex < 0 ||
      toIndex >= tabs.value.length
    ) {
      return;
    }
    const [movedTab] = tabs.value.splice(fromIndex, 1);
    tabs.value.splice(toIndex, 0, movedTab);
    // Persist change immediately
    saveToStorage();
  }

  return {
    tabs,
    activeTabId,
    currentTab,
    addTab,
    openTableTab,
    openSettingsTab,
    openDashboardTab,
    openDocumentTab,
    closeTab,

    loadFromStorage,
    saveToStorage,
    reorderTabs,
    openConnectionTab,
  };
});
