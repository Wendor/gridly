<template>
  <label class="base-checkbox" :class="{ disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="hidden-input"
      @change="updateValue"
    />
    <span class="checkmark">
      <svg
        v-if="modelValue"
        width="10"
        height="8"
        viewBox="0 0 10 8"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 4L3.5 6.5L9 1"
          stroke="white"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span v-if="$slots.default || label" class="label-text">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>();

const emit = defineEmits<{ (e: 'update:modelValue', val: boolean): void }>();

function updateValue(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
}
</script>

<style scoped>
.base-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--text-primary);
}

.base-checkbox.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hidden-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  width: 16px;
  height: 16px;
  background-color: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.base-checkbox:hover .checkmark {
  border-color: var(--focus-border);
}

.hidden-input:checked ~ .checkmark {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.hidden-input:focus ~ .checkmark {
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.3);
}

.label-text {
  line-height: 1.2;
}
</style>
