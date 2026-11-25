<template>
  <div class="range-time-control" :class="{ 'range-time-invalid': !valid }">
    <v-menu v-model="open" :close-on-content-click="false" location="bottom start" @after-enter="scrollToSelection">
      <template #activator="{ props: menuProps }">
        <input
          ref="input"
          :aria-controls="open ? id : undefined"
          :aria-describedby="descriptionId"
          :aria-expanded="open"
          aria-haspopup="listbox"
          :aria-invalid="!valid"
          :aria-label="label"
          :disabled="disabled"
          :inputmode="numeric ? 'numeric' : 'text'"
          :maxlength="digits"
          role="combobox"
          type="text"
          :value="modelValue"
          @blur="normalizeInput"
          @focus="selectText"
          @input="typeValue"
          @keydown.stop="onKeydown"
          @wheel.prevent="onWheel"
        >

        <button
          :aria-label="`Choose ${label.toLowerCase()}`"
          class="range-time-chevron"
          :disabled="disabled"
          type="button"
          v-bind="menuProps"
        >
          <v-icon icon="mdi-chevron-down" size="16" />
        </button>
      </template>

      <div :id="id" :aria-label="label" class="range-time-options" role="listbox">
        <v-virtual-scroll ref="scroller" height="200" item-height="32" :items="options">
          <template #default="{ item }">
            <button
              :aria-selected="item === canonical"
              class="range-time-option"
              :class="{ selected: item === options[highlighted] }"
              role="option"
              type="button"
              @click="choose(item)"
              @keydown.stop="onKeydown"
            >{{ item }}</button>
          </template>
        </v-virtual-scroll>
      </div>
    </v-menu>
  </div>
</template>

<script lang="ts" setup>
  const props = withDefaults(defineProps<{ modelValue: string, label: string, descriptionId?: string, min?: number, max?: number, digits?: number, numeric?: boolean, disabled?: boolean }>(), { min: 0, max: 59, digits: 2, numeric: true })
  const emit = defineEmits<{ 'update:model-value': [value: string], 'advance': [], 'confirm': [], 'cancel': [] }>()

  const input = ref<HTMLInputElement | null>(null)
  const scroller = ref<{ scrollToIndex: (index: number) => void } | null>(null)
  const open = ref(false)
  const highlighted = ref(0)
  const id = useId()
  const options = computed(() => props.numeric
    ? Array.from({ length: props.max - props.min + 1 }, (_, index) => String(index + props.min).padStart(props.digits, '0'))
    : ['AM', 'PM'])
  const canonical = computed(() => props.numeric && /^\d+$/.test(props.modelValue) ? String(Number(props.modelValue)).padStart(props.digits, '0') : props.modelValue.toUpperCase())
  const valid = computed(() => options.value.includes(canonical.value))

  watch(open, value => {
    if (value) highlighted.value = Math.max(0, options.value.indexOf(canonical.value))
  })

  defineExpose({ focus: focusInput })

  function focusInput (): void {
    input.value?.focus({ preventScroll: true })
    input.value?.select()
  }

  function selectText (event: FocusEvent): void {
    ;(event.target as HTMLInputElement).select()
  }

  function typeValue (event: Event): void {
    const value = (event.target as HTMLInputElement).value
    emit('update:model-value', value)
    const candidate = props.numeric && /^\d+$/.test(value) ? String(Number(value)).padStart(props.digits, '0') : value.toUpperCase()
    if (value.length === props.digits && options.value.includes(candidate)) emit('advance')
  }

  function normalizeInput (): void {
    // Auto-advance can blur before Vue delivers the updated prop. Read the input
    // itself so a freshly typed component is never replaced by its old value.
    const value = input.value?.value ?? props.modelValue
    const normalized = props.numeric && /^\d+$/.test(value) ? String(Number(value)).padStart(props.digits, '0') : value.toUpperCase()
    if (options.value.includes(normalized) && normalized !== props.modelValue) emit('update:model-value', normalized)
  }

  function choose (value: string): void {
    emit('update:model-value', value)
    open.value = false
    focusInput()
  }

  function scrollToSelection (): void {
    scroller.value?.scrollToIndex(highlighted.value)
  }

  function onWheel (event: WheelEvent): void {
    if (props.disabled || !event.deltaY) return
    const index = Math.max(0, options.value.indexOf(canonical.value))
    emit('update:model-value', options.value[Math.max(0, Math.min(options.value.length - 1, index + Math.sign(event.deltaY)))]!)
  }

  function onKeydown (event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (open.value) choose(options.value[highlighted.value]!)
      else {
        normalizeInput()
        emit('confirm')
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (open.value) {
        highlighted.value = Math.max(0, Math.min(options.value.length - 1, highlighted.value + (event.key === 'ArrowDown' ? 1 : -1)))
      } else {
        open.value = true
      }
      nextTick(scrollToSelection)
    } else if (event.key === 'Escape' && open.value) {
      event.preventDefault()
      open.value = false
      focusInput()
    } else if (event.key === 'Escape') {
      emit('cancel')
    }
  }
</script>

<style scoped>
.range-time-control {
  display: flex;
  height: 36px;
  border: 1px solid var(--range-border, rgba(var(--v-theme-on-surface), 0.16));
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  min-width: 0;
}
.range-time-control:focus-within {
  border-color: var(--range-accent, rgb(var(--v-theme-primary)));
  box-shadow: 0 0 0 1px var(--range-accent, rgb(var(--v-theme-primary)));
}
.range-time-invalid { border-color: rgb(var(--v-theme-error)); }
.range-time-control input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--range-accent, rgb(var(--v-theme-primary)));
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: center;
  padding: 0 2px 0 8px;
}
.range-time-chevron { padding-right: 3px; color: rgba(var(--v-theme-on-surface), 0.6); }
.range-time-options { background: rgb(var(--v-theme-surface)); min-width: 72px; padding: 4px 0; }
.range-time-option { display: block; width: 100%; height: 32px; text-align: center; font-variant-numeric: tabular-nums; }
.range-time-option:hover, .range-time-option.selected { background: rgba(var(--v-theme-primary), 0.12); }
</style>
