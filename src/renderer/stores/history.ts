import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface HistoryItem {
  id: string
  sql: string
  connectionId: string | null // string ID
  timestamp: number
  status: 'success' | 'error'
  duration: number
}

export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryItem[]>([])

  // Загрузка из LocalStorage при старте
  const saved = localStorage.getItem('query-history')
  if (saved) {
    try {
      items.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }

  function addEntry(
    sql: string,
    status: 'success' | 'error',
    duration: number,
    connectionId: string | null
  ): void {
    // Не сохраняем пустые или слишком короткие запросы
    if (!sql || sql.trim().length < 2) return

    // Не сохраняем дубликаты подряд (если 10 раз нажали Run)
    if (items.value.length > 0 && items.value[0].sql === sql) {
      // Можно просто обновить время последнего
      items.value[0].timestamp = Date.now()
      // Update connection ID if it changed for the same query (unlikely but possible)
      items.value[0].connectionId = connectionId
      save()
      return
    }

    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      sql,
      connectionId,
      timestamp: Date.now(),
      status,
      duration
    }

    // Добавляем в начало
    items.value.unshift(newItem)

    // Ограничиваем историю (например, 100 записей)
    if (items.value.length > 100) {
      items.value = items.value.slice(0, 100)
    }

    save()
  }

  function clearHistory(): void {
    items.value = []
    save()
  }

  function save(): void {
    localStorage.setItem('query-history', JSON.stringify(items.value))
  }

  return {
    items,
    addEntry,
    clearHistory
  }
})
