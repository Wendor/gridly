import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useTabStore, QueryTab } from './tabs';
import { useConnectionStore } from './connections';
import { useHistoryStore } from './history';


export const useQueryStore = defineStore('query', () => {
  const tabStore = useTabStore();
  const connectionStore = useConnectionStore();
  const historyStore = useHistoryStore();

  const activeDatabaseCache = ref<Map<string, string | null>>(new Map());

  // Helper: Extract table name from SQL
  function extractTableName(sql: string): string | null {
    const match = sql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i);
    return match ? match[1].replace(/[`'"]/g, '') : null;
  }

  // Helper: Load primary keys
  async function loadPrimaryKeys(tab: QueryTab): Promise<void> {
    if (tab.connectionId === null) return;

    const tableName = tab.tableName || extractTableName(tab.sql);
    if (!tableName) return;

    // Update tab's tableName if we found it
    tab.tableName = tableName;

    try {
      const pks = await window.dbApi.getPrimaryKeys(tab.connectionId, tableName);
      tab.primaryKeys = pks;
    } catch (e) {
      console.error('Failed to load primary keys:', e);
      tab.primaryKeys = [];
    }
  }

  function resetConnectionState(connectionId: string): void {
    activeDatabaseCache.value.delete(connectionId);
  }

  async function runQuery(tabId?: number): Promise<void> {
    // If tabId provided, use it, otherwise use current
    const targetTab = tabId ? tabStore.tabs.find(t => t.id === tabId) : tabStore.currentTab;
    const tab = targetTab as QueryTab | undefined;

    if (!tab || tab.type !== 'query' || tab.connectionId === null) return;

    const connId = tab.connectionId;
    const dbName = tab.database;

    // Helper to execute the core query logic
    const execute = async (
      forceDbSwitch = false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ res: any; tableName: string | null; isSimpleSelect: boolean }> => {
      await connectionStore.ensureConnection(connId);

      if (dbName) {
        // If forceDbSwitch is true, we ignore the cache
        const lastSetDb = activeDatabaseCache.value.get(connId);
        if (forceDbSwitch || lastSetDb !== dbName) {
          await window.dbApi.setActiveDatabase(connId, dbName);
          activeDatabaseCache.value.set(connId, dbName);
          // Force reload schema for the new database context if needed
          // await connectionStore.loadSchema(connId, dbName, true); 
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

      const res = await window.dbApi.execute(connId, finalSql, tab.currentQueryId);
      return { res, tableName, isSimpleSelect }; // Return needed data
    };

    try {
      tab.loading = true;
      tab.error = null;
      // Generate ID
      tab.currentQueryId = crypto.randomUUID();

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
        tab.error = res.error;
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
              // Count query usually fast, no need for cancellation ID?
              const countRes = await window.dbApi.execute(connId, countSql);
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

      await loadPrimaryKeys(tab);
    } catch (e) {
      if (e instanceof Error) {
        tab.error = e.message;
        if (tab.type === 'query') {
          historyStore.addEntry(tab.sql, 'error', 0, connId);
        }
      }
    } finally {
      tab.loading = false;
      tab.currentQueryId = undefined;
      // Persist state change
      tabStore.saveToStorage(); 
    }
  }

  async function cancelQuery(tabId?: number): Promise<void> {
    const targetTab = tabId ? tabStore.tabs.find(t => t.id === tabId) : tabStore.currentTab;
    const tab = targetTab as QueryTab | undefined;
    
    if (!tab || tab.type !== 'query' || !tab.loading || !tab.currentQueryId || !tab.connectionId) return;

    try {
        await window.dbApi.cancelQuery(tab.connectionId, tab.currentQueryId);
    } catch (e) {
        console.error("Failed to cancel query", e);
    }
  }

  return {
    runQuery,
    cancelQuery,
    resetConnectionState,
    activeDatabaseCache, // Expose if needed elsewhere
  };
});
