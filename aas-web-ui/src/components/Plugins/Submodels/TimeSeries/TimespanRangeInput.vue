<template>
  <v-card class="ma-0" max-width="420" variant="flat">
    <v-card-text>
      <div class="text-title-small mb-2">Timespan</div>

      <DateRangeCalendar
        :disabled="!isEditable || Boolean(pendingDate)"
        :select-on-click="false"
        :start="highlightDates[0] || ''"
        :stop="highlightDates.length > 1 ? highlightDates.at(-1)! : ''"
        @date-click="chooseDate"
        @select="clearSelection"
      >
        <template #selection>
          <template v-if="firstEndpoint && secondEndpoint">
            <div>From {{ formatTimestamp(selectedBounds!.min) }}</div>
            <div>To {{ formatTimestamp(selectedBounds!.max) }}</div>
          </template>

          <template v-else-if="firstEndpoint">
            {{ formatEndpoint(firstEndpoint) }} selected. Select the second date and time.
          </template>

          <template v-else>Select the first date and time, then the second.</template>
        </template>
      </DateRangeCalendar>

      <div class="text-caption text-medium-emphasis mt-2">Local time · {{ timezone }}</div>

      <TimeWheelPicker
        v-if="pendingDate"
        :date="pendingDate"
        :error="timeError"
        :time="firstEndpoint ? '23:59' : '00:00'"
        @cancel="cancelTime"
        @confirm="confirmTime"
      />
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { calendarDateKey } from './timeRange'
  import { type CalendarEndpoint, dateTimeTimespan, timespanHasBounds } from './timespan'

  const props = withDefaults(defineProps<{ rangeObject: any, isEditable?: boolean }>(), { isEditable: true })
  const emit = defineEmits<{ 'update-range': [bounds: { min: string, max: string }] }>()

  const firstEndpoint = ref<CalendarEndpoint | null>(null)
  const secondEndpoint = ref<CalendarEndpoint | null>(null)
  const pendingDate = ref('')
  const timeError = ref('')
  const timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  let previousSelection: { first: CalendarEndpoint | null, second: CalendarEndpoint | null, bounds: { min: string, max: string } } | null = null
  let lastEmittedKey: string | undefined

  const highlightDates = computed(() => [firstEndpoint.value?.date, secondEndpoint.value?.date, pendingDate.value].filter(Boolean).toSorted())
  const selectedBounds = computed(() => firstEndpoint.value && secondEndpoint.value ? dateTimeTimespan(firstEndpoint.value, secondEndpoint.value) : null)

  watch(
    () => [props.rangeObject?.min, props.rangeObject?.max],
    ([min, max]) => {
      if (JSON.stringify([min, max]) === lastEmittedKey) {
        return
      }
      pendingDate.value = ''
      previousSelection = null
      firstEndpoint.value = timespanHasBounds(props.rangeObject) ? endpointFromTimestamp(min) : null
      secondEndpoint.value = timespanHasBounds(props.rangeObject) ? endpointFromTimestamp(max) : null
    },
    { immediate: true },
  )

  function emitBounds (bounds: { min: string, max: string }): void {
    lastEmittedKey = JSON.stringify([bounds.min, bounds.max])
    emit('update-range', bounds)
  }

  function endpointFromTimestamp (value: string): CalendarEndpoint {
    const date = new Date(value)
    return { date: calendarDateKey(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
  }

  function formatTimestamp (value: string): string {
    return formatter.format(new Date(value))
  }

  function formatEndpoint (endpoint: CalendarEndpoint): string {
    return formatTimestamp(dateTimeTimespan(endpoint, endpoint).min)
  }

  function chooseDate (date: string): void {
    if (!props.isEditable || pendingDate.value) return
    previousSelection = {
      first: firstEndpoint.value, second: secondEndpoint.value,
      bounds: { min: props.rangeObject?.min ?? '', max: props.rangeObject?.max ?? '' },
    }
    if (firstEndpoint.value && secondEndpoint.value) {
      firstEndpoint.value = null
      secondEndpoint.value = null
    }
    pendingDate.value = date
    timeError.value = ''
    emitBounds({ min: '', max: '' })
  }

  function confirmTime (time: string): void {
    if (!props.isEditable || !pendingDate.value) return
    const endpoint = { date: pendingDate.value, time }
    try {
      dateTimeTimespan(endpoint, endpoint)
    } catch (error) {
      timeError.value = error instanceof Error ? error.message : 'Choose a valid time.'
      return
    }
    if (firstEndpoint.value) {
      secondEndpoint.value = endpoint
    } else {
      firstEndpoint.value = endpoint
    }
    pendingDate.value = ''
    previousSelection = null
    timeError.value = ''
    emitBounds(selectedBounds.value ?? { min: '', max: '' })
  }

  function cancelTime (): void {
    if (!previousSelection) return
    firstEndpoint.value = previousSelection.first
    secondEndpoint.value = previousSelection.second
    pendingDate.value = ''
    timeError.value = ''
    emitBounds(previousSelection.bounds)
    previousSelection = null
  }

  function clearSelection (): void {
    if (!props.isEditable) return
    firstEndpoint.value = null
    secondEndpoint.value = null
    pendingDate.value = ''
    previousSelection = null
    timeError.value = ''
    emitBounds({ min: '', max: '' })
  }
</script>
