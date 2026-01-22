<template>
  <codemirror
    :key="settingsStore.activeTheme.type"
    v-model="code"
    placeholder="Введите SQL запрос..."
    :style="{
      height: '100%',
      fontSize: '14px',
      backgroundColor: 'var(--bg-app)',
      color: 'var(--text-primary)'
    }"
    :autofocus="true"
    :indent-with-tab="true"
    :tab-size="2"
    :extensions="extensions"
    @keydown.ctrl.enter="$emit('run')"
    @keydown.meta.enter="$emit('run')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Extension } from '@codemirror/state' // Импортируем тип
import { useSettingsStore } from '../stores/settings'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'run'): void
}>()

const settingsStore = useSettingsStore()

const code = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Явно указываем тип Extension[]
const extensions = computed<Extension[]>(() => {
  const exts: Extension[] = [sql()]
  if (settingsStore.activeTheme.type === 'dark') {
    exts.push(oneDark)
  }
  return exts
})
</script>

<style>
.cm-editor {
  height: 100% !important;
}
.cm-scroller {
  overflow: auto !important;
}
</style>
