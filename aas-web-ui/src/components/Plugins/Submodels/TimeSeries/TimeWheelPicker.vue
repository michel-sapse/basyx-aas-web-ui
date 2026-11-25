<template>
  <v-dialog
    aria-label="Choose time"
    max-width="320"
    :model-value="true"
    @after-enter="focusHour"
    @update:model-value="onVisibilityChange"
  >
    <v-card>
      <v-card-title>Choose time</v-card-title>
      <v-card-subtitle>{{ dateLabel }}</v-card-subtitle>

      <v-card-text>
        <div class="d-flex align-center justify-center ga-3">
          <TimeWheelColumn
            ref="hourWheel"
            v-model="hour"
            advance-on-complete
            :count="24"
            label="Hour"
            @advance="focusMinute"
            @confirm="confirmTime"
            @validity="hourValid = $event"
          />

          <span aria-hidden="true" class="text-headline-small mt-6">:</span>

          <TimeWheelColumn
            ref="minuteWheel"
            v-model="minute"
            :count="60"
            label="Minute"
            @confirm="confirmTime"
            @validity="minuteValid = $event"
          />
        </div>

        <div aria-live="polite" class="text-body-medium text-center mt-3">{{ selectedTime }}</div>
        <div class="text-caption text-medium-emphasis text-center">Local time</div>
        <div class="text-caption text-medium-emphasis text-center mt-1">Type the time and press Return, or use the wheels.</div>
        <div v-if="error" class="text-error text-body-small mt-2" role="alert">{{ error }}</div>
      </v-card-text>

      <v-card-actions>
        <v-btn @click="emit('cancel')">Cancel</v-btn>
        <v-spacer />
        <v-btn color="primary" :disabled="!hourValid || !minuteValid" variant="tonal" @click="confirmTime">Use time</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
  import { parseCalendarDate } from './timeRange'

  const props = defineProps<{ date: string, time: string, error?: string }>()
  const emit = defineEmits<{ confirm: [time: string], cancel: [] }>()

  const hour = ref(Number(props.time.split(':', 1)[0]))
  const minute = ref(Number(props.time.split(':', 2)[1]))
  const hourValid = ref(true)
  const minuteValid = ref(true)
  const hourWheel = ref<{ commitScroll: () => boolean, focusInput: () => void } | null>(null)
  const minuteWheel = ref<{ commitScroll: () => boolean, focusInput: () => void } | null>(null)
  const selectedTime = computed(() => `${String(hour.value).padStart(2, '0')}:${String(minute.value).padStart(2, '0')}`)
  const dateLabel = computed(() => {
    const date = parseCalendarDate(props.date)
    return date ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : ''
  })

  function focusHour (): void {
    hourWheel.value?.focusInput()
  }

  function focusMinute (): void {
    minuteWheel.value?.focusInput()
  }

  function confirmTime (): void {
    const validHour = hourWheel.value?.commitScroll() ?? true
    const validMinute = minuteWheel.value?.commitScroll() ?? true
    if (!validHour || !validMinute) return
    emit('confirm', selectedTime.value)
  }

  function onVisibilityChange (visible: boolean): void {
    if (!visible) emit('cancel')
  }
</script>
