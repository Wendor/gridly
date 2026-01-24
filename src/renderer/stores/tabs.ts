import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useConnectionStore } from './connections'
import { useHistoryStore } from './history'
import i18n from '../i18n'

export interface BaseTab {
  id: number
  name: string
}

export interface QueryTab extends BaseTab {
  type: 'query'
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

export interface SettingsTab extends BaseTab {
  type: 'settings'
}

export interface DocumentTab extends BaseTab {
  type: 'document'
  content: string
}

export type Tab = QueryTab | SettingsTab | DocumentTab

export const useTabStore = defineStore('tabs', () => {
  const connectionStore = useConnectionStore()
  const historyStore = useHistoryStore()

  const tabs = ref<Tab[]>([])
  const activeTabId = ref(1)
  const nextTabId = ref(1)

  const activeDatabaseCache = ref<Map<number, string | null>>(new Map())

  const currentTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value))

  function addTab(initialConnId: number | null = null): void {
    const id = nextTabId.value++
    let connId = initialConnId

    if (connId === null) {
      if (currentTab.value?.type === 'query') {
        connId = currentTab.value.connectionId
      } else {
        connId = connectionStore.savedConnections.length ? 0 : null
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
      (t): t is QueryTab =>
        t.type === 'query' && t.connectionId === connectionId && t.name === tableName
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
      name: i18n.global.t('common.settings')
    })
    activeTabId.value = id
  }

  function openDocumentTab(title: string, content: string): void {
    const existing = tabs.value.find((t) => t.type === 'document' && t.name === title)
    if (existing) {
      activeTabId.value = existing.id
      return
    }

    const id = nextTabId.value++
    tabs.value.push({
      id,
      type: 'document',
      name: title,
      content
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
    if (!currentTab.value || currentTab.value.type !== 'query') return
    currentTab.value.pagination.offset += currentTab.value.pagination.limit
    runQuery()
  }

  function prevPage(): void {
    if (!currentTab.value || currentTab.value.type !== 'query') return
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
        if (currentTab.value && currentTab.value.type === 'query') {
          historyStore.addEntry(currentTab.value.sql, 'error', 0, connId)
        }
      }
    } finally {
      connectionStore.loading = false
    }
  }

  // --- PERSISTENCE LOGIC ---
  function saveToStorage(): void {
    // Only save what is necessary to restore
    const dataToSave = tabs.value.map((t) => {
      if (t.type === 'query') {
        return {
          id: t.id,
          type: 'query',
          name: t.name,
          connectionId: t.connectionId,
          database: t.database,
          sql: t.sql,
          meta: null,
          pagination: t.pagination
        }
      } else if (t.type === 'document') {
        // Document contents might be large if we allow custom docs,
        // but for instructions it's fine.
        return {
          id: t.id,
          type: 'document',
          name: t.name,
          content: t.content
        }
      }
      return {
        id: t.id,
        type: t.type,
        name: t.name
      }
    })

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
        // Need to reconstruct state correctly from parsed execution
        // We can't strict type check too easy here, so we cast
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tabs.value = parsed.map((t: any) => {
          if (t.type === 'query') {
            return {
              ...t,
              rows: [],
              colDefs: [],
              meta: null
            }
          }
          return t
        })
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
    if (connectionStore.savedConnections.length === 0) {
      openDocumentTab(
        i18n.global.t('common.instructions'),
        `# ${i18n.global.t('common.instructions')}\n\n${i18n.global.t('common.instructionsText')}`
      )
    } else {
      addTab()
    }
  }

  return {
    tabs,
    activeTabId,
    currentTab,
    addTab,
    openTableTab,
    openSettingsTab,
    openDocumentTab,
    closeTab,
    runQuery,
    nextPage,
    prevPage
  }
})
