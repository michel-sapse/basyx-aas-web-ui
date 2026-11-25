<template>
  <v-list-subheader>Favorites</v-list-subheader>

  <v-alert
    v-if="favoritesStore.loadError"
    class="ma-2"
    density="compact"
    role="alert"
    type="error"
    variant="tonal"
  >
    {{ favoritesStore.loadError }}
  </v-alert>

  <v-list-item v-if="entries.length === 0" disabled title="No saved query favorites" />

  <v-list-item
    v-for="entry in entries"
    :key="entry.favorite.id"
    :aria-label="`Run ${entry.favorite.name}`"
    :link="!entry.reason"
    prepend-icon="mdi-star-outline"
    :subtitle="entry.reason || entry.targetLabel"
    @click="select(entry.favorite, entry.reason)"
  >
    <template #title>
      <span :class="entry.reason ? 'text-disabled' : undefined">{{ entry.favorite.name }}</span>
    </template>

    <template #append>
      <v-btn-group size="small" variant="text">
        <v-tooltip open-delay="600" text="Edit favorite">
          <template #activator="{ props: tooltipProps }">
            <v-btn v-bind="tooltipProps" :aria-label="`Edit ${entry.favorite.name}`" icon="mdi-pencil-outline" @click.stop="emit('edit', entry.favorite)" />
          </template>
        </v-tooltip>

        <v-tooltip open-delay="600" text="Delete favorite">
          <template #activator="{ props: tooltipProps }">
            <v-btn v-bind="tooltipProps" :aria-label="`Delete ${entry.favorite.name}`" icon="mdi-delete-outline" @click.stop="openDelete(entry.favorite)" />
          </template>
        </v-tooltip>
      </v-btn-group>
    </template>
  </v-list-item>

  <v-dialog max-width="420" :model-value="!!deleteFavorite" @update:model-value="updateDeleteDialog">
    <v-card title="Delete query favorite">
      <v-card-text>
        Delete "{{ deleteFavorite?.name }}"?
        <v-alert
          v-if="deleteError"
          class="mt-2"
          density="compact"
          role="alert"
          type="error"
          variant="tonal"
        >
          {{ deleteError }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn text="Cancel" @click="deleteFavorite = undefined" />
        <v-btn color="error" text="Delete" variant="flat" @click="remove" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
  import type { InfrastructureTemplate } from '@/types/Infrastructure'
  import type { QueryFavorite, QueryTarget } from '@/types/QueryLanguage'
  import { useQueryFavoritesStore } from '@/store/QueryFavoritesStore'
  import { validateQueryForTarget } from '@/utils/QueryLanguageUtils'

  const props = defineProps<{
    availableTargets: QueryTarget[]
    infrastructureTemplate: InfrastructureTemplate
  }>()
  const emit = defineEmits<{
    select: [favorite: QueryFavorite]
    edit: [favorite: QueryFavorite]
  }>()

  const favoritesStore = useQueryFavoritesStore()
  const deleteFavorite = ref<QueryFavorite>()
  const deleteError = ref('')

  const validatedFavorites = computed(() => favoritesStore.favorites.map(favorite => {
    const targetLabel = favorite.target === 'aas-registry' ? 'AAS Registry' : 'AAS Repository'
    const validation = validateQueryForTarget(JSON.stringify(favorite.query), favorite.target, props.infrastructureTemplate)
    return { favorite, targetLabel, validationMessage: validation.message }
  }))
  const entries = computed(() => validatedFavorites.value.map(({ favorite, targetLabel, validationMessage }) => {
    const reason = props.availableTargets.includes(favorite.target)
      ? validationMessage
      : `${targetLabel} querying is unavailable for this infrastructure.`
    return { favorite, reason, targetLabel }
  }))

  function select (favorite: QueryFavorite, reason: string): void {
    if (!reason) emit('select', favorite)
  }

  function openDelete (favorite: QueryFavorite): void {
    deleteError.value = ''
    deleteFavorite.value = favorite
  }

  function updateDeleteDialog (open: boolean): void {
    if (!open) deleteFavorite.value = undefined
  }

  function remove (): void {
    if (!deleteFavorite.value) return
    deleteError.value = ''
    try {
      favoritesStore.remove(deleteFavorite.value.id)
      deleteFavorite.value = undefined
    } catch (error_) {
      deleteError.value = error_ instanceof Error ? error_.message : 'The query favorite could not be deleted.'
    }
  }
</script>
