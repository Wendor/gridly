import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { DbConnection, DbSchema } from '../../../shared/types'

export const useConnectionStore = defineStore('connections', () => {
  // State
  const savedConnections = ref<DbConnection[]>([])

  const activeId = ref<number | null>(null)

  // ИЗМЕНЕНИЕ: Используем Set для хранения множества активных соединений
  const activeConnectionIds = ref<Set<number>>(new Set())

  // Кеш списка таблиц (для сайдбара)
  const tablesCache = reactive<Record<number, string[]>>({})

  // Кеш схемы для автокомплита (Таблица -> Колонки)
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

  async function loadTables(index: number): Promise<void> {
    // Если кеш есть, не грузим
    if (tablesCache[index]?.length) return

    try {
      await ensureConnection(index)
      // ИЗМЕНЕНИЕ: Передаем index
      const tables = await window.dbApi.getTables(index)
      tablesCache[index] = tables
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

      // При обновлении настроек сбрасываем состояние подключения
      if (activeConnectionIds.value.has(index)) {
        activeConnectionIds.value.delete(index)
        delete tablesCache[index]
        delete schemaCache[index]
      }
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
    updateConnection
  }
})
