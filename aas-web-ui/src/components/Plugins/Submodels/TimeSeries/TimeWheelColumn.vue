<template>
  <div class="time-wheel-column">
    <div class="text-caption text-medium-emphasis text-center mb-2">{{ label }}</div>

    <div class="time-wheel-frame">
      <div aria-hidden="true" class="time-wheel-band" />

      <div
        ref="wheel"
        :aria-activedescendant="`${id}-${modelValue}`"
        :aria-label="label"
        class="time-wheel-list"
        role="listbox"
        tabindex="0"
        @keydown="onKeydown"
        @scroll="onScroll"
        @scrollend="commitScroll"
      >
        <div
          v-for="value in count"
          :id="`${id}-${value - 1}`"
          :key="value"
          :aria-selected="modelValue === value - 1"
          class="time-wheel-value"
          :class="{ 'time-wheel-selected': modelValue === value - 1 }"
          role="option"
          @click="select(value - 1)"
        >
          <input
            v-if="modelValue === value - 1"
            ref="textInputs"
            v-model="typedValue"
            :aria-invalid="typingError"
            :aria-label="`Type ${label.toLowerCase()}`"
            class="time-wheel-input"
            inputmode="numeric"
            maxlength="2"
            pattern="[0-9]*"
            type="text"
            @blur="commitTyping"
            @click.stop
            @focus="startTyping"
            @input="onTextInput"
            @keydown.stop="onInputKeydown"
          >

          <template v-else>{{ String(value - 1).padStart(2, '0') }}</template>
        </div>
      </div>
    </div>

    <div v-if="typingError" class="text-caption text-error text-center mt-1" role="alert">00–{{ String(count - 1).padStart(2, '0') }}</div>
  </div>
</template>

<script lang="ts" setup>
  const props = defineProps<{ modelValue: number, count: number, label: string, advanceOnComplete?: boolean }>()
  const emit = defineEmits<{ 'update:model-value': [value: number], 'validity': [valid: boolean], 'advance': [], 'confirm': [] }>()

  const id = useId()
  const wheel = ref<HTMLElement | null>(null)
  const textInputs = ref<HTMLInputElement[]>([])
  const typedValue = ref(String(props.modelValue).padStart(2, '0'))
  const typing = ref(false)
  let scrollTimer: ReturnType<typeof setTimeout> | undefined
  const rowHeight = 40
  const typingError = computed(() => typing.value && (!/^\d{1,2}$/.test(typedValue.value) || Number(typedValue.value) >= props.count))

  watch(() => props.modelValue, () => {
    if (!typing.value) typedValue.value = String(props.modelValue).padStart(2, '0')
    alignSelection()
  }, { flush: 'post' })
  watch(typingError, error => emit('validity', !error), { immediate: true })

  onMounted(alignSelection)
  onBeforeUnmount(() => clearTimeout(scrollTimer))

  defineExpose({ commitScroll, focusInput })

  function alignSelection (): void {
    if (wheel.value) wheel.value.scrollTop = props.modelValue * rowHeight
  }

  function select (value: number): void {
    emit('update:model-value', Math.max(0, Math.min(props.count - 1, value)))
  }

  function commitScroll (): boolean {
    clearTimeout(scrollTimer)
    if (typing.value) return commitTyping()
    if (wheel.value) select(Math.round(wheel.value.scrollTop / rowHeight))
    return true
  }

  function onScroll (): void {
    clearTimeout(scrollTimer)
    if (typing.value) {
      typing.value = false
      typedValue.value = String(props.modelValue).padStart(2, '0')
      textInputs.value[0]?.blur()
    }
    scrollTimer = setTimeout(commitScroll, 120)
  }

  function focusInput (): void {
    const input = textInputs.value[0]
    input?.focus({ preventScroll: true })
    input?.select()
  }

  function startTyping (event: FocusEvent): void {
    clearTimeout(scrollTimer)
    typing.value = true
    ;(event.target as HTMLInputElement).select()
  }

  function commitTyping (): boolean {
    if (!typing.value) return true
    if (typingError.value) return false
    const value = Number(typedValue.value)
    typing.value = false
    typedValue.value = String(value).padStart(2, '0')
    select(value)
    return true
  }

  function onInputKeydown (event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      emit('confirm')
    } else if (event.key === 'Escape') {
      event.preventDefault()
      typing.value = false
      typedValue.value = String(props.modelValue).padStart(2, '0')
      wheel.value?.focus()
    }
  }

  function onTextInput (): void {
    if (props.advanceOnComplete && typedValue.value.length === 2 && !typingError.value && commitTyping()) {
      emit('advance')
    }
  }

  function onKeydown (event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      emit('confirm')
      return
    }
    const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }
    if (event.key in offsets) {
      select(props.modelValue + offsets[event.key]!)
    } else if (event.key === 'Home' || event.key === 'End') {
      select(event.key === 'Home' ? 0 : props.count - 1)
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }
</script>

<style scoped>
.time-wheel-column {
  width: 88px;
}

.time-wheel-frame {
  height: 200px;
  position: relative;
}

.time-wheel-band {
  position: absolute;
  inset: 80px 0 auto;
  height: 40px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.12);
  pointer-events: none;
}

.time-wheel-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(var(--v-theme-surface), 1), rgba(var(--v-theme-surface), 0) 40%, rgba(var(--v-theme-surface), 0) 60%, rgba(var(--v-theme-surface), 1));
  pointer-events: none;
}

.time-wheel-list {
  height: 200px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  padding-block: 80px;
  box-sizing: border-box;
  border-radius: 8px;
}

.time-wheel-list::-webkit-scrollbar {
  display: none;
}

.time-wheel-list:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.time-wheel-value {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  scroll-snap-align: center;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.time-wheel-selected {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.time-wheel-input {
  width: 100%;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: center;
  padding: 0;
}

.time-wheel-input:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
</style>
