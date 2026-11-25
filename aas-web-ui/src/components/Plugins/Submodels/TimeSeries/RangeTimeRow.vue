<template>
  <div class="range-time-row">
    <span class="range-time-label">{{ label }}</span>

    <div class="range-time-parts">
      <template v-for="(part, index) in parts" :key="part.key">
        <RangeTimeControl
          :ref="setControl(index)"
          :description-id="error ? errorId : undefined"
          :digits="part.digits"
          :disabled="disabled"
          :label="`${prefix} ${part.label}`"
          :max="part.max"
          :min="part.min"
          :model-value="point[part.key]"
          :numeric="part.key !== 'period'"
          @advance="controls[index + 1]?.focus()"
          @cancel="emit('cancel')"
          @confirm="emit('confirm')"
          @update:model-value="emit('part-change', part.key, $event)"
        />

        <span v-if="index < 3" aria-hidden="true" class="range-time-separator">{{ index === 2 ? '.' : ':' }}</span>
      </template>
    </div>

    <div v-if="error" :id="errorId" class="range-time-error text-error text-body-small" role="alert">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
  import type { TimePoint } from './fixedOffsetRange'

  const props = defineProps<{ point: TimePoint, label: string, disabled?: boolean, error?: string }>()
  const emit = defineEmits<{ 'part-change': [field: keyof TimePoint, value: string], 'confirm': [], 'cancel': [] }>()
  const controls = ref<Array<{ focus: () => void } | null>>([])
  const errorId = useId()
  const prefix = computed(() => props.label.startsWith('Start') ? 'Start' : 'End')
  const parts = [
    { key: 'hour', label: 'hour', min: 1, max: 12, digits: 2 },
    { key: 'minute', label: 'minute', min: 0, max: 59, digits: 2 },
    { key: 'second', label: 'second', min: 0, max: 59, digits: 2 },
    { key: 'millisecond', label: 'milliseconds', min: 0, max: 999, digits: 3 },
    { key: 'period', label: 'AM/PM', min: 0, max: 1, digits: 2 },
  ] as const

  defineExpose({ focusHour: () => controls.value[0]?.focus() })

  function setControl (index: number) {
    return (instance: unknown) => {
      controls.value[index] = instance as { focus: () => void } | null
    }
  }
</script>

<style scoped>
.range-time-row { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 6px; align-items: center; }
.range-time-label { color: rgba(var(--v-theme-on-surface), 0.62); font-size: 14px; }
.range-time-error { grid-column: 1 / -1; }
.range-time-parts { display: grid; grid-template-columns: 1fr 7px 1fr 7px 1fr 7px 1.2fr 1.2fr; align-items: center; gap: 4px; }
.range-time-separator { text-align: center; color: rgba(var(--v-theme-on-surface), 0.62); }
@media (max-width: 600px) { .range-time-row { grid-template-columns: 1fr; gap: 4px; } }
</style>
