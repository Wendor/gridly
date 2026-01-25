<template>
  <div class="editor-container">
    <div
      ref="editorRef"
      class="sql-editor"
      :style="{ fontSize: settingsStore.fontSize + 'px' }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, watchEffect } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands'
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  completeFromList
} from '@codemirror/autocomplete'
import { sql, MySQL, PostgreSQL } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

import { useTabStore } from '../stores/tabs'
import { useConnectionStore } from '../stores/connections'
import { useSettingsStore } from '../stores/settings'
import { DbSchema } from '../../shared/types'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: string): void; (e: 'run'): void }>()

const tabStore = useTabStore()
const connStore = useConnectionStore()
const settingsStore = useSettingsStore()
const editorRef = ref<HTMLElement | null>(null)
let view: EditorView | null = null
const languageConf = new Compartment()

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'INSERT',
  'UPDATE',
  'DELETE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'GROUP',
  'BY',
  'ORDER',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'AS',
  'ON',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'VALUES',
  'SET',
  'CREATE',
  'TABLE',
  'DROP',
  'ALTER',
  'distinct',
  'count',
  'max',
  'min',
  'avg',
  'sum'
].map((label) => ({ label, type: 'keyword', boost: 0 }))

const currentDialect = computed(() => {
  const tab = tabStore.currentTab
  if (tab?.type === 'query' && tab.connectionId !== null) {
    const connId = tab.connectionId
    if (connStore.savedConnections[connId]?.type === 'postgres') {
      return PostgreSQL
    }
  }
  return MySQL
})

const simpleSchema = computed(() => {
  const tab = tabStore.currentTab
  if (tab?.type === 'query' && tab.connectionId !== null) {
    const connId = tab.connectionId
    const dbName = tab.database
    const key = dbName ? `${connId}-${dbName}` : connId
    return JSON.parse(JSON.stringify(connStore.schemaCache[key] || {})) as DbSchema
  }
  return {}
})

// Helper computed to safely extract connection info
const activeQueryInfo = computed(() => {
  const tab = tabStore.currentTab
  // Check if tab exists and is of type 'query'
  if (tab && tab.type === 'query' && tab.connectionId) {
    return {
      connId: tab.connectionId,
      dbName: tab.database
    }
  }
  return null
})

// Ensure schema is loaded when tab changes or editor mounts
watch(
  activeQueryInfo,
  async (info) => {
    if (info) {
      await connStore.loadSchema(info.connId, info.dbName || undefined)
    }
  },
  { immediate: true }
)

// FIX 2: Расширяем возвращаемый тип (добавляем Promise)
function customCompletionSource(
  context: CompletionContext
): CompletionResult | null | Promise<CompletionResult | null> {
  const word = context.matchBefore(/[\w"']+/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  const dbSchema = simpleSchema.value
  const docText = context.state.doc.toString()

  const options: {
    label: string
    type?: string
    apply?: string
    detail?: string
    boost?: number
  }[] = [...SQL_KEYWORDS]

  const schemaKeys = Object.keys(dbSchema)
  schemaKeys.forEach((tableName) => {
    options.push({
      label: tableName,
      type: 'class',
      boost: 50
    })
  })

  // Improved regex to capture table names with or without quotes/backticks
  // Captures: FROM table | JOIN table
  // Group 1: The table name (possibly quoted)
  const tableMatches = [...docText.matchAll(/(?:FROM|JOIN)\s+([`"']?[\w.]+[`"']?)/gi)]

  tableMatches.forEach((match) => {
    let rawTableName = match[1]
    if (!rawTableName) return

    // Remove quotes/backticks if present
    rawTableName = rawTableName.replace(/^[`"']|[`"']$/g, '')

    // Case-insensitive lookup
    const foundKey = schemaKeys.find((k) => k.toLowerCase() === rawTableName.toLowerCase())

    if (foundKey) {
      const columns = dbSchema[foundKey]
      if (columns) {
        columns.forEach((col) => {
          const needsQuotes = currentDialect.value === PostgreSQL && /[A-Z]/.test(col)
          const insertText = needsQuotes ? `"${col}"` : col

          options.push({
            label: col,
            type: 'property',
            detail: foundKey, // Show which table this column belongs to
            apply: insertText,
            boost: 99
          })
        })
      }
    }
  })

  return completeFromList(options)(context)
}

const themeConf = new Compartment()

onMounted(() => {
  if (!editorRef.value) return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      autocompletion({
        override: [customCompletionSource]
      }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-Enter',
          run: () => {
            emit('run')
            return true
          }
        },
        {
          key: 'Tab',
          preventDefault: true,
          run: indentMore
        },
        {
          key: 'Shift-Tab',
          preventDefault: true,
          run: indentLess
        }
      ]),
      // Use Compartment for theme
      themeConf.of(settingsStore.activeTheme.type === 'dark' ? oneDark : []),

      syntaxHighlighting(defaultHighlightStyle),

      languageConf.of(sql({ dialect: currentDialect.value, schema: simpleSchema.value })),

      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      })
    ]
  })

  view = new EditorView({ state: startState, parent: editorRef.value })
})

watchEffect(() => {
  if (view) {
    view.dispatch({
      effects: [
        languageConf.reconfigure(
          sql({
            dialect: currentDialect.value,
            schema: simpleSchema.value
          })
        ),
        // Reconfigure theme based on settings
        themeConf.reconfigure(settingsStore.activeTheme.type === 'dark' ? oneDark : [])
      ]
    })
  }
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (view && newVal !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newVal } })
    }
  }
)

onBeforeUnmount(() => {
  if (view) view.destroy()
})
</script>

<style scoped>
.editor-container {
  height: 100%;
  width: 100%;
  position: relative;
  /* Скрываем всё, что вылезает за пределы контейнера компонента */
  overflow: hidden;
}

.sql-editor {
  height: 100%;
  width: 100%;
  font-size: 14px;
}

/* --- МАГИЯ CODEMIRROR --- */

/* 1. Заставляем сам редактор занимать всю высоту контейнера */
:deep(.cm-editor) {
  height: 100%;
}

/* 2. Включаем скролл внутри скроллера CodeMirror */
:deep(.cm-scroller) {
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace; /* Опционально: красивый шрифт */
}

/* 3. Опционально: Стилизуем полосу прокрутки - используем глобальные стили из main.css */
/* :deep(.cm-scroller)::-webkit-scrollbar styles removed to use global defaults */

/* Исправляем активную строку, чтобы она не перекрывала границы */
:deep(.cm-activeLine) {
  background-color: var(--list-hover-bg);
}

:deep(.cm-editor) {
  background-color: var(--bg-app) !important;
}

:deep(.cm-gutters) {
  background-color: var(--bg-app) !important;
  border-right: 1px solid var(--border-color) !important;
}
</style>

<style>
/* --- Стили для автокомплита CodeMirror (Global because tooltips are in body) --- */

/* Фон и границы списка */
.cm-tooltip-autocomplete {
  border: 1px solid var(--border-color) !important;
  background-color: var(--bg-sidebar) !important;
  border-radius: 4px !important;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3) !important;
}

/* Пункты списка */
.cm-tooltip-autocomplete > ul > li {
  padding: 4px 8px !important;
  font-family: var(--font-mono) !important;
  font-size: 12px !important;
}

/* Активный пункт */
.cm-tooltip-autocomplete > ul > li[aria-selected='true'] {
  background-color: var(--accent-primary) !important;
  color: #fff !important;
}

/* Иконки типов (t = table, key = keyword) */
.cm-completionIcon {
  margin-right: 8px !important;
}
</style>
