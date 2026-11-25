<template>
  <v-container class="pa-0" fluid>
    <v-list-item class="px-1 pb-1 pt-0">
      <v-list-item-title class="text-title-small mt-2">{{ 'Range: ' }}</v-list-item-title>
    </v-list-item>

    <TimespanRangeInput v-if="isTimespanRange(rangeObject)" :is-editable="false" :range-object="rangeObject" />
    <div v-if="isTimespanRange(rangeObject)" class="text-body-small mt-2">Select the ReadRecords operation to choose a timespan and execute it.</div>

    <v-card v-else-if="rangeObject" class="pt-10 pb-5 px-3" color="elevatedCard">
      <v-range-slider
        v-model="range"
        class="align-center"
        color="primary"
        hide-details
        :max="max"
        :min="min"
        readonly
        thumb-label="always"
      >
        <template #thumb-label="{ modelValue }">
          <span style="white-space: nowrap">{{ modelValue + ' ' + unitSuffix(rangeObject) }}</span>
        </template>
      </v-range-slider>
    </v-card>
  </v-container>
</template>

<script lang="ts" setup>
  import { isTimespanRange } from '@/components/Plugins/Submodels/TimeSeries/timespan'
  import { useConceptDescriptionHandling } from '@/composables/AAS/ConceptDescriptionHandling'

  const props = defineProps({
    rangeObject: {
      type: Object,
      default: () => ({}),
    },
  })

  // Composables
  const { unitSuffix } = useConceptDescriptionHandling()

  // Returns the range as an Array [min, max]
  const range = computed(() => {
    if (props.rangeObject) {
      return [Number.parseInt(props.rangeObject.min), Number.parseInt(props.rangeObject.max)]
    }
    return [0, 0]
  })

  // Returns the min value - 10% of the range
  const min = computed(() => {
    if (props.rangeObject) {
      return (
        Number.parseInt(props.rangeObject.min)
        - (Number.parseInt(props.rangeObject.max) - Number.parseInt(props.rangeObject.min)) * 0.1
      )
    }
    return 0
  })

  // Returns the max value + 10% of the range
  const max = computed(() => {
    if (props.rangeObject) {
      return (
        Number.parseInt(props.rangeObject.max)
        + (Number.parseInt(props.rangeObject.max) - Number.parseInt(props.rangeObject.min)) * 0.1
      )
    }
    return 0
  })
</script>
