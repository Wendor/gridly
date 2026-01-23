<template>
  <div class="base-input-wrapper">
    <label v-if="label" class="input-label">{{ label }}</label>
    <input
      :value="modelValue"
      v-bind="$attrs"
      class="base-input"
      :class="{ 'has-error': !!error }"
      @input="updateValue"
    />
    <small v-if="error" class="input-error">{{ error }}</small>
    <small v-else-if="help" class="input-help">{{ help }}</small>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | number | undefined
  label?: string
  error?: string
  help?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', val: string): void }>()

function updateValue(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped>
.base-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.input-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.base-input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 4px;
  outline: none;
  font-family: var(--font-main);
  font-size: 13px;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box; /* Важно для паддингов */
}

.base-input:focus {
  border-color: var(--focus-border);
}

.base-input.has-error {
  border-color: #ff4d4f;
}

.input-error {
  color: #ff4d4f;
  font-size: 11px;
}

.input-help {
  color: var(--text-secondary);
  font-size: 11px;
  opacity: 0.8;
}
</style>
