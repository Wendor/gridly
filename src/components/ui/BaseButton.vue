<template>
  <button
    class="base-btn"
    :class="[`variant-${variant}`, { 'icon-only': iconOnly }]"
    :disabled="disabled || loading"
    :title="loading ? $t('common.loading') : undefined"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="spinner"></span>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    disabled?: boolean
    loading?: boolean
    iconOnly?: boolean
  }>(),
  {
    variant: 'secondary',
  },
);

defineEmits<{ (e: 'click', event: MouseEvent): void }>();
</script>

<style scoped>
.base-btn {
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--font-main);
  box-sizing: border-box;
  white-space: nowrap;
  flex-shrink: 0;
}

.base-btn:not(.icon-only) {
  min-width: 32px;
}

.base-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Primary */
.variant-primary {
  background: var(--accent-primary);
  color: var(--text-white);
}
.variant-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

/* Secondary (Outline) */
.variant-secondary {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-primary);
}
.variant-secondary:hover:not(:disabled) {
  border-color: var(--focus-border);
  color: var(--text-white);
}

/* Danger */
.variant-danger {
  background: transparent;
  border-color: #ff4d4f;
  color: #ff4d4f;
}
.variant-danger:hover:not(:disabled) {
  background: #ff4d4f;
  color: white;
}

/* Ghost (No border/bg usually, or minimal) */
.variant-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: 4px;
}
.variant-ghost:hover:not(:disabled) {
  background: var(--bg-input);
  color: var(--text-primary);
}

.icon-only {
  padding: 6px;
  aspect-ratio: 1;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
