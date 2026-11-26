<template>
  <div class="range-form">
    <aside class="range-sidebar">
      <div class="range-sidebar-heading">QUICK RANGES</div>

      <v-btn
        v-for="item in QUICK_RANGES"
        :key="item"
        :aria-pressed="preset === item"
        block
        class="range-preset"
        :class="{ selected: preset === item }"
        :disabled="disabled"
        :elevation="0"
        height="44"
        rounded="sm"
        type="button"
        variant="text"
        @click="emit('preset', item)"
      >
        {{ item }}
        <v-icon v-if="preset === item" icon="mdi-check" size="18" />
      </v-btn>

      <div class="range-timezone">
        <label>Time zone · Fixed offset</label>

        <v-select
          aria-label="Time zone fixed offset"
          bg-color="surface"
          class="font-weight-medium"
          density="compact"
          :disabled="disabled"
          hide-details
          :items="offsets"
          :model-value="offset"
          variant="outlined"
          @update:model-value="emit('offset', Number($event))"
        />

      </div>
    </aside>

    <div class="range-main">
      <div class="range-date-fields">
        <template v-for="endpoint in endpoints" :key="endpoint">
          <label class="range-date-field" :class="{ active: activeEndpoint === endpoint }">
            <span>{{ endpoint === 'start' ? 'Start date' : 'End date' }}</span>

            <input
              :aria-describedby="dateError(endpoint) ? errorId + endpoint : undefined"
              :aria-invalid="Boolean(dateError(endpoint))"
              :aria-label="endpoint === 'start' ? 'Start date' : 'End date'"
              :disabled="disabled"
              :placeholder="endpoint === 'start' ? 'Start date' : 'End date'"
              type="text"
              :value="formatRangeDate(point(endpoint).date)"
              @focus="activate(endpoint, $event)"
              @input="updateDate(endpoint, $event)"
              @keydown.enter.prevent.stop="emit('confirm')"
              @keydown.esc.prevent.stop="emit('cancel')"
            >

            <div v-if="dateError(endpoint)" :id="errorId + endpoint" class="text-error text-body-small mt-1" role="alert">{{ dateError(endpoint) }}</div>
          </label>

          <span v-if="endpoint === 'start'" aria-hidden="true" class="range-date-arrow">→</span>
        </template>
      </div>

      <DateRangeCalendar
        :default-date="currentDate"
        design
        :disabled="disabled"
        hide-clear
        hide-summary
        :select-on-click="false"
        :start="calendarDates[0] || ''"
        :stop="calendarDates.length > 1 ? calendarDates[1]! : ''"
        @date-click="emit('date', $event)"
      />

      <v-divider class="my-3" />

      <div class="range-time-rows">
        <RangeTimeRow
          ref="startRow"
          :disabled="disabled"
          :error="timeError('start')"
          :hour-format="hourFormat"
          label="Start time"
          :point="start"
          @cancel="emit('cancel')"
          @confirm="emit('confirm')"
          @part-change="(field: keyof TimePoint, value: string) => emit('point-change', 'start', field, value)"
        />

        <RangeTimeRow
          ref="endRow"
          :disabled="disabled"
          :error="timeError('end')"
          :hour-format="hourFormat"
          label="End time"
          :point="end"
          @cancel="emit('cancel')"
          @confirm="emit('confirm')"
          @part-change="(field: keyof TimePoint, value: string) => emit('point-change', 'end', field, value)"
        />
      </div>

      <div v-if="error && !dateError('start') && !dateError('end') && !timeError('start') && !timeError('end')" class="text-error text-body-small mt-2" role="alert">{{ error }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { formatRangeDate, type HourFormat, offsetLabel, parseDateInput, pointError, pointFromUtc, QUICK_RANGES, type QuickRange, type TimePoint } from './fixedOffsetRange'

  const props = defineProps<{ start: TimePoint, end: TimePoint, offset: number, hourFormat: HourFormat, preset: QuickRange, activeEndpoint: 'start' | 'end', disabled?: boolean, error?: string }>()
  const emit = defineEmits<{
    'point-change': [endpoint: 'start' | 'end', field: keyof TimePoint, value: string]
    'activate': [endpoint: 'start' | 'end']
    'date': [date: string]
    'preset': [preset: QuickRange]
    'offset': [offset: number]
    'confirm': []
    'cancel': []
  }>()

  const startRow = ref<{ focusHour: () => void } | null>(null)
  const endRow = ref<{ focusHour: () => void } | null>(null)
  const errorId = useId()
  const today = new Date().toISOString()
  const currentDate = computed(() => pointFromUtc(today, props.offset).date)
  const endpoints = ['start', 'end'] as const
  const offsets = Array.from({ length: 105 }, (_, index) => ({ title: offsetLabel(-720 + index * 15), value: -720 + index * 15 }))
  const calendarDates = computed(() => [parseDateInput(props.start.date), parseDateInput(props.end.date)].filter(Boolean).toSorted())

  defineExpose({ focusHour: (endpoint: 'start' | 'end') => (endpoint === 'start' ? startRow : endRow).value?.focusHour() })

  function point (endpoint: 'start' | 'end'): TimePoint {
    return endpoint === 'start' ? props.start : props.end
  }

  function dateError (endpoint: 'start' | 'end'): string | undefined {
    return props.error && !parseDateInput(point(endpoint).date) ? pointError(point(endpoint), props.hourFormat) || undefined : undefined
  }

  function timeError (endpoint: 'start' | 'end'): string | undefined {
    return props.error && parseDateInput(point(endpoint).date) ? pointError(point(endpoint), props.hourFormat) || undefined : undefined
  }

  function activate (endpoint: 'start' | 'end', event: FocusEvent): void {
    emit('activate', endpoint)
    ;(event.target as HTMLInputElement).select()
  }

  function updateDate (endpoint: 'start' | 'end', event: Event): void {
    const value = (event.target as HTMLInputElement).value
    emit('point-change', endpoint, 'date', parseDateInput(value) || value)
  }
</script>

<style scoped>
.range-form { display: grid; grid-template-columns: 29.5% minmax(0, 1fr); }
.range-sidebar { display: flex; flex-direction: column; padding: 22px 12px 16px; background: rgba(var(--v-theme-on-surface), 0.035); border-right: 1px solid var(--range-border); }
.range-sidebar-heading { font-size: 12px; font-weight: 700; color: rgba(var(--v-theme-on-surface), 0.62); padding: 0 12px 15px; }
.range-preset { justify-content: flex-start; text-align: left; padding: 0 12px; color: rgb(var(--v-theme-on-surface)); font-size: 16px; font-weight: 400; letter-spacing: normal; box-shadow: none; }
.range-preset :deep(.v-btn__content) { display: flex; width: 100%; justify-content: space-between; align-items: center; }
.range-preset:hover { background: rgba(var(--v-theme-on-surface), 0.035); }
.range-preset.selected { background: var(--range-soft, var(--range-tint)); color: var(--range-accent); font-weight: 600; }
.range-timezone { margin-top: auto; padding: 22px 12px 0; }
.range-timezone label { display: block; margin-bottom: 7px; font-size: 12px; font-weight: 500; color: rgba(var(--v-theme-on-surface), 0.62); }
.range-main { padding: 20px 26px 12px; min-width: 0; }
.range-date-fields { display: grid; grid-template-columns: 1fr 24px 1fr; align-items: end; margin-bottom: 20px; }
.range-date-field { min-width: 0; }
.range-date-field span { display: block; margin-bottom: 6px; color: rgba(var(--v-theme-on-surface), 0.62); font-size: 13px; }
.range-date-field input { border: 1px solid var(--range-border); border-radius: 4px; width: 100%; height: 44px; padding: 0 12px; outline: none; font: inherit; font-size: 15px; font-weight: 600; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); }
.range-date-field.active input { border-color: var(--range-accent); box-shadow: inset 0 0 0 1px var(--range-accent); }
.range-date-arrow { text-align: center; padding-bottom: 12px; color: rgba(var(--v-theme-on-surface), 0.5); }
.range-time-rows { display: grid; gap: 6px; }
@media (max-width: 600px) {
  .range-form { grid-template-columns: 1fr; }
  .range-sidebar { border-right: 0; border-bottom: 1px solid var(--range-border); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .range-sidebar-heading, .range-timezone { grid-column: 1 / -1; }
  .range-timezone { padding-top: 12px; }
  .range-main { padding: 16px; }
}
</style>
