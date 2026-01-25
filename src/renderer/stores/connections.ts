import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { DbConnection, DbSchema } from '../../shared/types'

export const useConnectionStore = defineStore('connections', () => {
  // State
  const savedConnections = ref<DbConnection[]>([])

  const activeId = ref<number | null>(null)

  // ИЗМЕНЕНИЕ: Используем Set для хранения множества активных соединений
  const activeConnectionIds = ref<Set<number>>(new Set())

  // Кеш списка таблиц (для сайдбара)
  const tablesCache = reactive<Record<string, string[]>>({})

  // Кеш схемы для автокомплита (Таблица -> Колонки)
  const schemaCache = reactive<Record<number, DbSchema>>({})

  const databasesCache = reactive<Record<number, string[]>>({})
  const databasesError = reactive<Record<number, string | null>>({})

  // ... (Rest of state)

  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions

  function loadFromStorage(): void {
    const data = localStorage.getItem('db-connections')
    if (data) savedConnections.value = JSON.parse(data)
  }

  function saveToStorage(): void {
    localStorage.setItem('db-connections', JSON.stringify(savedConnections.value))
  }

  function addConnection(conn: DbConnection): void {
    savedConnections.value.push(conn)
    saveToStorage()
  }

  function deleteConnection(index: number): void {
    savedConnections.value.splice(index, 1)
    saveToStorage()

    delete tablesCache[index]
    delete schemaCache[index]
    delete databasesCache[index]
    delete databasesError[index]

    activeConnectionIds.value.delete(index)
    if (activeId.value === index) activeId.value = null
  }
  // Проверка активности конкретного соединения
  function isConnected(index: number): boolean {
    return activeConnectionIds.value.has(index)
  }

  // Храним промисы активных подключений, чтобы не делать двойные запросы
  const pendingConnections = new Map<number, Promise<void>>()

  async function ensureConnection(targetId: number | null): Promise<void> {
    if (targetId === null) return

    // Если уже подключено, выходим
    if (activeConnectionIds.value.has(targetId)) return

    // Если уже идет процесс подключения, возвращаем его промис
    if (pendingConnections.has(targetId)) {
      return pendingConnections.get(targetId)
    }

    // Check if connection exists
    const conn = savedConnections.value[targetId]
    if (!conn) {
      throw new Error(`Connection with ID ${targetId} not found`)
    }

    // Глубокое копирование
    const config = JSON.parse(JSON.stringify(conn))

    const connectPromise = (async () => {
      try {
        loading.value = true
        error.value = null

        await window.dbApi.connect(targetId, config)

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

  async function loadTables(index: number, dbName?: string): Promise<void> {
    const cacheKey = dbName ? `${index}-${dbName}` : String(index)
    if (tablesCache[cacheKey]?.length) return

    try {
      await ensureConnection(index)
      const tables = await window.dbApi.getTables(index, dbName)
      tablesCache[cacheKey] = tables
    } catch (e) {
      console.error(e)
      if (e instanceof Error) {
        error.value = 'Ошибка загрузки таблиц: ' + e.message
      }
    }
  }

  async function loadSchema(index: number, dbName?: string, force = false): Promise<void> {
    // Если схема уже в кеше и не force, выходим
    // Note: If dbName changes, we probably should force reload or have separate cache key?
    // Current cache is just `schemaCache[index]`. It implies only ONE schema per connection.
    // So if dbName is provided, we should probably force update active schema.
    if (!force && !dbName && schemaCache[index] && Object.keys(schemaCache[index]).length > 0)
      return

    try {
      await ensureConnection(index)
      // ИЗМЕНЕНИЕ: Передаем index и dbName
      const schema = await window.dbApi.getSchema(index, dbName)
      schemaCache[index] = schema

      console.log(
        `Schema loaded for connection ${index} (db: ${dbName}):`,
        Object.keys(schema).length,
        'tables'
      )
    } catch (e) {
      console.error('Failed to load schema', e)
    }
  }

  async function disconnect(index: number): Promise<void> {
    try {
      await window.dbApi.disconnect(index)
    } catch (e) {
      console.error('Disconnect failed', e)
    } finally {
      activeConnectionIds.value.delete(index)

      // Reset tab store state for this connection (active database)
      const tabStore = (await import('./tabs')).useTabStore()
      tabStore.resetConnectionState(index)
    }
  }

  function updateConnection(index: number, conn: DbConnection): void {
    if (savedConnections.value[index]) {
      savedConnections.value[index] = conn
      saveToStorage()

      // Полная очистка кэша для этого соединения
      delete databasesCache[index]
      delete databasesError[index]
      delete schemaCache[index]

      // Удаляем все таблицы, связанные с этим индексом (например, "0-public", "0-db_name")
      Object.keys(tablesCache).forEach((key) => {
        if (key === String(index) || key.startsWith(`${index}-`)) {
          delete tablesCache[key]
        }
      })

      // Сбрасываем физическое соединение, так как настройки (host/port/user) могли измениться
      activeConnectionIds.value.delete(index)
    }
  }

  async function loadDatabases(index: number, force = false): Promise<void> {
    if (!force && databasesCache[index]?.length) return

    // Сбрасываем ошибку перед новой попыткой
    databasesError[index] = null

    try {
      const conn = savedConnections.value[index]
      if (!conn) return

      await ensureConnection(index)
      // Передаем excludeList в API
      const dbs = await window.dbApi.getDatabases(index, conn.excludeList)
      databasesCache[index] = dbs
    } catch (e) {
      console.error('Failed to load databases', e)
      databasesError[index] = e instanceof Error ? e.message : String(e)
      // Важно: если произошла ошибка, можно либо очистить кэш, либо оставить как есть
      // Но чтобы UI не весел, мы полагаемся на databasesError
    }
  }

  // --- INITIALIZATION ---
  loadFromStorage()

  return {
    savedConnections,
    activeId,
    activeConnectionIds, // Экспортируем Set вместо connectedId
    isConnected,
    tablesCache,
    schemaCache,
    loading,
    error,
    loadFromStorage,
    saveToStorage,
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
