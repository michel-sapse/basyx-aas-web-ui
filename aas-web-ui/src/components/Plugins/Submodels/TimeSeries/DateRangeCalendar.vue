<template>
  <div class="date-range-calendar" :class="{ 'calendar-figma': design, 'calendar-connected': start && stop && start !== stop }">
    <div class="d-flex align-center justify-space-between mb-2">
      <v-btn
        aria-label="Previous month"
        :disabled="disabled"
        icon="mdi-chevron-left"
        size="small"
        variant="text"
        @click="changeMonth(-1)"
      />

      <span aria-live="polite" class="text-body-medium">{{ monthLabel }}</span>

      <v-btn
        aria-label="Next month"
        :disabled="disabled"
        icon="mdi-chevron-right"
        size="small"
        variant="text"
        @click="changeMonth(1)"
      />
    </div>

    <div :aria-label="monthLabel" class="calendar-grid" role="grid">
      <div class="calendar-week" role="row">
        <span v-for="weekday in weekdays" :key="weekday" class="text-caption text-center" role="columnheader">{{ weekday }}</span>
      </div>

      <div v-for="(week, index) in weeks" :key="index" class="calendar-week" role="row">
        <div
          v-for="day in week"
          :key="day.key"
          :aria-selected="isSelected(day.key)"
          class="calendar-cell"
          :class="{ 'calendar-between': isBetween(day.key), 'calendar-endpoint': isEndpoint(day.key), 'calendar-start': day.key === start, 'calendar-end': day.key === stop }"
          role="gridcell"
        >
          <v-btn
            :aria-label="day.label"
            :block="!design"
            class="calendar-day"
            :class="{ 'text-medium-emphasis': !day.currentMonth && !isEndpoint(day.key), 'calendar-marker': design && isEndpoint(day.key) }"
            :data-date="day.key"
            :disabled="disabled"
            min-width="0"
            rounded="0"
            size="small"
            :tabindex="day.key === focusedDate ? 0 : -1"
            :variant="design && isEndpoint(day.key) ? 'flat' : 'text'"
            @click="selectDate(day.key)"
            @keydown="moveFocus($event, day.key)"
          >{{ day.date.getDate() }}</v-btn>
        </div>
      </div>
    </div>

    <div v-if="!hideSummary" aria-live="polite" class="text-body-small mt-3" role="status">
      <slot name="selection">
        <template v-if="start && stop">{{ rangeLabel }} · Both days included</template>
        <template v-else-if="start">{{ formatDate(start) }} selected. Select a second date.</template>
        <template v-else>Select the first date, then the second date.</template>
      </slot>
    </div>

    <v-btn
      v-if="!hideClear"
      class="mt-2"
      :disabled="disabled"
      size="small"
      variant="text"
      @click="emit('select', '', '')"
    >Clear dates</v-btn>
  </div>
</template>

<script lang="ts" setup>
  import { calendarDateKey, parseCalendarDate } from './timeRange'

  const props = withDefaults(defineProps<{ start: string, stop: string, defaultDate?: string, disabled?: boolean, selectOnClick?: boolean, design?: boolean, hideSummary?: boolean, hideClear?: boolean }>(), { selectOnClick: true })
  const emit = defineEmits<{ 'select': [start: string, stop: string], 'date-click': [date: string] }>()

  const initialDate = parseCalendarDate(props.start) || parseCalendarDate(props.defaultDate || '') || new Date()
  const displayedMonth = ref(monthOf(initialDate))
  const focusedDate = ref(calendarDateKey(initialDate))
  const weekdays = computed(() => props.design ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  const formatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  const monthLabel = computed(() => new Intl.DateTimeFormat(props.design ? 'en-US' : undefined, { month: 'long', year: 'numeric' }).format(displayedMonth.value))
  const rangeLabel = computed(() => `${formatDate(props.start)} – ${formatDate(props.stop)}`)
  const weeks = computed(() => {
    const first = new Date(displayedMonth.value)
    first.setDate(1 - (first.getDay() + 6) % 7)
    return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(first)
      date.setDate(first.getDate() + week * 7 + weekday)
      return { date, key: calendarDateKey(date), label: formatter.format(date), currentMonth: date.getMonth() === displayedMonth.value.getMonth() }
    }))
  })

  watch(() => [props.start, props.stop, props.defaultDate], (values, previous) => {
    const changed = values[0] === previous[0] ? values[1] : values[0]
    const date = parseCalendarDate(changed || '') || parseCalendarDate(props.defaultDate || '') || new Date()
    if (!date) return
    displayedMonth.value = monthOf(date)
    focusedDate.value = calendarDateKey(date)
  })

  function monthOf (date: Date): Date {
    const month = new Date(date)
    month.setDate(1)
    return month
  }

  function formatDate (key: string): string {
    const date = parseCalendarDate(key)
    return date ? formatter.format(date) : ''
  }

  function isEndpoint (key: string): boolean {
    return key === props.start || key === props.stop
  }

  function isBetween (key: string): boolean {
    return Boolean(props.start && props.stop && key > props.start && key < props.stop)
  }

  function isSelected (key: string): boolean {
    return isEndpoint(key) || isBetween(key)
  }

  function selectDate (key: string): void {
    if (props.disabled) return
    focusedDate.value = key
    emit('date-click', key)
    if (!props.selectOnClick) return
    if (!props.start || props.stop) {
      emit('select', key, '')
    } else {
      const [start, stop] = [props.start, key].toSorted()
      emit('select', start!, stop!)
    }
  }

  function changeMonth (offset: number): void {
    const date = new Date(displayedMonth.value)
    date.setMonth(date.getMonth() + offset)
    displayedMonth.value = date
    focusedDate.value = calendarDateKey(date)
  }

  async function moveFocus (event: KeyboardEvent, key: string): Promise<void> {
    if (props.disabled) return
    const grid = (event.target as HTMLElement).closest('[role="grid"]')
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const date = parseCalendarDate(key)!
    if (event.key in offsets) {
      date.setDate(date.getDate() + offsets[event.key]!)
    } else if (event.key === 'Home' || event.key === 'End') {
      const weekday = (date.getDay() + 6) % 7
      date.setDate(date.getDate() + (event.key === 'Home' ? -weekday : 6 - weekday))
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      date.setDate(1)
      date.setMonth(date.getMonth() + (event.key === 'PageUp' ? -1 : 1))
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    focusedDate.value = calendarDateKey(date)
    displayedMonth.value = monthOf(date)
    await nextTick()
    Array.from(grid?.querySelectorAll<HTMLElement>('[data-date]') ?? [])
      .find(button => button.dataset.date === focusedDate.value)
      ?.focus()
  }
</script>

<style scoped>
.calendar-week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-between {
  background-color: rgba(var(--v-theme-primary), 0.12);
}

.calendar-endpoint {
  background-color: rgba(var(--v-theme-primary), 0.28);
  border-radius: 8px;
}

.date-range-calendar {
  width: 100%;
  min-width: 0;
}

.calendar-figma .calendar-cell { position: relative; display: flex; align-items: center; justify-content: center; height: 38px; }
.calendar-figma .calendar-day { width: 36px; min-width: 36px !important; height: 36px; border-radius: 50% !important; z-index: 1; }
.calendar-figma .calendar-marker { color: rgb(var(--v-theme-on-primary)); background-color: var(--range-endpoint, var(--range-accent, rgb(var(--v-theme-primary)))); }
.calendar-figma .calendar-endpoint, .calendar-figma .calendar-between { background: transparent; border-radius: 0; }
.calendar-figma.calendar-connected .calendar-between::before,
.calendar-figma.calendar-connected .calendar-start::before,
.calendar-figma.calendar-connected .calendar-end::before { content: ''; position: absolute; inset: 1px 0; background: var(--range-tint, rgba(var(--v-theme-primary), 0.12)); }
.calendar-figma.calendar-connected .calendar-start::before { left: 50%; }
.calendar-figma.calendar-connected .calendar-end::before { right: 50%; }
.calendar-figma :deep(.v-btn--icon) { color: var(--range-accent, rgb(var(--v-theme-primary))); }
.calendar-figma .calendar-week:first-child { margin-bottom: 8px; color: rgba(var(--v-theme-on-surface), 0.55); }
.calendar-figma .text-body-medium { font-weight: 700; }
</style>
