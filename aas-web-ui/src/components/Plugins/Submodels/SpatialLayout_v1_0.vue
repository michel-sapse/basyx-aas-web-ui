<template>
  <v-container class="pa-0" fluid>
    <v-card border elevation="0">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <v-icon color="primary" icon="mdi-cube-scan" />Spatial layout
        <v-spacer />
        <v-chip v-if="unsavedCount" color="warning" label size="small">{{ unsavedCount }} unsaved</v-chip>

        <v-btn
          aria-label="Refresh spatial data"
          :disabled="loading"
          icon="mdi-refresh"
          size="small"
          variant="text"
          @click="load(true)"
        ><v-tooltip activator="parent" open-delay="600">Refresh data and retain drafts</v-tooltip></v-btn>
      </v-card-title>

      <v-card-text>
        <v-alert
          v-if="error"
          class="mb-4"
          density="compact"
          role="alert"
          type="error"
          variant="tonal"
        >{{ error }}</v-alert>

        <v-progress-linear v-if="loading" class="mb-3" color="primary" indeterminate />

        <template v-if="layout && selected">
          <div class="d-flex flex-wrap ga-3 align-center mb-4">
            <v-select
              aria-label="Select spatial asset"
              class="asset-select"
              density="compact"
              hide-details
              :items="assetOptions"
              :model-value="selectedId"
              variant="outlined"
              @update:model-value="selectedId = String($event)"
            />

            <span class="text-body-small text-medium-emphasis">{{ layout.frame.name }} · Up {{ layout.frame.upDirection }} · Forward {{ layout.frame.forwardDirection }}</span>
          </div>

          <div class="spatial-layout-panels">
            <SpatialLayoutViewer
              :key="layout.id"
              :drafts="previewDrafts"
              :editable="editable"
              :layout="layout"
              :selected-id="selectedId"
              @move="move"
              @select="selectedId = $event"
            />

            <SpatialPositionEditor
              :asset="selected"
              :dirty="dirty(selected)"
              :editable="editable"
              :errors="coordinateErrors"
              :frame="layout.frame"
              :position="currentText"
              :saving="saving"
              @cancel="cancel"
              @edit="edit"
              @save="save"
              @target="previewTarget"
            />
          </div>

          <div class="text-body-small text-medium-emphasis mt-3">{{ layout.area ? layout.area.name + ' · ' + layout.area.type + '. ' : '' }}The outline shows the area polygon. Assets without declared geometry use point markers; demo volumes are schematic. Edit coordinates or drag an axis, then Save. Focus selection to inspect small offsets.</div>

          <v-alert
            v-for="warning in layout.warnings"
            :key="warning"
            class="mt-3"
            density="compact"
            type="warning"
            variant="tonal"
          >{{ warning }}</v-alert>

          <v-alert
            v-if="!envStore.getAllowEditing || isEditable === false"
            class="mt-3"
            density="compact"
            type="info"
            variant="tonal"
          >Coordinate editing is disabled in this view.</v-alert>
        </template>

        <v-alert v-else-if="!loading && !error" type="info" variant="tonal">No spatial layout data available.</v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script lang="ts" setup>
  import { jsonization } from '@aas-core-works/aas-core3.1-typescript'
  import { useSMRepositoryClient } from '@/composables/Client/SMRepositoryClient'
  import { useEnvStore } from '@/store/EnvironmentStore'
  import { coordinateNumber, parseSpatialLayout, positionText, samePosition } from './SpatialLayout/parse'
  import { savePlacement } from './SpatialLayout/save'
  import { type AasElement, AXES, type Axis, type Placement, type Position, type PositionDrafts, type PositionText, type SpatialLayout } from './SpatialLayout/types'

  defineOptions({ name: 'SpatialLayout', semanticId: 'urn:apeirora.eu:idcm:cd:assetPositionalData:Submodel' })
  const props = withDefaults(defineProps<{ submodelElementData?: AasElement, isEditable?: boolean }>(), { isEditable: undefined })
  const envStore = useEnvStore()
  const { fetchSm, putSubmodelElement } = useSMRepositoryClient()
  const layout = ref<SpatialLayout | null>(null)
  const selectedId = ref('')
  const texts = ref<Record<string, PositionText>>({})
  const previewDrafts = ref<PositionDrafts>({})
  const baselines = ref<Record<string, Placement>>({})
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  let generation = 0
  const selected = computed(() => layout.value?.assets.find(asset => asset.id === selectedId.value))
  const currentText = computed(() => selected.value ? texts.value[selected.value.id] ?? positionText(selected.value.position) : { x: '', y: '', z: '' })
  const coordinateErrors = computed(() => ({ x: coordinateNumber(currentText.value.x) === null, y: coordinateNumber(currentText.value.y) === null, z: coordinateNumber(currentText.value.z) === null }))
  const editable = computed(() => envStore.getAllowEditing && props.isEditable !== false && !loading.value && Boolean(selected.value?.positionPath))
  const assetOptions = computed(() => layout.value?.assets.map(asset => ({ title: asset.name, value: asset.id })) ?? [])
  const unsavedCount = computed(() => layout.value?.assets.filter(asset => dirty(asset)).length ?? 0)

  watch(() => [props.submodelElementData?.id, props.submodelElementData?.path], () => load(false))
  onMounted(() => load(false))
  onBeforeUnmount(() => {
    generation++
  })

  function parsedText (text: PositionText): Position | null {
    const x = coordinateNumber(text.x)
    const y = coordinateNumber(text.y)
    const z = coordinateNumber(text.z)
    return x === null || y === null || z === null ? null : { x, y, z }
  }
  function dirty (asset: Placement): boolean {
    const text = texts.value[asset.id]
    if (!text) return false
    const position = parsedText(text)
    return !position || !samePosition(position, asset.position)
  }
  async function load (retainDrafts: boolean): Promise<void> {
    const current = ++generation
    loading.value = true
    saving.value = false
    error.value = ''
    if (!retainDrafts) {
      layout.value = null
      texts.value = {}
      previewDrafts.value = {}
      baselines.value = {}
    }
    try {
      const source = props.submodelElementData
      if (!source) {
        layout.value = null
        return
      }
      const data = source.path ? await fetchSm(source.path) : source
      const next = parseSpatialLayout(data, source.path || '')
      if (current !== generation) return
      if (retainDrafts && unsavedCount.value && layout.value && JSON.stringify(next.frame) !== JSON.stringify(layout.value.frame)) throw new Error('The coordinate system changed. Cancel existing drafts before refreshing into the new frame.')
      layout.value = next
      if (retainDrafts) baselines.value = Object.fromEntries(next.assets.filter(asset => texts.value[asset.id]).map(asset => [asset.id, asset]))
      if (!next.assets.some(asset => asset.id === selectedId.value)) selectedId.value = (next.assets.find(asset => asset.reference && !samePosition(asset.position, asset.reference)) ?? next.assets[0])!.id
    } catch (error_) {
      if (current === generation) error.value = error_ instanceof Error ? error_.message : 'Loading spatial data failed.'
    } finally {
      if (current === generation) loading.value = false
    }
  }
  function edit (axis: Axis, value: string): void {
    if (!selected.value || !editable.value) return
    const id = selected.value.id
    const text = { ...currentText.value, [axis]: value }
    const position = parsedText(text)
    if (position && samePosition(position, selected.value.position)) {
      cancel()
      return
    }
    baselines.value[id] ??= selected.value
    texts.value = { ...texts.value, [id]: text }
    if (position) previewDrafts.value = { ...previewDrafts.value, [id]: position }
  }
  function move (id: string, position: Position): void {
    if (!editable.value || !layout.value) return
    const asset = layout.value.assets.find(candidate => candidate.id === id)
    if (!asset || AXES.some(axis => !Number.isFinite(position[axis]))) return
    selectedId.value = id
    if (samePosition(position, asset.position)) {
      cancel()
      return
    }
    baselines.value[id] ??= asset
    const original = asset.position
    const precise = { ...position }
    for (const axis of AXES) precise[axis] = Math.abs(position[axis] - original[axis]) < 1e-8 ? original[axis] : Number(position[axis].toPrecision(12))
    texts.value = { ...texts.value, [id]: positionText(precise) }
    previewDrafts.value = { ...previewDrafts.value, [id]: precise }
  }
  function previewTarget (): void {
    if (selected.value?.reference) move(selected.value.id, selected.value.reference)
  }
  function cancel (): void {
    delete texts.value[selectedId.value]
    delete previewDrafts.value[selectedId.value]
    delete baselines.value[selectedId.value]
    error.value = ''
  }
  async function save (): Promise<void> {
    const position = parsedText(currentText.value)
    const currentLayout = layout.value
    const id = selectedId.value
    if (!position || !currentLayout || !selected.value || !dirty(selected.value) || !editable.value) return
    // Compare the selected draft against the snapshot from its first edit.
    const original = { ...currentLayout, assets: currentLayout.assets.map(asset => asset.id === id ? baselines.value[id] ?? asset : asset) }
    const current = generation
    loading.value = true
    saving.value = true
    error.value = ''
    try {
      const confirmed = await savePlacement(original, id, position, {
        read: () => fetchSm(original.path),
        write: (element, path) => putSubmodelElement(jsonization.submodelElementFromJsonable(element).mustValue(), path),
      })
      if (current !== generation) return
      layout.value = confirmed
      delete texts.value[id]
      delete previewDrafts.value[id]
      delete baselines.value[id]
    } catch (error_) {
      if (current === generation) error.value = error_ instanceof Error ? error_.message : 'Saving failed. Your draft has been retained.'
    } finally {
      if (current === generation) {
        loading.value = false
        saving.value = false
      }
    }
  }
</script>

<style scoped>
.spatial-layout-panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 340px); gap: 16px; align-items: start; }
.asset-select { max-width: 380px; }
@media (max-width: 900px) { .spatial-layout-panels { grid-template-columns: minmax(0, 1fr); } }
</style>
