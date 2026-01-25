<template>
  <div class="base-spinner" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
  }>(),
  {
    size: 16
  }
)
</script>

<style scoped>
.base-spinner {
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: rotate 1s linear infinite;
  display: inline-block;
  color: inherit;
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
