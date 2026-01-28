<template>
  <span class="base-icon" :class="[sizeClass, customClass, { spin: props.spin }]" v-html="svgContent"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string
  size?: 'sm' | 'md' | 'lg'
  customClass?: string
  spin?: boolean
}>();

import { icons } from './icons';

const svgContent = computed(() => icons[props.name] || '');
const sizeClass = computed(() => (props.size ? `icon-${props.size}` : ''));
</script>

<style scoped>
.base-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
