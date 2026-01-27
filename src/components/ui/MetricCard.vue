<template>
  <div class="metric-card">
    <div class="card-header">
      <span class="card-title">{{ title }}</span>
      <slot name="header-action"></slot>
    </div>
    <div class="card-content">
      <div v-if="loading" class="loading-param">
        <div class="skeleton-line" style="width: 60%"></div>
      </div>
      <div v-else-if="error" class="error-text">{{ error }}</div>
      <div v-else class="value-display">
        <span class="main-value">{{ value }}</span>
        <span v-if="unit" class="unit">{{ unit }}</span>
        <div v-if="subtext" class="subtext">{{ subtext }}</div>
      </div>
      <slot name="content"></slot>
    </div>
    <div v-if="history && history.length > 1" class="chart-container">
      <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none">
        <defs>
          <linearGradient :id="`grad-${id}`" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.2" />
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" :fill="`url(#grad-${id})`" class="area-path" />
        <path :d="linePath" fill="none" class="line-path" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string
  value?: string | number
  unit?: string
  subtext?: string
  loading?: boolean
  error?: string | null
  history?: number[]
}>();

const id = Math.random().toString(36).substr(2, 9);
const width = 100;
const height = 40;

const normalizedData = computed(() => {
  if (!props.history || props.history.length < 2) return [];
  const min = Math.min(...props.history);
  const max = Math.max(...props.history);
  const range = max - min;

  // Prevent division by zero if flat line
  const effectiveRange = range === 0 ? 1 : range;

  return props.history.map((val, i) => {
    const x = (i / (props.history!.length - 1)) * width;
    // Normalize y: higher value = smaller y (SVG coords)
    // Add 2px padding to avoid clipping stroke
    const padding = 2;
    const availableHeight = height - padding * 2;
    const normalizedY = 1 - (val - min) / effectiveRange;
    const y = padding + normalizedY * availableHeight;
    return { x, y };
  });
});

const linePath = computed(() => {
  const data = normalizedData.value;
  if (data.length === 0) return '';
  return `M ${data.map((p) => `${p.x},${p.y}`).join(' L ')}`;
});

const areaPath = computed(() => {
  const data = normalizedData.value;
  if (data.length === 0) return '';
  const line = `M ${data.map((p) => `${p.x},${p.y}`).join(' L ')}`;
  return `${line} L ${width},${height} L 0,${height} Z`;
});
</script>

<style scoped>
.metric-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  min-height: 100px;
  position: relative;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  z-index: 2;
}

.card-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  font-weight: 600;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 2;
}

.value-display {
  display: flex;
  flex-direction: column;
}

.main-value {
  font-size: 24px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.2;
}

.unit {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.subtext {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  opacity: 0.8;
}

.loading-param {
  width: 100%;
  animation: pulse 1.5s infinite;
}

.skeleton-line {
  height: 20px;
  background: var(--border-color);
  border-radius: 4px;
}

.error-text {
  color: #ff6b6b;
  font-size: 12px;
}

.chart-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 60%;
  opacity: 0.5; /* subtle background */
  pointer-events: none;
  z-index: 1;
}

.chart-container svg {
  width: 100%;
  height: 100%;
  display: block;
}

.line-path {
  stroke: var(--accent-primary);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.area-path {
  stroke: none;
}

@keyframes pulse {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}
</style>
