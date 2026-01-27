import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { DbConnection, DbConnectionMeta, DbSchema, AppSchemaCache } from '../types';

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

export const useConnectionStore = defineStore('connections', () => {
  const savedConnections = ref<DbConnectionMeta[]>([]);
  const activeId = ref<string | null>(null);
  const activeConnectionIds = ref<Set<string>>(new Set());

  // Data Caches
  const tablesCache = reactive<Record<string, string[]>>({});
  const schemaCache = reactive<Record<string, DbSchema>>({});
  const databasesCache = reactive<Record<string, string[]>>({});
  const databasesError = reactive<Record<string, string | null>>({});

  // Background fetch tracking
  const fetchingDatabases = reactive<Set<string>>(new Set());
  const fetchingTables = reactive<Set<string>>(new Set());
  const fetchingSchemas = reactive<Set<string>>(new Set());

  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- PERSISTENCE ---

  const saveCache = debounce(async () => {
    const cache: AppSchemaCache = {
      databases: { ...databasesCache },
      tables: { ...tablesCache },
      schemas: { ...schemaCache },
    };
    try {
      await window.dbApi.saveSchemaCache(cache);
    } catch (e) {
      console.error('Failed to save schema cache', e);
    }
  }, 2000); // 2 seconds debounce

  async function syncCache(): Promise<void> {
    try {
      const cache = await window.dbApi.getSchemaCache();
      
      // Merge/Overwrite cache
      Object.assign(databasesCache, cache.databases);
      Object.assign(tablesCache, cache.tables);
      Object.assign(schemaCache, cache.schemas);

      console.log('Schema cache loaded', {
        dbs: Object.keys(cache.databases).length,
        tables: Object.keys(cache.tables).length,
        schemas: Object.keys(cache.schemas).length
      });
    } catch (e) {
      console.error('Failed to load schema cache', e);
    }
  }

  // --- ACTIONS ---

  async function loadFromStorage(): Promise<void> {
    try {
      loading.value = true;
      const [conns] = await Promise.all([
        window.dbApi.getConnections(),
        syncCache() // Load cache in parallel
      ]);
      savedConnections.value = conns;
    } catch (e) {
      console.error('Failed to load connections', e);
    } finally {
      loading.value = false;
    }
  }

  async function addConnection(conn: DbConnection): Promise<void> {
    if (!conn.id) conn.id = crypto.randomUUID();
    await window.dbApi.saveConnection(conn);
    await loadFromStorage();
  }

  async function deleteConnection(id: string): Promise<void> {
    await window.dbApi.deleteConnection(id);
    await loadFromStorage();

    delete tablesCache[id];
    delete schemaCache[id];
    delete databasesCache[id];
    delete databasesError[id];

    saveCache(); // Update persistence

    activeConnectionIds.value.delete(id);
    if (activeId.value === id) activeId.value = null;
  }

  function isConnected(id: string): boolean {
    return activeConnectionIds.value.has(id);
  }

  const pendingConnections = new Map<string, Promise<void>>();

  async function ensureConnection(targetId: string | null): Promise<void> {
    if (targetId === null) return;
    if (activeConnectionIds.value.has(targetId)) return;
    if (pendingConnections.has(targetId)) return pendingConnections.get(targetId);

    const connectPromise = (async () => {
      try {
        loading.value = true;
        error.value = null;
        await window.dbApi.connect(targetId);
        activeConnectionIds.value.add(targetId);
        
        // Background load schema if needed
        loadSchema(targetId); 
      } catch (e) {
        activeConnectionIds.value.delete(targetId);
        if (e instanceof Error) throw e;
        throw new Error(String(e));
      } finally {
        loading.value = false;
        pendingConnections.delete(targetId);
      }
    })();

    pendingConnections.set(targetId, connectPromise);
    return connectPromise;
  }

  // SWR: Load Tables
  async function loadTables(id: string, dbName?: string, force = false): Promise<void> {
    const cacheKey = dbName ? `${id}-${dbName}` : id;
    
    // SWR Check
    if (!force && tablesCache[cacheKey]?.length) {
      if (!fetchingTables.has(cacheKey)) {
        loadTables(id, dbName, true).catch(console.error);
      }
      return;
    }

    if (fetchingTables.has(cacheKey) && !force) return;

    try {
      fetchingTables.add(cacheKey);
      await ensureConnection(id);
      const tables = await window.dbApi.getTables(id, dbName);
      
      // Update cache only if changed (optional optimization, but Vue reactive handles equality checks relatively well)
      tablesCache[cacheKey] = tables.sort();
      saveCache();
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        error.value = 'Ошибка загрузки таблиц: ' + e.message;
      }
    } finally {
      fetchingTables.delete(cacheKey);
    }
  }

  // SWR: Load Schema
  async function loadSchema(id: string, dbName?: string, force = false): Promise<void> {
    const key = dbName ? `${id}-${dbName}` : id;
    
    // SWR Check
    if (!force && schemaCache[key] && Object.keys(schemaCache[key]).length > 0) {
      if (!fetchingSchemas.has(key)) {
        loadSchema(id, dbName, true).catch(console.error);
      }
      return;
    }

    if (fetchingSchemas.has(key) && !force) return;

    try {
      fetchingSchemas.add(key);
      await ensureConnection(id);
      const schema = await window.dbApi.getSchema(id, dbName);
      schemaCache[key] = schema;
      saveCache();

      console.log(
        `Schema loaded (BG) for ${id} (db: ${dbName || 'default'}):`,
        Object.keys(schema).length,
        'tables',
      );
    } catch (e) {
      console.error('Failed to load schema', e);
    } finally {
      fetchingSchemas.delete(key);
    }
  }

  async function disconnect(id: string): Promise<void> {
    try {
      await window.dbApi.disconnect(id);
    } catch (e) {
      console.error('Disconnect failed', e);
    } finally {
      activeConnectionIds.value.delete(id);
      const tabStore = (await import('./tabs')).useTabStore();
      tabStore.resetConnectionState(id);
    }
  }

  async function updateConnection(conn: DbConnection): Promise<void> {
    const id = conn.id;
    const wasActive = activeConnectionIds.value.has(id);

    await window.dbApi.saveConnection(conn);
    await loadFromStorage();

    // Clear caches for this connection
    delete databasesCache[id];
    delete databasesError[id];
    delete schemaCache[id];
    Object.keys(tablesCache).forEach((key) => {
      if (key === id || key.startsWith(`${id}-`)) {
        delete tablesCache[key];
      }
    });
    saveCache();

    activeConnectionIds.value.delete(id);

    if (wasActive) {
      try {
        await ensureConnection(id);
        await loadDatabases(id, true);
      } catch (e) {
        console.error('Failed to reconnect after update:', e);
      }
    }
  }

  // SWR: Load Databases
  async function loadDatabases(id: string, force = false): Promise<void> {
    // SWR Check
    if (!force && databasesCache[id]?.length) {
      if (!fetchingDatabases.has(id)) {
        loadDatabases(id, true).catch(console.error);
      }
      return;
    }

    if (fetchingDatabases.has(id) && !force) return;

    databasesError[id] = null;

    try {
      fetchingDatabases.add(id);
      const conn = savedConnections.value.find((c) => c.id === id);
      if (!conn) return;

      await ensureConnection(id);
      const dbs = await window.dbApi.getDatabases(id, conn.excludeList);
      databasesCache[id] = dbs;
      saveCache();
    } catch (e) {
      console.error('Failed to load databases', e);
      databasesError[id] = e instanceof Error ? e.message : String(e);
    } finally {
      fetchingDatabases.delete(id);
    }
  }

  // --- INITIALIZATION ---
  loadFromStorage();

  return {
    savedConnections,
    activeId,
    activeConnectionIds,
    isConnected,
    tablesCache,
    schemaCache,
    loading,
    error,
    loadFromStorage,
    addConnection,
    deleteConnection,
    ensureConnection,
    loadTables,
    loadSchema,
    updateConnection,
    databasesCache,
    databasesError,
    loadDatabases,
    disconnect,
  };
});
