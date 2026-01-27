<template>
  <div class="connection-editor">
    <div class="editor-main">
      <div class="editor-sidebar">
        <div
          class="sidebar-item"
          :class="{ active: activeSection === 'general' }"
          @click="activeSection = 'general'"
        >
          {{ $t('connections.section.general') }}
        </div>
        <div
          class="sidebar-item"
          :class="{ active: activeSection === 'ssh' }"
          @click="activeSection = 'ssh'"
        >
          {{ $t('connections.section.ssh') }}
        </div>
        <div
          v-if="isEditing"
          class="sidebar-item"
          :class="{ active: activeSection === 'schemas' }"
          @click="activeSection = 'schemas'"
        >
          {{ $t('connections.section.schemas') }}
        </div>
      </div>

      <div class="editor-content">
        <div v-if="activeSection === 'general'" class="form-section">
          <BaseSelect
            v-model="form.type"
            :label="$t('connections.type')"
            :options="[
            { label: 'MySQL / MariaDB', value: 'mysql' },
            { label: 'PostgreSQL', value: 'postgres' },
            { label: 'ClickHouse', value: 'clickhouse' },
          ]"
            @change="onTypeChange"
          />

          <BaseInput v-model="form.name" :label="$t('connections.name')" placeholder="PROD" />

          <div class="row">
            <BaseInput v-model="form.host" :label="$t('connections.host')" placeholder="localhost" />
            <BaseInput
              v-model="form.port"
              :label="$t('connections.port')"
              placeholder="5432"
              class="port-input"
            />
          </div>

          <div class="row">
            <BaseInput v-model="form.user" :label="$t('connections.user')" placeholder="root" />
            <BaseInput
              v-model="form.password"
              type="password"
              :label="$t('connections.password')"
              placeholder="******"
            />
          </div>

          <BaseInput
            v-model="form.database"
            :label="$t('connections.database')"
            placeholder="my_app_db"
          />

          <div v-if="isEditing" class="password-hint">
            {{ $t('connections.passwordHint') }}
          </div>
        </div>

        <div v-if="activeSection === 'ssh'" class="form-section">
          <h3>{{ $t('connections.section.ssh') }}</h3>
          <div class="ssh-toggle-section">
            <label class="checkbox-label">
              <input v-model="form.useSsh" type="checkbox" />
              {{ $t('connections.ssh') }}
            </label>
          </div>

          <div v-if="form.useSsh" class="ssh-fields">
            <div class="row">
              <BaseInput
                v-model="form.sshHost"
                :label="$t('connections.sshHost')"
                placeholder="1.2.3.4"
              />
              <BaseInput
                v-model="form.sshPort"
                :label="$t('connections.sshPort')"
                placeholder="22"
                class="port-input"
              />
            </div>
            <BaseInput v-model="form.sshUser" :label="$t('connections.sshUser')" placeholder="root" />
            <BaseInput
              v-model="form.sshPassword"
              type="password"
              :label="$t('connections.sshPassword')"
              placeholder="******"
            />
            <BaseInput
              v-model="form.sshKeyPath"
              :label="$t('connections.sshKeyPath')"
              placeholder="/path/to/key"
            />
          </div>
        </div>

        <div v-if="activeSection === 'schemas'" class="form-section">
          <h3>{{ $t('connections.excludeDatabases') }}</h3>
          <div class="help-text">{{ $t('connections.excludeDatabasesHint') }}</div>

          <div v-if="availableDatabases.length === 0" class="loading-dbs">
            {{ $t('status.loading') }}...
          </div>

          <div v-else class="list-actions">
            <span class="action-link" @click="selectAllDb">{{ $t('connections.selectAll') }}</span>
            <span class="separator">|</span>
            <span class="action-link" @click="unselectAllDb">{{ $t('connections.unselectAll') }}</span>
          </div>

          <div v-if="availableDatabases.length > 0" class="db-list">
            <label v-for="db in availableDatabases" :key="db" class="db-check-item">
              <input type="checkbox" :checked="isExcluded(db)" @change="toggleDbExclusion(db)" />
              {{ db }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="editor-actions">
        <!-- Test Status Feedback -->
        <div v-if="testStatus" class="test-feedback">
         <div class="feedback-msg" :class="testStatus.type">
            <span v-if="testStatus.type === 'loading'">
               <BaseIcon name="loader" class="spin" />
            </span>
            <span v-if="testStatus.type === 'success'">
               <BaseIcon name="check" />
            </span>
            <span v-if="testStatus.type === 'error'">
               <BaseIcon name="cross" />
            </span>
            {{ testStatus.message }}
         </div>
      </div>

      <div class="action-buttons">
         <BaseButton
            variant="secondary"
            :disabled="testStatus?.type === 'loading'"
            @click="testConnection"
         >
            {{ $t('connections.test') }}
         </BaseButton>
         <BaseButton variant="primary" :disabled="testStatus?.type === 'loading'" @click="save">
            {{ isEditing ? $t('common.save') : $t('common.create') }}
         </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useTabStore } from '../../stores/tabs';
import { useConnectionStore } from '../../stores/connections';
import { DbConnection } from '../../types';
import BaseInput from '../ui/BaseInput.vue';
import BaseSelect from '../ui/BaseSelect.vue';
import BaseButton from '../ui/BaseButton.vue';
import BaseIcon from '../ui/BaseIcon.vue';
import i18n from '../../i18n';

const tabStore = useTabStore();
const connStore = useConnectionStore();
const activeSection = ref<'general' | 'ssh' | 'schemas'>('general');

const currentTab = computed(() => {
   return tabStore.currentTab?.type === 'connection' ? tabStore.currentTab : null;
});

const isEditing = computed(() => !!currentTab.value?.connectionId);

const defaultForm: DbConnection = {
  id: '',
  type: 'mysql',
  name: '',
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: '',
  database: '',
  excludeList: '',
  useSsh: false,
  sshHost: '',
  sshPort: '22',
  sshUser: 'root',
  sshPassword: '',
  sshKeyPath: '',
};

const form = reactive<DbConnection>({ ...defaultForm });
const availableDatabases = ref<string[]>([]);
const testStatus = ref<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);

// Initialize form from existing connection if editing
onMounted(async () => {
   if (currentTab.value?.connectionId) {
      const conn = connStore.savedConnections.find(c => c.id === currentTab.value!.connectionId);
      if (conn) {
         Object.assign(form, JSON.parse(JSON.stringify(conn)));
         // Load databases for schema exclusion
          // Try to load databases from cache first
          const cachedDbs = connStore.databasesCache[conn.id] || [];
          
          // Also include databases that are currently excluded (they might not be in the cache if the cache is filtered)
          const excludedDbs = conn.excludeList 
            ? conn.excludeList.split(',').map(s => s.trim()).filter(Boolean)
            : [];
            
          if (cachedDbs.length || excludedDbs.length) {
            // Merge and deduplicate
            const merged = new Set([...cachedDbs, ...excludedDbs]);
            availableDatabases.value = Array.from(merged).sort();
          }

          if (connStore.isConnected(conn.id)) {
            try {
               const dbs = await window.dbApi.getDatabases(conn.id, '');
               availableDatabases.value = dbs.sort();
            } catch (e) {
               console.error('Failed to load databases:', e);
            }
         }
      }
   }
});

// Watch SSH toggle to switch section or stay
// REMOVED: Auto-switch logic not needed as tab is always visible


// Logic for Excluded DBs
const excludedDbSet = computed({
  get() {
    if (!form.excludeList) return new Set<string>();
    return new Set(
      form.excludeList
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  },
  set(newSet: Set<string>) {
    form.excludeList = Array.from(newSet).join(', ');
  },
});

function toggleDbExclusion(db: string): void {
  const current = new Set(excludedDbSet.value);
  const lower = db.toLowerCase();
  if (current.has(lower)) {
    current.delete(lower);
  } else {
    current.add(lower);
  }
  excludedDbSet.value = current;
}

function selectAllDb(): void {
  const all = new Set<string>();
  availableDatabases.value.forEach(db => all.add(db.toLowerCase()));
  excludedDbSet.value = all;
}

function unselectAllDb(): void {
  excludedDbSet.value = new Set();
}

function isExcluded(db: string): boolean {
  return excludedDbSet.value.has(db.toLowerCase());
}

function onTypeChange(): void {
  if (form.type === 'mysql' && (form.port === '5432' || form.port === '8123' || !form.port))
    form.port = '3306';
  if (form.type === 'postgres' && (form.port === '3306' || form.port === '8123' || !form.port))
    form.port = '5432';
  if (form.type === 'clickhouse' && (form.port === '3306' || form.port === '5432' || !form.port))
    form.port = '8123';
}

async function testConnection(): Promise<void> {
  testStatus.value = { type: 'loading', message: i18n.global.t('connections.testingConnection') };
  try {
    const connectionId = isEditing.value ? form.id : undefined;
    await window.dbApi.testConnection({ ...form }, connectionId);
    testStatus.value = { type: 'success', message: i18n.global.t('connections.testSuccess') };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    testStatus.value = { type: 'error', message: i18n.global.t('connections.testFailed') + ': ' + msg };
  }
}

function save(): void {
  const newConn: DbConnection = {
    ...form,
    password: form.password || (isEditing.value ? undefined : ''),
    sshPassword: form.sshPassword || (isEditing.value ? undefined : ''),
  };
  if (!newConn.name) newConn.name = `${newConn.type} @ ${newConn.host}`;

  if (isEditing.value) {
     connStore.updateConnection(newConn);
  } else {
     connStore.addConnection(newConn);
  }
  
  if (currentTab.value) {
     tabStore.closeTab(currentTab.value.id);
  }
}
</script>

<style scoped>
.connection-editor {
   display: flex;
   flex-direction: column;
   height: 100%;
   background: var(--bg-app);
}

.editor-main {
   display: flex;
   flex: 1;
   overflow: hidden;
}

.editor-sidebar {
   width: 200px;
   background: var(--bg-sidebar);
   border-right: 1px solid var(--border-color);
   padding: 10px 0;
   display: flex;
   flex-direction: column;
}

.sidebar-item {
   padding: 8px 15px;
   cursor: pointer;
   color: var(--text-secondary);
   font-size: 13px;
   border-left: 3px solid transparent;
}

.sidebar-item:hover {
   background: var(--list-hover-bg);
   color: var(--text-primary);
}

.sidebar-item.active {
   background: var(--list-active-bg);
   color: var(--text-primary);
   border-left-color: var(--accent-primary);
}

.editor-content {
   flex: 1;
   padding: 20px;
   overflow-y: auto;
   display: flex;
   flex-direction: column;
   position: relative;
}

.form-section {
   max-width: 600px;
   display: flex;
   flex-direction: column;
   gap: 15px;
}

.editor-actions {
   /* Removing absolute positioning */
   padding: 15px 20px;
   background: var(--bg-app);
   border-top: 1px solid var(--border-color);
   display: flex;
   align-items: center;
   flex-shrink: 0;
}

.row {
  display: flex;
  gap: 15px;
}

.port-input {
  width: 120px;
  flex-shrink: 0;
}

.ssh-toggle-section {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}

.ssh-fields {
   display: flex;
   flex-direction: column;
   gap: 15px;
}

.db-list {
  flex: 1; /* Allow list to grow/shrink */
  min-height: 0;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  border-radius: 4px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-actions {
  display: flex;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 5px;
  color: var(--text-secondary);
}

.action-link {
  cursor: pointer;
  text-decoration: underline;
}

.action-link:hover {
  color: var(--accent-primary);
}

.separator {
  color: var(--border-color);
}

.db-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
}

.db-check-item:hover {
  background: var(--list-hover-bg);
}

.test-feedback {
   flex: 1;
   margin-right: 20px;
}

.feedback-msg {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-msg.error {
  background: rgba(255, 70, 70, 0.1);
  color: #ff6b6b;
  border: 1px solid rgba(255, 70, 70, 0.2);
}

.feedback-msg.success {
  background: rgba(70, 255, 70, 0.1);
  color: #6bff6b;
  border: 1px solid rgba(70, 255, 70, 0.2);
}

.action-buttons {
   display: flex;
   gap: 10px;
   margin-left: auto;
}

.password-hint {
   font-size: 12px;
   color: var(--text-secondary);
   font-style: italic;
}
</style>
