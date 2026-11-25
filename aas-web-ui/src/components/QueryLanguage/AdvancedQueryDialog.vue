<template>
  <v-dialog
    v-model="dialogOpen"
    :fullscreen="mobile"
    :max-width="mobile ? undefined : '1100px'"
    persistent
    :scrollable="!mobile"
  >
    <v-sheet
      border
      class="d-flex flex-column"
      :rounded="mobile ? undefined : 'lg'"
      :style="mobile ? { height: '100svh' } : undefined"
    >
      <v-card-title class="bg-cardHeader">{{ title }}</v-card-title>
      <v-divider />

      <v-card-text
        class="overflow-y-auto"
        :style="mobile ? { flex: '1 1 auto', minHeight: '0' } : { maxHeight: 'calc(100svh - 180px)' }"
      >
        <v-alert
          class="mb-4"
          density="compact"
          icon="mdi-server"
          type="info"
          variant="tonal"
        >
          <div class="font-weight-medium">{{ targetLabel }}</div>
          <div class="text-caption text-break">{{ endpoint }}</div>
        </v-alert>

        <QueryFavoriteActions
          v-if="favoritesEnabled && target !== 'submodel-repository'"
          :active="dialogOpen"
          class="mb-8"
          :favorite-id="favoriteId"
          :name="favoriteName"
          :query="schemaValidation.isValid && contextValidation.isValid ? contextValidation.query : undefined"
          :target="target"
          @saved="handleFavoriteSaved"
          @update:name="favoriteName = $event"
        />

        <v-alert
          v-if="executionEnabled === false"
          class="mb-4"
          density="compact"
          type="info"
          variant="tonal"
        >
          Querying is unavailable for this target on the selected infrastructure.
        </v-alert>

        <v-alert
          v-if="schemaValidation.isValid && !contextValidation.isValid"
          class="mb-4"
          density="compact"
          role="alert"
          type="error"
          variant="tonal"
        >
          {{ contextValidation.message }}
        </v-alert>

        <QueryLanguageEditor
          v-model="queryText"
          :height="mobile ? 'calc(100svh - 310px)' : 'min(55vh, 520px)'"
          @validation-change="schemaValidation = $event"
        />
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn
          border
          color="surface-light"
          prepend-icon="mdi-restore"
          rounded="lg"
          text="Reset example"
          variant="flat"
          @click="emit('reset')"
        />

        <v-spacer />
        <v-btn rounded="lg" text="Cancel" @click="dialogOpen = false" />

        <v-btn
          class="text-buttonText"
          color="primary"
          :disabled="!canExecute"
          :loading="loading"
          rounded="lg"
          text="Run query"
          variant="flat"
          @click="execute"
        />
      </v-card-actions>
    </v-sheet>
  </v-dialog>
</template>

<script setup lang="ts">
  import type { QueryLanguageValidation } from '@/pages/modules/queryLanguage/queryLanguageValidation'
  import type { InfrastructureTemplate } from '@/types/Infrastructure'
  import type { QueryLanguageQuery, QueryTarget } from '@/types/QueryLanguage'
  import { buildQueryEndpoint, validateQueryForTarget } from '@/utils/QueryLanguageUtils'

  const props = defineProps<{
    endpoint: string
    loading: boolean
    mobile: boolean
    query: string
    infrastructureTemplate: InfrastructureTemplate
    target: QueryTarget
    title: string
    favoritesEnabled?: boolean
    favoriteId?: string
    executionEnabled?: boolean
  }>()

  const emit = defineEmits<{
    'execute': [query: QueryLanguageQuery]
    'reset': []
    'update:query': [query: string]
    'update:favorite-id': [id: string]
  }>()

  const dialogOpen = defineModel<boolean>({ required: true })
  const favoriteName = defineModel<string>('favoriteName', { default: '' })
  const schemaValidation = ref<QueryLanguageValidation>({ isValid: false, messages: [] })

  const queryText = computed({
    get: () => props.query,
    set: value => emit('update:query', value),
  })
  const contextValidation = computed(() => validateQueryForTarget(
    props.query,
    props.target,
    props.infrastructureTemplate,
  ))
  const canExecute = computed(() => props.executionEnabled !== false && schemaValidation.value.isValid && contextValidation.value.isValid && !props.loading)
  const targetLabel = computed(() => {
    if (props.target === 'aas-registry') return 'AAS Registry'
    if (props.target === 'aas-repository') return 'AAS Repository'
    return 'Submodel Repository'
  })
  const endpoint = computed(() => buildQueryEndpoint(props.endpoint, props.target))

  function handleFavoriteSaved (id: string, name: string): void {
    favoriteName.value = name
    emit('update:favorite-id', id)
  }

  function execute (): void {
    if (!canExecute.value || !contextValidation.value.query) return
    emit('execute', contextValidation.value.query)
  }
</script>
