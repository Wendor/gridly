import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useConnectionStore } from './connections'
import { useHistoryStore } from './history'
import type { ValueFormatterParams, CellClassParams } from 'ag-grid-community'

export interface Tab {
  id: number
  type: 'query' | 'settings'
  name: string
  connectionId: number | null
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
      name: 'Query 1',
      connectionId: null,
      sql: 'SELECT 1;',
      rows: [],
      colDefs: [],
      meta: null,
      pagination: { limit: 100, offset: 0, total: null }
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
      meta: null,
      pagination: { limit: 100, offset: 0, total: null }
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
      name: 'Settings',
      connectionId: null,
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

    try {
      connectionStore.loading = true
      connectionStore.error = null

      await connectionStore.ensureConnection(currentTab.value.connectionId)

      let finalSql = currentTab.value.sql.trim()

      // Парсим имя таблицы для возможного COUNT(*)
      const tableMatch = finalSql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i)
      const tableName = tableMatch ? tableMatch[1] : null

      // Проверяем, является ли запрос "простым" (без WHERE/JOIN), чтобы безопасно вызвать COUNT(*)
      const isSimpleSelect =
        /^SELECT\s+\*\s+FROM/i.test(finalSql) && !/WHERE|JOIN|GROUP/i.test(finalSql)

      // Обработка LIMIT / OFFSET
      // Добавляем пагинацию ТОЛЬКО для SELECT запросов,
      // исключая SHOW, DESCRIBE, EXPLAIN и сложные запросы, где LIMIT уже есть
      const isSelect = /^SELECT\s/i.test(finalSql)
      const hasLimit = /LIMIT\s+\d+/i.test(finalSql)

      if (isSelect && !hasLimit) {
        // Убираем точку с запятой в конце, если есть
        finalSql = finalSql.replace(/;$/, '')
        finalSql += ` LIMIT ${currentTab.value.pagination.limit} OFFSET ${currentTab.value.pagination.offset}`
      }

      const res = await window.dbApi.query(finalSql)

      if (res.error) {
        connectionStore.error = res.error
        historyStore.addEntry(currentTab.value.sql, 'error', 0, currentTab.value.connectionId)
      } else {
        // Формируем колонки
        currentTab.value.colDefs = res.columns.map((col: string) => ({
          field: col,
          headerName: col,
          // ОБНОВЛЕННЫЙ valueFormatter
          valueFormatter: (params: ValueFormatterParams): string => {
            const val = params.value

            if (val === null) return '(NULL)'

            // Проверяем, является ли это объектом (но не null)
            if (typeof val === 'object') {
              // 1. Проверка на "странный" объект-буфер {"0": 155, "1": 255...}
              // Если это не массив, но ключи - числа
              if (!Array.isArray(val)) {
                const keys = Object.keys(val)
                // Эвристика: если есть ключи и они все числа — считаем это бинарником
                if (keys.length > 0 && keys.every((k) => !isNaN(Number(k)))) {
                  return Object.values(val)
                    .map((b: unknown) => Number(b).toString(16).padStart(2, '0'))
                    .join('')
                }
              }

              // 2. Если это Node Buffer { type: 'Buffer', data: [...] }
              if (val.type === 'Buffer' && Array.isArray(val.data)) {
                return val.data.map((b: number) => b.toString(16).padStart(2, '0')).join('')
              }

              // 3. Если это обычный JSON-объект или массив — показываем как JSON строку
              return JSON.stringify(val)
            }

            // Все остальное (числа, строки, даты)
            return String(val)
          },
          cellClassRules: {
            'null-cell': (params: CellClassParams): boolean => params.value === null
          }
        }))

        currentTab.value.rows = res.rows
        currentTab.value.meta = { duration: res.duration }

        historyStore.addEntry(
          currentTab.value.sql,
          'success',
          res.duration,
          currentTab.value.connectionId
        )

        // --- ИСПРАВЛЕННАЯ ЛОГИКА ПОДСЧЕТА TOTAL ---

        if (tableName && isSimpleSelect) {
          // СЦЕНАРИЙ 1: Простой просмотр всей таблицы.
          // Делаем отдельный запрос COUNT(*), если total еще не известен или это первая страница
          if (
            currentTab.value.pagination.total === null ||
            currentTab.value.pagination.offset === 0
          ) {
            try {
              const countSql = `SELECT COUNT(*) as total FROM ${tableName}`
              const countRes = await window.dbApi.query(countSql)
              if (countRes.rows.length > 0) {
                const val = Object.values(countRes.rows[0])[0]
                currentTab.value.pagination.total = Number(val)
              }
            } catch (e) {
              console.error('Count failed', e)
            }
          }
        } else {
          // СЦЕНАРИЙ 2: Кастомный запрос (с WHERE, JOIN и т.д.)

          // Если мы получили меньше строк, чем запрашивали (лимит),
          // значит мы достигли конца выборки.
          if (res.rows.length < currentTab.value.pagination.limit) {
            // Точный total = текущее смещение + сколько реально пришло строк
            currentTab.value.pagination.total = currentTab.value.pagination.offset + res.rows.length
          } else {
            // Если пришла полная пачка (например, 100 из 100), мы не знаем, сколько там дальше.
            // Сбрасываем total в null, чтобы пагинатор не показывал неверное "of 58".
            // (В UI это будет выглядеть как "1-100" вместо "1-100 of ???")
            currentTab.value.pagination.total = null
          }
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        connectionStore.error = e.message
        historyStore.addEntry(currentTab.value.sql, 'error', 0, currentTab.value.connectionId)
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
      sql: t.sql,
      // Не сохраняем rows, colDefs и meta, чтобы не забивать localStorage
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
          rows: [], // Восстанавливаем пустыми
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

  // Автосохранение при изменениях
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

  // Инициализация
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
