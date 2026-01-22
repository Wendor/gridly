import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

// 1. Описываем интерфейс подключения (вместо any)
export interface DbConnection {
  type: 'mysql' | 'postgres'
  name: string
  host: string
  port: string
  user: string
  password?: string
  database: string
  useSsh?: boolean
  sshHost?: string
  sshPort?: string
  sshUser?: string
  sshPassword?: string
  sshKeyPath?: string
}

export const useConnectionStore = defineStore('connections', () => {
  // State
  // Вместо any[] используем типизированный массив
  const savedConnections = ref<DbConnection[]>([])

  const activeId = ref<number | null>(null)
  const connectedId = ref<number | null>(null)
  const isConnected = ref(false)
  const tablesCache = reactive<Record<number, string[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions: Везде добавляем : void или : Promise<void>

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
    if (activeId.value === index) activeId.value = null
  }

  async function ensureConnection(targetId: number | null): Promise<void> {
    if (targetId === null) return
    if (connectedId.value === targetId && isConnected.value) return

    // Глубокое копирование, чтобы разорвать реактивность перед отправкой в Electron
    const config = JSON.parse(JSON.stringify(savedConnections.value[targetId]))

    try {
      loading.value = true
      error.value = null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).dbApi.connect(config)

      isConnected.value = true
      connectedId.value = targetId
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
    if (tablesCache[index]?.length) return

    try {
      await ensureConnection(index)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tables = await (window as any).dbApi.getTables()
      tablesCache[index] = tables
    } catch (e) {
      console.error(e)
      if (e instanceof Error) {
        error.value = 'Ошибка загрузки таблиц: ' + e.message
      }
    }
  }

  return {
    savedConnections,
    activeId,
    connectedId,
    isConnected,
    tablesCache,
    loading,
    error,
    loadFromStorage,
    saveToStorage,
    addConnection,
    deleteConnection,
    ensureConnection,
    loadTables
  }
})
