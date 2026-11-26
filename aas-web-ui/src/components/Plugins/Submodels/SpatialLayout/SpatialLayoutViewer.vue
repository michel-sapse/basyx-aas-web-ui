<template>
  <v-sheet border class="spatial-viewer" rounded>
    <div ref="container" class="spatial-canvas" />

    <v-sheet class="spatial-toolbar" rounded>
      <v-btn-toggle
        border
        color="primary"
        density="compact"
        divided
        mandatory
        :model-value="view"
        variant="text"
      >
        <v-btn
          v-for="item in views"
          :key="item.value"
          :aria-label="item.label + ' view'"
          :aria-pressed="view === item.value"
          :disabled="!ready"
          :value="item.value"
          @click="setView(item.value)"
        >{{ item.label }}</v-btn>
      </v-btn-toggle>

      <v-btn
        aria-label="Focus selected asset"
        :disabled="!ready || !selectedId"
        size="small"
        variant="outlined"
        @click="session?.focusSelected()"
      >Focus selection</v-btn>

      <v-btn
        aria-label="Fit entire layout"
        :disabled="!ready"
        size="small"
        variant="text"
        @click="session?.fitLayout()"
      >Fit layout</v-btn>
    </v-sheet>

    <v-alert
      v-if="error"
      class="ma-3 spatial-error"
      density="compact"
      type="warning"
      variant="tonal"
    >{{ error }} Numeric coordinates remain available.</v-alert>

    <div v-if="!ready && !error" class="spatial-loading" role="status">Loading spatial preview…</div>

    <div class="spatial-legend">
      <span>Gray: saved outline</span><span>Green: mounting target</span><span>Orange: facing direction</span>
      <span>Grid {{ gridStep }} m · Up {{ layout.frame.upDirection }} · Forward {{ layout.frame.forwardDirection }}</span>
      <span>X: red · Y: green · Z: blue (data axes)</span>
    </div>
  </v-sheet>
</template>

<script lang="ts" setup>
  import type { createSpatialScene, SpatialView } from './scene'
  import type { Position, PositionDrafts, SpatialLayout } from './types'

  const props = defineProps<{ layout: SpatialLayout, drafts: PositionDrafts, selectedId: string, editable: boolean }>()
  const emit = defineEmits<{ select: [id: string], move: [id: string, position: Position] }>()
  const container = ref<HTMLElement | null>(null)
  const ready = ref(false)
  const error = ref('')
  const gridStep = ref(0)
  const view = ref<SpatialView>('isometric')
  const views = [{ value: 'isometric', label: '3D' }, { value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'top', label: 'Top' }] as const
  let session: ReturnType<typeof createSpatialScene> | undefined
  let unmounted = false

  watch(() => [props.layout, props.drafts, props.selectedId, props.editable], update, { deep: true })
  onMounted(async () => {
    try {
      const { createSpatialScene } = await import('./scene')
      if (unmounted || !container.value) return
      session = createSpatialScene(container.value, props.layout, { select: id => emit('select', id), move: (id, position) => emit('move', id, position), grid: step => {
        gridStep.value = step
      } })
      update()
      ready.value = true
    } catch (error_) {
      session?.dispose()
      session = undefined
      error.value = error_ instanceof Error ? error_.message : '3D preview unavailable.'
    }
  })
  onBeforeUnmount(() => {
    unmounted = true
    session?.dispose()
  })
  function update (): void {
    session?.update(props.layout, props.drafts, props.selectedId, props.editable)
  }
  function setView (next: SpatialView): void {
    view.value = next
    session?.setView(next)
  }
</script>

<style scoped>
.spatial-viewer { position: relative; overflow: hidden; background: rgb(var(--v-theme-surface)); }
.spatial-canvas { height: min(65svh, 540px); min-height: 340px; width: 100%; }
.spatial-canvas :deep(canvas) { display: block; touch-action: none; }
.spatial-toolbar { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 4px; }
.spatial-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 10px 14px; border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12); font-size: 12px; color: rgba(var(--v-theme-on-surface), 0.7); }
.spatial-error { position: absolute; top: 64px; left: 0; right: 0; }
.spatial-loading { position: absolute; top: 50%; width: 100%; text-align: center; }
</style>
