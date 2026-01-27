<template>
  <div class="dashboard-view">
    <div class="toolbar">
      <div class="db-info">
        <h3>{{ $t('sidebar.overview') }}</h3>
        <span v-if="metrics?.version" class="db-version">{{ formatVersion(metrics.version) }}</span>
      </div>
      <button
        class="refresh-btn"
        :disabled="isRefreshing"
        :title="$t('sidebar.refresh')"
        @click="loadMetrics"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ spinning: isRefreshing }"
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
    </div>

    <div class="metrics-grid">
      <!-- Row 1: Key Stats -->
      <MetricCard
        :title="$t('dashboard.activeConnections')"
        :value="metrics ? `${metrics.activeConnections} / ${metrics.maxConnections}` : '-'"
        :loading="isLoading"
        :error="error"
        :subtext="
          metrics
            ? Math.round((metrics.activeConnections / metrics.maxConnections) * 100) + '%'
            : ''
        "
        :history="metricsHistory.activeConnections"
      />

      <MetricCard
        :title="$t('dashboard.cacheHit')"
        :value="metrics ? (metrics.cacheHitRatio * 100).toFixed(1) + '%' : '-'"
        :loading="isLoading"
        :error="error"
        :history="metricsHistory.cacheHit"
      />

      <MetricCard
        :title="$t('dashboard.tableCount')"
        :value="metrics?.tableCount"
        :loading="isLoading"
        :error="error"
      />

      <MetricCard
        :title="$t('dashboard.dbSize')"
        :value="metrics?.dbSize"
        :loading="isLoading"
        :error="error"
        :history="metricsHistory.dbSize"
      />

      <MetricCard
        :title="$t('dashboard.indexesSize')"
        :value="metrics?.indexesSize"
        :loading="isLoading"
        :error="error"
        :history="metricsHistory.indexesSize"
      />

      <MetricCard
        :title="$t('dashboard.uptime')"
        :value="formatUptime(metrics?.uptime)"
        :loading="isLoading"
        :error="error"
      />

      <!-- Row 2: Top Queries -->
      <div class="full-width-card">
        <div class="card-header">
          <span class="card-title">{{ $t('dashboard.longRunningQueries') }}</span>
        </div>
        <div class="query-list-container">
          <div v-if="isLoading && !metrics" class="loading-state">Loading...</div>
          <div v-else-if="!metrics?.topQueries?.length" class="empty-state">
            {{ $t('dashboard.noActiveQueries') }}
          </div>
          <table v-else class="query-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>User</th>
                <th>Duration</th>
                <th>State</th>
                <th>Query</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in metrics.topQueries" :key="q.pid">
                <td class="mono">{{ q.pid }}</td>
                <td>{{ q.user }}</td>
                <td class="duration-cell">{{ q.duration }}</td>
                <td>{{ q.state }}</td>
                <td class="query-cell" :title="q.query">{{ truncate(q.query, 80) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useTabStore } from '../../stores/tabs';
import { useConnectionStore } from '../../stores/connections';
import type { DashboardMetrics } from '@/types';
import MetricCard from '../ui/MetricCard.vue';

import { useI18n } from 'vue-i18n';

const tabStore = useTabStore();
const connStore = useConnectionStore();
const { t } = useI18n();
const metrics = ref<DashboardMetrics | null>(null);
const isLoading = ref(false); // For initial skeleton load
const isRefreshing = ref(false); // For spinner
const error = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

const currentTab = computed(() => {
  return tabStore.currentTab?.type === 'dashboard' ? tabStore.currentTab : null;
});

function formatUptime(seconds?: number): string {
  if (seconds === undefined) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  // Use optional chaining carefully or fallback
  const d = t('common.time.d') || 'd';
  const h = t('common.time.h') || 'h';
  const m = t('common.time.m') || 'm';

  if (days > 0) {
    return `${days}${d} ${hours}${h} ${minutes}${m}`;
  }
  return `${hours}${h} ${minutes}${m}`;
}

function formatVersion(v: string): string {
  // Try to keep it short if it's very long (Postgres versions are verbose)
  if (v.length > 40) return v.substring(0, 40) + '...';
  return v;
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.substring(0, n) + '...' : str;
}

// History state for charts
const metricsHistory = ref<{
  activeConnections: number[]
  cacheHit: number[]
  dbSize: number[]
  indexesSize: number[]
}>({
  activeConnections: [],
  cacheHit: [],
  dbSize: [],
  indexesSize: [],
});

function parseSizeToMb(sizeStr?: string): number {
  if (!sizeStr) return 0;
  const val = parseFloat(sizeStr);
  if (isNaN(val)) return 0;
  if (sizeStr.includes('GB')) return val * 1024;
  if (sizeStr.includes('kB')) return val / 1024;
  if (sizeStr.includes('bytes') || sizeStr.includes('B')) return val / 1024 / 1024;
  return val;
}

function updateHistory(m: DashboardMetrics): void {
  const maxPoints = 30;

  const updateArr = (arr: number[], newVal: number): void => {
    arr.push(newVal);
    if (arr.length > maxPoints) arr.shift();
  };

  updateArr(metricsHistory.value.activeConnections, m.activeConnections);
  updateArr(metricsHistory.value.cacheHit, m.cacheHitRatio * 100);
  updateArr(metricsHistory.value.dbSize, parseSizeToMb(m.dbSize));
  updateArr(metricsHistory.value.indexesSize, parseSizeToMb(m.indexesSize));
}

async function loadMetrics(): Promise<void> {
  if (!currentTab.value) return;

  // Connect if needed
  try {
    await connStore.ensureConnection(currentTab.value.connectionId);
  } catch (e: unknown) {
    error.value = (e as Error).message || String(e);
    return;
  }

  // Set loading state
  if (!metrics.value) {
    isLoading.value = true;
  }
  isRefreshing.value = true;
  error.value = null;

  try {
    const res = await window.dbApi.getDashboardMetrics(currentTab.value.connectionId);
    if (res) {
      metrics.value = res;
      updateHistory(res);
    } else {
      error.value = 'Failed to load metrics';
    }
  } catch (e: unknown) {
    error.value = (e as Error).message || 'Unknown error';
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
}

onMounted(() => {
  loadMetrics();
  // Refresh every 10 seconds
  timer = setInterval(loadMetrics, 10000);
});

// Watch for tab changes to reload metrics when switching between dashboards
import { watch } from 'vue';
watch(
  () => currentTab.value?.connectionId,
  (newId) => {
    if (newId != null) {
      // Reset state to show skeletons immediately
      metrics.value = null;
      isLoading.value = true;
      error.value = null;

      // Reset history
      metricsHistory.value = {
        activeConnections: [],
        cacheHit: [],
        dbSize: [],
        indexesSize: [],
      };

      loadMetrics();
    }
  },
);

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.dashboard-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  padding: 16px;
  overflow-y: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.db-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: var(--text-primary);
}

.db-version {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

.refresh-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover {
  background: var(--bg-sidebar);
  color: var(--text-primary);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.full-width-card {
  grid-column: 1 / -1;
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 16px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.card-header {
  margin-bottom: 12px;
}

.card-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  font-weight: 600;
}

.query-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.query-table th {
  text-align: left;
  padding: 8px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  font-weight: 500;
}

.query-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.mono {
  font-family: var(--font-mono);
  color: var(--accent-primary);
}

.duration-cell {
  color: #ffaa00;
}

.query-cell {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.empty-state,
.loading-state {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-style: italic;
}
</style>
