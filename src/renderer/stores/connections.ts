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

  async function ensureConnection(targetId: number | null): Promise<void> {
    if (targetId === null) return

    // ИЗМЕНЕНИЕ: Проверяем наличие в Set, а не сравниваем с одним числом
    if (activeConnectionIds.value.has(targetId)) return

    // Глубокое копирование, чтобы разорвать реактивность перед отправкой в Electron
    const config = JSON.parse(JSON.stringify(savedConnections.value[targetId]))

    try {
      loading.value = true
      error.value = null

      // ИЗМЕНЕНИЕ: Передаем targetId первым аргументом
      await window.dbApi.connect(targetId, config)

      // Добавляем в список активных
      activeConnectionIds.value.add(targetId)

      // При успешном подключении можно сразу подгрузить схему в фоне
      loadSchema(targetId)
    } catch (e) {
      // Если ошибка, убираем из активных
      activeConnectionIds.value.delete(targetId)
      if (e instanceof Error) throw e
      throw new Error(String(e))
    } finally {
      loading.value = false
    }
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

  async function loadSchema(index: number): Promise<void> {
    // Если схема уже в кеше, выходим
    if (schemaCache[index] && Object.keys(schemaCache[index]).length > 0) return

    try {
      await ensureConnection(index)
      // ИЗМЕНЕНИЕ: Передаем index
      const schema = await window.dbApi.getSchema(index)
      schemaCache[index] = schema

      console.log(`Schema loaded for connection ${index}:`, Object.keys(schema).length, 'tables')
    } catch (e) {
      console.error('Failed to load schema', e)
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
    loadDatabases
  }
})
