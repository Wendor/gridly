import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useConnectionStore } from './connections'
import { useHistoryStore } from './history'
import i18n from '../i18n'

export interface Tab {
  id: number
  type: 'query' | 'settings'
  name: string
  connectionId: number | null
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
}

export const useTabStore = defineStore('tabs', () => {
  const connectionStore = useConnectionStore()
  const historyStore = useHistoryStore()

  const tabs = ref<Tab[]>([
    {
      id: 1,
      type: 'query',
      name: `${i18n.global.t('common.query')} 1`,
      connectionId: null,
      database: null,
      sql: 'SELECT 1;',
      rows: [],
      colDefs: [],
      meta: null,
      pagination: { limit: 100, offset: 0, total: null }
    }
  ])

  const activeTabId = ref(1)
  const nextTabId = ref(2)

  const activeDatabaseCache = ref<Map<number, string | null>>(new Map())

  const currentTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value))

  function addTab(initialConnId: number | null = null): void {
    const id = nextTabId.value++
    let connId = initialConnId

    if (connId === null) {
      connId =
        currentTab.value?.connectionId ?? (connectionStore.savedConnections.length ? 0 : null)
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
      pagination: { limit: 100, offset: 0, total: null }
    })
    activeTabId.value = id
  }

  async function openTableTab(
    connectionId: number,
    tableName: string,
    database?: string
  ): Promise<void> {
    const existingTab = tabs.value.find(
      (t) => t.type === 'query' && t.connectionId === connectionId && t.name === tableName
    )

    if (existingTab) {
      activeTabId.value = existingTab.id
      return
    }

    const id = nextTabId.value++

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
      pagination: { limit: 100, offset: 0, total: null }
    })

    activeTabId.value = id
    runQuery()
  }

  function openSettingsTab(): void {
    const existing = tabs.value.find((t) => t.type === 'settings')
    if (existing) {
      activeTabId.value = existing.id
      return
    }

    const id = nextTabId.value++
    tabs.value.push({
      id,
      type: 'settings',
      name: i18n.global.t('common.settings'),
      connectionId: null,
      database: null,
      sql: '',
      rows: [],
      colDefs: [],
      meta: null,
      pagination: { limit: 0, offset: 0, total: 0 }
    })
    activeTabId.value = id
  }

  function closeTab(id: number): void {
    if (tabs.value.length === 1) return
    const idx = tabs.value.findIndex((t) => t.id === id)
    tabs.value.splice(idx, 1)
    if (id === activeTabId.value) {
      activeTabId.value = tabs.value[Math.max(0, idx - 1)].id
    }
  }

  function nextPage(): void {
    if (!currentTab.value) return
    currentTab.value.pagination.offset += currentTab.value.pagination.limit
    runQuery()
  }

  function prevPage(): void {
    if (!currentTab.value) return
    if (currentTab.value.pagination.offset === 0) return

    currentTab.value.pagination.offset = Math.max(
      0,
      currentTab.value.pagination.offset - currentTab.value.pagination.limit
    )
    runQuery()
  }

  async function runQuery(): Promise<void> {
    if (
      !currentTab.value ||
      currentTab.value.type !== 'query' ||
      currentTab.value.connectionId === null
    )
      return

    const connId = currentTab.value.connectionId
    const dbName = currentTab.value.database

    try {
      connectionStore.loading = true
      connectionStore.error = null

      await connectionStore.ensureConnection(connId)

      if (dbName) {
        const lastSetDb = activeDatabaseCache.value.get(connId)
        if (lastSetDb !== dbName) {
          await window.dbApi.setActiveDatabase(connId, dbName)
          activeDatabaseCache.value.set(connId, dbName)
        }
      }

      let finalSql = currentTab.value.sql.trim()

      // Парсим имя таблицы для возможного COUNT(*)
      const tableMatch = finalSql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i)
      const tableName = tableMatch ? tableMatch[1] : null

      const isSimpleSelect =
        /^SELECT\s+\*\s+FROM/i.test(finalSql) && !/WHERE|JOIN|GROUP/i.test(finalSql)

      // Обработка LIMIT / OFFSET
      const isSelect = /^SELECT\s/i.test(finalSql)
      const hasLimit = /LIMIT\s+\d+/i.test(finalSql)

      if (isSelect && !hasLimit) {
        finalSql = finalSql.replace(/;$/, '')
        finalSql += ` LIMIT ${currentTab.value.pagination.limit} OFFSET ${currentTab.value.pagination.offset}`
      }

      // ИЗМЕНЕНИЕ: Передаем connId первым аргументом
      const res = await window.dbApi.query(connId, finalSql)

      if (res.error) {
        connectionStore.error = res.error
        historyStore.addEntry(currentTab.value.sql, 'error', 0, connId)
      } else {
        // Формируем колонки
        currentTab.value.colDefs = res.columns.map((col: string) => ({
          field: col,
          headerName: col
        }))

        currentTab.value.rows = res.rows
        currentTab.value.meta = { duration: res.duration }

        historyStore.addEntry(currentTab.value.sql, 'success', res.duration, connId)

        // --- ЛОГИКА ПОДСЧЕТА TOTAL ---

        if (tableName && isSimpleSelect) {
          if (
            currentTab.value.pagination.total === null ||
            currentTab.value.pagination.offset === 0
          ) {
            try {
              const countSql = `SELECT COUNT(*) as total FROM ${tableName}`
              // ИЗМЕНЕНИЕ: Передаем connId и сюда
              const countRes = await window.dbApi.query(connId, countSql)
              if (countRes.rows.length > 0) {
                const val = Object.values(countRes.rows[0])[0]
                currentTab.value.pagination.total = Number(val)
              }
            } catch (e) {
              console.error('Count failed', e)
            }
          }
        } else {
          if (res.rows.length < currentTab.value.pagination.limit) {
            currentTab.value.pagination.total = currentTab.value.pagination.offset + res.rows.length
          } else {
            currentTab.value.pagination.total = null
          }
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        connectionStore.error = e.message
        historyStore.addEntry(currentTab.value.sql, 'error', 0, connId)
      }
    } finally {
      connectionStore.loading = false
    }
  }

  // --- PERSISTENCE LOGIC ---
  function saveToStorage(): void {
    const dataToSave = tabs.value.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      connectionId: t.connectionId,
      database: t.database,
      sql: t.sql,
      meta: null,
      pagination: t.pagination
    }))
    localStorage.setItem('tabs-state', JSON.stringify(dataToSave))
    localStorage.setItem('active-tab-id', String(activeTabId.value))
    localStorage.setItem('next-tab-id', String(nextTabId.value))
  }

  function loadFromStorage(): void {
    const saved = localStorage.getItem('tabs-state')
    const savedActive = localStorage.getItem('active-tab-id')
    const savedNext = localStorage.getItem('next-tab-id')

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        tabs.value = parsed.map((t: Tab) => ({
          ...t,
          rows: [],
          colDefs: [],
          meta: null
        }))
      } catch (e) {
        console.error('Failed to load tabs', e)
      }
    }

    if (savedActive) activeTabId.value = parseInt(savedActive)
    if (savedNext) nextTabId.value = parseInt(savedNext)
  }

  watch(
    () => tabs.value,
    () => {
      saveToStorage()
    },
    { deep: true }
  )

  watch(activeTabId, () => {
    saveToStorage()
  })

  watch(
    currentTab,
    async (newTab) => {
      if (!newTab || newTab.type !== 'query' || newTab.connectionId === null) return
      if (!newTab.database) return

      const lastSetDb = activeDatabaseCache.value.get(newTab.connectionId)
      if (lastSetDb !== newTab.database) {
        try {
          await connectionStore.ensureConnection(newTab.connectionId)
          await window.dbApi.setActiveDatabase(newTab.connectionId, newTab.database)
          activeDatabaseCache.value.set(newTab.connectionId, newTab.database)
        } catch (e) {
          console.error('Failed to set active database on tab switch:', e)
        }
      }
    },
    { immediate: false }
  )

  loadFromStorage()
  if (tabs.value.length === 0) {
    addTab()
  }

  return {
    tabs,
    activeTabId,
    currentTab,
    addTab,
    openTableTab,
    openSettingsTab,
    closeTab,
    runQuery,
    nextPage,
    prevPage
  }
})
