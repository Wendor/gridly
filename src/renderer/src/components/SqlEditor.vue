<template>
  <div class="editor-container">
    <div ref="editorRef" class="sql-editor"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, watchEffect } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
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
import { DbSchema } from '../../../shared/types'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: string): void; (e: 'run'): void }>()

const tabStore = useTabStore()
const connStore = useConnectionStore()
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
  const connId = tabStore.currentTab?.connectionId
  if (typeof connId === 'number' && connStore.savedConnections[connId]?.type === 'postgres') {
    return PostgreSQL
  }
  return MySQL
})

const simpleSchema = computed(() => {
  const connId = tabStore.currentTab?.connectionId
  if (connId == null) return {}
  return JSON.parse(JSON.stringify(connStore.schemaCache[connId] || {})) as DbSchema
})

// FIX 2: Расширяем возвращаемый тип (добавляем Promise)
function customCompletionSource(
  context: CompletionContext
): CompletionResult | null | Promise<CompletionResult | null> {
  const word = context.matchBefore(/[\w"']+/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  const dbSchema = simpleSchema.value
  const docText = context.state.doc.toString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any[] = [...SQL_KEYWORDS]

  Object.keys(dbSchema).forEach((tableName) => {
    options.push({
      label: tableName,
      type: 'class',
      boost: 50
    })
  })

  const tableMatches = [...docText.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/gi)]

  tableMatches.forEach((match) => {
    const tableName = match[1]

    // FIX 1: Проверяем, что tableName существует и является ключом в dbSchema
    if (tableName && Object.prototype.hasOwnProperty.call(dbSchema, tableName)) {
      const columns = dbSchema[tableName]

      if (columns) {
        columns.forEach((col) => {
          const needsQuotes = currentDialect.value === PostgreSQL && /[A-Z]/.test(col)
          const insertText = needsQuotes ? `"${col}"` : col

          options.push({
            label: col,
            type: 'property',
            detail: tableName,
            apply: insertText,
            boost: 99
          })
        })
      }
    }
  })

  return completeFromList(options)(context)
}

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
        }
      ]),
      oneDark,
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
      effects: languageConf.reconfigure(
        sql({
          dialect: currentDialect.value,
          schema: simpleSchema.value
        })
      )
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

/* 3. Опционально: Стилизуем полосу прокрутки (для Webkit/Chrome/Electron) */
:deep(.cm-scroller)::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

:deep(.cm-scroller)::-webkit-scrollbar-track {
  background: transparent;
}

:deep(.cm-scroller)::-webkit-scrollbar-thumb {
  background: var(--border-color); /* Или #555 */
  border-radius: 5px;
  border: 2px solid var(--bg-app); /* Отступ от края */
}

:deep(.cm-scroller)::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Исправляем активную строку, чтобы она не перекрывала границы */
:deep(.cm-activeLine) {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
