<template>
  <div class="code-editor-container">
    <div ref="editorRef" class="code-editor" :style="{ fontSize: settingsStore.fontSize + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language'
import { useSettingsStore } from '../../stores/settings'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: 'json' | 'text'
    readOnly?: boolean
  }>(),
  {
    language: 'text',
    readOnly: false
  }
)

const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>()

const settingsStore = useSettingsStore()
const editorRef = ref<HTMLElement | null>(null)
let view: EditorView | null = null
const languageConf = new Compartment()
const themeConf = new Compartment()
const readOnlyConf = new Compartment()

onMounted(() => {
  if (!editorRef.value) return

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
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
      themeConf.of(settingsStore.activeTheme.type === 'dark' ? oneDark : []),
      syntaxHighlighting(defaultHighlightStyle),
      languageConf.of(props.language === 'json' ? json() : []),
      readOnlyConf.of(EditorState.readOnly.of(props.readOnly)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      })
    ]
  })

  view = new EditorView({ state: startState, parent: editorRef.value })
})

watch(
  () => [props.language, props.readOnly, settingsStore.activeTheme.type],
  () => {
    if (view) {
      view.dispatch({
        effects: [
          languageConf.reconfigure(props.language === 'json' ? json() : []),
          themeConf.reconfigure(settingsStore.activeTheme.type === 'dark' ? oneDark : []),
          readOnlyConf.reconfigure(EditorState.readOnly.of(props.readOnly))
        ]
      })
    }
  }
)

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
.code-editor-container {
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.code-editor {
  height: 100%;
  width: 100%;
}

:deep(.cm-editor) {
  height: 100%;
  background-color: var(--bg-app) !important;
}

:deep(.cm-scroller) {
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
}

:deep(.cm-gutters) {
  background-color: var(--bg-app) !important;
  border-right: 1px solid var(--border-color) !important;
  color: var(--text-secondary);
}

:deep(.cm-activeLine) {
  background-color: var(--list-hover-bg);
}
</style>
