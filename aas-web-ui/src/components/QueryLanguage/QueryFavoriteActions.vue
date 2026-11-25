<template>
  <div>
    <div class="text-body-2 font-weight-medium mb-2">Saved query</div>

    <v-row align="center" class="ga-3" no-gutters>
      <v-col cols="12" md="5">
        <v-text-field
          aria-label="Favorite name"
          autofocus
          density="compact"
          :disabled="saving"
          hide-details
          :model-value="favoriteName || null"
          placeholder="Enter a favorite name…"
          prepend-inner-icon="mdi-star-outline"
          variant="outlined"
          @keydown.enter.prevent="save(favoriteName, favorite?.id)"
          @update:model-value="emit('update:name', $event ?? '')"
        />
      </v-col>

      <v-col cols="auto">
        <div class="d-flex flex-wrap ga-3">
          <v-btn
            v-if="favorite"
            border
            class="text-body-1 font-weight-medium"
            color="card"
            :disabled="!query || !favoriteName.trim() || saving"
            height="44"
            :loading="savingAction === 'update'"
            rounded="sm"
            text="Update favorite"
            variant="flat"
            width="168"
            @click="save(favoriteName, favorite.id)"
          />

          <v-btn
            border
            class="text-body-1 font-weight-medium"
            color="card"
            :disabled="!query || !favoriteName.trim() || saving"
            height="44"
            :loading="savingAction === 'new'"
            rounded="sm"
            :text="favorite ? 'Save as new favorite' : 'Save as favorite'"
            variant="flat"
            width="208"
            @click="save(favoriteName)"
          />
        </div>
      </v-col>
    </v-row>

    <v-alert
      v-if="error"
      class="mt-2"
      density="compact"
      role="alert"
      type="error"
      variant="tonal"
    >
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
  import type { QueryFavorite, QueryLanguageQuery } from '@/types/QueryLanguage'
  import { useNavigationStore } from '@/store/NavigationStore'
  import { useQueryFavoritesStore } from '@/store/QueryFavoritesStore'

  const props = defineProps<{
    query?: QueryLanguageQuery
    target: QueryFavorite['target']
    favoriteId?: string
    name?: string
    active?: boolean
  }>()
  const emit = defineEmits<{
    'saved': [id: string, name: string]
    'update:name': [name: string]
  }>()

  const favoritesStore = useQueryFavoritesStore()
  const navigationStore = useNavigationStore()
  const savingAction = ref<'update' | 'new'>()
  const error = ref('')

  const saving = computed(() => savingAction.value !== undefined)
  const favorite = computed(() => favoritesStore.favorites.find(item =>
    item.id === props.favoriteId && item.target === props.target,
  ))
  const favoriteName = computed(() => props.name ?? favorite.value?.name ?? '')

  watch([() => props.active, () => props.favoriteId, () => props.name], () => {
    error.value = ''
  })

  async function save (name: string, id?: string): Promise<void> {
    if (!props.query || !name.trim() || saving.value) return
    const savedName = name.trim()
    error.value = ''
    savingAction.value = id ? 'update' : 'new'
    try {
      const savedId = await favoritesStore.save(savedName, props.target, props.query, id)
      emit('saved', savedId, savedName)
      navigationStore.dispatchSnackbar({ status: true, color: 'success', text: `Query favorite "${savedName}" saved.` })
    } catch (error_) {
      error.value = error_ instanceof Error ? error_.message : 'The query favorite could not be saved.'
    } finally {
      savingAction.value = undefined
    }
  }
</script>
