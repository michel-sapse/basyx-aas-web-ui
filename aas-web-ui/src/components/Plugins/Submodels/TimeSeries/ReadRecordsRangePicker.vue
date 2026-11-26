<template>
  <div class="read-records-range">
    <div class="range-summary-label">Time range</div>

    <div v-if="appliedValid" class="range-summary-line">
      <div aria-live="polite" class="range-summary-value" role="status">
        {{ formatRangeTimestamp(startValue, appliedOffset, hourFormat) }}<span class="range-summary-arrow">{{ ' → ' }}</span>{{ formatRangeTimestamp(endValue, appliedOffset, hourFormat) }}
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
        :hour-format="hourFormat"
        :offset="draftOffset"
        :preset="draftPreset"
        :start="draftStart"
        @activate="activateEndpoint"
        @cancel="cancel"
        @confirm="apply"
        @date="selectDate"
        @offset="changeOffset"
        @point-change="updatePart"
        @preset="selectPreset"
      />

      <div class="range-picker-footer">
        <v-btn
          class="range-clear"
          color="primary"
          :disabled="disabled"
          :elevation="0"
          height="40"
          rounded="sm"
          variant="text"
          @click="clearDraft"
        >Clear range</v-btn>

        <span aria-live="polite" class="range-footer-summary">{{ draftSummary }}</span>

        <v-btn
          class="range-cancel"
          :disabled="disabled"
          :elevation="0"
          height="40"
          rounded="sm"
          variant="outlined"
          @click="cancel"
        >Cancel</v-btn>

        <v-btn
          class="range-apply"
          color="primary"
          :disabled="disabled || !draftRange"
          :elevation="0"
          height="40"
          rounded="sm"
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

  const hourFormat = '24'
  const browserOffset = props.initialOffset ?? -new Date().getTimezoneOffset()
  const appliedOffset = ref(validOffset(browserOffset) ? browserOffset : 0)
  const draftOffset = ref(appliedOffset.value)
  const appliedPreset = ref<QuickRange>('Custom range')
  const draftPreset = ref<QuickRange>('Custom range')
  const editing = ref(false)
  const touched = ref(false)
  const draftStart = ref<TimePoint>(emptyTimePoint(false, hourFormat))
  const draftEnd = ref<TimePoint>(emptyTimePoint(true, hourFormat))
  const activeEndpoint = ref<'start' | 'end'>('end')
  const form = ref<{ focusHour: (endpoint: 'start' | 'end') => void } | null>(null)
  let explicitEndpoint = false
  let lastAppliedKey = ''
  let cancelSnapshot: { range: RecordRange, offset: number, preset: QuickRange } | null = null

  const appliedValid = computed(() => recordRangeValid(props.startValue, props.endValue))
  const draftError = computed(() => {
    const startError = pointError(draftStart.value, hourFormat)
    const endError = pointError(draftEnd.value, hourFormat)
    if (startError) return `Start: ${startError}`
    if (endError) return `End: ${endError}`
    if (!validOffset(draftOffset.value)) return 'Select a valid fixed offset.'
    try {
      pointToUtc(draftStart.value, draftOffset.value, hourFormat)
      pointToUtc(draftEnd.value, draftOffset.value, hourFormat)
    } catch {
      return 'The UTC timestamps must fall within years 0001–9999.'
    }
    return null
  })
  const draftRange = computed<RecordRange | null>(() => {
    if (draftError.value) return null
    const range = normalizeRecordRange(pointToUtc(draftStart.value, draftOffset.value, hourFormat), pointToUtc(draftEnd.value, draftOffset.value, hourFormat))
    return recordRangeValid(range.start, range.end) ? range : null
  })
  const draftSummary = computed(() => {
    if (!draftRange.value) return 'Select a start and end'
    const start = pointFromUtc(draftRange.value.start, draftOffset.value, hourFormat).date
    const end = pointFromUtc(draftRange.value.end, draftOffset.value, hourFormat).date
    return `${formatRangeDate(start, start.slice(0, 4) !== end.slice(0, 4))} – ${formatRangeDate(end)} · ${rangeDuration(Date.parse(draftRange.value.end) - Date.parse(draftRange.value.start))}`
  })

  watch(() => editing.value && !draftRange.value, value => emit('editing', value), { immediate: true })
  watch([draftRange, draftOffset, draftPreset], () => {
    if (editing.value && draftRange.value && !props.disabled) saveRange(draftRange.value)
  })
  watch(() => [props.startValue, props.endValue], values => {
    // Keep raw typed values, date-click order and focus when the parent echoes an
    // auto-saved range. Only an external change replaces the editable selection.
    if (JSON.stringify(values) === lastAppliedKey) return
    appliedPreset.value = 'Custom range'
    cancelSnapshot = null
    loadDraft()
  }, { immediate: true })
  watch(() => props.disabled, value => {
    if (value) {
      cancelSnapshot = null
      loadDraft()
    }
  })
  onBeforeUnmount(() => emit('editing', false))

  function loadDraft (range?: RecordRange): void {
    const savedRange = range ?? { start: props.startValue, end: props.endValue }
    const hasRange = recordRangeValid(savedRange.start, savedRange.end)
    draftOffset.value = appliedOffset.value
    draftPreset.value = appliedPreset.value
    touched.value = false
    editing.value = false
    explicitEndpoint = false
    // Repository arguments are only an applied range when both bounds are valid.
    // A stale partial input must not pull the initial calendar into an old year.
    draftStart.value = hasRange ? pointFromUtc(savedRange.start, appliedOffset.value, hourFormat) : emptyTimePoint(false, hourFormat)
    draftEnd.value = hasRange ? pointFromUtc(savedRange.end, appliedOffset.value, hourFormat) : emptyTimePoint(true, hourFormat)
    activeEndpoint.value = draftStart.value.date ? 'end' : 'start'
  }

  function beginEdit (): void {
    cancelSnapshot ??= { range: { start: props.startValue, end: props.endValue }, offset: appliedOffset.value, preset: appliedPreset.value }
    editing.value = true
  }

  function updatePart (endpoint: 'start' | 'end', field: keyof TimePoint, value: string): void {
    // Merge at the owner so a blur/auto-advance cannot replace a newer component
    // with an old copy of the entire timestamp from a child render.
    const point = endpoint === 'start' ? draftStart.value : draftEnd.value
    updatePoint(endpoint, { ...point, [field]: value })
  }

  function updatePoint (endpoint: 'start' | 'end', point: TimePoint): void {
    if (props.disabled) return
    beginEdit()
    if (endpoint === 'start') draftStart.value = point
    else draftEnd.value = point
    draftPreset.value = 'Custom range'
    touched.value = true
  }

  function activateEndpoint (endpoint: 'start' | 'end'): void {
    activeEndpoint.value = endpoint
    explicitEndpoint = true
  }

  function normalizeDraft (): 'start' | 'end' {
    let edited = activeEndpoint.value
    if (!draftError.value && Date.parse(pointToUtc(draftStart.value, draftOffset.value, hourFormat)) > Date.parse(pointToUtc(draftEnd.value, draftOffset.value, hourFormat))) {
      [draftStart.value, draftEnd.value] = [draftEnd.value, draftStart.value]
      edited = edited === 'start' ? 'end' : 'start'
    }
    return edited
  }

  async function selectDate (date: string): Promise<void> {
    if (props.disabled) return
    if (draftStart.value.date && draftEnd.value.date && !explicitEndpoint) {
      draftStart.value = emptyTimePoint(false, hourFormat)
      draftEnd.value = emptyTimePoint(true, hourFormat)
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
    beginEdit()
    draftPreset.value = preset
    const range = quickRecordRange(preset, draftOffset.value)
    if (range) {
      draftStart.value = pointFromUtc(range.start, draftOffset.value, hourFormat)
      draftEnd.value = pointFromUtc(range.end, draftOffset.value, hourFormat)
    }
    touched.value = false
    explicitEndpoint = false
  }

  function changeOffset (offset: number): void {
    if (props.disabled || !validOffset(offset)) return
    beginEdit()
    const start = validInstant(draftStart.value)
    const end = validInstant(draftEnd.value)
    draftOffset.value = offset
    if (['Today', 'Yesterday', 'This month', 'Last month'].includes(draftPreset.value)) {
      selectPreset(draftPreset.value)
    } else {
      if (start) draftStart.value = pointFromUtc(start, offset, hourFormat)
      if (end) draftEnd.value = pointFromUtc(end, offset, hourFormat)
    }
  }

  function validInstant (point: TimePoint): string | null {
    try {
      return pointToUtc(point, draftOffset.value, hourFormat)
    } catch {
      return null
    }
  }

  function apply (): void {
    touched.value = true
    if (props.disabled || !draftRange.value) return
    const range = draftRange.value
    saveRange(range)
    cancelSnapshot = null
    draftStart.value = pointFromUtc(range.start, appliedOffset.value, hourFormat)
    draftEnd.value = pointFromUtc(range.end, appliedOffset.value, hourFormat)
    editing.value = false
    touched.value = false
    explicitEndpoint = false
    activeEndpoint.value = 'end'
  }

  function saveRange (range: RecordRange): void {
    appliedOffset.value = draftOffset.value
    appliedPreset.value = draftPreset.value
    lastAppliedKey = JSON.stringify([range.start, range.end])
    if (lastAppliedKey !== JSON.stringify([props.startValue, props.endValue])) emit('update-range', range)
  }

  function cancel (): void {
    const snapshot = cancelSnapshot
    cancelSnapshot = null
    if (!snapshot) {
      loadDraft()
      return
    }
    appliedOffset.value = snapshot.offset
    appliedPreset.value = snapshot.preset
    lastAppliedKey = JSON.stringify([snapshot.range.start, snapshot.range.end])
    emit('update-range', snapshot.range)
    loadDraft(snapshot.range)
  }

  function clearDraft (): void {
    if (props.disabled) return
    beginEdit()
    draftStart.value = emptyTimePoint(false, hourFormat)
    draftEnd.value = emptyTimePoint(true, hourFormat)
    draftPreset.value = 'Custom range'
    activeEndpoint.value = 'start'
    explicitEndpoint = false
    touched.value = false
  }
</script>

<style scoped>
.read-records-range { --range-accent: rgb(var(--v-theme-primary)); --range-endpoint: rgb(var(--v-theme-primary)); --range-tint: rgba(var(--v-theme-primary), 0.12); --range-soft: var(--range-tint); --range-border: rgba(var(--v-border-color), var(--v-border-opacity)); border: 1px solid var(--range-border); border-radius: 4px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); padding: 14px 18px; margin-bottom: 16px; }
.range-summary-label { font-size: 14px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.62); margin-bottom: 7px; }
.range-summary-line { display: flex; align-items: center; flex-wrap: wrap; gap: 18px; margin-bottom: 12px; }
.range-summary-value { flex: 1 1 350px; min-width: 0; font-size: 15px; }
.range-summary-arrow { display: inline-block; padding: 0 10px; vertical-align: middle; }
.range-summary-offset { font-size: 14px; color: rgba(var(--v-theme-on-surface), 0.62); white-space: nowrap; }
.range-summary-badge { background: var(--range-soft); color: var(--range-accent); font-size: 14px; font-weight: 600; padding: 7px 14px; border-radius: 4px; white-space: nowrap; }
.read-records-picker { border: 1px solid var(--range-border); border-radius: 6px; width: 100%; max-width: 760px; }
.range-picker-header { padding: 22px 26px 18px; border-bottom: 1px solid var(--range-border); }
.range-picker-title { font-size: 24px; line-height: 1.4; font-weight: 700; }
.range-picker-subtitle { margin-top: 4px; font-size: 15px; color: rgba(var(--v-theme-on-surface), 0.62); }
.range-picker-footer { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-top: 1px solid var(--range-border); }
.range-picker-footer :deep(.v-btn) { text-transform: none; letter-spacing: normal; border-radius: 4px; }
.range-footer-summary { flex: 1; min-width: 0; font-size: 13px; color: rgba(var(--v-theme-on-surface), 0.62); }
.range-clear { padding: 0 12px; }
.range-cancel { border: 1px solid var(--range-border); background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); min-width: 104px; padding: 0 20px; }
.range-apply { min-width: 144px; padding: 0 20px; }
@media (max-width: 600px) {
  .read-records-range { padding: 12px; }
  .range-summary-value { flex-basis: 100%; font-size: 13px; }
  .range-picker-header { padding: 16px; }
  .range-picker-title { font-size: 21px; }
  .range-picker-footer { padding: 12px; gap: 6px; flex-wrap: wrap; }
  .range-footer-summary { flex-basis: calc(100% - 140px); }
}
</style>
