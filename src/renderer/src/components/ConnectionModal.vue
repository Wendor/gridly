<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ isEditing ? 'Редактирование подключения' : 'Новое подключение' }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="form-body">
        <label class="label">Тип базы:</label>
        <select v-model="form.type" class="input select" @change="onTypeChange">
          <option value="mysql">MySQL / MariaDB</option>
          <option value="postgres">PostgreSQL</option>
        </select>

        <input v-model="form.name" placeholder="Название (напр. PROD)" class="input" />

        <div class="row">
          <input v-model="form.host" placeholder="Host" class="input" />
          <input v-model="form.port" placeholder="Port" class="input port" />
        </div>

        <input v-model="form.user" placeholder="User" class="input" />
        <input v-model="form.password" type="password" placeholder="Password" class="input" />
        <input v-model="form.database" placeholder="Database Name" class="input" />

        <div class="ssh-toggle">
          <label class="checkbox-label">
            <input v-model="form.useSsh" type="checkbox" />
            Использовать SSH Tunnel
          </label>
        </div>

        <div v-if="form.useSsh" class="ssh-fields">
          <div class="row">
            <input v-model="form.sshHost" placeholder="SSH Host" class="input" />
            <input v-model="form.sshPort" placeholder="22" class="input port" />
          </div>
          <input v-model="form.sshUser" placeholder="SSH User" class="input" />
          <input
            v-model="form.sshPassword"
            type="password"
            placeholder="SSH Password"
            class="input"
          />
          <input v-model="form.sshKeyPath" placeholder="Key Path" class="input" />
        </div>
      </div>

      <div class="test-feedback" v-if="testStatus">
        <div class="feedback-msg" :class="testStatus.type">
          <span v-if="testStatus.type === 'loading'">⏳</span>
          <span v-if="testStatus.type === 'success'">✅</span>
          <span v-if="testStatus.type === 'error'">❌</span>
          {{ testStatus.message }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn test-btn" @click="testConnection" :disabled="testStatus?.type === 'loading'">
          Test Connection
        </button>
        <button class="btn save-btn" @click="save" :disabled="testStatus?.type === 'loading'">
          {{ isEditing ? 'Сохранить изменения' : 'Создать' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import type { DbConnection } from '../../../shared/types'

const props = defineProps<{
  isOpen: boolean
  initialData?: DbConnection | null // Данные для редактирования
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', conn: DbConnection): void
}>()

const isEditing = computed(() => !!props.initialData)

// Дефолтное состояние формы
const defaultForm: DbConnection = {
  type: 'mysql',
  name: '',
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: '',
  database: '',
  useSsh: false,
  sshHost: '',
  sshPort: '22',
  sshUser: 'root',
  sshPassword: '',
  sshKeyPath: ''
}

const form = reactive<DbConnection>({ ...defaultForm })
const testStatus = ref<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null)

// Следим за открытием окна
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      testStatus.value = null // Сброс статуса
      if (props.initialData) {
        // РЕЖИМ РЕДАКТИРОВАНИЯ: Копируем данные в форму
        Object.assign(form, props.initialData)
      } else {
        // РЕЖИМ СОЗДАНИЯ: Сбрасываем форму
        Object.assign(form, defaultForm)
      }
    }
  }
)

function onTypeChange(): void {
  // Меняем порт только если он дефолтный или пустой, чтобы не стереть пользовательский ввод
  if (form.type === 'mysql' && (form.port === '5432' || !form.port)) form.port = '3306'
  if (form.type === 'postgres' && (form.port === '3306' || !form.port)) form.port = '5432'
}

function close(): void {
  emit('close')
}

async function testConnection(): Promise<void> {
  testStatus.value = { type: 'loading', message: 'Testing connection...' }
  try {
    const successMsg = await window.dbApi.testConnection({ ...form })
    testStatus.value = { type: 'success', message: successMsg }
  } catch (e: any) {
    const msg = e.message || String(e)
    testStatus.value = { type: 'error', message: msg }
  }
}

function save(): void {
  const newConn = JSON.parse(JSON.stringify(form)) as DbConnection
  if (!newConn.name) newConn.name = `${newConn.type} @ ${newConn.host}`

  emit('save', newConn)
  close()
}
</script>

<style scoped>
/* Стили без изменений */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  width: 400px;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}
.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
}
.close-btn:hover {
  color: var(--text-primary);
}
.form-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px;
  outline: none;
  border-radius: 4px;
}
.input:focus {
  border-color: var(--focus-border);
}
.row {
  display: flex;
  gap: 10px;
}
.port {
  width: 80px;
}
.ssh-fields {
  border-left: 2px solid var(--accent-primary);
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.checkbox-label {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.save-btn {
  background: var(--accent-primary);
  color: var(--text-white);
  border: none;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.save-btn:hover {
  background: var(--accent-hover);
}
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
}
.test-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}
.test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.test-feedback {
    margin-top: 5px;
}
.feedback-msg {
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
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
.feedback-msg.loading {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
}
</style>
