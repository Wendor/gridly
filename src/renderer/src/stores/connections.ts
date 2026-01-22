import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { DbConnection, DbSchema } from '../../../shared/types'

export const useConnectionStore = defineStore('connections', () => {
  // State
  const savedConnections = ref<DbConnection[]>([])

  const activeId = ref<number | null>(null)
  const connectedId = ref<number | null>(null)
  const isConnected = ref(false)

  // Кеш списка таблиц (для сайдбара)
  const tablesCache = reactive<Record<number, string[]>>({})

  // НОВОЕ: Кеш схемы для автокомплита (Таблица -> Колонки)
  const schemaCache = reactive<Record<number, DbSchema>>({})

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
    // Чистим кеши при удалении
    delete tablesCache[index]
    delete schemaCache[index]

    if (activeId.value === index) activeId.value = null
    if (connectedId.value === index) {
      connectedId.value = null
      isConnected.value = false
    }
  }

  async function ensureConnection(targetId: number | null): Promise<void> {
    if (targetId === null) return
    // Если уже подключены к этой базе, не переподключаемся
    if (connectedId.value === targetId && isConnected.value) return

    // Глубокое копирование, чтобы разорвать реактивность перед отправкой в Electron
    const config = JSON.parse(JSON.stringify(savedConnections.value[targetId]))

    try {
      loading.value = true
      error.value = null

      // ИСПОЛЬЗУЕМ ТИПИЗИРОВАННЫЙ API (window.dbApi вместо any)
      await window.dbApi.connect(config)

      isConnected.value = true
      connectedId.value = targetId

      // При успешном подключении можно сразу подгрузить схему в фоне,
      // чтобы автокомплит заработал быстрее
      loadSchema(targetId)
    } catch (e) {
      isConnected.value = false
      connectedId.value = null
      if (e instanceof Error) throw e
      throw new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  async function loadTables(index: number): Promise<void> {
    // Если кеш есть, не грузим (можно добавить кнопку refresh позже)
    if (tablesCache[index]?.length) return

    try {
      await ensureConnection(index)
      const tables = await window.dbApi.getTables()
      tablesCache[index] = tables
    } catch (e) {
      console.error(e)
      if (e instanceof Error) {
        error.value = 'Ошибка загрузки таблиц: ' + e.message
      }
    }
  }

  // НОВЫЙ МЕТОД: Загрузка схемы для автокомплита
  async function loadSchema(index: number): Promise<void> {
    // Если схема уже в кеше, выходим
    if (schemaCache[index] && Object.keys(schemaCache[index]).length > 0) return

    try {
      // Убеждаемся, что подключение активно
      await ensureConnection(index)

      const schema = await window.dbApi.getSchema()
      schemaCache[index] = schema

      console.log(`Schema loaded for connection ${index}:`, Object.keys(schema).length, 'tables')
    } catch (e) {
      console.error('Failed to load schema', e)
      // Не блокируем UI ошибкой схемы, просто логируем
    }
  }

  function updateConnection(index: number, conn: DbConnection): void {
    if (savedConnections.value[index]) {
      savedConnections.value[index] = conn
      saveToStorage()

      // Если мы редактируем активное подключение, можно сбросить кеши
      if (activeId.value === index) {
        // Опционально: можно предложить переподключиться
      }
    }
  }

  return {
    savedConnections,
    activeId,
    connectedId,
    isConnected,
    tablesCache,
    schemaCache, // Экспортируем новый стейт
    loading,
    error,
    loadFromStorage,
    saveToStorage,
    addConnection,
    deleteConnection,
    ensureConnection,
    loadTables,
    loadSchema,
    updateConnection
  }
})
