<template>
  <div
    class="table-cell"
    :class="{
      selected: selected,
      focused: focused,
      changed: changed
    }"
    :style="{ width: width + 'px', minWidth: width + 'px' }"
    @mousedown="$emit('mousedown', $event)"
    @dblclick="$emit('dblclick', $event)"
    @contextmenu.prevent="$emit('contextmenu', $event)"
  >
    <span :style="{ opacity: isEditing ? 0 : 1 }">
      {{ formattedValue }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatTableValue } from '@/utils/tableFormatter'

const props = defineProps<{
  value: unknown
  width: number
  selected: boolean
  focused: boolean
  changed: boolean
  isEditing: boolean
}>()

defineEmits<{
  (e: 'mousedown', event: MouseEvent): void
  (e: 'dblclick', event: MouseEvent): void
  (e: 'contextmenu', event: MouseEvent): void
}>()

const formattedValue = computed(() => formatTableValue(props.value))
</script>

<style scoped>
.table-cell {
  position: relative;
  padding: 0 8px;
  display: flex;
  align-items: center;
  border-right: 1px solid var(--border-color);
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-sizing: border-box;
  flex-shrink: 0;
}

.table-cell.selected {
  background: var(--list-active-bg);
  box-shadow: inset 0 0 0 2px var(--accent-primary);
}

.table-cell.focused {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
}

.table-cell.changed {
  color: var(--warning);
}
</style>
