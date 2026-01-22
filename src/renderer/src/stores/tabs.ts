import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConnectionStore } from './connections'
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
  // Состояние пагинации для каждой вкладки
  pagination: {
    limit: number
    offset: number
    total: number | null // Общее количество строк в таблице
  }
}

export const useTabStore = defineStore('tabs', () => {
  const connectionStore = useConnectionStore()

  // Начальное состояние
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

  // --- ACTIONS ---

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
    // 1. Проверяем, открыта ли уже эта таблица
    const existingTab = tabs.value.find(
      (t) => t.type === 'query' && t.connectionId === connectionId && t.name === tableName
    )

    if (existingTab) {
      activeTabId.value = existingTab.id
      return
    }

    // 2. Если нет — создаем новую
    const id = nextTabId.value++

    tabs.value.push({
      id,
      type: 'query',
      name: tableName,
      connectionId,
      // Чистый SQL без LIMIT (LIMIT добавится автоматически при запуске)
      sql: `SELECT * FROM ${tableName}`,
      rows: [],
      colDefs: [],
      meta: null,
      pagination: { limit: 100, offset: 0, total: null }
    })

    activeTabId.value = id
    // Сразу запускаем
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

  // --- PAGINATION ACTIONS ---

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

  // --- CORE LOGIC ---

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

      // 1. Пытаемся определить имя таблицы для подсчета Total
      // Ищем паттерн: FROM "tableName" или FROM tableName
      const tableMatch = finalSql.match(/FROM\s+([`'"]?[\w.]+[`'"]?)/i)
      const tableName = tableMatch ? tableMatch[1] : null

      // Простая проверка, что это SELECT * (чтобы не ломать сложные JOIN/GROUP BY подсчетом)
      const isSimpleSelect =
        /^SELECT\s+\*\s+FROM/i.test(finalSql) && !/WHERE|JOIN|GROUP/i.test(finalSql)

      // 2. Обработка LIMIT / OFFSET
      // Проверяем, написал ли пользователь LIMIT вручную
      const hasLimit = /LIMIT\s+\d+/i.test(finalSql)

      if (!hasLimit) {
        // Если нет, убираем ; в конце и добавляем нашу пагинацию
        finalSql = finalSql.replace(/;$/, '')
        finalSql += ` LIMIT ${currentTab.value.pagination.limit} OFFSET ${currentTab.value.pagination.offset}`
      } else {
        // Если пользователь сам написал LIMIT, сбрасываем нашу пагинацию, чтобы не путать UI
        // (Опционально, можно парсить его лимит, но пока просто не вмешиваемся)
      }

      // 3. Выполняем основной запрос
      const res = await window.dbApi.query(finalSql)

      if (res.error) {
        connectionStore.error = res.error
      } else {
        // Генерация колонок для Ag-Grid
        currentTab.value.colDefs = res.columns.map((col: string) => ({
          field: col,
          // Форматтер для отображения (NULL)
          valueFormatter: (params: ValueFormatterParams): string =>
            params.value === null ? '(NULL)' : String(params.value),
          // CSS класс для серых NULL
          cellClassRules: {
            'null-cell': (params: CellClassParams): boolean => params.value === null
          }
        }))

        currentTab.value.rows = res.rows
        currentTab.value.meta = { duration: res.duration }

        // 4. Подсчет общего количества строк (Total Count)
        // Запускаем только если:
        // - Нашли имя таблицы
        // - Это простой запрос
        // - Либо мы еще не знаем total, либо мы на первой странице (могли добавиться данные)
        if (
          tableName &&
          isSimpleSelect &&
          (currentTab.value.pagination.total === null || currentTab.value.pagination.offset === 0)
        ) {
          try {
            // COUNT(*) работает быстро на большинстве БД
            const countSql = `SELECT COUNT(*) as total FROM ${tableName}`
            const countRes = await window.dbApi.query(countSql)

            if (countRes.rows.length > 0) {
              // Postgres возвращает string "500", MySQL number 500. Приводим к Number safely.
              const firstRow = countRes.rows[0]
              const countVal = Object.values(firstRow)[0]
              currentTab.value.pagination.total = Number(countVal)
            }
          } catch (e) {
            console.error('Failed to count rows, ignoring', e)
          }
        }
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
    runQuery,
    nextPage,
    prevPage
  }
})
