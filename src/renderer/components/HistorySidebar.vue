<template>
  <div class="history-sidebar">
    <div class="header">
      <span class="title">{{ $t('history.title') }}</span>
      <BaseButton
        variant="ghost"
        :icon-only="true"
        :title="$t('history.clear')"
        class="clear-btn"
        @click="historyStore.clearHistory"
      >
        <BaseIcon name="trash" />
      </BaseButton>
    </div>

    <div class="list">
      <div
        v-for="item in historyStore.items"
        :key="item.id"
        class="history-item"
        @click="restoreQuery(item)"
      >
        <div class="item-header">
          <div class="left-meta">
            <span class="status-dot" :class="item.status"></span>
            <span class="time">{{ formatTime(item.timestamp) }}</span>
          </div>

          <span v-if="item.duration > 0" class="duration"> {{ item.duration }}ms </span>
        </div>

        <div class="sql-preview">
          {{ item.sql }}
        </div>
      </div>

      <div v-if="historyStore.items.length === 0" class="empty-state">
        {{ $t('history.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHistoryStore } from '../stores/history'
import { useTabStore } from '../stores/tabs'
import BaseIcon from './ui/BaseIcon.vue'
import BaseButton from './ui/BaseButton.vue'

const historyStore = useHistoryStore()
const tabStore = useTabStore()

function formatTime(ts: number): string {
  // Показываем время чуть короче, без секунд, если места мало, или полностью
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function restoreQuery(item: { sql: string; connectionId: number | null }): void {
  const current = tabStore.currentTab

  // 1. Проверяем, можно ли использовать текущий таб
  // Он должен быть типа 'query', иметь то же подключение, и быть (желательно) пустым или немодифицированным
  // Для упрощения: если SQL в табе пустой или дефолтный 'SELECT 1;', то перезаписываем.
  // Иначе — открываем новый.
  if (current && current.type === 'query' && current.connectionId === item.connectionId) {
    // 1a. Если в текущем табе УЖЕ этот запрос — ничего не делаем (мы уже здесь)
    if (current.sql === item.sql) return

    // 1b. Если таб пустой — используем его
    const isCurrentEmpty =
      !current.sql || current.sql.trim() === '' || current.sql.trim() === 'SELECT 1;'

    if (isCurrentEmpty) {
      current.sql = item.sql
      return
    }
  }

  // 2. Иначе открываем новый таб
  tabStore.addTab(item.connectionId)

  setTimeout(() => {
    if (tabStore.currentTab && tabStore.currentTab.type === 'query') {
      tabStore.currentTab.sql = item.sql
    }
  }, 0)
}
</script>

<style scoped>
.history-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-sidebar);
  color: var(--text-primary);
  border-right: 1px solid var(--border-color); /* Разделитель с контентом */
}

.header {
  height: var(--header-height);
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.clear-btn {
  /* Only overrides if needed, otherwise rely on BaseButton variants */
  color: var(--text-secondary);
}
.clear-btn:hover {
  color: #f48771 !important; /* Force red on hover */
  background: transparent !important;
}

.list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.history-item {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: var(--list-hover-bg);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Разносит время влево, а длительность вправо */
  margin-bottom: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.left-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.success {
  background: #89d185;
}
.status-dot.error {
  background: #f48771;
}

.duration {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-primary);
  opacity: 0.7;
  white-space: nowrap; /* Чтобы ms не переносилось */
}

/* --- СТИЛИ ДЛЯ SQL ПРЕВЬЮ --- */
.sql-preview {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  opacity: 0.9;
  line-height: 1.4;

  /* Магия ограничения строк (Line Clamping) */
  display: -webkit-box;
  -webkit-line-clamp: 4; /* Максимум 4 строки */
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;

  /* Переносы длинных слов */
  word-break: break-all;
  white-space: pre-wrap; /* Сохраняет пробелы и переносы, если они есть */
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 20px;
}
</style>
