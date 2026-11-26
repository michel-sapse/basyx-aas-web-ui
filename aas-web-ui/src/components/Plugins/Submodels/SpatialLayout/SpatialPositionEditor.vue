<template>
  <v-card border elevation="0" rounded="lg">
    <v-card-text>
      <div class="text-title-medium mb-1">{{ asset.name }}</div>
      <div class="text-body-small text-medium-emphasis mb-3">Coordinates in {{ frame.name }}, before the shared PositionsOffset.</div>
      <div class="text-body-small text-break mb-4">Asset AAS: {{ asset.aasId }}</div>

      <div class="coordinate-fields">
        <v-text-field
          v-for="axis in AXES"
          :key="axis"
          :aria-label="axis.toUpperCase() + ' coordinate'"
          density="compact"
          :error-messages="errors[axis] ? ['Enter a finite number.'] : []"
          inputmode="decimal"
          :label="axis.toUpperCase() + ' (' + frame.units[axis].name + ')'"
          :model-value="position[axis]"
          :readonly="!editable"
          type="text"
          variant="outlined"
          @update:model-value="emit('edit', axis, String($event ?? ''))"
        />
      </div>

      <v-alert
        v-if="invalid"
        class="mb-3"
        density="compact"
        type="warning"
        variant="tonal"
      >The preview shows the last valid coordinates. Correct the inputs before saving.</v-alert>

      <div v-if="asset.reference" class="reference-panel mb-3">
        <div class="text-body-small font-weight-medium">Known mounting target</div>
        <div class="text-body-small">{{ AXES.map(axis => axis.toUpperCase() + ' ' + asset.reference![axis] + ' ' + frame.units[axis].name).join(' · ') }}</div>
        <div v-if="delta" aria-live="polite" class="text-body-small mt-1">Offset: {{ delta }}</div>

        <v-btn
          class="mt-2"
          color="primary"
          :disabled="!editable"
          size="small"
          variant="text"
          @click="emit('target')"
        >Preview target position</v-btn>
      </div>

      <div v-else class="text-body-small text-medium-emphasis mb-3">No mounting target defined. Use known reference geometry to judge placement.</div>
      <div class="text-body-small text-medium-emphasis mb-3">Shared offset: X {{ frame.offset.x }} · Y {{ frame.offset.y }} · Z {{ frame.offset.z }} (axis units). It remains unchanged when saving.</div>
      <div class="text-body-small text-medium-emphasis mb-4">Orientation: yaw {{ asset.rotation.yaw }}, pitch {{ asset.rotation.pitch }}, roll {{ asset.rotation.roll }} {{ frame.angleUnit.name }} ({{ frame.rotationOrder }}). Orientation is read-only.</div>

      <div class="d-flex ga-2">
        <v-btn
          class="flex-grow-1"
          color="primary"
          :disabled="!editable || !dirty || invalid"
          :loading="saving"
          variant="flat"
          @click="emit('save')"
        >Save coordinates</v-btn>

        <v-btn :disabled="saving || !dirty" variant="outlined" @click="emit('cancel')">Cancel</v-btn>
      </div>

      <div aria-live="polite" class="text-body-small text-medium-emphasis mt-3">{{ dirty ? 'Unsaved preview. Stored coordinates have not been changed.' : 'Showing stored coordinates.' }}</div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { AXES, type Axis, type CoordinateFrame, type Placement, type PositionText } from './types'
  const props = defineProps<{ asset: Placement, position: PositionText, frame: CoordinateFrame, editable: boolean, saving: boolean, dirty: boolean, errors: Record<Axis, boolean> }>()
  const emit = defineEmits<{ edit: [axis: Axis, value: string], target: [], save: [], cancel: [] }>()
  const invalid = computed(() => AXES.some(axis => props.errors[axis]))
  const delta = computed(() => {
    if (invalid.value || !props.asset.reference) return ''
    return AXES.map(axis => axis.toUpperCase() + ' ' + Number((Number(props.position[axis]) - props.asset.reference![axis]).toFixed(8)) + ' ' + props.frame.units[axis].name).join(' · ')
  })
</script>

<style scoped>
.coordinate-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.reference-panel { padding: 12px; border-radius: 6px; background: rgba(var(--v-theme-primary), 0.07); }
</style>
