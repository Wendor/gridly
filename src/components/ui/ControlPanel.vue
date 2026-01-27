<template>
  <div class="control-panel">
    <div class="control-panel-left">
      <span v-if="title" class="panel-title">{{ title }}</span>
      <slot name="default"></slot>
    </div>

    <div class="control-panel-center">
      <slot name="center"></slot>
    </div>

    <div class="control-panel-right">
      <slot name="right"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>();
</script>

<style scoped>
.control-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height, 35px);
  background-color: var(--bg-control-panel);
  border-bottom: 1px solid var(--border-color);
  padding: 0 8px;
  box-sizing: border-box;
  flex-shrink: 0;
  width: 100%;
  color: var(--text-primary);
  font-size: 13px;
}

.control-panel-left,
.control-panel-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-panel-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 16px;
}

.panel-title {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 11px;
  margin-right: 8px;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

:deep(.base-btn:not(.variant-primary)) {
  color: var(--text-primary);
}
</style>
