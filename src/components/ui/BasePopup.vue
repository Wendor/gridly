<template>
  <div v-if="isOpen" class="base-popup" :style="{ width }">
    <div class="popup-header">
      <span class="popup-title">{{ title }}</span>
      <button class="popup-close-btn" @click="$emit('close')">
        <BaseIcon name="x" size="sm" />
      </button>
    </div>
    <div class="popup-body">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseIcon from './BaseIcon.vue';

defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  width: {
    type: String,
    default: '600px',
  },
});

defineEmits(['close']);
</script>

<style scoped>
.base-popup {
  position: fixed;
  bottom: 30px; /* Above status bar default */
  left: 10px;
  right: auto;
  max-width: 90vw;
  max-height: 300px;
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  box-shadow: 0 -4px 10px rgba(0,0,0,0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  overflow: hidden;
  animation: slideUp 0.15s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border-color);
}

.popup-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.popup-close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  display: flex;
  border-radius: 4px;
}
.popup-close-btn:hover {
  background: var(--bg-input);
  color: var(--text-primary);
}

.popup-body {
  padding: 0;
  overflow: auto;
  background: var(--bg-input);
  flex: 1;
}
</style>
