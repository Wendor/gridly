import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { DbConnection, DbConnectionMeta, DbSchema } from '../../shared/types'

export const useConnectionStore = defineStore('connections', () => {
  const savedConnections = ref<DbConnectionMeta[]>([])

  const activeId = ref<string | null>(null)

  // ИЗМЕНЕНИЕ: Используем Set для хранения множества активных соединений
  const activeConnectionIds = ref<Set<string>>(new Set())

  // Кеш списка таблиц (для сайдбара)
  const tablesCache = reactive<Record<string, string[]>>({})

  // Кеш схемы для автокомплита (Таблица -> Колонки)
  const schemaCache = reactive<Record<string, DbSchema>>({})

  const databasesCache = reactive<Record<string, string[]>>({})
  const databasesError = reactive<Record<string, string | null>>({})

  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions

  async function loadFromStorage(): Promise<void> {
    try {
      loading.value = true
      savedConnections.value = await window.dbApi.getConnections()
    } catch (e) {
      console.error('Failed to load connections', e)
    } finally {
      loading.value = false
    }
  }

  async function addConnection(conn: DbConnection): Promise<void> {
    // Generate ID if missing (should be handled by creator, but just in case)
    if (!conn.id) {
      conn.id = crypto.randomUUID()
    }
    await window.dbApi.saveConnection(conn)
    await loadFromStorage()
  }

  async function deleteConnection(id: string): Promise<void> {
    await window.dbApi.deleteConnection(id)
    await loadFromStorage()

    delete tablesCache[id]
    delete schemaCache[id]
    delete databasesCache[id]
    delete databasesError[id]

    activeConnectionIds.value.delete(id)
    if (activeId.value === id) activeId.value = null
  }

  // Проверка активности конкретного соединения
  function isConnected(id: string): boolean {
    return activeConnectionIds.value.has(id)
  }

  // Храним промисы активных подключений, чтобы не делать двойные запросы
  const pendingConnections = new Map<string, Promise<void>>()

  async function ensureConnection(targetId: string | null): Promise<void> {
    if (targetId === null) return

    // Если уже подключено, выходим
    if (activeConnectionIds.value.has(targetId)) return

    // Если уже идет процесс подключения, возвращаем его промис
    if (pendingConnections.has(targetId)) {
      return pendingConnections.get(targetId)
    }

    const connectPromise = (async () => {
      try {
        loading.value = true
        error.value = null

        await window.dbApi.connect(targetId)

        activeConnectionIds.value.add(targetId)
        loadSchema(targetId)
      } catch (e) {
        activeConnectionIds.value.delete(targetId)
        if (e instanceof Error) throw e
        throw new Error(String(e))
      } finally {
        loading.value = false
        pendingConnections.delete(targetId)
      }
    })()

    pendingConnections.set(targetId, connectPromise)
    return connectPromise
  }

  async function loadTables(id: string, dbName?: string): Promise<void> {
    const cacheKey = dbName ? `${id}-${dbName}` : id
    if (tablesCache[cacheKey]?.length) return

    try {
      await ensureConnection(id)
      const tables = await window.dbApi.getTables(id, dbName)
      tablesCache[cacheKey] = tables.sort()
    } catch (e) {
      console.error(e)
      if (e instanceof Error) {
        error.value = 'Ошибка загрузки таблиц: ' + e.message
      }
    }
  }

  async function loadSchema(id: string, dbName?: string, force = false): Promise<void> {
    const key = dbName ? `${id}-${dbName}` : id
    // Если схема уже в кеше и не force, выходим
    if (!force && schemaCache[key] && Object.keys(schemaCache[key]).length > 0) return

    try {
      await ensureConnection(id)
      const schema = await window.dbApi.getSchema(id, dbName)
      schemaCache[key] = schema

      console.log(
        `Schema loaded for connection ${id} (db: ${dbName || 'default'}):`,
        Object.keys(schema).length,
        'tables'
      )
    } catch (e) {
      console.error('Failed to load schema', e)
    }
  }

  async function disconnect(id: string): Promise<void> {
    try {
      await window.dbApi.disconnect(id)
    } catch (e) {
      console.error('Disconnect failed', e)
    } finally {
      activeConnectionIds.value.delete(id)

      // Reset tab store state for this connection (active database)
      const tabStore = (await import('./tabs')).useTabStore()
      tabStore.resetConnectionState(id)
    }
  }

  async function updateConnection(conn: DbConnection): Promise<void> {
    const id = conn.id
    const wasActive = activeConnectionIds.value.has(id)

    await window.dbApi.saveConnection(conn)
    await loadFromStorage()

    delete databasesCache[id]
    delete databasesError[id]
    delete schemaCache[id]

    Object.keys(tablesCache).forEach((key) => {
      if (key === id || key.startsWith(`${id}-`)) {
        delete tablesCache[key]
      }
    })

    activeConnectionIds.value.delete(id)

    if (wasActive) {
      try {
        await ensureConnection(id)
        await loadDatabases(id, true)
      } catch (e) {
        console.error('Failed to reconnect after update:', e)
      }
    }
  }

  async function loadDatabases(id: string, force = false): Promise<void> {
    if (!force && databasesCache[id]?.length) return

    // Сбрасываем ошибку перед новой попыткой
    databasesError[id] = null

    try {
      // Find connection to get excludeList? No, dbApi handles it inside via StorageService?
      // Wait, getDatabases in backend uses `StorageService.getConnectionById`?
      // No, currently `getDatabases` takes `excludeList` as argument in IpcHandlers.
      // But `DatabaseManager` shouldn't depend on frontend passing it if we want to secure it?
      // Actually `excludeList` is not sensitive.
      // But we need to pass it.

      const conn = savedConnections.value.find((c) => c.id === id)
      if (!conn) return

      await ensureConnection(id)
      const dbs = await window.dbApi.getDatabases(id, conn.excludeList)
      databasesCache[id] = dbs
    } catch (e) {
      console.error('Failed to load databases', e)
      databasesError[id] = e instanceof Error ? e.message : String(e)
    }
  }

  // --- INITIALIZATION ---
  loadFromStorage()

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
    disconnect
  }
})
