<template>
  <div class="base-select-wrapper">
    <label v-if="label" class="select-label">{{ label }}</label>
    <div class="select-container">
      <select :value="modelValue" class="base-select" v-bind="$attrs" @change="updateValue">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <div class="select-arrow">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface SelectOption {
  label: string
  value: string | number
}

defineProps<{
  modelValue: string | number
  options: SelectOption[]
  label?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>()

function updateValue(event: Event): void {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped>
.base-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.select-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.select-container {
  position: relative;
  width: 100%;
}

.base-select {
  appearance: none;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 30px 8px 10px; /* Справа место под стрелку */
  border-radius: 4px;
  outline: none;
  font-family: var(--font-main);
  font-size: 13px;
  width: 100%;
  cursor: pointer;
}

.base-select:focus {
  border-color: var(--focus-border);
}

.select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-secondary);
  display: flex;
}
</style>
