<template>
  <div ref="wrapperRef" class="base-select-wrapper" :class="{ 'is-open': isOpen }">
    <label v-if="label" class="select-label">{{ label }}</label>
    <div class="select-container" :title="$t('common.select')" @click="toggle">
      <div class="base-select" :class="[`variant-${variant}`, { 'is-active': isOpen }]">
        <span class="selected-text">{{ selectedLabel }}</span>
        <div class="select-arrow">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <div v-show="isOpen" class="custom-dropdown">
        <div
          v-for="option in options"
          :key="option.value"
          class="dropdown-item"
          :class="{ selected: option.value === modelValue }"
          @click.stop="selectOption(option)"
        >
          {{ option.label }}
          <span v-if="option.value === modelValue" class="check-icon">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface SelectOption {
  label: string
  value: string | number
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: SelectOption[]
    label?: string
    variant?: 'filled' | 'outline'
  }>(),
  {
    variant: 'filled'
  }
)

const emit = defineEmits<{ (e: 'update:modelValue', val: string | number): void }>()

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const found = props.options.find((o) => o.value === props.modelValue)
  return found ? found.label : String(props.modelValue || '')
})

function toggle() {
  isOpen.value = !isOpen.value
}

function selectOption(option: SelectOption) {
  emit('update:modelValue', option.value)
  isOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.base-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  position: relative;
}

.select-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.select-container {
  position: relative;
  width: 100%;
}

.base-select {
  box-sizing: border-box; /* Fix width+padding calculation */
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 6px 30px 6px 10px;
  border-radius: 4px;
  font-family: var(--font-main);
  font-size: 13px;
  width: 100%;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  position: relative;
  user-select: none;
}

.selected-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* VARIANTS */
.variant-filled {
  background: var(--bg-input);
}

.variant-outline {
  background: transparent;
}
.variant-outline:hover,
.variant-outline.is-active {
  border-color: var(--focus-border);
  color: var(--text-white);
}

.base-select.is-active {
  border-color: var(--focus-border);
}

/* ARROW */
.select-arrow {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  display: flex;
  pointer-events: none;
  transition: transform 0.2s;
}

.is-active .select-arrow {
  transform: translateY(-50%) rotate(180deg);
}

.variant-outline:hover .select-arrow,
.variant-outline.is-active .select-arrow {
  color: var(--text-white);
}

/* DROPDOWN */
.custom-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 100%;
  /* min-width removed to strict align with trigger, or use min-width: 100% */
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  padding: 4px;
  box-sizing: border-box;
}

.dropdown-item {
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dropdown-item:hover {
  background: var(--list-hover-bg);
  color: var(--text-white);
}

.dropdown-item.selected {
  background: var(--list-active-bg);
  color: var(--text-white);
}

.check-icon {
  margin-left: 8px;
  display: flex;
  align-items: center;
  color: var(--accent-primary);
}

/* Scrollbar styles for the dropdown */
.custom-dropdown::-webkit-scrollbar {
  width: 8px;
}
.custom-dropdown::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}
.custom-dropdown::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
</style>
