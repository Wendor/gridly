<template>
  <BaseModal
    :is-open="isOpen"
    :title="isEditing ? 'Редактирование подключения' : 'Новое подключение'"
    @close="close"
  >
    <div class="form-body">
      <BaseSelect
        v-model="form.type"
        label="Тип базы"
        :options="[
          { label: 'MySQL / MariaDB', value: 'mysql' },
          { label: 'PostgreSQL', value: 'postgres' }
        ]"
        @change="onTypeChange"
      />

      <BaseInput v-model="form.name" label="Название" placeholder="Например: PROD" />

      <div class="row">
        <BaseInput v-model="form.host" label="Host" placeholder="localhost" />
        <BaseInput v-model="form.port" label="Port" placeholder="3306" class="port-input" />
      </div>

      <div class="row">
        <BaseInput v-model="form.user" label="User" placeholder="root" />
        <BaseInput v-model="form.password" type="password" label="Password" placeholder="******" />
      </div>

      <BaseInput v-model="form.database" label="База данных" placeholder="my_app_db" />

      <BaseInput
        v-model="form.excludeList"
        label="Исключить базы/схемы"
        placeholder="information_schema, sys..."
        help="Введите названия через запятую (регистронезависимо)"
      />

      <div class="ssh-toggle">
        <label class="checkbox-label">
          <input v-model="form.useSsh" type="checkbox" />
          Использовать SSH Tunnel
        </label>
      </div>

      <div v-if="form.useSsh" class="ssh-fields">
        <div class="row">
          <BaseInput v-model="form.sshHost" label="SSH Host" placeholder="1.2.3.4" />
          <BaseInput v-model="form.sshPort" label="Port" placeholder="22" class="port-input" />
        </div>
        <BaseInput v-model="form.sshUser" label="SSH User" placeholder="root" />
        <BaseInput
          v-model="form.sshPassword"
          type="password"
          label="SSH Password/Passphrase"
          placeholder="******"
        />
        <BaseInput v-model="form.sshKeyPath" label="SSH Key Path" placeholder="/path/to/key" />
      </div>

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
    </div>

    <template #footer>
      <BaseButton
        variant="secondary"
        :disabled="testStatus?.type === 'loading'"
        @click="testConnection"
      >
        Check Connection
      </BaseButton>
      <BaseButton variant="primary" :disabled="testStatus?.type === 'loading'" @click="save">
        {{ isEditing ? 'Сохранить' : 'Создать' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import type { DbConnection } from '../../../shared/types'
import BaseIcon from './ui/BaseIcon.vue'
import BaseModal from './ui/BaseModal.vue'
import BaseInput from './ui/BaseInput.vue'
import BaseButton from './ui/BaseButton.vue'
import BaseSelect from './ui/BaseSelect.vue'

const props = defineProps<{
  isOpen: boolean
  initialData?: DbConnection | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', conn: DbConnection): void
}>()

const isEditing = computed(() => !!props.initialData)

const defaultForm: DbConnection = {
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
  sshKeyPath: ''
}

const form = reactive<DbConnection>({ ...defaultForm })
const testStatus = ref<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null)

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      testStatus.value = null
      if (props.initialData) {
        Object.assign(form, { ...defaultForm, ...props.initialData })
      } else {
        Object.assign(form, defaultForm)
      }
    }
  }
)

function onTypeChange(): void {
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
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
.form-body {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.row {
  display: flex;
  gap: 15px;
}

/* BaseInput takes 100% width, so we control layout via flex parent */
.port-input {
  width: 120px;
  flex-shrink: 0;
}

.ssh-toggle {
  margin-top: 5px;
}

.ssh-fields {
  border-left: 2px solid var(--accent-primary);
  padding-left: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.test-feedback {
  margin-top: 10px;
}

.feedback-msg {
  padding: 10px;
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
</style>
