<template>
  <div class="read-records-range">
    <div class="range-summary-label">Time range</div>

    <div v-if="appliedValid" class="range-summary-line">
      <div aria-live="polite" class="range-summary-value" role="status">
        {{ formatRangeTimestamp(startValue, appliedOffset) }}<span class="range-summary-arrow">{{ ' → ' }}</span>{{ formatRangeTimestamp(endValue, appliedOffset) }}
      </div>

      <span class="range-summary-offset">{{ offsetLabel(appliedOffset) }}</span>
      <span class="range-summary-badge">{{ rangeDuration(Date.parse(endValue) - Date.parse(startValue)) }} · {{ appliedPreset }}</span>
    </div>

    <v-card
      aria-label="Select range"
      class="read-records-picker"
      role="region"
      variant="flat"
      @keydown.esc.prevent="cancel"
    >
      <div class="range-picker-header">
        <div class="range-picker-title">Select range</div>
        <div class="range-picker-subtitle">Choose a start and end time for your time-series query.</div>
      </div>

      <ReadRecordsRangeForm
        ref="form"
        :active-endpoint="activeEndpoint"
        :disabled="disabled"
        :end="draftEnd"
        :error="touched ? draftError || undefined : undefined"
        :offset="draftOffset"
        :preset="draftPreset"
        :start="draftStart"
        @activate="activateEndpoint"
        @cancel="cancel"
        @confirm="apply"
        @date="selectDate"
        @offset="changeOffset"
        @point-change="updatePoint"
        @preset="selectPreset"
      />

      <div class="range-picker-footer">
        <v-btn color="var(--range-accent)" :disabled="disabled" variant="text" @click="clearDraft">Clear range</v-btn>
        <span aria-live="polite" class="range-footer-summary">{{ draftSummary }}</span>
        <v-btn class="range-cancel" :disabled="disabled" variant="outlined" @click="cancel">Cancel</v-btn>

        <v-btn
          class="text-white range-apply"
          color="var(--range-endpoint)"
          :disabled="disabled || !draftRange"
          variant="flat"
          @click="apply"
        >Apply range</v-btn>
      </div>
    </v-card>
  </div>
</template>

<script lang="ts" setup>
  import {
    emptyTimePoint, formatRangeDate, formatRangeTimestamp,
    normalizeRecordRange, offsetLabel, pointError, pointFromUtc, pointToUtc, type QuickRange,
    quickRecordRange, rangeDuration, type RecordRange, recordRangeValid, type TimePoint, validOffset,
  } from './fixedOffsetRange'

  const props = withDefaults(defineProps<{ startValue: string, endValue: string, disabled?: boolean, initialOffset?: number }>(), { disabled: false })
  const emit = defineEmits<{ 'update-range': [range: RecordRange], 'editing': [editing: boolean] }>()

  const browserOffset = props.initialOffset ?? -new Date().getTimezoneOffset()
  const appliedOffset = ref(validOffset(browserOffset) ? browserOffset : 0)
  const draftOffset = ref(appliedOffset.value)
  const appliedPreset = ref<QuickRange>('Custom range')
  const draftPreset = ref<QuickRange>('Custom range')
  const editing = ref(false)
  const touched = ref(false)
  const draftStart = ref<TimePoint>(emptyTimePoint())
  const draftEnd = ref<TimePoint>(emptyTimePoint(true))
  const activeEndpoint = ref<'start' | 'end'>('end')
  const form = ref<{ focusHour: (endpoint: 'start' | 'end') => void } | null>(null)
  let explicitEndpoint = false
  let lastAppliedKey = ''

  const appliedValid = computed(() => recordRangeValid(props.startValue, props.endValue))
  const draftError = computed(() => {
    const startError = pointError(draftStart.value)
    const endError = pointError(draftEnd.value)
    if (startError) return `Start: ${startError}`
    if (endError) return `End: ${endError}`
    if (!validOffset(draftOffset.value)) return 'Select a valid fixed offset.'
    try {
      pointToUtc(draftStart.value, draftOffset.value)
      pointToUtc(draftEnd.value, draftOffset.value)
    } catch {
      return 'The UTC timestamps must fall within years 0001–9999.'
    }
    return null
  })
  const draftRange = computed<RecordRange | null>(() => {
    if (draftError.value) return null
    const range = normalizeRecordRange(pointToUtc(draftStart.value, draftOffset.value), pointToUtc(draftEnd.value, draftOffset.value))
    return recordRangeValid(range.start, range.end) ? range : null
  })
  const draftSummary = computed(() => {
    if (!draftRange.value) return 'Select a start and end'
    const start = pointFromUtc(draftRange.value.start, draftOffset.value).date
    const end = pointFromUtc(draftRange.value.end, draftOffset.value).date
    return `${formatRangeDate(start, start.slice(0, 4) !== end.slice(0, 4))} – ${formatRangeDate(end)} · ${rangeDuration(Date.parse(draftRange.value.end) - Date.parse(draftRange.value.start))}`
  })

  watch(editing, value => emit('editing', value), { immediate: true })
  watch(() => [props.startValue, props.endValue], values => {
    if (JSON.stringify(values) !== lastAppliedKey) appliedPreset.value = 'Custom range'
    loadDraft()
  }, { immediate: true })
  watch(() => props.disabled, value => {
    if (value) loadDraft()
  })
  onBeforeUnmount(() => emit('editing', false))

  function loadDraft (): void {
    draftOffset.value = appliedOffset.value
    draftPreset.value = appliedPreset.value
    touched.value = false
    editing.value = false
    explicitEndpoint = false
    // Repository arguments are only an applied range when both bounds are valid.
    // A stale partial input must not pull the initial calendar into an old year.
    draftStart.value = appliedValid.value ? pointFromUtc(props.startValue, appliedOffset.value) : emptyTimePoint()
    draftEnd.value = appliedValid.value ? pointFromUtc(props.endValue, appliedOffset.value) : emptyTimePoint(true)
    activeEndpoint.value = draftStart.value.date ? 'end' : 'start'
  }

  function updatePoint (endpoint: 'start' | 'end', point: TimePoint): void {
    if (props.disabled) return
    if (endpoint === 'start') draftStart.value = point
    else draftEnd.value = point
    draftPreset.value = 'Custom range'
    editing.value = true
    touched.value = true
  }

  function activateEndpoint (endpoint: 'start' | 'end'): void {
    activeEndpoint.value = endpoint
    explicitEndpoint = true
  }

  function normalizeDraft (): 'start' | 'end' {
    let edited = activeEndpoint.value
    if (!draftError.value && Date.parse(pointToUtc(draftStart.value, draftOffset.value)) > Date.parse(pointToUtc(draftEnd.value, draftOffset.value))) {
      [draftStart.value, draftEnd.value] = [draftEnd.value, draftStart.value]
      edited = edited === 'start' ? 'end' : 'start'
    }
    return edited
  }

  async function selectDate (date: string): Promise<void> {
    if (props.disabled) return
    if (draftStart.value.date && draftEnd.value.date && !explicitEndpoint) {
      draftStart.value = emptyTimePoint()
      draftEnd.value = emptyTimePoint(true)
      activeEndpoint.value = 'start'
    }
    const endpoint = activeEndpoint.value
    updatePoint(endpoint, { ...(endpoint === 'start' ? draftStart.value : draftEnd.value), date })
    const edited = normalizeDraft()
    activeEndpoint.value = endpoint === 'start' ? 'end' : edited
    explicitEndpoint = false
    await nextTick()
    form.value?.focusHour(edited)
  }

  function selectPreset (preset: QuickRange): void {
    if (props.disabled) return
    draftPreset.value = preset
    editing.value = true
    const range = quickRecordRange(preset, draftOffset.value)
    if (range) {
      draftStart.value = pointFromUtc(range.start, draftOffset.value)
      draftEnd.value = pointFromUtc(range.end, draftOffset.value)
    }
    touched.value = false
    explicitEndpoint = false
  }

  function changeOffset (offset: number): void {
    if (props.disabled || !validOffset(offset)) return
    editing.value = true
    const start = validInstant(draftStart.value)
    const end = validInstant(draftEnd.value)
    draftOffset.value = offset
    if (['Today', 'Yesterday', 'This month', 'Last month'].includes(draftPreset.value)) {
      selectPreset(draftPreset.value)
    } else {
      if (start) draftStart.value = pointFromUtc(start, offset)
      if (end) draftEnd.value = pointFromUtc(end, offset)
    }
  }

  function validInstant (point: TimePoint): string | null {
    try {
      return pointToUtc(point, draftOffset.value)
    } catch {
      return null
    }
  }

  function apply (): void {
    touched.value = true
    if (props.disabled || !draftRange.value) return
    const range = draftRange.value
    appliedOffset.value = draftOffset.value
    appliedPreset.value = draftPreset.value
    lastAppliedKey = JSON.stringify([range.start, range.end])
    emit('update-range', range)
    draftStart.value = pointFromUtc(range.start, appliedOffset.value)
    draftEnd.value = pointFromUtc(range.end, appliedOffset.value)
    editing.value = false
    touched.value = false
    explicitEndpoint = false
    activeEndpoint.value = 'end'
  }

  function cancel (): void {
    loadDraft()
  }

  function clearDraft (): void {
    if (props.disabled) return
    editing.value = true
    draftStart.value = emptyTimePoint()
    draftEnd.value = emptyTimePoint(true)
    draftPreset.value = 'Custom range'
    activeEndpoint.value = 'start'
    explicitEndpoint = false
    touched.value = false
  }
</script>

<style scoped>
.read-records-range { --range-accent: #007f9b; --range-endpoint: #007f9b; --range-tint: rgba(0, 160, 205, 0.10); --range-border: rgba(var(--v-theme-on-surface), 0.16); border: 1px solid var(--range-border); border-radius: 4px; background: rgb(var(--v-theme-surface)); padding: 14px 18px; margin-bottom: 16px; }
.range-summary-label { font-size: 14px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.62); margin-bottom: 7px; }
.range-summary-line { display: flex; align-items: center; flex-wrap: wrap; gap: 18px; margin-bottom: 12px; }
.range-summary-value { flex: 1 1 350px; min-width: 0; font-size: 15px; }
.range-summary-arrow { display: inline-block; padding: 0 10px; vertical-align: middle; }
.range-summary-offset { font-size: 14px; color: rgba(var(--v-theme-on-surface), 0.62); white-space: nowrap; }
.range-summary-badge { background: var(--range-tint); color: var(--range-accent); font-size: 14px; font-weight: 600; padding: 7px 14px; border-radius: 4px; white-space: nowrap; }
.read-records-picker { border: 1px solid var(--range-border); border-radius: 6px; width: 100%; max-width: 760px; }
.range-picker-header { padding: 22px 26px 18px; border-bottom: 1px solid var(--range-border); }
.range-picker-title { font-size: 24px; line-height: 1.4; font-weight: 700; }
.range-picker-subtitle { margin-top: 4px; font-size: 15px; color: rgba(var(--v-theme-on-surface), 0.62); }
.range-picker-footer { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-top: 1px solid var(--range-border); }
.range-picker-footer :deep(.v-btn) { text-transform: none; letter-spacing: normal; border-radius: 4px; }
.range-footer-summary { flex: 1; min-width: 0; font-size: 13px; color: rgba(var(--v-theme-on-surface), 0.62); }
.range-cancel { border-color: var(--range-border); min-width: 94px; }
.range-apply { min-width: 142px; }
:global(.v-theme--dark) .read-records-range { --range-accent: #4bd1e6; --range-tint: rgba(75, 209, 230, 0.16); }
@media (max-width: 600px) {
  .read-records-range { padding: 12px; }
  .range-summary-value { flex-basis: 100%; font-size: 13px; }
  .range-picker-header { padding: 16px; }
  .range-picker-title { font-size: 21px; }
  .range-picker-footer { padding: 12px; gap: 6px; flex-wrap: wrap; }
  .range-footer-summary { flex-basis: calc(100% - 140px); }
}
</style>
