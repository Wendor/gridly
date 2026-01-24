<template>
  <div class="document-view">
    <div class="markdown-body" v-html="renderedContent"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { useTabStore } from '../../stores/tabs'

const tabStore = useTabStore()
const md = new MarkdownIt()

const renderedContent = computed(() => {
  if (tabStore.currentTab?.type === 'document' && tabStore.currentTab.content) {
    return md.render(tabStore.currentTab.content)
  }
  return ''
})
</script>

<style scoped>
.document-view {
  height: 100%;
  overflow-y: auto;
  background: var(--bg-app);
  color: var(--text-primary);
  padding: 40px;
}

.markdown-body {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
}

:deep(h1) {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
  margin-bottom: 1em;
}

:deep(h2) {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
  margin-top: 1.5em;
  margin-bottom: 1em;
}

:deep(p) {
  margin-bottom: 1em;
}

:deep(ul),
:deep(ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

:deep(code) {
  background-color: var(--bg-input);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: var(--font-mono);
}

:deep(pre) {
  background-color: var(--bg-input);
  padding: 16px;
  overflow: auto;
  border-radius: 6px;
  margin-bottom: 1em;
}

:deep(pre code) {
  background-color: transparent;
  padding: 0;
}

:deep(a) {
  color: var(--accent-primary);
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}
</style>
