import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryItem } from '../../shared/types'

export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryItem[]>([])
  let initialized = false

  async function loadFromStorage(): Promise<void> {
    if (initialized) return
    try {
      items.value = await window.dbApi.getHistory()
      initialized = true
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }

  async function save(): Promise<void> {
    try {
      await window.dbApi.saveHistory(items.value)
    } catch (e) {
      console.error('Failed to save history', e)
    }
  }

  function addEntry(
    sql: string,
    status: 'success' | 'error',
    duration: number,
    connectionId: string | null
  ): void {
    if (!sql || sql.trim().length < 2) return

    if (items.value.length > 0 && items.value[0].sql === sql) {
      items.value[0].timestamp = Date.now()
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

    items.value.unshift(newItem)

    if (items.value.length > 100) {
      items.value = items.value.slice(0, 100)
    }

    save()
  }

  async function clearHistory(): Promise<void> {
    items.value = []
    await save()
  }

  return {
    items,
    addEntry,
    clearHistory,
    loadFromStorage
  }
})
