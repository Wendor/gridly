<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="base-context-menu-overlay"
      @click.stop="close"
      @contextmenu.prevent="close"
    >
      <div
        class="base-context-menu"
        :style="{ top: y + 'px', left: x + 'px' }"
        @click.stop
        @contextmenu.stop.prevent
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue';

const props = defineProps<{
  visible: boolean
  x: number
  y: number
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

function close(): void {
  emit('close');
}

// Optional: Close on Escape key
watch(
  () => props.visible,
  (val) => {
    if (val) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
);

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}
</script>

<style scoped>
.base-context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  /* Transparent overlay to catch clicks */
}

.base-context-menu {
  position: absolute; /* Relative to overlay is fixed, so absolute here works if overlay is fixed */
  z-index: 9999;
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 150px;
}
</style>
