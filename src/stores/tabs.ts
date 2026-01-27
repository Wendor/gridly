import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useConnectionStore } from './connections';
import { useHistoryStore } from './history';
import { RowUpdate, UpdateResult } from '@/types';
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

export type Tab = QueryTab | SettingsTab | DocumentTab | DashboardTab

export const useTabStore = defineStore('tabs', () => {
  const connectionStore = useConnectionStore();
  const historyStore = useHistoryStore();

  const tabs = ref<Tab[]>([]);
  const activeTabId = ref(1);
  const nextTabId = ref(1);

  const activeDatabaseCache = ref<Map<string, string | null>>(new Map());

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
    });

    activeTabId.value = id;
    runQuery();
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

  function resetConnectionState(connectionId: string): void {
    activeDatabaseCache.value.delete(connectionId);
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

  function nextPage(): void {
    if (!currentTab.value || currentTab.value.type !== 'query') return;
    currentTab.value.pagination.offset += currentTab.value.pagination.limit;
    runQuery();
  }

  function prevPage(): void {
    if (!currentTab.value || currentTab.value.type !== 'query') return;
    if (currentTab.value.pagination.offset === 0) return;

    currentTab.value.pagination.offset = Math.max(
      0,
      currentTab.value.pagination.offset - currentTab.value.pagination.limit,
    );
    runQuery();
  }

  async function runQuery(): Promise<void> {
    const tab = currentTab.value;
    if (!tab || tab.type !== 'query' || tab.connectionId === null) return;

    const connId = tab.connectionId;
    const dbName = tab.database;

    // Helper to execute the core query logic
    const execute = async (
      forceDbSwitch = false,
    ): Promise<{ res: unknown; tableName: string | null; isSimpleSelect: boolean }> => {
      await connectionStore.ensureConnection(connId);

      if (dbName) {
        // If forceDbSwitch is true, we ignore the cache
        const lastSetDb = activeDatabaseCache.value.get(connId);
        if (forceDbSwitch || lastSetDb !== dbName) {
          await window.dbApi.setActiveDatabase(connId, dbName);
          activeDatabaseCache.value.set(connId, dbName);
        }
      }

      let finalSql = tab.sql.trim();

      // Parse table name for count optimization
      const tableMatch = finalSql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i);
      const tableName = tableMatch ? tableMatch[1] : null;

      const isSimpleSelect =
        /^SELECT\s+\*\s+FROM/i.test(finalSql) && !/WHERE|JOIN|GROUP/i.test(finalSql);

      // Handle LIMIT / OFFSET
      const isSelect = /^SELECT\s/i.test(finalSql);
      const hasLimit = /LIMIT\s+\d+/i.test(finalSql);

      if (isSelect && !hasLimit) {
        finalSql = finalSql.replace(/;$/, '');
        finalSql += ` LIMIT ${tab.pagination.limit} OFFSET ${tab.pagination.offset}`;
      }

      const res = await window.dbApi.query(connId, finalSql);
      return { res, tableName, isSimpleSelect }; // Return needed data
    };

    try {
      connectionStore.loading = true;
      connectionStore.error = null;

      let result;
      try {
        result = await execute(false);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Check for specific DB errors indicating wrong context
        const isMissingRelation = msg.includes('relation') && msg.includes('does not exist'); // Postgres
        const isMissingTable = msg.includes('Table') && msg.includes("doesn't exist"); // MySQL

        if ((isMissingRelation || isMissingTable) && dbName) {
          console.warn('Handling missing relation error: retrying with forced DB switch');
          // Force switch and retry
          activeDatabaseCache.value.delete(connId);
          result = await execute(true);
        } else {
          throw e;
        }
      }

      if (!result) return; // Should not happen if no throw

      const { res, tableName, isSimpleSelect } = result;

      if (res.error) {
        connectionStore.error = res.error;
        historyStore.addEntry(tab.sql, 'error', 0, connId);
      } else {
        // Columns
        tab.colDefs = res.columns.map((col: string) => ({
          field: col,
          headerName: col,
        }));

        tab.rows = res.rows as Record<string, unknown>[];
        tab.meta = { duration: res.duration };

        historyStore.addEntry(tab.sql, 'success', res.duration, connId);

        // Count Total
        if (tableName && isSimpleSelect) {
          if (tab.pagination.total === null || tab.pagination.offset === 0) {
            try {
              const countSql = `SELECT COUNT(*) as total FROM ${tableName}`;
              const countRes = await window.dbApi.query(connId, countSql);
              if (countRes.rows.length > 0) {
                const row = countRes.rows[0] as Record<string, unknown>;
                const val = Object.values(row)[0];
                tab.pagination.total = Number(val);
              }
            } catch (e) {
              console.error('Count failed', e);
            }
          }
        } else {
          if (res.rows.length < tab.pagination.limit) {
            tab.pagination.total = tab.pagination.offset + res.rows.length;
          } else {
            tab.pagination.total = null;
          }
        }
      }

      await loadPrimaryKeys();
    } catch (e) {
      if (e instanceof Error) {
        connectionStore.error = e.message;
        if (tab.type === 'query') {
          historyStore.addEntry(tab.sql, 'error', 0, connId);
        }
      }
    } finally {
      connectionStore.loading = false;
    }
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

  watch(
    currentTab,
    async (newTab) => {
      if (!newTab || newTab.type !== 'query' || newTab.connectionId === null) return;
      if (
        !newTab.database ||
        typeof newTab.database !== 'string' ||
        newTab.database === 'undefined'
      )
        return;

      const lastSetDb = activeDatabaseCache.value.get(newTab.connectionId);
      if (lastSetDb !== newTab.database) {
        try {
          await connectionStore.ensureConnection(newTab.connectionId);
          await window.dbApi.setActiveDatabase(newTab.connectionId, newTab.database);
          activeDatabaseCache.value.set(newTab.connectionId, newTab.database);
          // Force reload schema for the new database
          const dbName = newTab.database || undefined;
          await connectionStore.loadSchema(newTab.connectionId, dbName, true);
        } catch (e) {
          console.error('Failed to set active database on tab switch:', e);
        }
      }
    },
    { immediate: false },
  );

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

  function getRowKey(row: Record<string, unknown>, primaryKeys: string[]): string {
    const pkValues = primaryKeys.map((pk) => String(row[pk] ?? '')).join('|');
    return pkValues;
  }

  function extractTableName(sql: string): string | null {
    const match = sql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i);
    return match ? match[1].replace(/[`'"]/g, '') : null;
  }

  async function loadPrimaryKeys(): Promise<void> {
    if (!currentTab.value || currentTab.value.type !== 'query') return;
    if (currentTab.value.connectionId === null) return;

    const tableName = currentTab.value.tableName || extractTableName(currentTab.value.sql);
    if (!tableName) return;

    currentTab.value.tableName = tableName;

    try {
      const pks = await window.dbApi.getPrimaryKeys(currentTab.value.connectionId, tableName);
      currentTab.value.primaryKeys = pks;
    } catch (e) {
      console.error('Failed to load primary keys:', e);
      currentTab.value.primaryKeys = [];
    }
  }

  function updateCellValue(rowIndex: number, column: string, value: unknown): void {
    if (!currentTab.value || currentTab.value.type !== 'query') return;
    if (currentTab.value.primaryKeys.length === 0) return;

    const row = currentTab.value.rows[rowIndex];
    if (!row) return;

    const rowKey = getRowKey(row, currentTab.value.primaryKeys);

    if (!currentTab.value.originalRows.has(rowKey)) {
      currentTab.value.originalRows.set(rowKey, { ...row });
    }

    if (!currentTab.value.pendingChanges.has(rowKey)) {
      currentTab.value.pendingChanges.set(rowKey, {});
    }

    const changes = currentTab.value.pendingChanges.get(rowKey)!;

    // Check if value equals original
    const originalValue = currentTab.value.originalRows.get(rowKey)![column];
    // Simple equality check, can be improved for objects/dates if needed
    if (String(value) === String(originalValue)) {
      delete changes[column];
      if (Object.keys(changes).length === 0) {
        currentTab.value.pendingChanges.delete(rowKey);
        currentTab.value.originalRows.delete(rowKey);
      }
    } else {
      changes[column] = value;
    }

    // Update UI
    row[column] = value;
  }

  function revertChanges(): void {
    if (!currentTab.value || currentTab.value.type !== 'query') return;

    const queryTab = currentTab.value;

    for (const [rowKey, originalRow] of queryTab.originalRows) {
      const rowIndex = queryTab.rows.findIndex((r) => getRowKey(r, queryTab.primaryKeys) === rowKey);
      if (rowIndex !== -1) {
        queryTab.rows[rowIndex] = { ...originalRow };
      }
    }

    queryTab.pendingChanges.clear();
    queryTab.originalRows.clear();
  }

  async function commitChanges(): Promise<void> {
    if (!currentTab.value || currentTab.value.type !== 'query') return;
    if (currentTab.value.connectionId === null) return;
    if (currentTab.value.pendingChanges.size === 0) return;
    if (!currentTab.value.tableName) return;

    const updates: RowUpdate[] = [];

    for (const [rowKey, changes] of currentTab.value.pendingChanges) {
      const original = currentTab.value.originalRows.get(rowKey);
      if (!original) continue;

      const primaryKeys: Record<string, unknown> = {};
      for (const pk of currentTab.value.primaryKeys) {
        primaryKeys[pk] = original[pk];
      }

      updates.push({
        tableName: currentTab.value.tableName,
        primaryKeys,
        changes: Object.fromEntries(Object.entries(changes)),
      });
    }

    try {
      connectionStore.loading = true;
      const result = (await window.dbApi.updateRows(
        currentTab.value.connectionId,
        updates,
      )) as UpdateResult;

      if (result.success) {
        currentTab.value.pendingChanges.clear();
        currentTab.value.originalRows.clear();
        await runQuery();
      } else {
        connectionStore.error = result.error || 'Unknown error';
      }
    } catch (e) {
      connectionStore.error = e instanceof Error ? e.message : String(e);
    } finally {
      connectionStore.loading = false;
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
    runQuery,
    nextPage,
    prevPage,
    loadPrimaryKeys,
    updateCellValue,
    revertChanges,
    commitChanges,
    resetConnectionState,
    loadFromStorage,
    reorderTabs,
  };
});
