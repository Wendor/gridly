import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConnectionStore } from './connections'
// Импортируем типы Ag-Grid, чтобы убрать any
import type { ValueFormatterParams, CellClassParams } from 'ag-grid-community'

export interface Tab {
  id: number
  type: 'query' | 'settings'
  name: string
  connectionId: number | null
  sql: string
  rows: Record<string, unknown>[]
  colDefs: { field: string }[]
  meta: { duration: number } | null
}

export const useTabStore = defineStore('tabs', () => {
  const connectionStore = useConnectionStore()

  const tabs = ref<Tab[]>([
    {
      id: 1,
      type: 'query',
      name: 'Query 1',
      connectionId: null,
      sql: 'SELECT 1;',
      rows: [],
      colDefs: [],
      meta: null
    }
  ])
  const activeTabId = ref(1)
  const nextTabId = ref(2)

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
      name: `Query ${id}`,
      connectionId: connId,
      sql: '',
      rows: [],
      colDefs: [],
      meta: null
    })
    activeTabId.value = id
  }

  function openTableTab(connectionId: number, tableName: string): void {
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
      sql: `SELECT * FROM ${tableName} LIMIT 100;`,
      rows: [],
      colDefs: [],
      meta: null
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
      name: 'Settings',
      connectionId: null,
      sql: '',
      rows: [],
      colDefs: [],
      meta: null
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

  async function runQuery(): Promise<void> {
    if (
      !currentTab.value ||
      currentTab.value.type !== 'query' ||
      currentTab.value.connectionId === null
    )
      return

    try {
      connectionStore.loading = true
      connectionStore.error = null

      await connectionStore.ensureConnection(currentTab.value.connectionId)

      // Используем типизацию через приведение
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (window as any).dbApi.query(currentTab.value.sql)

      if (res.error) {
        connectionStore.error = res.error
      } else {
        // ТИПИЗИРОВАННАЯ ГЕНЕРАЦИЯ КОЛОНОК
        currentTab.value.colDefs = res.columns.map((col: string) => ({
          field: col,
          valueFormatter: (params: ValueFormatterParams) =>
            params.value === null ? '(NULL)' : params.value,
          cellClassRules: {
            'null-cell': (params: CellClassParams) => params.value === null
          }
        }))

        currentTab.value.rows = res.rows
        currentTab.value.meta = { duration: res.duration }
      }
    } catch (e) {
      if (e instanceof Error) {
        connectionStore.error = e.message
      }
    } finally {
      connectionStore.loading = false
    }
  }

  return {
    tabs,
    activeTabId,
    currentTab,
    addTab,
    openTableTab,
    openSettingsTab,
    closeTab,
    runQuery
  }
})
