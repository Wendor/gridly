<template>
  <div class="activity-bar">
    <div class="top-actions">
      <div
        class="ab-item"
        :class="{ active: uiStore.activeSidebar === 'connections' }"
        :title="$t('activity.connections')"
        @click="uiStore.setSidebar('connections')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </svg>
      </div>

      <div
        class="ab-item"
        :class="{ active: uiStore.activeSidebar === 'history' }"
        :title="$t('activity.history')"
        @click="uiStore.setSidebar('history')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
    </div>

    <div class="spacer"></div>

    <div class="bottom-actions">
      <div class="ab-item" :title="$t('common.help')" @click="openHelp">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>
      <div class="ab-item" :title="$t('common.settings')" @click="openSettings">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '../../stores/ui';
import { useTabStore } from '../../stores/tabs'; // <-- Импортируем tabStore
import i18n from '../../i18n';

const uiStore = useUIStore();
const tabStore = useTabStore();

const emit = defineEmits<{
  (e: 'open-settings'): void
}>();

function openHelp(): void {
  tabStore.openDocumentTab(
    i18n.global.t('common.instructions'),
    i18n.global.t('common.instructionsText'),
  );
}

function openSettings(): void {
  // Вызываем метод открытия таба настроек
  tabStore.openSettingsTab();

  // Опционально: можно эмитить событие наверх, если нужно
  emit('open-settings');
}
</script>

<style scoped>
.activity-bar {
  width: 48px;
  background: var(--bg-activity-bar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column; /* Элементы идут сверху вниз */
  flex-shrink: 0;
  height: 100%; /* Растягиваем на всю высоту */
}

.top-actions {
  display: flex;
  flex-direction: column;
}

/* Spacer занимает всё доступное место, толкая bottom-actions вниз */
.spacer {
  flex: 1;
}

.bottom-actions {
  display: flex;
  flex-direction: column;
  padding-bottom: 10px;
}

.ab-item {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary); /* Используем переменную темы */
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.ab-item:hover {
  color: var(--text-primary);
}

.ab-item.active {
  color: var(--text-primary); /* Активный цвет */
}

/* Белая полоска слева для активного элемента */
.ab-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent-primary);
}
</style>
